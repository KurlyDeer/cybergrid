import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
  scrypt,
} from "node:crypto";
import { access, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type {
  AdministrationProtocol,
  AssetInput,
  AssetMetadata,
  AssetRecord,
  ConnectionProtocol,
  DeviceIcon,
  DeviceOsFamily,
  ConnectionTaskInput,
  ConnectionTaskRecord,
  ExternalToolInput,
  ExternalToolRecord,
  FolderDefaultsInput,
  FolderDefaultsSummary,
  InventorySyncResult,
  InventorySyncSourceInput,
  InventorySyncSourceSummary,
  OpenPortInfo,
  ServerAuthType,
  ServerProfileInput,
  ServerProfileSummary,
  SerialParity,
  SnippetInput,
  SnippetLanguage,
  SnippetRecord,
  VaultStatus,
} from "../shared/ipc";

const VAULT_VERSION = 1 as const;
const PAYLOAD_VERSION = 1 as const;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const MAX_VAULT_BYTES = 10 * 1024 * 1024;
const SCRYPT_COST = 32_768;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024;

interface VaultKdfConfig {
  algorithm: "scrypt";
  salt: string;
  cost: number;
  blockSize: number;
  parallelization: number;
  keyLength: number;
}

interface VaultEnvelope {
  version: typeof VAULT_VERSION;
  kdf: VaultKdfConfig;
  cipher: {
    algorithm: "aes-256-gcm";
    iv: string;
    authTag: string;
    ciphertext: string;
  };
}

export interface DecryptedServerProfile extends ServerProfileInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}

interface VaultPayload {
  version: typeof PAYLOAD_VERSION;
  profiles: DecryptedServerProfile[];
  assets: AssetRecord[];
  snippets: SnippetRecord[];
  folderDefaults: StoredFolderDefaults[];
  externalTools: ExternalToolRecord[];
  connectionTasks: ConnectionTaskRecord[];
  syncSources: StoredSyncSource[];
}

interface StoredFolderDefaults extends FolderDefaultsInput {
  updatedAt: string;
}

export interface StoredSyncSource extends InventorySyncSourceInput {
  id: string;
  createdAt: string;
  updatedAt: string;
  lastSyncedAt?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new Error(`Vault field ${field} is invalid.`);
  }
  return value;
}

function requireBase64(value: unknown, field: string, expectedLength?: number): Buffer {
  const encoded = requireString(value, field);
  const decoded = Buffer.from(encoded, "base64");
  if (decoded.toString("base64") !== encoded) {
    throw new Error(`Vault field ${field} is not valid base64.`);
  }
  if (expectedLength !== undefined && decoded.length !== expectedLength) {
    throw new Error(`Vault field ${field} has an invalid length.`);
  }
  return decoded;
}

function parseKdf(value: unknown): VaultKdfConfig {
  if (!isRecord(value)) {
    throw new Error("Vault KDF configuration is invalid.");
  }

  const kdf: VaultKdfConfig = {
    algorithm: value.algorithm === "scrypt" ? "scrypt" : (() => {
      throw new Error("Unsupported vault KDF.");
    })(),
    salt: requireString(value.salt, "kdf.salt"),
    cost: Number(value.cost),
    blockSize: Number(value.blockSize),
    parallelization: Number(value.parallelization),
    keyLength: Number(value.keyLength),
  };

  requireBase64(kdf.salt, "kdf.salt", SALT_LENGTH);
  if (
    kdf.cost !== SCRYPT_COST ||
    kdf.blockSize !== SCRYPT_BLOCK_SIZE ||
    kdf.parallelization !== SCRYPT_PARALLELIZATION ||
    kdf.keyLength !== KEY_LENGTH
  ) {
    throw new Error("Unsupported vault KDF parameters.");
  }
  return kdf;
}

function parseEnvelope(value: unknown): VaultEnvelope {
  if (!isRecord(value) || value.version !== VAULT_VERSION || !isRecord(value.cipher)) {
    throw new Error("Vault file format is invalid.");
  }
  if (value.cipher.algorithm !== "aes-256-gcm") {
    throw new Error("Unsupported vault cipher.");
  }

  const kdf = parseKdf(value.kdf);
  const iv = requireString(value.cipher.iv, "cipher.iv");
  const authTag = requireString(value.cipher.authTag, "cipher.authTag");
  const ciphertext = requireString(value.cipher.ciphertext, "cipher.ciphertext");
  requireBase64(iv, "cipher.iv", IV_LENGTH);
  requireBase64(authTag, "cipher.authTag", AUTH_TAG_LENGTH);
  requireBase64(ciphertext, "cipher.ciphertext");

  return {
    version: VAULT_VERSION,
    kdf,
    cipher: {
      algorithm: "aes-256-gcm",
      iv,
      authTag,
      ciphertext,
    },
  };
}

function parseAuthType(value: unknown): ServerAuthType {
  if (value === "none" || value === "password" || value === "privateKey") {
    return value;
  }
  throw new Error("Vault profile authentication type is invalid.");
}

function parseConnectionProtocol(value: unknown): ConnectionProtocol {
  if (value === undefined) {
    return "ssh";
  }
  if (
    value === "ssh" || value === "rdp" || value === "telnet" || value === "raw" ||
    value === "vnc" || value === "http" || value === "https" || value === "serial"
  ) {
    return value;
  }
  throw new Error("Vault profile protocol is invalid.");
}

function parseSerialParity(value: unknown): SerialParity | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === "none" || value === "even" || value === "odd" || value === "mark" || value === "space") {
    return value;
  }
  throw new Error("Vault profile serial parity is invalid.");
}

