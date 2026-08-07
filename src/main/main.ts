import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
} from "electron";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import {
  IPC_CHANNELS,
  type ServerProfileInput,
  type SshConnectionConfig,
  type SshResizeRequest,
  type SshWriteRequest,
} from "../shared/ipc";
import { SshController } from "./ssh";
import { VaultController } from "./vault";

const sshController = new SshController();
let vaultController: VaultController | null = null;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(
  value: unknown,
  field: string,
  options: { required?: boolean; maxLength: number; trim?: boolean },
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
  return normalized;
}

function readPort(value: unknown): number {
  const port = typeof value === "number" ? value : Number(value ?? 22);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("Port must be an integer between 1 and 65535.");
  }
  return port;
}

function normalizeConnectionConfig(value: unknown): SshConnectionConfig {
  if (!isRecord(value)) {
    throw new Error("Invalid SSH connection configuration.");
  }

  const host = readString(value.host, "Host", { required: true, maxLength: 253 });
  const username = readString(value.username, "Username", {
    required: true,
    maxLength: 128,
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

function normalizeProfileInput(value: unknown): ServerProfileInput {
  if (!isRecord(value)) {
    throw new Error("Invalid server profile.");
  }

  const name = readString(value.name, "Display name", { required: true, maxLength: 100 });
  const host = readString(value.host, "Host", { required: true, maxLength: 253 });
  const username = readString(value.username, "Username", {
    required: true,
    maxLength: 128,
  });
  const group = readString(value.group, "Folder", { maxLength: 100 }) ?? "Ungrouped";

  if (value.authType === "password") {
    const password = readString(value.password, "Password", {
      required: true,
      maxLength: 4_096,
      trim: false,
    });
    return {
      name: name as string,
      host: host as string,
      port: readPort(value.port),
      username: username as string,
      group,
      authType: "password",
      password: password as string,
    };
  }

  if (value.authType === "privateKey") {
    const privateKeyPath = readString(value.privateKeyPath, "Private key path", {
      required: true,
      maxLength: 2_048,
    });
    const passphrase = readString(value.passphrase, "Key passphrase", {
      maxLength: 4_096,
      trim: false,
    });
    return {
      name: name as string,
      host: host as string,
      port: readPort(value.port),
      username: username as string,
      group,
      authType: "privateKey",
      privateKeyPath: privateKeyPath as string,
      passphrase,
    };
  }

  throw new Error("Authentication method must be password or private key.");
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

async function connectionConfigForProfile(profileId: string): Promise<SshConnectionConfig> {
  const profile = requireVault().getConnectionProfile(profileId);
  const baseConfig: SshConnectionConfig = {
    host: profile.host,
    port: profile.port,
    username: profile.username,
    readyTimeout: 15_000,
  };

  if (profile.authType === "password") {
    return { ...baseConfig, password: profile.password };
  }

  const privateKeyPath = profile.privateKeyPath as string;
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
    passphrase: profile.passphrase,
  };
}

function readSessionId(value: unknown): string {
  return readUuid(value, "SSH session ID");
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

  ipcMain.handle(IPC_CHANNELS.sshDisconnect, (event, sessionId: unknown) => {
    assertTrustedSender(event);
    sshController.disconnect(readSessionId(sessionId));
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
    sshController.disconnectAll();
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
        sessionId: readSessionId(request.sessionId),
        data: request.data,
      };
      sshController.write(payload.sessionId, payload.data);
    } catch (error) {
      console.warn("Rejected SSH write request:", error);
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
        sessionId: readSessionId(request.sessionId),
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
  sshController.disconnectAll();
  vaultController?.lock();
});

app.on("window-all-closed", () => {
  sshController.disconnectAll();
  vaultController?.lock();
  if (process.platform !== "darwin") {
    app.quit();
  }
});
