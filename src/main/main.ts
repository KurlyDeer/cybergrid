import {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  session,
  Tray,
  type MenuItemConstructorOptions,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
  type ProxyConfig,
  type WebContents,
} from "electron";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { lookup } from "node:dns/promises";
import { basename, join, posix, resolve, sep } from "node:path";
import {
  IPC_CHANNELS,
  type AppPreferences,
  type AdministrationProtocol,
  type AssetInput,
  type AssetMetadata,
  type ConfigBackupInput,
  type ConnectionCategory,
  type ConnectionProtocol,
  type ConnectionTaskInput,
  type DeviceIcon,
  type DeviceOsFamily,
  type DiagnosticKind,
  type ExternalToolInput,
  type FolderDefaultsInput,
  type HealthTarget,
  type InventorySyncSourceInput,
  type MigrationRequest,
  type OpenPortInfo,
  type ProfileConnectionResult,
  type RdpConnectionConfig,
  type SerialConnectionConfig,
  type SerialParity,
  type ServerProfileInput,
  type ScreenshotRequest,
  type SnippetInput,
  type SnippetLanguage,
  type SshConnectionConfig,
  type SshResizeRequest,
  type SshWriteRequest,
  type StreamConnectionConfig,
  type TerminalAppearanceOverrides,
  type VncConnectionConfig,
  type WebBounds,
  type WebConnectionConfig,
  type WorkspaceSnapshot,
} from "../shared/ipc";
import { AuditController, type AuditSessionContext } from "./audit";
import type { AutoUnlockController } from "./auto-unlock";
import { runDiagnostic } from "./diagnostics";
import { launchExternalTool, runConnectionTasks } from "./enterprise";
import { HealthController } from "./health";
import { discoverInventory } from "./inventory-sync";
import type { MigrationController } from "./migration";
import type { PreferencesController } from "./preferences";
import { RdpController } from "./rdp";
import type { ScannerController } from "./scanner";
import type { SerialController } from "./serial";
import type { SshController } from "./ssh";
import { StreamController } from "./stream";
import { generateTotp, validateTotpSecret } from "./totp";
import type { VaultController } from "./vault";
import type { VncController } from "./vnc";
import { WebController } from "./web";

let displayingFatalError = false;

function errorStack(reason: unknown): string {
  if (reason instanceof Error) return reason.stack ?? `${reason.name}: ${reason.message}`;
  return typeof reason === "string" ? reason : JSON.stringify(reason, null, 2) || String(reason);
}

function reportFatalError(source: string, reason: unknown): void {
  const stack = errorStack(reason);
  console.error(`[CyberGrid ${source}]`, stack);
  if (displayingFatalError) return;
  displayingFatalError = true;
  try {
    dialog.showErrorBox(`CyberGrid ${source}`, stack);
  } catch (dialogError) {
    console.error("CyberGrid could not display the native error dialog:", dialogError);
  } finally {
    displayingFatalError = false;
  }
}

process.on("uncaughtException", (error) => reportFatalError("uncaught exception", error));
process.on("unhandledRejection", (reason) => reportFatalError("unhandled promise rejection", reason));

app.commandLine.appendSwitch("disable-gpu-process-crash-limit");

const auditController = new AuditController();
const streamController = new StreamController(auditController);
const healthController = new HealthController();
let scannerController: ScannerController | null = null;
let scannerControllerPromise: Promise<ScannerController> | null = null;
let vncController: VncController | null = null;
let vncControllerPromise: Promise<VncController> | null = null;
let sshController: SshController | null = null;
let sshControllerPromise: Promise<SshController> | null = null;
let serialController: SerialController | null = null;
let serialControllerPromise: Promise<SerialController> | null = null;
let rdpController: RdpController | null = null;
let vaultController: VaultController | null = null;
let webController: WebController | null = null;
let migrationController: MigrationController | null = null;
let migrationControllerPromise: Promise<MigrationController> | null = null;
let preferencesController: PreferencesController | null = null;
let autoUnlockController: AutoUnlockController | null = null;
let mainWindow: BrowserWindow | null = null;
let quickLauncherWindow: BrowserWindow | null = null;
let applicationUpdater: import("electron-updater").AppUpdater | null = null;
let applicationUpdaterConfigured = false;
let tray: Tray | null = null;
let autoLockTimer: NodeJS.Timeout | undefined;
let isQuitting = false;
let servicesReadyResolve!: () => void;
let servicesReadyReject!: (reason: unknown) => void;
const servicesReady = new Promise<void>((resolveReady, rejectReady) => {
  servicesReadyResolve = resolveReady;
  servicesReadyReject = rejectReady;
});
void servicesReady.catch(() => undefined);
const hasSingleInstanceLock = app.requestSingleInstanceLock();
app.setAppUserModelId("com.kurlydeer.cybergrid");

function sendUpdateEvent(
  channel: typeof IPC_CHANNELS.appUpdateAvailable | typeof IPC_CHANNELS.appUpdateDownloaded,
  version: string,
): void {
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) return;
  mainWindow.webContents.send(channel, { version });
}

async function configureAutoUpdater(): Promise<void> {
  if (!app.isPackaged || applicationUpdaterConfigured || isQuitting) return;
  applicationUpdaterConfigured = true;
  const { autoUpdater } = await import("electron-updater");
  applicationUpdater = autoUpdater;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("update-available", (info) => {
    sendUpdateEvent(IPC_CHANNELS.appUpdateAvailable, info.version);
  });
  autoUpdater.on("update-downloaded", (info) => {
    sendUpdateEvent(IPC_CHANNELS.appUpdateDownloaded, info.version);
  });
  autoUpdater.on("error", (error) => {
    console.warn("CyberGrid update check failed:", error);
  });
  await autoUpdater.checkForUpdatesAndNotify();
}

function scheduleUpdateCheck(): void {
  if (!app.isPackaged) return;
  const timer = setTimeout(() => {
    void servicesReady
      .then(configureAutoUpdater)
      .catch((error: unknown) => console.warn("CyberGrid updater did not start:", error));
  }, 2_000);
  timer.unref();
}

async function getSshController(): Promise<SshController> {
  if (sshController) return sshController;
  sshControllerPromise ??= import("./ssh.js").then(({ SshController }) => {
    const controller = new SshController(auditController);
    sshController = controller;
    return controller;
  });
  return sshControllerPromise;
}

async function getSerialController(): Promise<SerialController> {
  if (serialController) return serialController;
  serialControllerPromise ??= import("./serial.js").then(({ SerialController }) => {
    const controller = new SerialController(auditController);
    serialController = controller;
    return controller;
  });
  return serialControllerPromise;
}

async function getScannerController(): Promise<ScannerController> {
  if (scannerController) return scannerController;
  scannerControllerPromise ??= import("./scanner.js").then(({ ScannerController }) => {
    const controller = new ScannerController();
    scannerController = controller;
    return controller;
  });
  return scannerControllerPromise;
}

async function getVncController(): Promise<VncController> {
  if (vncController) return vncController;
  vncControllerPromise ??= import("./vnc.js").then(({ VncController }) => {
    const controller = new VncController();
    vncController = controller;
    return controller;
  });
  return vncControllerPromise;
}

async function getMigrationController(): Promise<MigrationController> {
  if (migrationController) return migrationController;
  migrationControllerPromise ??= import("./migration.js").then(({ MigrationController }) => {
    const controller = new MigrationController(() => mainWindow);
    migrationController = controller;
    return controller;
  });
  return migrationControllerPromise;
}

function applicationFile(...segments: string[]): string {
  const applicationRoot = app.isPackaged ? app.getAppPath() : resolve(__dirname, "..", "..");
  return join(applicationRoot, "build", ...segments);
}

function userDataFile(...segments: string[]): string {
  const userDataRoot = resolve(app.getPath("userData"));
  const target = resolve(userDataRoot, ...segments);
  if (target !== userDataRoot && !target.startsWith(`${userDataRoot}${sep}`)) {
    throw new Error(`Refused storage path outside Electron userData: ${target}`);
  }
  return target;
}

