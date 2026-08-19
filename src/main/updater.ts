import { app, dialog, type BrowserWindow, type MessageBoxOptions } from "electron";
import {
  IPC_CHANNELS,
  type AppUpdateEvent,
  type AppUpdateStatusEvent,
} from "../shared/ipc";

type AppUpdater = import("electron-updater").AppUpdater;

interface ElectronUpdaterModuleShape {
  autoUpdater?: AppUpdater;
  default?: {
    autoUpdater?: AppUpdater;
  };
}

export class UpdaterController {
  private updater: AppUpdater | null = null;
  private initialization: Promise<AppUpdater> | null = null;
  private interactiveCheck = false;
  private downloadRequested = false;
  private downloaded = false;
  private lastErrorMessage = "";
  private lastErrorAt = 0;

  constructor(private readonly windowProvider: () => BrowserWindow | null) {}

  async checkForUpdates(interactive: boolean): Promise<void> {
    if (!app.isPackaged) {
      if (interactive) {
        await this.showMessageBox({
          type: "info",
          title: "CyberGrid Updates",
          message: "Update checks are available in packaged CyberGrid builds.",
          detail: `Development build ${app.getVersion()} is running from source.`,
        });
      }
      return;
    }

    this.interactiveCheck ||= interactive;
    try {
      const updater = await this.ensureUpdater();
      await updater.checkForUpdates();
    } catch (error) {
      await this.handleError(error);
    }
  }

  async downloadUpdate(): Promise<void> {
    if (!app.isPackaged) throw new Error("Updates can only be downloaded by a packaged CyberGrid build.");
    this.downloadRequested = true;
    this.sendStatus({
      stage: "download-progress",
      message: "Preparing the CyberGrid update download...",
      percent: 0,
    });
    try {
      await (await this.ensureUpdater()).downloadUpdate();
    } catch (error) {
      await this.handleError(error);
      throw error;
    }
  }

  installUpdate(): void {
    if (!app.isPackaged || !this.updater || !this.downloaded) {
      throw new Error("A downloaded CyberGrid update is not ready to install.");
    }
    setImmediate(() => this.updater?.quitAndInstall(false, true));
  }

  private async ensureUpdater(): Promise<AppUpdater> {
    if (this.updater) return this.updater;
    this.initialization ??= import("electron-updater").then((loadedModule) => {
      // electron-updater is CommonJS. Depending on how Node resolves a packaged
      // build, autoUpdater can be exposed on either the namespace or default export.
      const module = loadedModule as unknown as ElectronUpdaterModuleShape;
      const autoUpdater = module.autoUpdater ?? module.default?.autoUpdater;
      if (!autoUpdater) {
        throw new Error("electron-updater loaded without an autoUpdater instance.");
      }
      this.updater = autoUpdater;
      autoUpdater.autoDownload = false;
      autoUpdater.autoInstallOnAppQuit = true;
      autoUpdater.on("checking-for-update", () => {
        this.sendStatus({
          stage: "checking",
          message: "Checking GitHub Releases for updates...",
        });
      });
      autoUpdater.on("update-not-available", () => {
        const showDialog = this.interactiveCheck;
        this.interactiveCheck = false;
        if (showDialog) {
          void this.showMessageBox({
            type: "info",
            title: "CyberGrid is Up to Date",
            message: `You are currently running the latest version of CyberGrid (v${app.getVersion()}).`,
          });
        }
      });
      autoUpdater.on("update-available", (info) => {
        const event: AppUpdateEvent = { version: info.version };
        this.send(IPC_CHANNELS.appUpdateAvailable, event);
        const showDialog = this.interactiveCheck;
        this.interactiveCheck = false;
        if (showDialog) void this.promptToDownload(info.version);
      });
      autoUpdater.on("download-progress", (progress) => {
        this.sendStatus({
          stage: "download-progress",
          message: `Downloading CyberGrid update... ${progress.percent.toFixed(1)}%`,
          percent: Math.max(0, Math.min(100, progress.percent)),
          transferred: progress.transferred,
          total: progress.total,
          bytesPerSecond: progress.bytesPerSecond,
        });
      });
      autoUpdater.on("update-downloaded", (info) => {
        this.downloaded = true;
        this.downloadRequested = false;
        const event: AppUpdateEvent = { version: info.version };
        this.send(IPC_CHANNELS.appUpdateDownloaded, event);
        void this.promptToRestart(info.version);
      });
      autoUpdater.on("error", (error) => {
        void this.handleError(error).catch(() => undefined);
      });
      return autoUpdater;
    }).catch((error: unknown) => {
      this.initialization = null;
      this.updater = null;
      throw error;
    });
    return this.initialization;
  }

  private async promptToDownload(version: string): Promise<void> {
    const result = await this.showMessageBox({
      type: "info",
      title: "Update Available!",
      message: `Version ${version} is available on GitHub. Would you like to download it now?`,
      buttons: ["Download & Install", "Remind Me Later"],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    });
    if (result.response === 0) await this.downloadUpdate().catch(() => undefined);
  }

  private async promptToRestart(version: string): Promise<void> {
    const result = await this.showMessageBox({
      type: "info",
      title: "Update Ready",
      message: `CyberGrid v${version} has finished downloading. Restart now to apply the update?`,
      buttons: ["Restart Now", "Later"],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    });
    if (result.response === 0) this.installUpdate();
  }

  private async handleError(error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    this.sendStatus({
      stage: "error",
      message: "CyberGrid could not check for updates. Check your network connection and try again.",
    });
    const shouldShowDialog = this.interactiveCheck || this.downloadRequested;
    this.interactiveCheck = false;
    this.downloadRequested = false;
    const now = Date.now();
    if (!shouldShowDialog || (message === this.lastErrorMessage && now - this.lastErrorAt < 2_000)) return;
    this.lastErrorMessage = message;
    this.lastErrorAt = now;
    await this.showMessageBox({
      type: "error",
      title: "CyberGrid Update Error",
      message: "CyberGrid could not check for updates.",
      detail: `${message}\n\nCheck your internet connection and try again from Help > Check for Updates.`,
    });
  }

  private sendStatus(event: AppUpdateStatusEvent): void {
    this.send(IPC_CHANNELS.appUpdateStatus, event);
  }

  private send(channel: string, payload: AppUpdateEvent | AppUpdateStatusEvent): void {
    const window = this.windowProvider();
    if (!window || window.isDestroyed() || window.webContents.isDestroyed()) return;
    window.webContents.send(channel, payload);
  }

  private showMessageBox(options: MessageBoxOptions): Promise<Electron.MessageBoxReturnValue> {
    const window = this.windowProvider();
    return window && !window.isDestroyed()
      ? dialog.showMessageBox(window, options)
      : dialog.showMessageBox(options);
  }
}
