import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
  type WebContents,
} from "electron";
import { readFile, stat } from "node:fs/promises";
import { basename, join, posix } from "node:path";
import {
  IPC_CHANNELS,
  type AdministrationProtocol,
  type AssetInput,
  type AssetMetadata,
  type ConnectionProtocol,
  type DeviceIcon,
  type DeviceOsFamily,
  type HealthTarget,
  type MigrationRequest,
  type OpenPortInfo,
  type ProfileConnectionResult,
  type RdpConnectionConfig,
  type SerialConnectionConfig,
  type SerialParity,
  type ServerProfileInput,
  type SshConnectionConfig,
  type SshResizeRequest,
  type SshWriteRequest,
  type StreamConnectionConfig,
  type VncConnectionConfig,
  type WebBounds,
  type WebConnectionConfig,
} from "../shared/ipc";
import { HealthController } from "./health";
import { MigrationController } from "./migration";
import { RdpController } from "./rdp";
import { ScannerController } from "./scanner";
import { SerialController } from "./serial";
import { SshController } from "./ssh";
import { StreamController } from "./stream";
import { VaultController } from "./vault";
import { VncController } from "./vnc";
import { WebController } from "./web";

const sshController = new SshController();
const scannerController = new ScannerController();
const streamController = new StreamController();
const serialController = new SerialController();
const vncController = new VncController();
const healthController = new HealthController();
let rdpController: RdpController | null = null;
let vaultController: VaultController | null = null;
let webController: WebController | null = null;
let migrationController: MigrationController | null = null;
let mainWindow: BrowserWindow | null = null;
const hasSingleInstanceLock = app.requestSingleInstanceLock();

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 980,
    minHeight: 640,
    show: false,
    backgroundColor: "#080d14",
    title: "CyberGrid",
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.once("ready-to-show", () => window.show());
  window.on("closed", () => {
    if (mainWindow === window) {
      mainWindow = null;
    }
  });

  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (url !== window.webContents.getURL()) {
      event.preventDefault();
    }
  });

  void window.loadFile(join(__dirname, "../renderer/index.html"));
  return window;
}

function isTrustedSender(event: IpcMainEvent | IpcMainInvokeEvent): boolean {
  return Boolean(mainWindow && event.sender === mainWindow.webContents);
}

function assertTrustedSender(event: IpcMainInvokeEvent): void {
  if (!isTrustedSender(event)) {
    throw new Error("Rejected IPC request from an untrusted renderer.");
  }
}

function requireVault(): VaultController {
  if (!vaultController) {
    throw new Error("Credential vault is not initialized.");
  }
  return vaultController;
}

function requireRdp(): RdpController {
  if (!rdpController) {
    throw new Error("RDP controller is not initialized.");
  }
  return rdpController;
}

function requireWeb(): WebController {
  if (!webController) {
    throw new Error("Embedded browser controller is not initialized.");
  }
  return webController;
}

function requireMigration(): MigrationController {
  if (!migrationController) {
    throw new Error("Migration controller is not initialized.");
  }
  return migrationController;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(
  value: unknown,
  field: string,
  options: { required?: boolean; maxLength: number; trim?: boolean; singleLine?: boolean },
): string | undefined {
  if (value === undefined || value === null || value === "") {
    if (options.required) {
      throw new Error(`${field} is required.`);
    }
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`${field} must be a string.`);
  }
  const normalized = options.trim === false ? value : value.trim();
  if (options.required && normalized.length === 0) {
    throw new Error(`${field} is required.`);
  }
  if (normalized.length > options.maxLength) {
    throw new Error(`${field} is too long.`);
  }
  if (options.singleLine && /[\r\n\0]/.test(normalized)) {
    throw new Error(`${field} must be a single line.`);
  }
  return normalized;
}

function readPort(value: unknown, defaultPort = 22): number {
  const port = typeof value === "number" ? value : Number(value ?? defaultPort);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("Port must be an integer between 1 and 65535.");
  }
  return port;
}

function normalizeConnectionConfig(value: unknown): SshConnectionConfig {
  if (!isRecord(value)) {
    throw new Error("Invalid SSH connection configuration.");
  }

  const host = readString(value.host, "Host", {
    required: true,
    maxLength: 253,
    singleLine: true,
  });
  const username = readString(value.username, "Username", {
    required: true,
    maxLength: 128,
    singleLine: true,
  });
  const password = readString(value.password, "Password", {
    maxLength: 4_096,
    trim: false,
  });
  const privateKey = readString(value.privateKey, "Private key", {
    maxLength: 1_048_576,
    trim: false,
  });
  const passphrase = readString(value.passphrase, "Passphrase", {
    maxLength: 4_096,
    trim: false,
  });

  return {
    host: host as string,
    port: readPort(value.port),
    username: username as string,
    password,
    privateKey,
    passphrase,
    readyTimeout: 15_000,
  };
}