function parseProfile(value: unknown): DecryptedServerProfile {
  if (!isRecord(value)) {
    throw new Error("Vault profile is invalid.");
  }

  const protocol = parseConnectionProtocol(value.protocol);
  const port = Number(value.port);
  if (!Number.isInteger(port) || port < (protocol === "serial" ? 0 : 1) || port > 65_535) {
    throw new Error("Vault profile port is invalid.");
  }

  const authType = parseAuthType(value.authType);
  if (value.tags !== undefined && !Array.isArray(value.tags)) {
    throw new Error("Vault profile tags are invalid.");
  }
  const tags = (value.tags ?? []).map((tag, index) =>
    requireString(tag, `profile.tags[${index}]`),
  );
  if (tags.length > 20) throw new Error("Vault profile contains too many tags.");
  const profile: DecryptedServerProfile = {
    id: requireString(value.id, "profile.id"),
    name: requireString(value.name, "profile.name"),
    host: requireString(value.host, "profile.host"),
    port,
    username: requireString(value.username, "profile.username"),
    group: requireString(value.group, "profile.group"),
    authType,
    protocol,
    tags,
    favorite: value.favorite === true,
    inheritFolderDefaults: value.inheritFolderDefaults !== false,
    domain: optionalString(value.domain, "profile.domain"),
    readyTimeoutSeconds: optionalPositiveInteger(value.readyTimeoutSeconds, "profile.readyTimeoutSeconds"),
    keepaliveSeconds: optionalPositiveInteger(value.keepaliveSeconds, "profile.keepaliveSeconds"),
    preConnectTaskIds: parseStringArray(value.preConnectTaskIds, "profile.preConnectTaskIds", 50),
    postConnectTaskIds: parseStringArray(value.postConnectTaskIds, "profile.postConnectTaskIds", 50),
    totpSecret: optionalString(value.totpSecret, "profile.totpSecret"),
    totpDigits: value.totpDigits === 8 ? 8 : 6,
    totpPeriod: value.totpPeriod === 60 ? 60 : 30,
    totpAlgorithm: value.totpAlgorithm === "sha256" || value.totpAlgorithm === "sha512" ? value.totpAlgorithm : "sha1",
    managedBySyncId: optionalString(value.managedBySyncId, "profile.managedBySyncId"),
    managedObjectId: optionalString(value.managedObjectId, "profile.managedObjectId"),
    createdAt: requireString(value.createdAt, "profile.createdAt"),
    updatedAt: requireString(value.updatedAt, "profile.updatedAt"),
  };

  if (protocol === "serial") {
    const baudRate = Number(value.baudRate ?? 9_600);
    const dataBits = Number(value.dataBits ?? 8);
    const stopBits = Number(value.stopBits ?? 1);
    if (!Number.isInteger(baudRate) || baudRate < 50 || baudRate > 4_000_000) {
      throw new Error("Vault profile baud rate is invalid.");
    }
    if (dataBits !== 5 && dataBits !== 6 && dataBits !== 7 && dataBits !== 8) {
      throw new Error("Vault profile data bits are invalid.");
    }
    if (stopBits !== 1 && stopBits !== 2) {
      throw new Error("Vault profile stop bits are invalid.");
    }
    profile.baudRate = baudRate;
    profile.dataBits = dataBits;
    profile.stopBits = stopBits;
    profile.parity = parseSerialParity(value.parity) ?? "none";
  }

  if (authType === "password") {
    profile.password = requireString(value.password, "profile.password");
  } else if (authType === "privateKey") {
    profile.privateKeyPath = requireString(value.privateKeyPath, "profile.privateKeyPath");
    if (value.passphrase !== undefined) {
      profile.passphrase = requireString(value.passphrase, "profile.passphrase");
    }
  }
  return profile;
}

function optionalString(value: unknown, field: string): string | undefined {
  return value === undefined ? undefined : requireString(value, field);
}

function optionalPositiveInteger(value: unknown, field: string): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 86_400) throw new Error(`Vault field ${field} is invalid.`);
  return parsed;
}

function parseStringArray(value: unknown, field: string, maximum: number): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > maximum) throw new Error(`Vault field ${field} is invalid.`);
  return value.map((item, index) => requireString(item, `${field}[${index}]`));
}

function parseDeviceIcon(value: unknown, field: string): DeviceIcon {
  if (
    value === "windows" ||
    value === "linux" ||
    value === "cisco" ||
    value === "fortinet" ||
    value === "vmware" ||
    value === "printer" ||
    value === "network" ||
    value === "server" ||
    value === "unknown"
  ) {
    return value;
  }
  throw new Error(`Vault field ${field} is invalid.`);
}

function parseOsFamily(value: unknown): DeviceOsFamily {
  if (
    value === "Windows" ||
    value === "Linux" ||
    value === "Network appliance" ||
    value === "Printer" ||
    value === "Unknown"
  ) {
    return value;
  }
  throw new Error("Vault asset OS family is invalid.");
}

function parseProtocol(value: unknown): AdministrationProtocol {
  if (
    value === "ssh" ||
    value === "rdp" ||
    value === "http" ||
    value === "https" ||
    value === "telnet" ||
    value === "vnc"
  ) {
    return value;
  }
  throw new Error("Vault asset protocol is invalid.");
}

function parseOpenPort(value: unknown): OpenPortInfo {
  if (!isRecord(value)) {
    throw new Error("Vault asset port is invalid.");
  }
  const port = Number(value.port);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("Vault asset port number is invalid.");
  }
  return {
    port,
    protocol: parseProtocol(value.protocol),
    banner: optionalString(value.banner, "asset.port.banner"),
  };
}

function parseMetadata(value: unknown): AssetMetadata {
  if (!isRecord(value)) {
    throw new Error("Vault asset metadata is invalid.");
  }
  return {
    serialNumber: requireString(value.serialNumber, "asset.metadata.serialNumber"),
    assetTag: requireString(value.assetTag, "asset.metadata.assetTag"),
    rackPosition: requireString(value.rackPosition, "asset.metadata.rackPosition"),
    site: requireString(value.site, "asset.metadata.site"),
    osVersion: requireString(value.osVersion, "asset.metadata.osVersion"),
    maintenanceSla: requireString(value.maintenanceSla, "asset.metadata.maintenanceSla"),
  };
}

