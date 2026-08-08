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
  DeviceIcon,
  DeviceOsFamily,
  OpenPortInfo,
  ServerAuthType,
  ServerProfileInput,
  ServerProfileSummary,
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
  if (value === "password" || value === "privateKey") {
    return value;
  }
  throw new Error("Vault profile authentication type is invalid.");
}

function parseProfile(value: unknown): DecryptedServerProfile {
  if (!isRecord(value)) {
    throw new Error("Vault profile is invalid.");
  }

  const port = Number(value.port);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("Vault profile port is invalid.");
  }

  const authType = parseAuthType(value.authType);
  const profile: DecryptedServerProfile = {
    id: requireString(value.id, "profile.id"),
    name: requireString(value.name, "profile.name"),
    host: requireString(value.host, "profile.host"),
    port,
    username: requireString(value.username, "profile.username"),
    group: requireString(value.group, "profile.group"),
    authType,
    createdAt: requireString(value.createdAt, "profile.createdAt"),
    updatedAt: requireString(value.updatedAt, "profile.updatedAt"),
  };

  if (authType === "password") {
    profile.password = requireString(value.password, "profile.password");
  } else {
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

function parsePayload(value: unknown): VaultPayload {
  if (!isRecord(value) || value.version !== PAYLOAD_VERSION || !Array.isArray(value.profiles)) {
    throw new Error("Vault payload is invalid.");
  }
  if (value.assets !== undefined && !Array.isArray(value.assets)) {
    throw new Error("Vault asset inventory is invalid.");
  }
  return {
    version: PAYLOAD_VERSION,
    profiles: value.profiles.map(parseProfile),
    assets: (value.assets ?? []).map(parseAsset),
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
  };
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
    this.payload = { version: PAYLOAD_VERSION, profiles: [], assets: [] };

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

  getConnectionProfile(profileId: string): DecryptedServerProfile {
    const profile = this.requirePayload().profiles.find((candidate) => candidate.id === profileId);
    if (!profile) {
      throw new Error("Server profile was not found.");
    }
    return { ...profile };
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