function normalizeRdpConfig(value: unknown): RdpConnectionConfig {
  if (!isRecord(value)) {
    throw new Error("Invalid RDP connection configuration.");
  }
  const host = readString(value.host, "Host", {
    required: true,
    maxLength: 253,
    singleLine: true,
  });
  const username = readString(value.username, "Username", {
    required: true,
    maxLength: 256,
    singleLine: true,
  });
  return {
    host: host as string,
    port: readPort(value.port, 3389),
    username: username as string,
  };
}

function normalizeProfileInput(value: unknown): ServerProfileInput {
  if (!isRecord(value)) {
    throw new Error("Invalid server profile.");
  }
  const protocol = readConnectionProtocol(value.protocol ?? "ssh");
  const host = readString(value.host, protocol === "serial" ? "Serial port" : "Host", {
    required: true,
    maxLength: protocol === "serial" ? 2_048 : 253,
    singleLine: true,
  }) as string;
  const authType = value.authType === "password" || value.authType === "privateKey"
    ? value.authType
    : "none";
  if (authType === "privateKey" && protocol !== "ssh") {
    throw new Error("Private-key authentication is only available for SSH profiles.");
  }
  const defaultPorts: Record<ConnectionProtocol, number> = {
    ssh: 22, rdp: 3389, telnet: 23, raw: 23, vnc: 5900,
    http: 80, https: 443, serial: 0,
  };
  const port = protocol === "serial" ? 0 : readPort(value.port, defaultPorts[protocol]);
  const profile: ServerProfileInput = {
    protocol,
    name: readString(value.name, "Display name", { required: true, maxLength: 100 }) as string,
    host,
    port,
    username: readString(value.username, "Username", {
      maxLength: 256,
      singleLine: true,
    }) ?? "",
    group: readString(value.group, "Folder", { maxLength: 100 }) ?? "Ungrouped",
    authType,
  };
  if (authType === "password") {
    profile.password = readString(value.password, "Password", {
      required: true,
      maxLength: 4_096,
      trim: false,
    });
  } else if (authType === "privateKey") {
    profile.privateKeyPath = readString(value.privateKeyPath, "Private key path", {
      required: true,
      maxLength: 2_048,
    });
    profile.passphrase = readString(value.passphrase, "Key passphrase", {
      maxLength: 4_096,
      trim: false,
    });
  }
  if (protocol === "serial") {
    const baudRate = Number(value.baudRate ?? 9_600);
    const dataBits = Number(value.dataBits ?? 8);
    const stopBits = Number(value.stopBits ?? 1);
    if (!Number.isInteger(baudRate) || baudRate < 50 || baudRate > 4_000_000) {
      throw new Error("Baud rate must be between 50 and 4,000,000.");
    }
    if (dataBits !== 5 && dataBits !== 6 && dataBits !== 7 && dataBits !== 8) {
      throw new Error("Data bits must be 5, 6, 7, or 8.");
    }
    if (stopBits !== 1 && stopBits !== 2) {
      throw new Error("Stop bits must be 1 or 2.");
    }
    profile.baudRate = baudRate;
    profile.dataBits = dataBits;
    profile.stopBits = stopBits;
    profile.parity = readSerialParity(value.parity ?? "none");
  }
  return profile;
}

function readConnectionProtocol(value: unknown): ConnectionProtocol {
  if (
    value === "ssh" || value === "rdp" || value === "telnet" || value === "raw" ||
    value === "vnc" || value === "http" || value === "https" || value === "serial"
  ) {
    return value;
  }
  throw new Error("Unsupported connection protocol.");
}

function readSerialParity(value: unknown): SerialParity {
  if (value === "none" || value === "even" || value === "odd" || value === "mark" || value === "space") {
    return value;
  }
  throw new Error("Serial parity must be none, even, odd, mark, or space.");
}

function readOsFamily(value: unknown): DeviceOsFamily {
  if (
    value === "Windows" ||
    value === "Linux" ||
    value === "Network appliance" ||
    value === "Printer" ||
    value === "Unknown"
  ) {
    return value;
  }
  throw new Error("Invalid asset OS family.");
}