function parseAsset(value: unknown): AssetRecord {
  if (!isRecord(value) || !Array.isArray(value.openPorts)) {
    throw new Error("Vault asset is invalid.");
  }
  return {
    id: requireString(value.id, "asset.id"),
    name: requireString(value.name, "asset.name"),
    ipAddress: requireString(value.ipAddress, "asset.ipAddress"),
    hostname: optionalString(value.hostname, "asset.hostname"),
    macAddress: optionalString(value.macAddress, "asset.macAddress"),
    vendor: optionalString(value.vendor, "asset.vendor"),
    osFamily: parseOsFamily(value.osFamily),
    openPorts: value.openPorts.map(parseOpenPort),
    suggestedIcon: parseDeviceIcon(value.suggestedIcon, "asset.suggestedIcon"),
    iconOverride: value.iconOverride === undefined
      ? undefined
      : parseDeviceIcon(value.iconOverride, "asset.iconOverride"),
    metadata: parseMetadata(value.metadata),
    lastSeenAt: requireString(value.lastSeenAt, "asset.lastSeenAt"),
    createdAt: requireString(value.createdAt, "asset.createdAt"),
    updatedAt: requireString(value.updatedAt, "asset.updatedAt"),
  };
}

function parseSnippetLanguage(value: unknown): SnippetLanguage {
  if (value === "powershell" || value === "bash" || value === "cisco") return value;
  throw new Error("Vault snippet language is invalid.");
}

function parseSnippet(value: unknown): SnippetRecord {
  if (!isRecord(value) || !Array.isArray(value.tags)) {
    throw new Error("Vault snippet is invalid.");
  }
  return {
    id: requireString(value.id, "snippet.id"),
    name: requireString(value.name, "snippet.name"),
    language: parseSnippetLanguage(value.language),
    tags: value.tags.map((tag, index) => requireString(tag, `snippet.tags[${index}]`)),
    body: requireString(value.body, "snippet.body"),
    createdAt: requireString(value.createdAt, "snippet.createdAt"),
    updatedAt: requireString(value.updatedAt, "snippet.updatedAt"),
  };
}

function parseArguments(value: unknown, field: string): string[] {
  return parseStringArray(value, field, 64);
}

function parseFolderDefaults(value: unknown): StoredFolderDefaults {
  if (!isRecord(value)) throw new Error("Vault folder defaults are invalid.");
  const authType = parseAuthType(value.authType ?? "none");
  return {
    path: requireString(value.path, "folderDefaults.path"),
    username: optionalString(value.username, "folderDefaults.username"),
    domain: optionalString(value.domain, "folderDefaults.domain"),
    authType,
    password: authType === "password" ? requireString(value.password, "folderDefaults.password") : undefined,
    privateKeyPath: authType === "privateKey" ? requireString(value.privateKeyPath, "folderDefaults.privateKeyPath") : undefined,
    passphrase: authType === "privateKey" ? optionalString(value.passphrase, "folderDefaults.passphrase") : undefined,
    port: optionalPositiveInteger(value.port, "folderDefaults.port"),
    readyTimeoutSeconds: optionalPositiveInteger(value.readyTimeoutSeconds, "folderDefaults.readyTimeoutSeconds"),
    keepaliveSeconds: optionalPositiveInteger(value.keepaliveSeconds, "folderDefaults.keepaliveSeconds"),
    updatedAt: requireString(value.updatedAt, "folderDefaults.updatedAt"),
  };
}

function parseExternalTool(value: unknown): ExternalToolRecord {
  if (!isRecord(value)) throw new Error("Vault external tool is invalid.");
  return {
    id: requireString(value.id, "externalTool.id"),
    name: requireString(value.name, "externalTool.name"),
    executablePath: requireString(value.executablePath, "externalTool.executablePath"),
    arguments: parseArguments(value.arguments, "externalTool.arguments"),
    createdAt: requireString(value.createdAt, "externalTool.createdAt"),
    updatedAt: requireString(value.updatedAt, "externalTool.updatedAt"),
  };
}

function parseConnectionTask(value: unknown): ConnectionTaskRecord {
  if (!isRecord(value)) throw new Error("Vault connection task is invalid.");
  if (value.kind !== "script" && value.kind !== "vpn") throw new Error("Vault connection task kind is invalid.");
  return {
    id: requireString(value.id, "connectionTask.id"),
    name: requireString(value.name, "connectionTask.name"),
    kind: value.kind,
    executablePath: requireString(value.executablePath, "connectionTask.executablePath"),
    arguments: parseArguments(value.arguments, "connectionTask.arguments"),
    waitForExit: value.waitForExit !== false,
    timeoutSeconds: optionalPositiveInteger(value.timeoutSeconds, "connectionTask.timeoutSeconds") ?? 60,
    createdAt: requireString(value.createdAt, "connectionTask.createdAt"),
    updatedAt: requireString(value.updatedAt, "connectionTask.updatedAt"),
  };
}

function parseSyncSource(value: unknown): StoredSyncSource {
  if (!isRecord(value) || (value.provider !== "ldap" && value.provider !== "vmware" && value.provider !== "hyperv")) {
    throw new Error("Vault inventory sync source is invalid.");
  }
  if (value.defaultProtocol !== "ssh" && value.defaultProtocol !== "rdp" && value.defaultProtocol !== "https") {
    throw new Error("Vault inventory sync protocol is invalid.");
  }
  return {
    id: requireString(value.id, "syncSource.id"),
    name: requireString(value.name, "syncSource.name"),
    provider: value.provider,
    endpoint: requireString(value.endpoint, "syncSource.endpoint"),
    baseDn: optionalString(value.baseDn, "syncSource.baseDn"),
    username: optionalString(value.username, "syncSource.username"),
    password: optionalString(value.password, "syncSource.password"),
    filter: optionalString(value.filter, "syncSource.filter"),
    group: requireString(value.group, "syncSource.group"),
    defaultProtocol: value.defaultProtocol,
    createdAt: requireString(value.createdAt, "syncSource.createdAt"),
    updatedAt: requireString(value.updatedAt, "syncSource.updatedAt"),
    lastSyncedAt: optionalString(value.lastSyncedAt, "syncSource.lastSyncedAt"),
  };
}

