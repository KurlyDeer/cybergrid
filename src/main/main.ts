import { app, BrowserWindow, ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from "electron";
import { join } from "node:path";
import {
  IPC_CHANNELS,
  type SshConnectionConfig,
  type SshResizeRequest,
  type SshWriteRequest,
} from "../shared/ipc";
import { SshController } from "./ssh";

const sshController = new SshController();
let mainWindow: BrowserWindow | null = null;

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
  const port = typeof value.port === "number" ? value.port : Number(value.port ?? 22);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("Port must be an integer between 1 and 65535.");
  }

  return {
    host: host as string,
    port,
    username: username as string,
    password,
    privateKey,
    passphrase,
    readyTimeout: 15_000,
  };
}

function readSessionId(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f-]{36}$/i.test(value)) {
    throw new Error("Invalid SSH session ID.");
  }
  return value;
}

function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.sshConnect, (event, config: unknown) => {
    if (!isTrustedSender(event)) {
      throw new Error("Rejected IPC request from an untrusted renderer.");
    }
    return sshController.connect(normalizeConnectionConfig(config), event.sender);
  });

  ipcMain.handle(IPC_CHANNELS.sshDisconnect, (event, sessionId: unknown) => {
    if (!isTrustedSender(event)) {
      throw new Error("Rejected IPC request from an untrusted renderer.");
    }
    sshController.disconnect(readSessionId(sessionId));
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

app.whenReady().then(() => {
  registerIpcHandlers();
  mainWindow = createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

app.on("before-quit", () => sshController.disconnectAll());

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