function readDeviceIcon(value: unknown, required: boolean): DeviceIcon | undefined {
  if (value === undefined || value === "") {
    if (required) {
      throw new Error("Asset icon is required.");
    }
    return undefined;
  }
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
  throw new Error("Invalid asset icon.");
}

function readProtocol(value: unknown): AdministrationProtocol {
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
  throw new Error("Invalid administration protocol.");
}

function normalizeOpenPorts(value: unknown): OpenPortInfo[] {
  if (!Array.isArray(value) || value.length > 64) {
    throw new Error("Invalid asset port inventory.");
  }
  return value.map((candidate) => {
    if (!isRecord(candidate)) {
      throw new Error("Invalid asset port entry.");
    }
    return {
      port: readPort(candidate.port),
      protocol: readProtocol(candidate.protocol),
      banner: readString(candidate.banner, "Service banner", {
        maxLength: 240,
        singleLine: true,
      }),
    };
  });
}

function normalizeMetadata(value: unknown): AssetMetadata {
  if (!isRecord(value)) {
    throw new Error("Invalid asset metadata.");
  }
  return {
    serialNumber: readString(value.serialNumber, "Serial number", { maxLength: 128 }) ?? "",
    assetTag: readString(value.assetTag, "Asset tag", { maxLength: 128 }) ?? "",
    rackPosition: readString(value.rackPosition, "Rack position", { maxLength: 128 }) ?? "",
    site: readString(value.site, "Data center / site", { maxLength: 160 }) ?? "",
    osVersion: readString(value.osVersion, "OS version", { maxLength: 240 }) ?? "",
    maintenanceSla: readString(value.maintenanceSla, "Maintenance SLA", { maxLength: 240 }) ?? "",
  };
}

function normalizeAssetInput(value: unknown): AssetInput {
  if (!isRecord(value)) {
    throw new Error("Invalid asset record.");
  }
  const ipAddress = readString(value.ipAddress, "IP address", {
    required: true,
    maxLength: 15,
    singleLine: true,
  }) as string;
  const octets = ipAddress.split(".");
  if (
    octets.length !== 4 ||
    octets.some((octet) => !/^\d{1,3}$/.test(octet) || Number(octet) > 255)
  ) {
    throw new Error("Asset IP address must be a valid IPv4 address.");
  }

  const macAddress = readString(value.macAddress, "MAC address", {
    maxLength: 17,
    singleLine: true,
  });
  if (macAddress && !/^[0-9a-f]{2}(?::[0-9a-f]{2}){5}$/i.test(macAddress)) {
    throw new Error("Asset MAC address is invalid.");
  }

  const id = value.id === undefined ? undefined : readUuid(value.id, "asset ID");
  const lastSeenAt = readString(value.lastSeenAt, "Last seen timestamp", {
    required: true,
    maxLength: 64,
    singleLine: true,
  }) as string;
  if (!Number.isFinite(Date.parse(lastSeenAt))) {
    throw new Error("Asset last-seen timestamp is invalid.");
  }

  return {
    id,
    name: readString(value.name, "Asset name", { required: true, maxLength: 100 }) as string,
    ipAddress,
    hostname: readString(value.hostname, "Hostname", {
      maxLength: 253,
      singleLine: true,
    }),
    macAddress,
    vendor: readString(value.vendor, "Vendor", { maxLength: 200, singleLine: true }),
    osFamily: readOsFamily(value.osFamily),
    openPorts: normalizeOpenPorts(value.openPorts),
    suggestedIcon: readDeviceIcon(value.suggestedIcon, true) as DeviceIcon,
    iconOverride: readDeviceIcon(value.iconOverride, false),
    metadata: normalizeMetadata(value.metadata),
    lastSeenAt,
  };
}

function readMasterPassword(value: unknown): string {
  if (typeof value !== "string" || value.length > 1_024) {
    throw new Error("Invalid master password.");
  }
  return value;
}

function readUuid(value: unknown, field: string): string {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new Error(`Invalid ${field}.`);
  }
  return value;
}

function readRemotePath(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 4_096 || value.includes("\0")) {
    throw new Error("Invalid remote path.");
  }
  return value;
}