function parsePayload(value: unknown): VaultPayload {
  if (!isRecord(value) || value.version !== PAYLOAD_VERSION || !Array.isArray(value.profiles)) {
    throw new Error("Vault payload is invalid.");
  }
  if (value.assets !== undefined && !Array.isArray(value.assets)) {
    throw new Error("Vault asset inventory is invalid.");
  }
  if (value.snippets !== undefined && !Array.isArray(value.snippets)) {
    throw new Error("Vault snippet library is invalid.");
  }
  if (value.folderDefaults !== undefined && !Array.isArray(value.folderDefaults)) throw new Error("Vault folder defaults are invalid.");
  if (value.externalTools !== undefined && !Array.isArray(value.externalTools)) throw new Error("Vault external tools are invalid.");
  if (value.connectionTasks !== undefined && !Array.isArray(value.connectionTasks)) throw new Error("Vault connection tasks are invalid.");
  if (value.syncSources !== undefined && !Array.isArray(value.syncSources)) throw new Error("Vault sync sources are invalid.");
  return {
    version: PAYLOAD_VERSION,
    profiles: value.profiles.map(parseProfile),
    assets: (value.assets ?? []).map(parseAsset),
    snippets: (value.snippets ?? []).map(parseSnippet),
    folderDefaults: (value.folderDefaults ?? []).map(parseFolderDefaults),
    externalTools: (value.externalTools ?? []).map(parseExternalTool),
    connectionTasks: (value.connectionTasks ?? []).map(parseConnectionTask),
    syncSources: (value.syncSources ?? []).map(parseSyncSource),
  };
}

function createKdfConfig(): VaultKdfConfig {
  return {
    algorithm: "scrypt",
    salt: randomBytes(SALT_LENGTH).toString("base64"),
    cost: SCRYPT_COST,
    blockSize: SCRYPT_BLOCK_SIZE,
    parallelization: SCRYPT_PARALLELIZATION,
    keyLength: KEY_LENGTH,
  };
}

function aadFor(kdf: VaultKdfConfig): Buffer {
  return Buffer.from(
    [
      "CyberGridVault",
      VAULT_VERSION,
      kdf.algorithm,
      kdf.salt,
      kdf.cost,
      kdf.blockSize,
      kdf.parallelization,
      kdf.keyLength,
    ].join(":"),
    "utf8",
  );
}

async function deriveKey(masterPassword: string, kdf: VaultKdfConfig): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      masterPassword,
      Buffer.from(kdf.salt, "base64"),
      KEY_LENGTH,
      {
        N: kdf.cost,
        r: kdf.blockSize,
        p: kdf.parallelization,
        maxmem: SCRYPT_MAX_MEMORY,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
        } else {
          resolve(derivedKey);
        }
      },
    );
  });
}

function summarizeProfile(profile: DecryptedServerProfile): ServerProfileSummary {
  return {
    id: profile.id,
    name: profile.name,
    host: profile.host,
    port: profile.port,
    username: profile.username,
    group: profile.group,
    authType: profile.authType,
    protocol: profile.protocol,
    baudRate: profile.baudRate,
    dataBits: profile.dataBits,
    stopBits: profile.stopBits,
    parity: profile.parity,
    tags: [...(profile.tags ?? [])],
    favorite: profile.favorite ?? false,
    inheritFolderDefaults: profile.inheritFolderDefaults !== false,
    domain: profile.domain,
    readyTimeoutSeconds: profile.readyTimeoutSeconds,
    keepaliveSeconds: profile.keepaliveSeconds,
    preConnectTaskIds: [...(profile.preConnectTaskIds ?? [])],
    postConnectTaskIds: [...(profile.postConnectTaskIds ?? [])],
    hasTotp: Boolean(profile.totpSecret),
    managedBySyncId: profile.managedBySyncId,
  };
}

function summarizeFolderDefaults(value: StoredFolderDefaults): FolderDefaultsSummary {
  return {
    path: value.path,
    username: value.username,
    domain: value.domain,
    authType: value.authType,
    hasPassword: value.authType === "password" && Boolean(value.password),
    privateKeyPath: value.privateKeyPath,
    hasPassphrase: Boolean(value.passphrase),
    port: value.port,
    readyTimeoutSeconds: value.readyTimeoutSeconds,
    keepaliveSeconds: value.keepaliveSeconds,
    updatedAt: value.updatedAt,
  };
}

function summarizeSyncSource(value: StoredSyncSource): InventorySyncSourceSummary {
  const { password: _password, ...safe } = value;
  return { ...safe, hasPassword: Boolean(value.password) };
}

function cloneAsset(asset: AssetRecord): AssetRecord {
  return {
    ...asset,
    openPorts: asset.openPorts.map((port) => ({ ...port })),
    metadata: { ...asset.metadata },
  };
}

export class VaultController {
  private masterKey?: Buffer;
  private payload?: VaultPayload;
  private kdf?: VaultKdfConfig;

  constructor(private readonly vaultPath: string) {}

  async status(): Promise<VaultStatus> {
    return {
      exists: await this.fileExists(),
      unlocked: this.isUnlocked(),
    };
  }

  isVaultUnlocked(): boolean {
    return this.isUnlocked();
  }