function normalizeWorkspaceSnapshot(value: unknown): WorkspaceSnapshot {
  if (!isRecord(value) || !Array.isArray(value.profileIds) || value.profileIds.length > 32) {
    throw new Error("Invalid workspace snapshot.");
  }
  const profileIds = value.profileIds.map((id) => readUuid(id, "workspace profile ID"));
  const activeProfileId = value.activeProfileId === undefined
    ? undefined : readUuid(value.activeProfileId, "active workspace profile ID");
  const requestedActiveIndex = Number(value.activeIndex);
  const activeIndex = Number.isInteger(requestedActiveIndex) && requestedActiveIndex >= 0 && requestedActiveIndex < profileIds.length
    ? requestedActiveIndex : undefined;
  return {
    profileIds,
    activeProfileId: activeProfileId && profileIds.includes(activeProfileId) ? activeProfileId : undefined,
    activeIndex,
    layout: value.layout === "grid" ? "grid" : "single",
    updatedAt: new Date().toISOString(),
  };
}

async function loadWorkspaceSnapshot(): Promise<WorkspaceSnapshot> {
  const workspacePath = userDataFile("cybergrid-workspace.json");
  const info = await stat(workspacePath).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return undefined;
    throw error;
  });
  if (!info) return { profileIds: [], layout: "single", updatedAt: new Date(0).toISOString() };
  if (!info.isFile() || info.size > 64 * 1024) throw new Error("Workspace snapshot is invalid or too large.");
  return normalizeWorkspaceSnapshot(JSON.parse(await readFile(workspacePath, "utf8")) as unknown);
}