export function resolveEnvironmentTokens(value: string | undefined, field: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const resolved = value.replace(/\$\{([A-Z_][A-Z0-9_]*)\}/g, (_match, variableName: string) => {
    const replacement = process.env[variableName];
    if (replacement === undefined) {
      throw new Error(`${field} requires environment variable ${variableName}, but it is not defined.`);
    }
    return replacement;
  });
  if (resolved.includes("${")) {
    throw new Error(`${field} contains an invalid environment-variable token.`);
  }
  if (resolved.length > 1_048_576 || resolved.includes("\0")) {
    throw new Error(`${field} expands to an invalid value.`);
  }
  return resolved;
}

function normalizeStreamConfig(value: unknown): StreamConnectionConfig {
  if (!isRecord(value) || (value.protocol !== "telnet" && value.protocol !== "raw")) {
    throw new Error("Invalid Telnet/RAW connection configuration.");
  }
  return {
    protocol: value.protocol,
    host: readString(value.host, "Host", { required: true, maxLength: 253, singleLine: true }) as string,
    port: readPort(value.port, value.protocol === "telnet" ? 23 : 23),
  };
}

function normalizeSerialConfig(value: unknown): SerialConnectionConfig {
  if (!isRecord(value)) {
    throw new Error("Invalid serial connection configuration.");
  }
  const baudRate = Number(value.baudRate ?? 9_600);
  const dataBits = Number(value.dataBits ?? 8);
  const stopBits = Number(value.stopBits ?? 1);
  if (!Number.isInteger(baudRate) || baudRate < 50 || baudRate > 4_000_000) {
    throw new Error("Baud rate must be between 50 and 4,000,000.");
  }
  if (dataBits !== 5 && dataBits !== 6 && dataBits !== 7 && dataBits !== 8) {
    throw new Error("Data bits must be 5, 6, 7, or 8.");
  }
  if (stopBits !== 1 && stopBits !== 2) {
    throw new Error("Stop bits must be 1 or 2.");
  }
  return {
    path: readString(value.path, "Serial port", { required: true, maxLength: 2_048, singleLine: true }) as string,
    baudRate,
    dataBits,
    stopBits,
    parity: readSerialParity(value.parity ?? "none"),
  };
}

function normalizeVncConfig(value: unknown): VncConnectionConfig {
  if (!isRecord(value)) {
    throw new Error("Invalid VNC connection configuration.");
  }
  return {
    host: readString(value.host, "Host", { required: true, maxLength: 253, singleLine: true }) as string,
    port: readPort(value.port, 5900),
    password: readString(value.password, "VNC password", { maxLength: 4_096, trim: false }),
  };
}

function normalizeWebConfig(value: unknown): WebConnectionConfig {
  if (!isRecord(value)) {
    throw new Error("Invalid embedded browser configuration.");
  }
  const url = readString(value.url, "Web URL", { required: true, maxLength: 2_048, singleLine: true }) as string;
  const parsed = new URL(url);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Embedded browser URLs must use HTTP or HTTPS.");
  }
  return { url: parsed.toString() };
}

function normalizeWebBounds(value: unknown): WebBounds {
  if (!isRecord(value)) {
    throw new Error("Invalid browser bounds.");
  }
  const bounds: WebBounds = {
    x: Number(value.x), y: Number(value.y), width: Number(value.width), height: Number(value.height),
  };
  if (Object.values(bounds).some((candidate) => !Number.isFinite(candidate) || candidate < 0 || candidate > 20_000)) {
    throw new Error("Invalid browser bounds.");
  }
  return bounds;
}

function normalizeMigrationRequest(value: unknown): MigrationRequest {
  if (!isRecord(value)) {
    throw new Error("Invalid migration request.");
  }
  const format = value.format;
  if (format !== "auto" && format !== "mremoteng" && format !== "putty" && format !== "csv" && format !== "cgvault") {
    throw new Error("Unsupported migration format.");
  }
  return {
    format,
    teamPassphrase: readString(value.teamPassphrase, "Team passphrase", {
      maxLength: 1_024,
      trim: false,
    }),
  };
}