  async create(masterPassword: string): Promise<void> {
    if (masterPassword.length < 10) {
      throw new Error("Master password must contain at least 10 characters.");
    }
    if (await this.fileExists()) {
      throw new Error("A credential vault already exists.");
    }

    const kdf = createKdfConfig();
    const key = await deriveKey(masterPassword, kdf);
    this.lock();
    this.masterKey = key;
    this.kdf = kdf;
    this.payload = {
      version: PAYLOAD_VERSION,
      profiles: [],
      assets: [],
      snippets: [],
      folderDefaults: [],
      externalTools: [],
      connectionTasks: [],
      syncSources: [],
    };

    try {
      await this.persist();
    } catch (error) {
      this.lock();
      throw error;
    }
  }

  async unlock(masterPassword: string): Promise<void> {
    if (this.isUnlocked()) {
      return;
    }

    const envelope = await this.readEnvelope();
    const key = await deriveKey(masterPassword, envelope.kdf);
    let plaintext: Buffer | undefined;

    try {
      const decipher = createDecipheriv(
        "aes-256-gcm",
        key,
        Buffer.from(envelope.cipher.iv, "base64"),
      );
      decipher.setAAD(aadFor(envelope.kdf));
      decipher.setAuthTag(Buffer.from(envelope.cipher.authTag, "base64"));
      plaintext = Buffer.concat([
        decipher.update(Buffer.from(envelope.cipher.ciphertext, "base64")),
        decipher.final(),
      ]);
      const payload = parsePayload(JSON.parse(plaintext.toString("utf8")) as unknown);
      this.masterKey = key;
      this.kdf = envelope.kdf;
      this.payload = payload;
    } catch {
      key.fill(0);
      throw new Error("Invalid master password or corrupted credential vault.");
    } finally {
      plaintext?.fill(0);
    }
  }

  lock(): void {
    this.masterKey?.fill(0);
    this.masterKey = undefined;
    this.payload = undefined;
    this.kdf = undefined;
  }

  listProfiles(): ServerProfileSummary[] {
    return this.requirePayload()
      .profiles.map(summarizeProfile)
      .sort((left, right) =>
        left.group.localeCompare(right.group) || left.name.localeCompare(right.name),
      );
  }