async function saveWorkspaceSnapshot(value: unknown): Promise<void> {
  const snapshot = normalizeWorkspaceSnapshot(value);
  const workspacePath = userDataFile("cybergrid-workspace.json");
  const temporaryPath = `${workspacePath}.${process.pid}.tmp`;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(snapshot, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    await rename(temporaryPath, workspacePath);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

const rendererRestartHistory = new Map<number, number[]>();

app.on("child-process-gone", (_event, details) => {
  console.error("[CyberGrid child process terminated]", {
    type: details.type,
    reason: details.reason,
    exitCode: details.exitCode,
    serviceName: details.serviceName,
    name: details.name,
  });
});

app.on("render-process-gone", (_event, contents, details) => {
  if (isQuitting || details.reason === "clean-exit") return;
  const now = Date.now();
  const recentRestarts = (rendererRestartHistory.get(contents.id) ?? [])
    .filter((timestamp) => now - timestamp < 60_000);
  if (recentRestarts.length >= 3) {
    reportFatalError(
      "renderer crash loop",
      new Error(`Renderer ${contents.id} stopped repeatedly (${details.reason}, exit ${details.exitCode}).`),
    );
    return;
  }
  recentRestarts.push(now);
  rendererRestartHistory.set(contents.id, recentRestarts);
  const delay = 200 * recentRestarts.length;
  console.error(
    `[CyberGrid renderer ${contents.id} terminated: ${details.reason}; restarting in ${delay}ms]`,
  );
  const restartTimer = setTimeout(() => {
    if (isQuitting || contents.isDestroyed()) return;
    try {
      contents.reload();
    } catch (error) {
      reportFatalError("renderer restart failure", error);
    }
  }, delay);
  restartTimer.unref();
});

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 980,
    minHeight: 640,
    show: false,
    backgroundColor: "#1e1e1e",
    title: "CyberGrid",
    webPreferences: {
      preload: applicationFile("main", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  let revealed = false;
  const revealWindow = (): void => {
    if (revealed || window.isDestroyed()) return;
    revealed = true;
    window.show();
    setImmediate(startBackgroundServices);
    scheduleUpdateCheck();
  };
  window.once("ready-to-show", revealWindow);
  window.webContents.once("dom-ready", () => setImmediate(revealWindow));
  window.on("minimize", () => {
    if (preferencesController?.get().minimizeToTray && !isQuitting) {
      setImmediate(() => window.hide());
    }
  });
  window.on("close", (event) => {
    if (preferencesController?.get().minimizeToTray && !isQuitting) {
      event.preventDefault();
      window.hide();
    }
  });
  window.on("session-end", () => {
    isQuitting = true;
  });
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

  void window.loadFile(applicationFile("renderer", "index.html")).catch((error: unknown) => {
    reportFatalError("renderer load failure", error);
  });
  return window;
}

function destroyQuickLauncher(): void {
  if (quickLauncherWindow && !quickLauncherWindow.isDestroyed()) quickLauncherWindow.destroy();
  quickLauncherWindow = null;
}

function createQuickLauncherWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 620,
    height: 360,
    show: false,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: "#0d1520",
    title: "CyberGrid Quick Launcher",
    webPreferences: {
      preload: applicationFile("main", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  quickLauncherWindow = window;
  window.setAlwaysOnTop(true, "pop-up-menu");
  window.once("ready-to-show", () => {
    if (window.isDestroyed()) return;
    window.center();
    window.show();
    window.focus();
  });
  window.on("blur", () => destroyQuickLauncher());
  window.on("closed", () => {
    if (quickLauncherWindow === window) quickLauncherWindow = null;
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (url !== window.webContents.getURL()) event.preventDefault();
  });
  void window.loadFile(applicationFile("renderer", "launcher.html")).catch((error: unknown) => {
    destroyQuickLauncher();
    reportFatalError("quick launcher load failure", error);
  });
  return window;
}

function toggleQuickLauncher(): void {
  if (quickLauncherWindow && !quickLauncherWindow.isDestroyed()) {
    destroyQuickLauncher();
    return;
  }
  createQuickLauncherWindow();
}

function registerGlobalQuickLauncher(): void {
  const registered = globalShortcut.register("Alt+Space", toggleQuickLauncher);
  if (!registered) {
    console.warn("CyberGrid could not register Alt+Space; the shortcut may be reserved by the operating system.");
    globalShortcut.register("CommandOrControl+Alt+Space", toggleQuickLauncher);
  }
}

function isTrustedSender(event: IpcMainEvent | IpcMainInvokeEvent): boolean {
  return Boolean(
    (mainWindow && event.sender === mainWindow.webContents) ||
    (quickLauncherWindow && event.sender === quickLauncherWindow.webContents),
  );
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

function requirePreferences(): PreferencesController {
  if (!preferencesController) {
    throw new Error("Application preferences are not initialized.");
  }
  return preferencesController;
}

function requireAutoUnlock(): AutoUnlockController {
  if (!autoUnlockController) {
    throw new Error("Automatic vault unlock is not initialized.");
  }
  return autoUnlockController;
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

function readTags(value: unknown, field: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 20) {
    throw new Error(`${field} must contain at most 20 tags.`);
  }
  return [...new Set(value.map((tag) =>
    readString(tag, field, { required: true, maxLength: 32, singleLine: true }) as string,
  ))];
}

function readOptionalInteger(value: unknown, field: string, minimum: number, maximum: number): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${field} must be an integer between ${minimum} and ${maximum}.`);
  }
  return parsed;
}

function readUuidArray(value: unknown, field: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 50) throw new Error(`${field} contains too many values.`);
  return [...new Set(value.map((item) => readUuid(item, field)))];
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
  const category: ConnectionCategory = value.category === "network" || value.category === "web" || value.category === "desktop"
    ? value.category : "server";
  const profile: ServerProfileInput = {
    category,
    protocol,
    name: readString(value.name, "Display name", { required: true, maxLength: 100 }) as string,
    host,
    port,
    username: readString(value.username, "Username", {
      maxLength: 256,
      singleLine: true,
    }) ?? "",
    group: value.group === undefined || value.group === ""
      ? "Ungrouped" : normalizeFolderPath(value.group),
    authType,
    tags: readTags(value.tags, "Profile tags"),
    favorite: value.favorite === true,
    inheritFolderDefaults: value.inheritFolderDefaults !== false,
    domain: readString(value.domain, "Domain", { maxLength: 256, singleLine: true }),
    readyTimeoutSeconds: readOptionalInteger(value.readyTimeoutSeconds, "Connection timeout", 1, 300),
    keepaliveSeconds: readOptionalInteger(value.keepaliveSeconds, "Keepalive interval", 1, 300),
    keepAliveEnabled: value.keepAliveEnabled !== false,
    persistUntilAppCloses: value.persistUntilAppCloses === true,
    autoReconnect: value.autoReconnect === true,
    jumpHost: readString(value.jumpHost, "Jump host", { maxLength: 253, singleLine: true }),
    proxyOverride: readString(value.proxyOverride, "Connection proxy", { maxLength: 2_048, singleLine: true }),
    icon: readDeviceIcon(value.icon, false),
    applicationBadge: readString(value.applicationBadge, "Application badge", { maxLength: 4, singleLine: true }),
    indicatorColor: value.indicatorColor === undefined || value.indicatorColor === ""
      ? undefined : readHexColor(value.indicatorColor, "Indicator color"),
    terminalOverrides: normalizeTerminalOverrides(value.terminalOverrides),
    preConnectTaskIds: readUuidArray(value.preConnectTaskIds, "pre-connect task ID"),
    postConnectTaskIds: readUuidArray(value.postConnectTaskIds, "post-connect task ID"),
  };
  const totpSecret = readString(value.totpSecret, "TOTP secret", { maxLength: 2_048, trim: true });
  if (totpSecret) {
    profile.totpSecret = validateTotpSecret(totpSecret);
    profile.totpDigits = value.totpDigits === 8 ? 8 : 6;
    profile.totpPeriod = value.totpPeriod === 60 ? 60 : 30;
    profile.totpAlgorithm = value.totpAlgorithm === "sha256" || value.totpAlgorithm === "sha512"
      ? value.totpAlgorithm : "sha1";
  }
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

function normalizeFolderPath(value: unknown): string {
  const path = (readString(value, "Folder path", { required: true, maxLength: 100, singleLine: true }) as string)
    .replace(/\\/g, "/").replace(/\s*>\s*/g, "/").replace(/^\/+|\/+$/g, "");
  const parts = path.split("/").map((part) => part.trim());
  if (parts.some((part) => !part || part === "." || part === "..")) throw new Error("Folder path contains an invalid segment.");
  return parts.join("/");
}

function normalizeFolderDefaults(value: unknown): FolderDefaultsInput {
  if (!isRecord(value)) throw new Error("Invalid folder defaults.");
  const authType = value.authType === "password" || value.authType === "privateKey" ? value.authType : "none";
  const result: FolderDefaultsInput = {
    path: normalizeFolderPath(value.path),
    username: readString(value.username, "Default username", { maxLength: 256, singleLine: true }),
    domain: readString(value.domain, "Default domain", { maxLength: 256, singleLine: true }),
    authType,
    port: readOptionalInteger(value.port, "Default port", 1, 65_535),
    readyTimeoutSeconds: readOptionalInteger(value.readyTimeoutSeconds, "Connection timeout", 1, 300),
    keepaliveSeconds: readOptionalInteger(value.keepaliveSeconds, "Keepalive interval", 1, 300),
    keepAliveEnabled: value.keepAliveEnabled === undefined ? undefined : value.keepAliveEnabled === true,
    persistUntilAppCloses: value.persistUntilAppCloses === undefined ? undefined : value.persistUntilAppCloses === true,
    autoReconnect: value.autoReconnect === undefined ? undefined : value.autoReconnect === true,
    icon: readDeviceIcon(value.icon, false),
    applicationBadge: readString(value.applicationBadge, "Application badge", { maxLength: 4, singleLine: true }),
    indicatorColor: value.indicatorColor === undefined || value.indicatorColor === ""
      ? undefined : readHexColor(value.indicatorColor, "Indicator color"),
    terminalOverrides: normalizeTerminalOverrides(value.terminalOverrides),
  };
  if (authType === "password") {
    result.password = readString(value.password, "Default password", { maxLength: 4_096, trim: false });
  } else if (authType === "privateKey") {
    result.privateKeyPath = readString(value.privateKeyPath, "Default private key", { maxLength: 2_048, singleLine: true });
    result.passphrase = readString(value.passphrase, "Default key passphrase", { maxLength: 4_096, trim: false });
  }
  return result;
}

function readProcessArguments(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length > 64) throw new Error(`${field} must contain at most 64 arguments.`);
  return value.map((argument) => readString(argument, field, { required: true, maxLength: 8_192, singleLine: true }) as string);
}

function normalizeExternalTool(value: unknown): ExternalToolInput {
  if (!isRecord(value)) throw new Error("Invalid external tool.");
  return {
    id: value.id === undefined || value.id === "" ? undefined : readUuid(value.id, "external tool ID"),
    name: readString(value.name, "Tool name", { required: true, maxLength: 100, singleLine: true }) as string,
    executablePath: readString(value.executablePath, "Executable", { required: true, maxLength: 2_048, singleLine: true }) as string,
    arguments: readProcessArguments(value.arguments, "Tool arguments"),
  };
}

function normalizeConnectionTask(value: unknown): ConnectionTaskInput {
  if (!isRecord(value) || (value.kind !== "script" && value.kind !== "vpn")) throw new Error("Invalid connection task.");
  return {
    id: value.id === undefined || value.id === "" ? undefined : readUuid(value.id, "connection task ID"),
    name: readString(value.name, "Task name", { required: true, maxLength: 100, singleLine: true }) as string,
    kind: value.kind,
    executablePath: readString(value.executablePath, "Task executable", { required: true, maxLength: 2_048, singleLine: true }) as string,
    arguments: readProcessArguments(value.arguments, "Task arguments"),
    waitForExit: value.waitForExit !== false,
    timeoutSeconds: readOptionalInteger(value.timeoutSeconds, "Task timeout", 1, 900) ?? 60,
  };
}

function normalizeSyncSource(value: unknown): InventorySyncSourceInput {
  if (!isRecord(value) || (value.provider !== "ldap" && value.provider !== "vmware" && value.provider !== "hyperv")) {
    throw new Error("Invalid inventory sync source.");
  }
  const endpoint = readString(value.endpoint, "Sync endpoint", { required: true, maxLength: 2_048, singleLine: true }) as string;
  if (value.provider === "ldap" && new URL(endpoint).protocol !== "ldaps:") throw new Error("Directory sync requires an ldaps:// endpoint.");
  if (value.provider === "vmware" && new URL(endpoint).protocol !== "https:") throw new Error("VMware sync requires an https:// endpoint.");
  if (value.provider === "hyperv" && !/^[a-z0-9_.-]{1,253}$/i.test(endpoint)) throw new Error("Hyper-V host is invalid.");
  const defaultProtocol = value.defaultProtocol === "rdp" || value.defaultProtocol === "https" ? value.defaultProtocol : "ssh";
  return {
    id: value.id === undefined || value.id === "" ? undefined : readUuid(value.id, "sync source ID"),
    name: readString(value.name, "Sync source name", { required: true, maxLength: 100, singleLine: true }) as string,
    provider: value.provider,
    endpoint,
    baseDn: readString(value.baseDn, "Base DN", { maxLength: 1_024, singleLine: true }),
    username: readString(value.username, "Sync username", { maxLength: 512, singleLine: true }),
    password: readString(value.password, "Sync password", { maxLength: 4_096, trim: false }),
    filter: readString(value.filter, "LDAP filter", { maxLength: 512, singleLine: true }),
    group: normalizeFolderPath(value.group),
    defaultProtocol,
  };
}

function normalizeScreenshotRequest(value: unknown): ScreenshotRequest {
  if (!isRecord(value)) throw new Error("Invalid screenshot request.");
  const values = [value.x, value.y, value.width, value.height].map(Number);
  if (values.some((item) => !Number.isFinite(item) || item < 0 || item > 20_000) || (values[2] ?? 0) < 1 || (values[3] ?? 0) < 1) {
    throw new Error("Screenshot bounds are invalid.");
  }
  return {
    x: Math.round(values[0] as number), y: Math.round(values[1] as number),
    width: Math.round(values[2] as number), height: Math.round(values[3] as number),
    label: readString(value.label, "Screenshot label", { required: true, maxLength: 100, singleLine: true }) as string,
  };
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
    value === "ubuntu" ||
    value === "redhat" ||
    value === "macos" ||
    value === "bare-metal" ||
    value === "cisco" ||
    value === "fortinet" ||
    value === "vmware" ||
    value === "hyperv" ||
    value === "router" ||
    value === "database" ||
    value === "web-server" ||
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

function readSnippetLanguage(value: unknown): SnippetLanguage {
  if (value === "powershell" || value === "bash" || value === "cisco") return value;
  throw new Error("Snippet language must be PowerShell, Bash, or Cisco CLI.");
}

function normalizeSnippetInput(value: unknown): SnippetInput {
  if (!isRecord(value)) throw new Error("Invalid command snippet.");
  const body = readString(value.body, "Snippet command", {
    required: true,
    maxLength: 65_536,
    trim: false,
  }) as string;
  if (body.trim().length === 0 || body.includes("\0")) {
    throw new Error("Snippet command cannot be empty or contain null characters.");
  }
  if (!Array.isArray(value.tags) || value.tags.length > 20) {
    throw new Error("A snippet may contain at most 20 tags.");
  }
  const tags = [...new Set(value.tags.map((tag) =>
    readString(tag, "Snippet tag", { required: true, maxLength: 32, singleLine: true }) as string,
  ))];
  return {
    id: value.id === undefined ? undefined : readUuid(value.id, "snippet ID"),
    name: readString(value.name, "Snippet name", {
      required: true,
      maxLength: 100,
      singleLine: true,
    }) as string,
    language: readSnippetLanguage(value.language),
    tags,
    body,
  };
}

function auditContext(
  protocol: AuditSessionContext["protocol"],
  displayName: string,
  target: string,
  username = "",
  group = "Quick Connect",
): AuditSessionContext {
  return { protocol, displayName, target, username, group };
}

function readDiagnosticKind(value: unknown): DiagnosticKind {
  if (value === "ping" || value === "traceroute" || value === "dns" || value === "port") {
    return value;
  }
  throw new Error("Unsupported diagnostic operation.");
}

function readHexColor(value: unknown, field: string): string {
  if (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value)) {
    throw new Error(`${field} must be a six-digit hexadecimal color.`);
  }
  return value.toLowerCase();
}

function normalizeTerminalOverrides(value: unknown): TerminalAppearanceOverrides | undefined {
  if (value === undefined || value === null) return undefined;
  if (!isRecord(value)) throw new Error("Invalid terminal appearance override.");
  const result: TerminalAppearanceOverrides = {};
  if (value.theme === "dark" || value.theme === "monochrome" || value.theme === "custom") {
    result.theme = value.theme;
  }
  result.fontFamily = readString(value.fontFamily, "Override font family", {
    maxLength: 200,
    singleLine: true,
  });
  result.fontSize = readOptionalInteger(value.fontSize, "Override font size", 10, 28);
  if (value.lineHeight !== undefined && value.lineHeight !== "") {
    const lineHeight = Number(value.lineHeight);
    if (!Number.isFinite(lineHeight) || lineHeight < 1 || lineHeight > 2) {
      throw new Error("Terminal line height must be between 1.0 and 2.0.");
    }
    result.lineHeight = Math.round(lineHeight * 100) / 100;
  }
  if (value.background !== undefined && value.background !== "") result.background = readHexColor(value.background, "Override background");
  if (value.foreground !== undefined && value.foreground !== "") result.foreground = readHexColor(value.foreground, "Override foreground");
  if (value.cursor !== undefined && value.cursor !== "") result.cursor = readHexColor(value.cursor, "Override cursor");
  return Object.values(result).some((item) => item !== undefined) ? result : undefined;
}

function normalizeProfileNotes(value: unknown): string {
  if (typeof value !== "string" || value.length > 262_144 || value.includes("\0")) {
    throw new Error("Profile notes must be text smaller than 256 KB.");
  }
  return value;
}

function normalizeConfigBackupInput(value: unknown): ConfigBackupInput {
  if (!isRecord(value)) throw new Error("Invalid configuration snapshot.");
  const content = typeof value.content === "string" ? value.content : "";
  if (!content || content.length > 1_048_576 || content.includes("\0")) {
    throw new Error("Configuration snapshot content must be between 1 byte and 1 MB.");
  }
  return {
    name: readString(value.name, "Snapshot name", { required: true, maxLength: 100, singleLine: true }) as string,
    content,
  };
}

function normalizePreferences(value: unknown): AppPreferences {
  if (!isRecord(value)) throw new Error("Invalid application preferences.");
  const autoLockMinutes = Number(value.autoLockMinutes);
  const fontSize = Number(value.fontSize);
  const clipboardClearSeconds = Number(value.clipboardClearSeconds);
  const healthCheckIntervalSeconds = Number(value.healthCheckIntervalSeconds);
  if (!Number.isInteger(autoLockMinutes) || autoLockMinutes < 0 || autoLockMinutes > 480) {
    throw new Error("Auto-lock must be between 0 and 480 minutes.");
  }
  if (!Number.isInteger(fontSize) || fontSize < 10 || fontSize > 28) {
    throw new Error("Terminal font size must be between 10 and 28 pixels.");
  }
  if (!Number.isInteger(clipboardClearSeconds) || clipboardClearSeconds < 0 || clipboardClearSeconds > 300) {
    throw new Error("Clipboard clearing must be between 0 and 300 seconds.");
  }
  if (!Number.isInteger(healthCheckIntervalSeconds) || healthCheckIntervalSeconds < 10 || healthCheckIntervalSeconds > 600) {
    throw new Error("Ping interval must be between 10 and 600 seconds.");
  }
  const theme = value.theme;
  if (theme !== "dark" && theme !== "monochrome" && theme !== "custom") {
    throw new Error("Invalid terminal theme.");
  }
  const proxyMode = value.proxyMode;
  if (proxyMode !== "system" && proxyMode !== "direct" && proxyMode !== "manual") {
    throw new Error("Invalid proxy mode.");
  }
  const proxyUrl = readString(value.proxyUrl, "Proxy URL", {
    maxLength: 2_048,
    singleLine: true,
  }) ?? "";
  if (proxyMode === "manual") {
    let parsed: URL;
    try {
      parsed = new URL(proxyUrl);
    } catch {
      throw new Error("Manual proxy URL is invalid.");
    }
    if (!["http:", "https:", "socks4:", "socks5:"].includes(parsed.protocol)) {
      throw new Error("Proxy URL must use HTTP, HTTPS, SOCKS4, or SOCKS5.");
    }
    if (parsed.username || parsed.password) {
      throw new Error("Do not store credentials in the proxy URL; use system proxy authentication.");
    }
  }
  const masterPasswordEnabled = value.masterPasswordEnabled === true;
  const toolPaths = isRecord(value.externalToolPaths) ? value.externalToolPaths : {};
  return {
    minimizeToTray: value.minimizeToTray === true,
    startMinimized: value.startMinimized === true,
    launchAtLogin: value.launchAtLogin === true,
    masterPasswordEnabled,
    autoLockMinutes: masterPasswordEnabled ? autoLockMinutes : 0,
    clipboardClearSeconds,
    theme,
    fontFamily: readString(value.fontFamily, "Terminal font family", {
      required: true,
      maxLength: 200,
      singleLine: true,
    }) as string,
    fontSize,
    cursorBlink: value.cursorBlink === true,
    background: readHexColor(value.background, "Terminal background"),
    foreground: readHexColor(value.foreground, "Terminal foreground"),
    cursor: readHexColor(value.cursor, "Terminal cursor"),
    accent: readHexColor(value.accent, "Interface accent"),
    proxyMode,
    proxyUrl,
    proxyBypassRules: readString(value.proxyBypassRules, "Proxy bypass rules", {
      maxLength: 2_048,
      singleLine: true,
    }) ?? "",
    healthCheckIntervalSeconds,
    externalToolPaths: {
      wireshark: readString(toolPaths.wireshark, "Wireshark path", { maxLength: 2_048, singleLine: true }) ?? "",
      winscp: readString(toolPaths.winscp, "WinSCP path", { maxLength: 2_048, singleLine: true }) ?? "",
      nmap: readString(toolPaths.nmap, "Nmap path", { maxLength: 2_048, singleLine: true }) ?? "",
      powershell: readString(toolPaths.powershell, "PowerShell path", { maxLength: 2_048, singleLine: true }) ?? "powershell.exe",
    },
  };
}

async function applyProxyPreferences(preferences: AppPreferences): Promise<void> {
  let config: ProxyConfig;
  if (preferences.proxyMode === "direct") {
    config = { mode: "direct" };
  } else if (preferences.proxyMode === "manual") {
    config = {
      mode: "fixed_servers",
      proxyRules: preferences.proxyUrl,
      proxyBypassRules: preferences.proxyBypassRules,
    };
  } else {
    config = { mode: "system" };
  }
  await session.defaultSession.setProxy(config);
  await session.defaultSession.closeAllConnections();
}

async function getOrCreateAutomaticSecret(): Promise<string> {
  const controller = requireAutoUnlock();
  return (await controller.readSecret()) ?? controller.createAndStoreSecret();
}

async function initializeVaultAccess(): Promise<void> {
  const vault = requireVault();
  const preferences = requirePreferences();
  const automatic = requireAutoUnlock();
  const status = await vault.status();
  if (await automatic.hasStoredSecret()) {
    try {
      const secret = await automatic.readSecret();
      if (!secret) throw new Error("Automatic vault key is empty.");
      if (status.exists) await vault.unlock(secret);
      else await vault.create(secret);
      if (preferences.get().masterPasswordEnabled || preferences.get().autoLockMinutes !== 0) {
        await preferences.save({
          ...preferences.get(),
          masterPasswordEnabled: false,
          autoLockMinutes: 0,
        });
      }
      return;
    } catch (error) {
      console.warn("CyberGrid automatic vault unlock failed; falling back to master password:", error);
      if (!preferences.get().masterPasswordEnabled) {
        await preferences.save({ ...preferences.get(), masterPasswordEnabled: true });
      }
      return;
    }
  }

  if (!status.exists && !preferences.get().masterPasswordEnabled) {
    if (await automatic.isAvailable()) {
      const secret = await automatic.createAndStoreSecret();
      try {
        await vault.create(secret);
        await preferences.save({
          ...preferences.get(),
          masterPasswordEnabled: false,
          autoLockMinutes: 0,
        });
        return;
      } catch (error) {
        await automatic.removeSecret().catch(() => undefined);
        throw error;
      }
    }
    await preferences.save({ ...preferences.get(), masterPasswordEnabled: true });
    return;
  }

  if (status.exists && !preferences.get().masterPasswordEnabled) {
    // Existing installations created before optional master-password support do
    // not have an OS-protected key. Preserve access by retaining the prompt.
    await preferences.save({ ...preferences.get(), masterPasswordEnabled: true });
  }
}

async function changeMasterPasswordMode(
  enabled: boolean,
  newMasterPassword: unknown,
): Promise<void> {
  const preferences = requirePreferences().get();
  if (preferences.masterPasswordEnabled === enabled) return;
  const vault = requireVault();
  if (!vault.isVaultUnlocked()) throw new Error("Unlock the credential vault before changing Master Password settings.");

  if (enabled) {
    const password = readMasterPassword(newMasterPassword);
    if (password.length < 10) throw new Error("New master password must contain at least 10 characters.");
    await vault.rotateMasterPassword(password);
    await requireAutoUnlock().removeSecret();
    return;
  }

  const secret = await requireAutoUnlock().createAndStoreSecret();
  try {
    await vault.rotateMasterPassword(secret);
  } catch (error) {
    await requireAutoUnlock().removeSecret().catch(() => undefined);
    throw error;
  }
}

async function unlockVault(masterPassword: unknown): Promise<void> {
  if (requirePreferences().get().masterPasswordEnabled) {
    await requireVault().unlock(readMasterPassword(masterPassword));
    return;
  }
  const secret = await requireAutoUnlock().readSecret();
  if (!secret) throw new Error("The OS-protected automatic vault key is missing. Enable Master Password recovery is required.");
  await requireVault().unlock(secret);
}

function showMainWindow(): void {
  if (!app.isReady()) return;
  if (!mainWindow) mainWindow = createMainWindow();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  resetAutoLockTimer();
}

function createTrayImage(): Electron.NativeImage {
  const size = 16;
  const bitmap = Buffer.alloc(size * size * 4);
  const setPixel = (x: number, y: number, alpha = 255): void => {
    const offset = (y * size + x) * 4;
    bitmap[offset] = 171;
    bitmap[offset + 1] = 213;
    bitmap[offset + 2] = 35;
    bitmap[offset + 3] = alpha;
  };
  for (let index = 2; index < 14; index += 1) {
    setPixel(index, 2);
    setPixel(index, 13);
    setPixel(2, index);
    setPixel(13, index);
  }
  for (let index = 4; index < 12; index += 1) {
    setPixel(7, index);
    setPixel(index, 7);
  }
  return nativeImage.createFromBitmap(bitmap, { width: size, height: size, scaleFactor: 1 });
}

let trayRefreshSequence = 0;

async function refreshTrayMenu(): Promise<void> {
  const activeSequence = ++trayRefreshSequence;
  if (!tray || !vaultController) return;
  const status = await vaultController.status();
  const favorites = status.unlocked
    ? vaultController.listProfiles().filter((profile) => profile.favorite).slice(0, 20)
    : [];
  if (!tray || activeSequence !== trayRefreshSequence) return;
  const favoriteItems: MenuItemConstructorOptions[] = favorites.length > 0
    ? favorites.map((profile) => ({
        label: `${profile.name} (${profile.protocol.toUpperCase()})`,
        click: () => {
          showMainWindow();
          mainWindow?.webContents.send(IPC_CHANNELS.trayQuickConnect, profile.id);
        },
      }))
    : [{ label: status.unlocked ? "No favorite servers" : "Unlock vault to view favorites", enabled: false }];
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Show CyberGrid", click: showMainWindow },
    { label: "Quick Connect Favorites", submenu: favoriteItems },
    { type: "separator" },
    {
      label: "Lock Credential Vault",
      enabled: status.unlocked,
      click: () => lockApplication("Credential vault locked from the system tray.", true),
    },
    { type: "separator" },
    {
      label: "Quit CyberGrid",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]));
}

function createSystemTray(): void {
  tray = new Tray(createTrayImage());
  tray.setToolTip("CyberGrid remote connection manager");
  tray.on("click", showMainWindow);
  if (!isQuitting) void refreshTrayMenu();
}

function resetAutoLockTimer(): void {
  if (autoLockTimer) clearTimeout(autoLockTimer);
  autoLockTimer = undefined;
  if (!vaultController?.isVaultUnlocked()) return;
  const minutes = preferencesController?.get().autoLockMinutes ?? 0;
  if (minutes === 0) return;
  autoLockTimer = setTimeout(() => {
    lockApplication(`Credential vault auto-locked after ${minutes} minutes of inactivity.`, true);
  }, minutes * 60_000);
  autoLockTimer.unref();
}

function lockApplication(reason: string, notifyRenderer: boolean): void {
  if (autoLockTimer) clearTimeout(autoLockTimer);
  autoLockTimer = undefined;
  scannerController?.cancelAll();
  healthController.stop();
  sshController?.disconnectAll(reason);
  streamController.disconnectAll();
  serialController?.disconnectAll();
  vncController?.disconnectAll();
  webController?.disconnectAll();
  rdpController?.disconnectAll();
  vaultController?.lock();
  if (notifyRenderer && mainWindow && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send(IPC_CHANNELS.vaultLocked, reason);
  }
  if (!isQuitting) void refreshTrayMenu();
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
    readyTimeout: (profile.readyTimeoutSeconds ?? 15) * 1_000,
    keepaliveInterval: profile.keepAliveEnabled === false ? 0 : (profile.keepaliveSeconds ?? 10) * 1_000,
    totpCode: profile.totpSecret ? generateTotp(profile.totpSecret, {
      digits: profile.totpDigits,
      period: profile.totpPeriod,
      algorithm: profile.totpAlgorithm,
    }).code : undefined,
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
  const context = {
    displayName: profile.name,
    host,
    ip: host,
    username,
    group: profile.group,
    port: profile.port,
    profileId,
  };
  await runConnectionTasks(
    requireVault().getConnectionTasks(profile.preConnectTaskIds ?? []),
    context,
  );
  const policy = {
    keepAliveEnabled: profile.keepAliveEnabled !== false,
    persistUntilAppCloses: profile.persistUntilAppCloses === true,
    autoReconnect: profile.autoReconnect === true,
    terminalAppearance: profile.terminalOverrides,
  };
  switch (profile.protocol) {
    case "ssh": {
      const ssh = await getSshController();
      return {
        protocol: "ssh",
        sessionId: await ssh.connect(
          await connectionConfigForProfile(profileId),
          sender,
          auditContext("ssh", profile.name, `${host}:${profile.port}`, username, profile.group),
        ),
        context,
        policy,
      };
    }
    case "rdp":
      return { protocol: "rdp", sessionId: await requireRdp().connect({ host, port: profile.port, username }, sender), context, policy };
    case "telnet":
    case "raw":
      return {
        protocol: profile.protocol,
        sessionId: streamController.connect(
          { protocol: profile.protocol, host, port: profile.port },
          sender,
          auditContext(profile.protocol, profile.name, `${host}:${profile.port}`, username, profile.group),
        ),
        context,
        policy,
      };
    case "serial": {
      const serial = await getSerialController();
      return {
        protocol: "serial",
        sessionId: await serial.connect(
          {
            path: host,
            baudRate: profile.baudRate ?? 9_600,
            dataBits: profile.dataBits ?? 8,
            stopBits: profile.stopBits ?? 1,
            parity: profile.parity ?? "none",
          },
          sender,
          auditContext("serial", profile.name, host, username, profile.group),
        ),
        context,
        policy,
      };
    }
    case "vnc": {
      const result = await (await getVncController()).connect({
        host,
        port: profile.port,
        password: resolveEnvironmentTokens(profile.password, "VNC password"),
      }, sender);
      return { protocol: "vnc", ...result, context, policy };
    }
    case "http":
    case "https": {
      const defaultPort = profile.protocol === "https" ? 443 : 80;
      const normalizedHost = host.replace(/^https?:\/\//i, "").replace(/\/$/, "");
      const port = profile.port === defaultPort ? "" : `:${profile.port}`;
      const sessionId = await requireWeb().connect({ url: `${profile.protocol}://${normalizedHost}${port}/` }, sender);
      return { protocol: profile.protocol, sessionId, context, policy };
    }
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.sshConnect, async (event, config: unknown) => {
    assertTrustedSender(event);
    const normalized = normalizeConnectionConfig(config);
    return (await getSshController()).connect(
      normalized,
      event.sender,
      auditContext("ssh", normalized.host, `${normalized.host}:${normalized.port}`, normalized.username),
    );
  });

  ipcMain.handle(IPC_CHANNELS.sshConnectProfile, async (event, profileId: unknown) => {
    assertTrustedSender(event);
    const id = readUuid(profileId, "server profile ID");
    const profile = requireVault().getConnectionProfile(id);
    const config = await connectionConfigForProfile(id);
    return (await getSshController()).connect(
      config,
      event.sender,
      auditContext("ssh", profile.name, `${config.host}:${config.port}`, config.username, profile.group),
    );
  });

  ipcMain.handle(IPC_CHANNELS.profileConnect, async (event, profileId: unknown) => {
    assertTrustedSender(event);
    return connectProfile(readUuid(profileId, "server profile ID"), event.sender);
  });

  ipcMain.handle(IPC_CHANNELS.profileRunPostConnect, async (event, profileId: unknown) => {
    assertTrustedSender(event);
    const profile = requireVault().getConnectionProfile(readUuid(profileId, "server profile ID"));
    const host = resolveEnvironmentTokens(profile.host, profile.protocol === "serial" ? "Serial port" : "Host") as string;
    const username = resolveEnvironmentTokens(profile.username, "Username") ?? "";
    await runConnectionTasks(
      requireVault().getConnectionTasks(profile.postConnectTaskIds ?? []),
      {
        displayName: profile.name, host, ip: host, username, group: profile.group,
        port: profile.port, profileId: profile.id,
      },
    );
  });

  ipcMain.handle(IPC_CHANNELS.sshDisconnect, (event, sessionId: unknown) => {
    assertTrustedSender(event);
    sshController?.disconnect(readUuid(sessionId, "SSH session ID"));
  });

  ipcMain.handle(
    IPC_CHANNELS.sftpList,
    async (event, sessionId: unknown, remotePath: unknown) => {
      assertTrustedSender(event);
      return (await getSshController()).listDirectory(
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
        await (await getSshController()).uploadFile(id, localPath, remotePath);
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
      await (await getSshController()).downloadFile(id, sourcePath, selection.filePath);
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
    const normalized = normalizeStreamConfig(config);
    return streamController.connect(
      normalized,
      event.sender,
      auditContext(normalized.protocol, normalized.host, `${normalized.host}:${normalized.port}`),
    );
  });

  ipcMain.handle(IPC_CHANNELS.streamDisconnect, (event, sessionId: unknown) => {
    assertTrustedSender(event);
    streamController.disconnect(readUuid(sessionId, "terminal socket session ID"));
  });

  ipcMain.handle(IPC_CHANNELS.serialList, async (event) => {
    assertTrustedSender(event);
    return (await getSerialController()).listPorts();
  });

  ipcMain.handle(IPC_CHANNELS.serialConnect, async (event, config: unknown) => {
    assertTrustedSender(event);
    const normalized = normalizeSerialConfig(config);
    return (await getSerialController()).connect(
      normalized,
      event.sender,
      auditContext("serial", normalized.path, normalized.path),
    );
  });

  ipcMain.handle(IPC_CHANNELS.serialDisconnect, (event, sessionId: unknown) => {
    assertTrustedSender(event);
    serialController?.disconnect(readUuid(sessionId, "serial session ID"));
  });

  ipcMain.handle(IPC_CHANNELS.vncConnect, async (event, config: unknown) => {
    assertTrustedSender(event);
    return (await getVncController()).connect(normalizeVncConfig(config), event.sender);
  });

  ipcMain.handle(IPC_CHANNELS.vncDisconnect, (event, sessionId: unknown) => {
    assertTrustedSender(event);
    vncController?.disconnect(readUuid(sessionId, "VNC session ID"));
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
    const password = requirePreferences().get().masterPasswordEnabled
      ? readMasterPassword(masterPassword)
      : await getOrCreateAutomaticSecret();
    await requireVault().create(password);
    resetAutoLockTimer();
    await refreshTrayMenu();
  });

  ipcMain.handle(IPC_CHANNELS.vaultUnlock, async (event, masterPassword: unknown) => {
    assertTrustedSender(event);
    await unlockVault(masterPassword);
    resetAutoLockTimer();
    await refreshTrayMenu();
  });

  ipcMain.handle(IPC_CHANNELS.vaultLock, (event) => {
    assertTrustedSender(event);
    lockApplication("Credential vault locked.", false);
  });

  ipcMain.handle(IPC_CHANNELS.vaultListProfiles, (event) => {
    assertTrustedSender(event);
    return requireVault().listProfiles();
  });

  ipcMain.handle(IPC_CHANNELS.vaultSaveProfile, async (event, profile: unknown) => {
    assertTrustedSender(event);
    const result = await requireVault().saveProfile(normalizeProfileInput(profile));
    await refreshTrayMenu();
    return result;
  });

  ipcMain.handle(IPC_CHANNELS.vaultDeleteProfile, async (event, profileId: unknown) => {
    assertTrustedSender(event);
    await requireVault().deleteProfile(readUuid(profileId, "server profile ID"));
    await refreshTrayMenu();
  });

  ipcMain.handle(IPC_CHANNELS.vaultUpdateProfileNotes, async (event, profileId: unknown, notes: unknown) => {
    assertTrustedSender(event);
    return requireVault().updateProfileNotes(
      readUuid(profileId, "server profile ID"),
      normalizeProfileNotes(notes),
    );
  });

  ipcMain.handle(IPC_CHANNELS.vaultAddConfigBackup, async (event, profileId: unknown, input: unknown) => {
    assertTrustedSender(event);
    return requireVault().addConfigBackup(
      readUuid(profileId, "server profile ID"),
      normalizeConfigBackupInput(input),
    );
  });

  ipcMain.handle(IPC_CHANNELS.vaultDeleteConfigBackup, async (event, profileId: unknown, backupId: unknown) => {
    assertTrustedSender(event);
    return requireVault().deleteConfigBackup(
      readUuid(profileId, "server profile ID"),
      readUuid(backupId, "configuration snapshot ID"),
    );
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

  ipcMain.handle(IPC_CHANNELS.vaultListSnippets, (event) => {
    assertTrustedSender(event);
    return requireVault().listSnippets();
  });

  ipcMain.handle(IPC_CHANNELS.vaultSaveSnippet, async (event, snippet: unknown) => {
    assertTrustedSender(event);
    return requireVault().saveSnippet(normalizeSnippetInput(snippet));
  });

  ipcMain.handle(IPC_CHANNELS.vaultDeleteSnippet, async (event, snippetId: unknown) => {
    assertTrustedSender(event);
    await requireVault().deleteSnippet(readUuid(snippetId, "snippet ID"));
  });

  ipcMain.handle(IPC_CHANNELS.vaultSetFavorite, async (event, profileId: unknown, favorite: unknown) => {
    assertTrustedSender(event);
    if (typeof favorite !== "boolean") throw new Error("Invalid favorite state.");
    const result = await requireVault().setFavorite(
      readUuid(profileId, "server profile ID"),
      favorite,
    );
    await refreshTrayMenu();
    return result;
  });

  ipcMain.handle(IPC_CHANNELS.vaultListFolderDefaults, (event) => {
    assertTrustedSender(event);
    return requireVault().listFolderDefaults();
  });

  ipcMain.handle(IPC_CHANNELS.vaultSaveFolderDefaults, async (event, input: unknown) => {
    assertTrustedSender(event);
    return requireVault().saveFolderDefaults(normalizeFolderDefaults(input));
  });

  ipcMain.handle(IPC_CHANNELS.vaultDeleteFolderDefaults, async (event, path: unknown) => {
    assertTrustedSender(event);
    await requireVault().deleteFolderDefaults(normalizeFolderPath(path));
  });

  ipcMain.handle(IPC_CHANNELS.vaultListExternalTools, (event) => {
    assertTrustedSender(event);
    return requireVault().listExternalTools();
  });

  ipcMain.handle(IPC_CHANNELS.vaultSaveExternalTool, async (event, input: unknown) => {
    assertTrustedSender(event);
    return requireVault().saveExternalTool(normalizeExternalTool(input));
  });

  ipcMain.handle(IPC_CHANNELS.vaultDeleteExternalTool, async (event, toolId: unknown) => {
    assertTrustedSender(event);
    await requireVault().deleteExternalTool(readUuid(toolId, "external tool ID"));
  });

  ipcMain.handle(IPC_CHANNELS.vaultListConnectionTasks, (event) => {
    assertTrustedSender(event);
    return requireVault().listConnectionTasks();
  });

  ipcMain.handle(IPC_CHANNELS.vaultSaveConnectionTask, async (event, input: unknown) => {
    assertTrustedSender(event);
    return requireVault().saveConnectionTask(normalizeConnectionTask(input));
  });

  ipcMain.handle(IPC_CHANNELS.vaultDeleteConnectionTask, async (event, taskId: unknown) => {
    assertTrustedSender(event);
    await requireVault().deleteConnectionTask(readUuid(taskId, "connection task ID"));
  });

  ipcMain.handle(IPC_CHANNELS.vaultListSyncSources, (event) => {
    assertTrustedSender(event);
    return requireVault().listSyncSources();
  });

  ipcMain.handle(IPC_CHANNELS.vaultSaveSyncSource, async (event, input: unknown) => {
    assertTrustedSender(event);
    return requireVault().saveSyncSource(normalizeSyncSource(input));
  });

  ipcMain.handle(IPC_CHANNELS.vaultDeleteSyncSource, async (event, sourceId: unknown) => {
    assertTrustedSender(event);
    await requireVault().deleteSyncSource(readUuid(sourceId, "sync source ID"));
    await refreshTrayMenu();
  });

  ipcMain.handle(IPC_CHANNELS.vaultGenerateTotp, (event, profileId: unknown) => {
    assertTrustedSender(event);
    const profile = requireVault().getConnectionProfile(readUuid(profileId, "server profile ID"));
    if (!profile.totpSecret) throw new Error("This server profile does not have a TOTP secret.");
    return generateTotp(profile.totpSecret, {
      digits: profile.totpDigits, period: profile.totpPeriod, algorithm: profile.totpAlgorithm,
    });
  });

  ipcMain.handle(IPC_CHANNELS.externalToolRun, async (event, toolId: unknown, profileId: unknown) => {
    assertTrustedSender(event);
    const profile = requireVault().getConnectionProfile(readUuid(profileId, "server profile ID"));
    const host = resolveEnvironmentTokens(profile.host, "Tool host") as string;
    const username = resolveEnvironmentTokens(profile.username, "Tool username") ?? "";
    const ip = profile.protocol === "serial" ? host : (await lookup(host).catch(() => ({ address: host }))).address;
    return launchExternalTool(
      requireVault().getExternalTool(readUuid(toolId, "external tool ID")),
      { displayName: profile.name, host, ip, port: profile.port, username, group: profile.group, profileId: profile.id },
    );
  });

  ipcMain.handle(IPC_CHANNELS.inventorySyncRun, async (event, sourceId: unknown) => {
    assertTrustedSender(event);
    const id = readUuid(sourceId, "sync source ID");
    const candidates = await discoverInventory(requireVault().getSyncSource(id));
    const normalized = candidates.map((candidate) => ({
      ...normalizeProfileInput(candidate),
      managedBySyncId: candidate.managedBySyncId,
      managedObjectId: candidate.managedObjectId,
    }));
    const result = await requireVault().replaceSyncedProfiles(id, normalized);
    await refreshTrayMenu();
    return result;
  });

  ipcMain.handle(IPC_CHANNELS.sessionCaptureScreenshot, async (event, input: unknown) => {
    assertTrustedSender(event);
    if (!mainWindow) return { path: null };
    const request = normalizeScreenshotRequest(input);
    const image = await mainWindow.webContents.capturePage({
      x: request.x, y: request.y, width: request.width, height: request.height,
    });
    const safeLabel = request.label.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "session";
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const pictures = app.getPath("pictures");
    await mkdir(pictures, { recursive: true });
    const result = await dialog.showSaveDialog(mainWindow, {
      title: "Save session screenshot",
      defaultPath: join(pictures, `CyberGrid-${safeLabel}-${timestamp}.png`),
      filters: [{ name: "PNG image", extensions: ["png"] }],
    });
    if (result.canceled || !result.filePath) return { path: null };
    await writeFile(result.filePath, image.toPNG(), { mode: 0o600 });
    return { path: result.filePath };
  });

  ipcMain.handle(IPC_CHANNELS.preferencesGet, (event) => {
    assertTrustedSender(event);
    return requirePreferences().get();
  });

  ipcMain.handle(IPC_CHANNELS.workspaceLoad, async (event) => {
    assertTrustedSender(event);
    return loadWorkspaceSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.workspaceSave, async (event, snapshot: unknown) => {
    assertTrustedSender(event);
    await saveWorkspaceSnapshot(snapshot);
  });

  ipcMain.handle(IPC_CHANNELS.disasterRecoveryExport, async (event, rawPassphrase: unknown) => {
    assertTrustedSender(event);
    if (!mainWindow) return { path: null, profileCount: 0, assetCount: 0 };
    const passphrase = readString(rawPassphrase, "Runbook passphrase", {
      required: true,
      maxLength: 1_024,
      trim: false,
    }) as string;
    if (passphrase.length < 12) throw new Error("Runbook passphrase must contain at least 12 characters.");
    const profiles = requireVault().listProfiles();
    const assets = requireVault().listAssets();
    const date = new Date().toISOString().slice(0, 10);
    const result = await dialog.showSaveDialog(mainWindow, {
      title: "Export encrypted disaster recovery runbook",
      defaultPath: join(app.getPath("documents"), `CyberGrid-DR-Runbook-${date}.html`),
      filters: [{ name: "Encrypted HTML runbook", extensions: ["html"] }],
    });
    if (result.canceled || !result.filePath) {
      return { path: null, profileCount: profiles.length, assetCount: assets.length };
    }
    const { buildEncryptedRunbook } = await import("./runbook.js");
    const html = await buildEncryptedRunbook(profiles, assets, passphrase);
    await writeFile(result.filePath, html, { encoding: "utf8", mode: 0o600 });
    return { path: result.filePath, profileCount: profiles.length, assetCount: assets.length };
  });

  ipcMain.handle(IPC_CHANNELS.quickLauncherLaunchProfile, (event, profileId: unknown) => {
    assertTrustedSender(event);
    const id = readUuid(profileId, "quick-launch profile ID");
    if (!requireVault().isVaultUnlocked()) throw new Error("Unlock CyberGrid before launching a saved connection.");
    if (!requireVault().listProfiles().some((profile) => profile.id === id)) throw new Error("Saved connection was not found.");
    showMainWindow();
    mainWindow?.webContents.send(IPC_CHANNELS.trayQuickConnect, id);
    setImmediate(destroyQuickLauncher);
  });

  ipcMain.handle(IPC_CHANNELS.quickLauncherShowMain, (event) => {
    assertTrustedSender(event);
    showMainWindow();
    setImmediate(destroyQuickLauncher);
  });

  ipcMain.on(IPC_CHANNELS.quickLauncherHide, (event) => {
    if (isTrustedSender(event)) destroyQuickLauncher();
  });

  ipcMain.handle(IPC_CHANNELS.preferencesUpdate, async (event, preferences: unknown, newMasterPassword: unknown) => {
    assertTrustedSender(event);
    const normalized = normalizePreferences(preferences);
    await applyProxyPreferences(normalized);
    await changeMasterPasswordMode(normalized.masterPasswordEnabled, newMasterPassword);
    const saved = await requirePreferences().save(normalized);
    app.setLoginItemSettings({ openAtLogin: saved.launchAtLogin });
    resetAutoLockTimer();
    return saved;
  });

  ipcMain.on(IPC_CHANNELS.preferencesActivity, (event) => {
    if (isTrustedSender(event)) resetAutoLockTimer();
  });

  ipcMain.handle(IPC_CHANNELS.diagnosticsRun, async (event, profileId: unknown, kind: unknown) => {
    assertTrustedSender(event);
    const id = readUuid(profileId, "server profile ID");
    const profile = requireVault().getConnectionProfile(id);
    if (profile.protocol === "serial") {
      throw new Error("Network diagnostics are unavailable for serial profiles.");
    }
    return runDiagnostic(
      id,
      readDiagnosticKind(kind),
      resolveEnvironmentTokens(profile.host, "Diagnostic host") as string,
      profile.port,
    );
  });

  ipcMain.handle(IPC_CHANNELS.discoveryStart, async (event, target: unknown) => {
    assertTrustedSender(event);
    const normalizedTarget = readString(target, "Scan target", {
      required: true,
      maxLength: 64,
      singleLine: true,
    });
    return (await getScannerController()).start(normalizedTarget as string, event.sender);
  });

  ipcMain.handle(IPC_CHANNELS.discoveryCancel, (event, scanId: unknown) => {
    assertTrustedSender(event);
    scannerController?.cancel(readUuid(scanId, "scan ID"));
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
    healthController.setTargets(
      normalized,
      event.sender,
      requirePreferences().get().healthCheckIntervalSeconds,
    );
  });

  ipcMain.handle(IPC_CHANNELS.healthRefresh, async (event) => {
    assertTrustedSender(event);
    await healthController.sweep();
  });

  ipcMain.handle(IPC_CHANNELS.migrationImport, async (event, rawRequest: unknown) => {
    assertTrustedSender(event);
    const parsed = await (await getMigrationController()).importConnections(normalizeMigrationRequest(rawRequest));
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
    await refreshTrayMenu();
    return { imported, warnings, path: parsed.path };
  });

  ipcMain.handle(IPC_CHANNELS.migrationExport, async (event, rawRequest: unknown) => {
    assertTrustedSender(event);
    return (await getMigrationController()).exportConnections(
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
      sshController?.write(payload.sessionId, payload.data);
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
      serialController?.write(readUuid(request.sessionId, "serial session ID"), request.data);
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
      sshController?.resize(payload.sessionId, payload.cols, payload.rows);
    } catch (error) {
      console.warn("Rejected SSH resize request:", error);
    }
  });
}

function registerBootstrapIpcHandler(): void {
  ipcMain.handle(IPC_CHANNELS.appReady, async (event) => {
    assertTrustedSender(event);
    await servicesReady;
  });
  ipcMain.handle(IPC_CHANNELS.appUpdateInstall, (event) => {
    assertTrustedSender(event);
    if (!app.isPackaged || !applicationUpdater) {
      throw new Error("A downloaded CyberGrid update is not ready to install.");
    }
    setImmediate(() => applicationUpdater?.quitAndInstall(false, true));
  });
}

async function initializeBackgroundServices(): Promise<void> {
  app.setAppLogsPath(userDataFile("logs", "application"));
  auditController.configure(userDataFile("logs", "sessions"));

  const [preferencesModule, vaultModule, autoUnlockModule] = await Promise.all([
    import("./preferences.js"),
    import("./vault.js"),
    import("./auto-unlock.js"),
  ]);
  const preferences = new preferencesModule.PreferencesController(
    userDataFile("cybergrid-preferences.json"),
  );
  preferencesController = preferences;
  await preferences.load().catch((error: unknown) => {
    console.warn("CyberGrid preferences could not be loaded; using defaults:", error);
  });
  app.setLoginItemSettings({ openAtLogin: preferences.get().launchAtLogin });
  if (preferences.get().startMinimized && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide();
  }
  await applyProxyPreferences(preferences.get()).catch((error: unknown) => {
    console.warn("CyberGrid proxy settings could not be applied:", error);
  });

  vaultController = new vaultModule.VaultController(userDataFile("cybergrid-vault.json"));
  autoUnlockController = new autoUnlockModule.AutoUnlockController(
    userDataFile("security", "vault-auto-key.bin"),
  );
  await initializeVaultAccess();

  rdpController = new RdpController(join(app.getPath("temp"), "CyberGrid", "rdp"));
  webController = new WebController(() => mainWindow);
  registerIpcHandlers();
  try {
    createSystemTray();
  } catch (error) {
    console.warn("CyberGrid system tray could not be created:", error);
  }
  resetAutoLockTimer();
}

let backgroundServicesStarted = false;

function startBackgroundServices(): void {
  if (backgroundServicesStarted || isQuitting) return;
  backgroundServicesStarted = true;
  void initializeBackgroundServices().then(() => {
    servicesReadyResolve();
  }).catch((error: unknown) => {
    servicesReadyReject(error);
    reportFatalError("startup failure", error);
  });
}

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    showMainWindow();
  });

  void app.whenReady().then(() => {
    registerBootstrapIpcHandler();
    mainWindow = createMainWindow();
    registerGlobalQuickLauncher();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createMainWindow();
      } else {
        showMainWindow();
      }
    });
  }).catch((error: unknown) => reportFatalError("window startup failure", error));
}

let flushingAuditLogs = false;

app.on("before-quit", (event) => {
  isQuitting = true;
  lockApplication("Application is closing.", false);
  auditController.closeAll();
  if (!flushingAuditLogs) {
    flushingAuditLogs = true;
    event.preventDefault();
    void auditController.flush().finally(() => app.quit());
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin" && !preferencesController?.get().minimizeToTray) {
    app.quit();
  }
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  destroyQuickLauncher();
  tray?.destroy();
  tray = null;
});