async function connectionConfigForProfile(profileId: string): Promise<SshConnectionConfig> {
  const profile = requireVault().getConnectionProfile(profileId);
  if (profile.protocol !== "ssh") {
    throw new Error("Selected profile is not an SSH connection.");
  }
  const baseConfig: SshConnectionConfig = {
    host: resolveEnvironmentTokens(profile.host, "Host") as string,
    port: profile.port,
    username: resolveEnvironmentTokens(profile.username, "Username") ?? "",
    readyTimeout: 15_000,
  };

  if (profile.authType === "password") {
    return { ...baseConfig, password: resolveEnvironmentTokens(profile.password, "Password") };
  }

  if (profile.authType === "none") {
    return baseConfig;
  }

  const privateKeyPath = resolveEnvironmentTokens(profile.privateKeyPath, "Private key path") as string;
  const keyInfo = await stat(privateKeyPath).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") {
      throw new Error(`Private key file not found: ${privateKeyPath}`);
    }
    throw error;
  });
  if (!keyInfo.isFile() || keyInfo.size > 1_048_576) {
    throw new Error("Private key must be a file smaller than 1 MB.");
  }

  return {
    ...baseConfig,
    privateKey: await readFile(privateKeyPath, "utf8"),
    passphrase: resolveEnvironmentTokens(profile.passphrase, "Private key passphrase"),
  };
}

