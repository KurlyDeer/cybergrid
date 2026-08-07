import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
} from "electron";
import { readFile, stat } from "node:fs/promises";
import { basename, join, posix } from "node:path";
import {
  IPC_CHANNELS,
  type RdpConnectionConfig,
  type ServerProfileInput,
  type SshConnectionConfig,
  type SshResizeRequest,
  type SshWriteRequest,
} from "../shared/ipc";
import { RdpController } from "./rdp";
import { SshController } from "./ssh";
import { VaultController } from "./vault";

const sshController = new SshController();
let rdpController: RdpController | null = null;
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

function requireRdp(): RdpController {
  if (!rdpController) {
    throw new Error("RDP controller is not initialized.");
  }
  return rdpController;
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

  const name = readString(value.name, "Display name", { required: true, maxLength: 100 });
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

function readRemotePath(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 4_096 || value.includes("\0")) {
    throw new Error("Invalid remote path.");
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
    sshController.disconnectAll("Credential vault locked.");
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
  rdpController?.disconnectAll();
  vaultController?.lock();
});

app.on("window-all-closed", () => {
  sshController.disconnectAll();
  rdpController?.disconnectAll();
  vaultController?.lock();
  if (process.platform !== "darwin") {
    app.quit();
  }
});