  async saveProfile(input: ServerProfileInput): Promise<ServerProfileSummary> {
    const payload = this.requirePayload();
    const timestamp = new Date().toISOString();
    const profile: DecryptedServerProfile = {
      ...input,
      id: randomUUID(),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    payload.profiles.push(profile);
    try {
      await this.persist();
    } catch (error) {
      payload.profiles.pop();
      throw error;
    }
    return summarizeProfile(profile);
  }

  async importProfiles(inputs: ServerProfileInput[]): Promise<number> {
    const payload = this.requirePayload();
    const timestamp = new Date().toISOString();
    const profiles: DecryptedServerProfile[] = inputs.map((input) => ({
      ...input,
      id: randomUUID(),
      createdAt: timestamp,
      updatedAt: timestamp,
    }));
    payload.profiles.push(...profiles);
    try {
      await this.persist();
    } catch (error) {
      payload.profiles.splice(payload.profiles.length - profiles.length, profiles.length);
      throw error;
    }
    return profiles.length;
  }

  exportProfiles(): ServerProfileInput[] {
    return this.requirePayload().profiles.map((profile) => ({
      protocol: profile.protocol,
      name: profile.name,
      host: profile.host,
      port: profile.port,
      username: profile.username,
      group: profile.group,
      authType: profile.authType,
      password: profile.password,
      privateKeyPath: profile.privateKeyPath,
      passphrase: profile.passphrase,
      baudRate: profile.baudRate,
      dataBits: profile.dataBits,
      stopBits: profile.stopBits,
      parity: profile.parity,
      tags: [...(profile.tags ?? [])],
      favorite: profile.favorite ?? false,
      inheritFolderDefaults: profile.inheritFolderDefaults !== false,
      domain: profile.domain,
      readyTimeoutSeconds: profile.readyTimeoutSeconds,
      keepaliveSeconds: profile.keepaliveSeconds,
      preConnectTaskIds: [...(profile.preConnectTaskIds ?? [])],
      postConnectTaskIds: [...(profile.postConnectTaskIds ?? [])],
      totpSecret: profile.totpSecret,
      totpDigits: profile.totpDigits,
      totpPeriod: profile.totpPeriod,
      totpAlgorithm: profile.totpAlgorithm,
      managedBySyncId: profile.managedBySyncId,
      managedObjectId: profile.managedObjectId,
    }));
  }

  async setFavorite(profileId: string, favorite: boolean): Promise<ServerProfileSummary> {
    const payload = this.requirePayload();
    const profile = payload.profiles.find((candidate) => candidate.id === profileId);
    if (!profile) throw new Error("Server profile was not found.");
    const previousFavorite = profile.favorite ?? false;
    const previousUpdatedAt = profile.updatedAt;
    profile.favorite = favorite;
    profile.updatedAt = new Date().toISOString();
    try {
      await this.persist();
    } catch (error) {
      profile.favorite = previousFavorite;
      profile.updatedAt = previousUpdatedAt;
      throw error;
    }
    return summarizeProfile(profile);
  }

  async deleteProfile(profileId: string): Promise<void> {
    const payload = this.requirePayload();
    const profileIndex = payload.profiles.findIndex((profile) => profile.id === profileId);
    if (profileIndex < 0) {
      throw new Error("Server profile was not found.");
    }

    const [removedProfile] = payload.profiles.splice(profileIndex, 1);
    try {
      await this.persist();
    } catch (error) {
      if (removedProfile) {
        payload.profiles.splice(profileIndex, 0, removedProfile);
      }
      throw error;
    }
  }

  listAssets(): AssetRecord[] {
    return this.requirePayload()
      .assets.map(cloneAsset)
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async saveAsset(input: AssetInput): Promise<AssetRecord> {
    const payload = this.requirePayload();
    const timestamp = new Date().toISOString();
    const existingIndex = input.id
      ? payload.assets.findIndex((asset) => asset.id === input.id)
      : -1;
    if (input.id && existingIndex < 0) {
      throw new Error("Asset record was not found.");
    }

    const existing = existingIndex >= 0 ? payload.assets[existingIndex] : undefined;
    const asset: AssetRecord = {
      name: input.name,
      ipAddress: input.ipAddress,
      hostname: input.hostname,
      macAddress: input.macAddress,
      vendor: input.vendor,
      osFamily: input.osFamily,
      openPorts: input.openPorts.map((port) => ({ ...port })),
      suggestedIcon: input.suggestedIcon,
      iconOverride: input.iconOverride,
      metadata: { ...input.metadata },
      lastSeenAt: input.lastSeenAt,
      id: existing?.id ?? randomUUID(),
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };

    if (existingIndex >= 0) {
      payload.assets.splice(existingIndex, 1, asset);
    } else {
      payload.assets.push(asset);
    }
    try {
      await this.persist();
    } catch (error) {
      if (existingIndex >= 0 && existing) {
        payload.assets.splice(existingIndex, 1, existing);
      } else {
        payload.assets.pop();
      }
      throw error;
    }
    return cloneAsset(asset);
  }

  async deleteAsset(assetId: string): Promise<void> {
    const payload = this.requirePayload();
    const assetIndex = payload.assets.findIndex((asset) => asset.id === assetId);
    if (assetIndex < 0) {
      throw new Error("Asset record was not found.");
    }
    const [removedAsset] = payload.assets.splice(assetIndex, 1);
    try {
      await this.persist();
    } catch (error) {
      if (removedAsset) {
        payload.assets.splice(assetIndex, 0, removedAsset);
      }
      throw error;
    }
  }

  listSnippets(): SnippetRecord[] {
    return this.requirePayload().snippets
      .map((snippet) => ({ ...snippet, tags: [...snippet.tags] }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async saveSnippet(input: SnippetInput): Promise<SnippetRecord> {
    const payload = this.requirePayload();
    const timestamp = new Date().toISOString();
    const existingIndex = input.id
      ? payload.snippets.findIndex((snippet) => snippet.id === input.id)
      : -1;
    if (input.id && existingIndex < 0) {
      throw new Error("Command snippet was not found.");
    }
    const existing = existingIndex >= 0 ? payload.snippets[existingIndex] : undefined;
    const snippet: SnippetRecord = {
      name: input.name,
      language: input.language,
      tags: [...input.tags],
      body: input.body,
      id: existing?.id ?? randomUUID(),
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    if (existingIndex >= 0) payload.snippets.splice(existingIndex, 1, snippet);
    else payload.snippets.push(snippet);
    try {
      await this.persist();
    } catch (error) {
      if (existingIndex >= 0 && existing) payload.snippets.splice(existingIndex, 1, existing);
      else payload.snippets.pop();
      throw error;
    }
    return { ...snippet, tags: [...snippet.tags] };
  }

  async deleteSnippet(snippetId: string): Promise<void> {
    const payload = this.requirePayload();
    const snippetIndex = payload.snippets.findIndex((snippet) => snippet.id === snippetId);
    if (snippetIndex < 0) throw new Error("Command snippet was not found.");
    const [removed] = payload.snippets.splice(snippetIndex, 1);
    try {
      await this.persist();
    } catch (error) {
      if (removed) payload.snippets.splice(snippetIndex, 0, removed);
      throw error;
    }
  }

  listFolderDefaults(): FolderDefaultsSummary[] {
    return this.requirePayload().folderDefaults.map(summarizeFolderDefaults)
      .sort((left, right) => left.path.localeCompare(right.path));
  }

  async saveFolderDefaults(input: FolderDefaultsInput): Promise<FolderDefaultsSummary> {
    const payload = this.requirePayload();
    const existingIndex = payload.folderDefaults.findIndex((item) => item.path === input.path);
    const previous = existingIndex >= 0 ? payload.folderDefaults[existingIndex] : undefined;
    const value: StoredFolderDefaults = {
      ...input,
      password: input.authType === "password" ? (input.password || previous?.password) : undefined,
      privateKeyPath: input.authType === "privateKey" ? (input.privateKeyPath || previous?.privateKeyPath) : undefined,
      passphrase: input.authType === "privateKey" ? (input.passphrase || previous?.passphrase) : undefined,
      updatedAt: new Date().toISOString(),
    };
    if (value.authType === "password" && !value.password) throw new Error("A default password is required.");
    if (value.authType === "privateKey" && !value.privateKeyPath) throw new Error("A default private key path is required.");
    if (existingIndex >= 0) payload.folderDefaults.splice(existingIndex, 1, value);
    else payload.folderDefaults.push(value);
    try {
      await this.persist();
    } catch (error) {
      if (existingIndex >= 0 && previous) payload.folderDefaults.splice(existingIndex, 1, previous);
      else payload.folderDefaults.pop();
      throw error;
    }
    return summarizeFolderDefaults(value);
  }

  async deleteFolderDefaults(path: string): Promise<void> {
    const payload = this.requirePayload();
    const index = payload.folderDefaults.findIndex((item) => item.path === path);
    if (index < 0) throw new Error("Folder defaults were not found.");
    const [removed] = payload.folderDefaults.splice(index, 1);
    try { await this.persist(); }
    catch (error) { if (removed) payload.folderDefaults.splice(index, 0, removed); throw error; }
  }

  listExternalTools(): ExternalToolRecord[] {
    return this.requirePayload().externalTools.map((tool) => ({ ...tool, arguments: [...tool.arguments] }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  getExternalTool(toolId: string): ExternalToolRecord {
    const tool = this.requirePayload().externalTools.find((candidate) => candidate.id === toolId);
    if (!tool) throw new Error("External tool was not found.");
    return { ...tool, arguments: [...tool.arguments] };
  }

  async saveExternalTool(input: ExternalToolInput): Promise<ExternalToolRecord> {
    const payload = this.requirePayload();
    const index = input.id ? payload.externalTools.findIndex((tool) => tool.id === input.id) : -1;
    if (input.id && index < 0) throw new Error("External tool was not found.");
    const previous = index >= 0 ? payload.externalTools[index] : undefined;
    const timestamp = new Date().toISOString();
    const value: ExternalToolRecord = {
      name: input.name, executablePath: input.executablePath, arguments: [...input.arguments],
      id: previous?.id ?? randomUUID(), createdAt: previous?.createdAt ?? timestamp, updatedAt: timestamp,
    };
    if (index >= 0) payload.externalTools.splice(index, 1, value); else payload.externalTools.push(value);
    try { await this.persist(); }
    catch (error) {
      if (index >= 0 && previous) payload.externalTools.splice(index, 1, previous); else payload.externalTools.pop();
      throw error;
    }
    return { ...value, arguments: [...value.arguments] };
  }

  async deleteExternalTool(toolId: string): Promise<void> {
    const payload = this.requirePayload();
    const index = payload.externalTools.findIndex((tool) => tool.id === toolId);
    if (index < 0) throw new Error("External tool was not found.");
    const [removed] = payload.externalTools.splice(index, 1);
    try { await this.persist(); }
    catch (error) { if (removed) payload.externalTools.splice(index, 0, removed); throw error; }
  }

  listConnectionTasks(): ConnectionTaskRecord[] {
    return this.requirePayload().connectionTasks.map((task) => ({ ...task, arguments: [...task.arguments] }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  getConnectionTasks(taskIds: string[]): ConnectionTaskRecord[] {
    const tasks = this.requirePayload().connectionTasks;
    return taskIds.map((id) => {
      const task = tasks.find((candidate) => candidate.id === id);
      if (!task) throw new Error(`Connection task ${id} was not found.`);
      return { ...task, arguments: [...task.arguments] };
    });
  }

  async saveConnectionTask(input: ConnectionTaskInput): Promise<ConnectionTaskRecord> {
    const payload = this.requirePayload();
    const index = input.id ? payload.connectionTasks.findIndex((task) => task.id === input.id) : -1;
    if (input.id && index < 0) throw new Error("Connection task was not found.");
    const previous = index >= 0 ? payload.connectionTasks[index] : undefined;
    const timestamp = new Date().toISOString();
    const value: ConnectionTaskRecord = {
      ...input, arguments: [...input.arguments], id: previous?.id ?? randomUUID(),
      createdAt: previous?.createdAt ?? timestamp, updatedAt: timestamp,
    };
    if (index >= 0) payload.connectionTasks.splice(index, 1, value); else payload.connectionTasks.push(value);
    try { await this.persist(); }
    catch (error) {
      if (index >= 0 && previous) payload.connectionTasks.splice(index, 1, previous); else payload.connectionTasks.pop();
      throw error;
    }
    return { ...value, arguments: [...value.arguments] };
  }

  async deleteConnectionTask(taskId: string): Promise<void> {
    const payload = this.requirePayload();
    const index = payload.connectionTasks.findIndex((task) => task.id === taskId);
    if (index < 0) throw new Error("Connection task was not found.");
    const [removed] = payload.connectionTasks.splice(index, 1);
    const affected = payload.profiles.map((profile) => ({
      profile,
      pre: [...(profile.preConnectTaskIds ?? [])],
      post: [...(profile.postConnectTaskIds ?? [])],
    }));
    for (const item of affected) {
      item.profile.preConnectTaskIds = item.pre.filter((id) => id !== taskId);
      item.profile.postConnectTaskIds = item.post.filter((id) => id !== taskId);
    }
    try { await this.persist(); }
    catch (error) {
      if (removed) payload.connectionTasks.splice(index, 0, removed);
      for (const item of affected) { item.profile.preConnectTaskIds = item.pre; item.profile.postConnectTaskIds = item.post; }
      throw error;
    }
  }

  listSyncSources(): InventorySyncSourceSummary[] {
    return this.requirePayload().syncSources.map(summarizeSyncSource)
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  getSyncSource(sourceId: string): StoredSyncSource {
    const source = this.requirePayload().syncSources.find((candidate) => candidate.id === sourceId);
    if (!source) throw new Error("Inventory sync source was not found.");
    return { ...source };
  }

  async saveSyncSource(input: InventorySyncSourceInput): Promise<InventorySyncSourceSummary> {
    const payload = this.requirePayload();
    const index = input.id ? payload.syncSources.findIndex((source) => source.id === input.id) : -1;
    if (input.id && index < 0) throw new Error("Inventory sync source was not found.");
    const previous = index >= 0 ? payload.syncSources[index] : undefined;
    const timestamp = new Date().toISOString();
    const value: StoredSyncSource = {
      ...input,
      password: input.password || previous?.password,
      id: previous?.id ?? randomUUID(),
      createdAt: previous?.createdAt ?? timestamp,
      updatedAt: timestamp,
      lastSyncedAt: previous?.lastSyncedAt,
    };
    if (index >= 0) payload.syncSources.splice(index, 1, value); else payload.syncSources.push(value);
    try { await this.persist(); }
    catch (error) {
      if (index >= 0 && previous) payload.syncSources.splice(index, 1, previous); else payload.syncSources.pop();
      throw error;
    }
    return summarizeSyncSource(value);
  }

  async deleteSyncSource(sourceId: string): Promise<void> {
    const payload = this.requirePayload();
    const sourceIndex = payload.syncSources.findIndex((source) => source.id === sourceId);
    if (sourceIndex < 0) throw new Error("Inventory sync source was not found.");
    const [removedSource] = payload.syncSources.splice(sourceIndex, 1);
    const removedProfiles = payload.profiles.filter((profile) => profile.managedBySyncId === sourceId);
    payload.profiles = payload.profiles.filter((profile) => profile.managedBySyncId !== sourceId);
    try { await this.persist(); }
    catch (error) {
      if (removedSource) payload.syncSources.splice(sourceIndex, 0, removedSource);
      payload.profiles.push(...removedProfiles);
      throw error;
    }
  }

  async replaceSyncedProfiles(sourceId: string, inputs: ServerProfileInput[]): Promise<InventorySyncResult> {
    const payload = this.requirePayload();
    const source = payload.syncSources.find((candidate) => candidate.id === sourceId);
    if (!source) throw new Error("Inventory sync source was not found.");
    const previousProfiles = payload.profiles;
    const existing = new Map(previousProfiles.filter((profile) => profile.managedBySyncId === sourceId)
      .map((profile) => [profile.managedObjectId, profile]));
    const timestamp = new Date().toISOString();
    let imported = 0;
    let updated = 0;
    const replacements = inputs.map((input): DecryptedServerProfile => {
      const current = existing.get(input.managedObjectId);
      if (current) updated += 1; else imported += 1;
      return {
        ...input,
        id: current?.id ?? randomUUID(),
        favorite: current?.favorite ?? input.favorite,
        createdAt: current?.createdAt ?? timestamp,
        updatedAt: timestamp,
      };
    });
    const removed = Math.max(0, existing.size - updated);
    payload.profiles = [...previousProfiles.filter((profile) => profile.managedBySyncId !== sourceId), ...replacements];
    const previousLastSyncedAt = source.lastSyncedAt;
    source.lastSyncedAt = timestamp;
    try { await this.persist(); }
    catch (error) { payload.profiles = previousProfiles; source.lastSyncedAt = previousLastSyncedAt; throw error; }
    return { sourceId, imported, updated, removed, warnings: [], completedAt: timestamp };
  }

  getConnectionProfile(profileId: string): DecryptedServerProfile {
    const profile = this.requirePayload().profiles.find((candidate) => candidate.id === profileId);
    if (!profile) {
      throw new Error("Server profile was not found.");
    }
    const resolved: DecryptedServerProfile = {
      ...profile,
      tags: [...(profile.tags ?? [])],
      preConnectTaskIds: [...(profile.preConnectTaskIds ?? [])],
      postConnectTaskIds: [...(profile.postConnectTaskIds ?? [])],
    };
    if (profile.inheritFolderDefaults !== false) {
      const parts = profile.group.split("/").map((part) => part.trim()).filter(Boolean);
      const inherited = this.requirePayload().folderDefaults
        .filter((candidate) => parts.some((_part, index) => candidate.path === parts.slice(0, index + 1).join("/")))
        .sort((left, right) => left.path.split("/").length - right.path.split("/").length)
        .reduce<Partial<StoredFolderDefaults>>((merged, item) => {
          for (const [key, value] of Object.entries(item)) {
            if (value !== undefined && key !== "path" && key !== "updatedAt") {
              if (key === "authType" && value === "none" && merged.authType && merged.authType !== "none") continue;
              (merged as Record<string, unknown>)[key] = value;
            }
          }
          return merged;
        }, {});
      if (!resolved.username) resolved.username = inherited.username ?? "";
      if (!resolved.domain) resolved.domain = inherited.domain;
      if (resolved.authType === "none" && inherited.authType && inherited.authType !== "none") {
        resolved.authType = inherited.authType;
        resolved.password = inherited.password;
        resolved.privateKeyPath = inherited.privateKeyPath;
        resolved.passphrase = inherited.passphrase;
      }
      if (inherited.port && resolved.protocol !== "serial") resolved.port = inherited.port;
      resolved.readyTimeoutSeconds ??= inherited.readyTimeoutSeconds;
      resolved.keepaliveSeconds ??= inherited.keepaliveSeconds;
    }
    if (resolved.domain && resolved.username && !/[\\@]/.test(resolved.username)) {
      resolved.username = `${resolved.domain}\\${resolved.username}`;
    }
    return resolved;
  }

  private isUnlocked(): boolean {
    return Boolean(this.masterKey && this.payload && this.kdf);
  }

  private requirePayload(): VaultPayload {
    if (!this.payload || !this.masterKey || !this.kdf) {
      throw new Error("Credential vault is locked.");
    }
    return this.payload;
  }

  private async fileExists(): Promise<boolean> {
    try {
      await access(this.vaultPath);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return false;
      }
      throw error;
    }
  }

  private async readEnvelope(): Promise<VaultEnvelope> {
    const fileInfo = await stat(this.vaultPath).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        throw new Error("No credential vault exists yet.");
      }
      throw error;
    });
    if (!fileInfo.isFile() || fileInfo.size > MAX_VAULT_BYTES) {
      throw new Error("Credential vault file is invalid or too large.");
    }

    const serialized = await readFile(this.vaultPath, "utf8");
    try {
      return parseEnvelope(JSON.parse(serialized) as unknown);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error("Credential vault file contains invalid JSON.");
      }
      throw error;
    }
  }

  private async persist(): Promise<void> {
    const payload = this.requirePayload();
    const key = this.masterKey as Buffer;
    const kdf = this.kdf as VaultKdfConfig;
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(aadFor(kdf));

    const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
    let ciphertext: Buffer;
    try {
      ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    } finally {
      plaintext.fill(0);
    }

    const envelope: VaultEnvelope = {
      version: VAULT_VERSION,
      kdf,
      cipher: {
        algorithm: "aes-256-gcm",
        iv: iv.toString("base64"),
        authTag: cipher.getAuthTag().toString("base64"),
        ciphertext: ciphertext.toString("base64"),
      },
    };

    await mkdir(dirname(this.vaultPath), { recursive: true, mode: 0o700 });
    const temporaryPath = `${this.vaultPath}.${process.pid}.tmp`;
    try {
      await writeFile(temporaryPath, `${JSON.stringify(envelope, null, 2)}\n`, {
        encoding: "utf8",
        mode: 0o600,
      });
      await rename(temporaryPath, this.vaultPath);
    } catch (error) {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
      throw error;
    }
  }
}