async function connectProfile(profileId: string, sender: WebContents): Promise<ProfileConnectionResult> {
  const profile = requireVault().getConnectionProfile(profileId);
  const host = resolveEnvironmentTokens(profile.host, profile.protocol === "serial" ? "Serial port" : "Host") as string;
  const username = resolveEnvironmentTokens(profile.username, "Username") ?? "";
  switch (profile.protocol) {
    case "ssh":
      return { protocol: "ssh", sessionId: sshController.connect(await connectionConfigForProfile(profileId), sender) };
    case "rdp":
      return { protocol: "rdp", sessionId: await requireRdp().connect({ host, port: profile.port, username }, sender) };
    case "telnet":
    case "raw":
      return {
        protocol: profile.protocol,
        sessionId: streamController.connect({ protocol: profile.protocol, host, port: profile.port }, sender),
      };
    case "serial":
      return {
        protocol: "serial",
        sessionId: serialController.connect({
          path: host,
          baudRate: profile.baudRate ?? 9_600,
          dataBits: profile.dataBits ?? 8,
          stopBits: profile.stopBits ?? 1,
          parity: profile.parity ?? "none",
        }, sender),
      };
    case "vnc": {
      const result = await vncController.connect({
        host,
        port: profile.port,
        password: resolveEnvironmentTokens(profile.password, "VNC password"),
      }, sender);
      return { protocol: "vnc", ...result };
    }
    case "http":
    case "https": {
      const defaultPort = profile.protocol === "https" ? 443 : 80;
      const normalizedHost = host.replace(/^https?:\/\//i, "").replace(/\/$/, "");
      const port = profile.port === defaultPort ? "" : `:${profile.port}`;
      const sessionId = await requireWeb().connect({ url: `${profile.protocol}://${normalizedHost}${port}/` }, sender);
      return { protocol: profile.protocol, sessionId };
    }
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.sshConnect, (event, config: unknown) => {
    assertTrustedSender(event);
    return sshController.connect(normalizeConnectionConfig(config), event.sender);
  });

  ipcMain.handle(IPC_CHANNELS.sshConnectProfile, async (event, profileId: unknown) => {
    assertTrustedSender(event);
    const config = await connectionConfigForProfile(readUuid(profileId, "server profile ID"));
    return sshController.connect(config, event.sender);
  });

  ipcMain.handle(IPC_CHANNELS.profileConnect, async (event, profileId: unknown) => {
    assertTrustedSender(event);
    return connectProfile(readUuid(profileId, "server profile ID"), event.sender);
  });

  ipcMain.handle(IPC_CHANNELS.sshDisconnect, (event, sessionId: unknown) => {
    assertTrustedSender(event);
    sshController.disconnect(readUuid(sessionId, "SSH session ID"));
  });

  ipcMain.handle(
    IPC_CHANNELS.sftpList,
    async (event, sessionId: unknown, remotePath: unknown) => {
      assertTrustedSender(event);
      return sshController.listDirectory(
        readUuid(sessionId, "SSH session ID"),
        readRemotePath(remotePath),
      );
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.sftpUpload,
    async (event, sessionId: unknown, remoteDirectory: unknown) => {
      assertTrustedSender(event);
      if (!mainWindow) {
        return [];
      }
      const id = readUuid(sessionId, "SSH session ID");
      const directory = readRemotePath(remoteDirectory);
      const selection = await dialog.showOpenDialog(mainWindow, {
        title: "Upload files over SFTP",
        properties: ["openFile", "multiSelections"],
      });
      if (selection.canceled) {
        return [];
      }

      const uploadedPaths: string[] = [];
      for (const localPath of selection.filePaths) {
        const remotePath = posix.join(directory, basename(localPath));
        await sshController.uploadFile(id, localPath, remotePath);
        uploadedPaths.push(remotePath);
      }
      return uploadedPaths;
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.sftpDownload,
    async (event, sessionId: unknown, remotePath: unknown) => {
      assertTrustedSender(event);
      if (!mainWindow) {
        return null;
      }
      const id = readUuid(sessionId, "SSH session ID");
      const sourcePath = readRemotePath(remotePath);
      const selection = await dialog.showSaveDialog(mainWindow, {
        title: "Download file over SFTP",
        defaultPath: posix.basename(sourcePath),
      });
      if (selection.canceled || !selection.filePath) {
        return null;
      }
      await sshController.downloadFile(id, sourcePath, selection.filePath);
      return selection.filePath;
    },
  );

  ipcMain.handle(IPC_CHANNELS.rdpIsSupported, (event) => {
    assertTrustedSender(event);
    return requireRdp().isSupported();
  });

  ipcMain.handle(IPC_CHANNELS.rdpConnect, async (event, config: unknown) => {
    assertTrustedSender(event);
    return requireRdp().connect(normalizeRdpConfig(config), event.sender);
  });

  ipcMain.handle(IPC_CHANNELS.rdpDisconnect, (event, sessionId: unknown) => {
    assertTrustedSender(event);
    requireRdp().disconnect(readUuid(sessionId, "RDP session ID"));
  });

  ipcMain.handle(IPC_CHANNELS.streamConnect, (event, config: unknown) => {
    assertTrustedSender(event);
    return streamController.connect(normalizeStreamConfig(config), event.sender);
  });

  ipcMain.handle(IPC_CHANNELS.streamDisconnect, (event, sessionId: unknown) => {
    assertTrustedSender(event);
    streamController.disconnect(readUuid(sessionId, "terminal socket session ID"));
  });

  ipcMain.handle(IPC_CHANNELS.serialList, async (event) => {
    assertTrustedSender(event);
    return serialController.listPorts();
  });

  ipcMain.handle(IPC_CHANNELS.serialConnect, (event, config: unknown) => {
    assertTrustedSender(event);
    return serialController.connect(normalizeSerialConfig(config), event.sender);
  });

  ipcMain.handle(IPC_CHANNELS.serialDisconnect, (event, sessionId: unknown) => {
    assertTrustedSender(event);
    serialController.disconnect(readUuid(sessionId, "serial session ID"));
  });

  ipcMain.handle(IPC_CHANNELS.vncConnect, async (event, config: unknown) => {
    assertTrustedSender(event);
    return vncController.connect(normalizeVncConfig(config), event.sender);
  });

  ipcMain.handle(IPC_CHANNELS.vncDisconnect, (event, sessionId: unknown) => {
    assertTrustedSender(event);
    vncController.disconnect(readUuid(sessionId, "VNC session ID"));
  });

  ipcMain.handle(IPC_CHANNELS.webConnect, async (event, config: unknown) => {
    assertTrustedSender(event);
    return requireWeb().connect(normalizeWebConfig(config), event.sender);
  });

  ipcMain.handle(IPC_CHANNELS.webDisconnect, (event, sessionId: unknown) => {
    assertTrustedSender(event);
    requireWeb().disconnect(readUuid(sessionId, "browser session ID"));
  });

  ipcMain.on(IPC_CHANNELS.webSetBounds, (event, sessionId: unknown, bounds: unknown) => {
    if (!isTrustedSender(event)) return;
    try {
      requireWeb().setBounds(readUuid(sessionId, "browser session ID"), normalizeWebBounds(bounds));
    } catch (error) {
      console.warn("Rejected embedded browser bounds:", error);
    }
  });

  ipcMain.on(IPC_CHANNELS.webSetVisible, (event, sessionId: unknown, visible: unknown) => {
    if (!isTrustedSender(event) || typeof visible !== "boolean") return;
    try {
      requireWeb().setVisible(readUuid(sessionId, "browser session ID"), visible);
    } catch (error) {
      console.warn("Rejected embedded browser visibility update:", error);
    }
  });

  ipcMain.handle(IPC_CHANNELS.vaultStatus, async (event) => {
    assertTrustedSender(event);
    return requireVault().status();
  });

  ipcMain.handle(IPC_CHANNELS.vaultCreate, async (event, masterPassword: unknown) => {
    assertTrustedSender(event);
    await requireVault().create(readMasterPassword(masterPassword));
  });

  ipcMain.handle(IPC_CHANNELS.vaultUnlock, async (event, masterPassword: unknown) => {
    assertTrustedSender(event);
    await requireVault().unlock(readMasterPassword(masterPassword));
  });

  ipcMain.handle(IPC_CHANNELS.vaultLock, (event) => {
    assertTrustedSender(event);
    scannerController.cancelAll();
    healthController.stop();
    sshController.disconnectAll("Credential vault locked.");
    streamController.disconnectAll();
    serialController.disconnectAll();
    vncController.disconnectAll();
    requireWeb().disconnectAll();
    requireRdp().disconnectAll();
    requireVault().lock();
  });

  ipcMain.handle(IPC_CHANNELS.vaultListProfiles, (event) => {
    assertTrustedSender(event);
    return requireVault().listProfiles();
  });

  ipcMain.handle(IPC_CHANNELS.vaultSaveProfile, async (event, profile: unknown) => {
    assertTrustedSender(event);
    return requireVault().saveProfile(normalizeProfileInput(profile));
  });

  ipcMain.handle(IPC_CHANNELS.vaultDeleteProfile, async (event, profileId: unknown) => {
    assertTrustedSender(event);
    await requireVault().deleteProfile(readUuid(profileId, "server profile ID"));
  });

  ipcMain.handle(IPC_CHANNELS.vaultListAssets, (event) => {
    assertTrustedSender(event);
    return requireVault().listAssets();
  });

  ipcMain.handle(IPC_CHANNELS.vaultSaveAsset, async (event, asset: unknown) => {
    assertTrustedSender(event);
    return requireVault().saveAsset(normalizeAssetInput(asset));
  });

  ipcMain.handle(IPC_CHANNELS.vaultDeleteAsset, async (event, assetId: unknown) => {
    assertTrustedSender(event);
    await requireVault().deleteAsset(readUuid(assetId, "asset ID"));
  });

  ipcMain.handle(IPC_CHANNELS.discoveryStart, (event, target: unknown) => {
    assertTrustedSender(event);
    const normalizedTarget = readString(target, "Scan target", {
      required: true,
      maxLength: 64,
      singleLine: true,
    });
    return scannerController.start(normalizedTarget as string, event.sender);
  });

  ipcMain.handle(IPC_CHANNELS.discoveryCancel, (event, scanId: unknown) => {
    assertTrustedSender(event);
    scannerController.cancel(readUuid(scanId, "scan ID"));
  });

  ipcMain.handle(IPC_CHANNELS.healthSetTargets, (event, targets: unknown) => {
    assertTrustedSender(event);
    if (!Array.isArray(targets) || targets.length > 2_000) {
      throw new Error("Invalid health-monitor target list.");
    }
    const normalized: HealthTarget[] = targets.map((target) => {
      if (!isRecord(target)) throw new Error("Invalid health-monitor target.");
      const profileId = readUuid(target.profileId, "health profile ID");
      const profile = requireVault().getConnectionProfile(profileId);
      let host = "invalid.invalid";
      try {
        host = resolveEnvironmentTokens(profile.host, "Health-check host") as string;
      } catch {
        // A teammate may not have populated a profile's local token yet. Keep the
        // remaining health sweep active and report this target as unreachable.
      }
      return {
        profileId,
        host,
        protocol: profile.protocol,
      };
    });
    healthController.setTargets(normalized, event.sender);
  });

  ipcMain.handle(IPC_CHANNELS.healthRefresh, async (event) => {
    assertTrustedSender(event);
    await healthController.sweep();
  });

  ipcMain.handle(IPC_CHANNELS.migrationImport, async (event, rawRequest: unknown) => {
    assertTrustedSender(event);
    const parsed = await requireMigration().importConnections(normalizeMigrationRequest(rawRequest));
    if (!parsed) return null;
    const warnings = [...parsed.warnings];
    const profiles: ServerProfileInput[] = [];
    for (const candidate of parsed.profiles) {
      try {
        profiles.push(normalizeProfileInput(candidate));
      } catch (error) {
        warnings.push(`Skipped profile: ${error instanceof Error ? error.message : "invalid data"}`);
      }
    }
    const imported = await requireVault().importProfiles(profiles);
    for (const candidate of parsed.assets) {
      try {
        const asset = normalizeAssetInput(candidate);
        await requireVault().saveAsset({ ...asset, id: undefined });
      } catch (error) {
        warnings.push(`Skipped asset: ${error instanceof Error ? error.message : "invalid data"}`);
      }
    }
    return { imported, warnings, path: parsed.path };
  });

  ipcMain.handle(IPC_CHANNELS.migrationExport, async (event, rawRequest: unknown) => {
    assertTrustedSender(event);
    return requireMigration().exportConnections(
      normalizeMigrationRequest(rawRequest),
      requireVault().exportProfiles(),
      requireVault().listAssets(),
    );
  });

  ipcMain.handle(IPC_CHANNELS.selectPrivateKey, async (event) => {
    assertTrustedSender(event);
    if (!mainWindow) {
      return null;
    }
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Select SSH private key",
      properties: ["openFile"],
      filters: [
        { name: "SSH private keys", extensions: ["pem", "key", "ppk"] },
        { name: "All files", extensions: ["*"] },
      ],
    });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });

  ipcMain.on(IPC_CHANNELS.sshWrite, (event, request: unknown) => {
    if (!isTrustedSender(event)) {
      return;
    }
    try {
      if (!isRecord(request) || typeof request.data !== "string") {
        throw new Error("Invalid SSH write request.");
      }
      const payload: SshWriteRequest = {
        sessionId: readUuid(request.sessionId, "SSH session ID"),
        data: request.data,
      };
      sshController.write(payload.sessionId, payload.data);
    } catch (error) {
      console.warn("Rejected SSH write request:", error);
    }
  });

  ipcMain.on(IPC_CHANNELS.streamWrite, (event, request: unknown) => {
    if (!isTrustedSender(event)) return;
    try {
      if (!isRecord(request) || typeof request.data !== "string") throw new Error("Invalid stream write.");
      streamController.write(readUuid(request.sessionId, "terminal socket session ID"), request.data);
    } catch (error) {
      console.warn("Rejected terminal socket write:", error);
    }
  });

  ipcMain.on(IPC_CHANNELS.serialWrite, (event, request: unknown) => {
    if (!isTrustedSender(event)) return;
    try {
      if (!isRecord(request) || typeof request.data !== "string") throw new Error("Invalid serial write.");
      serialController.write(readUuid(request.sessionId, "serial session ID"), request.data);
    } catch (error) {
      console.warn("Rejected serial write:", error);
    }
  });

  ipcMain.on(IPC_CHANNELS.sshResize, (event, request: unknown) => {
    if (!isTrustedSender(event)) {
      return;
    }
    try {
      if (!isRecord(request)) {
        throw new Error("Invalid SSH resize request.");
      }

      const payload: SshResizeRequest = {
        sessionId: readUuid(request.sessionId, "SSH session ID"),
        cols: Number(request.cols),
        rows: Number(request.rows),
      };
      if (
        !Number.isInteger(payload.cols) ||
        !Number.isInteger(payload.rows) ||
        payload.cols < 2 ||
        payload.cols > 1_000 ||
        payload.rows < 1 ||
        payload.rows > 1_000
      ) {
        throw new Error("Invalid terminal dimensions.");
      }
      sshController.resize(payload.sessionId, payload.cols, payload.rows);
    } catch (error) {
      console.warn("Rejected SSH resize request:", error);
    }
  });
}

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show();
      mainWindow.focus();
    }
  });

  void app.whenReady().then(() => {
    vaultController = new VaultController(
      join(app.getPath("userData"), "cybergrid-vault.json"),
    );
    rdpController = new RdpController(join(app.getPath("temp"), "CyberGrid", "rdp"));
    webController = new WebController(() => mainWindow);
    migrationController = new MigrationController(() => mainWindow);
    registerIpcHandlers();
    mainWindow = createMainWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createMainWindow();
      }
    });
  });
}

app.on("before-quit", () => {
  scannerController.cancelAll();
  healthController.stop();
  sshController.disconnectAll();
  streamController.disconnectAll();
  serialController.disconnectAll();
  vncController.disconnectAll();
  webController?.disconnectAll();
  rdpController?.disconnectAll();
  vaultController?.lock();
});

app.on("window-all-closed", () => {
  scannerController.cancelAll();
  healthController.stop();
  sshController.disconnectAll();
  streamController.disconnectAll();
  serialController.disconnectAll();
  vncController.disconnectAll();
  webController?.disconnectAll();
  rdpController?.disconnectAll();
  vaultController?.lock();
  if (process.platform !== "darwin") {
    app.quit();
  }
});
