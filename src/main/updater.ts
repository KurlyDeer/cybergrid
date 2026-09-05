import { app, type BrowserWindow } from "electron";
import { IPC_CHANNELS, type AppUpdateEvent, type AppUpdateStatusEvent } from "../shared/ipc";

type AppUpdater = import("electron-updater").AppUpdater;
interface ElectronUpdaterModuleShape { autoUpdater?: AppUpdater; default?: { autoUpdater?: AppUpdater } }

export class UpdaterController {
  private updater: AppUpdater | null = null;
  private initialization: Promise<AppUpdater> | null = null;
  private check: Promise<void> | null = null;
  private interactiveCheck = false;
  private downloadRequested = false;
  private downloaded = false;
  private lastErrorMessage = "";
  private lastErrorAt = 0;
  private lastProgressAt = 0;

  constructor(private readonly windowProvider: () => BrowserWindow | null) {}

  async checkForUpdates(interactive: boolean): Promise<void> {
    if (!app.isPackaged) {
      if (interactive) this.sendStatus({ stage: "development", message: "Update checks are available in packaged CyberGrid builds." });
      return;
    }
    this.interactiveCheck ||= interactive;
    if (this.check) return this.check;
    this.check = this.runCheck().finally(() => { this.check = null; });
    return this.check;
  }

  private async runCheck(): Promise<void> {
    try { await (await this.ensureUpdater()).checkForUpdates(); }
    catch (error) { this.handleError(error); }
  }

  async downloadUpdate(): Promise<void> {
    if (!app.isPackaged) throw new Error("Updates require a packaged CyberGrid build.");
    if (this.downloadRequested) return;
    this.downloadRequested = true;
    this.lastProgressAt = 0;
    this.sendStatus({ stage: "download-progress", message: "Downloading update...", percent: 0 });
    try { await (await this.ensureUpdater()).downloadUpdate(); }
    catch (error) { this.handleError(error); throw error; }
  }

  installUpdate(): void {
    if (!app.isPackaged || !this.updater || !this.downloaded) throw new Error("An update is not ready to install.");
    setImmediate(() => {
      try { this.updater?.quitAndInstall(false, true); }
      catch (error) { this.interactiveCheck = true; this.handleError(error); }
    });
  }

  private async ensureUpdater(): Promise<AppUpdater> {
    if (this.updater) return this.updater;
    this.initialization ??= import("electron-updater").then((loadedModule) => {
      const module = loadedModule as unknown as ElectronUpdaterModuleShape;
      const updater = module.autoUpdater ?? module.default?.autoUpdater;
      if (!updater) throw new Error("electron-updater loaded without an autoUpdater instance.");
      this.updater = updater;
      updater.autoDownload = false;
      updater.autoInstallOnAppQuit = true;
      updater.on("checking-for-update", () => this.sendStatus({ stage: "checking", message: "Checking for updates..." }));
      updater.on("update-not-available", () => {
        if (this.interactiveCheck) this.sendStatus({ stage: "up-to-date",
          message: `You are running the latest version of CyberGrid (v${app.getVersion()}).` });
        this.interactiveCheck = false;
      });
      updater.on("update-available", (info) => {
        this.interactiveCheck = false;
        this.send(IPC_CHANNELS.appUpdateAvailable, { version: info.version });
      });
      updater.on("download-progress", (progress) => {
        const now = Date.now();
        if (now - this.lastProgressAt < 250 && progress.percent < 100) return;
        this.lastProgressAt = now;
        const percent = Number.isFinite(progress.percent) ? Math.max(0, Math.min(100, progress.percent)) : 0;
        this.sendStatus({ stage: "download-progress", message: `Downloading update... ${Math.round(percent)}%`,
          percent, transferred: progress.transferred, total: progress.total, bytesPerSecond: progress.bytesPerSecond });
      });
      updater.on("update-downloaded", (info) => {
        this.downloaded = true;
        this.downloadRequested = false;
        this.send(IPC_CHANNELS.appUpdateDownloaded, { version: info.version });
      });
      updater.on("error", (error) => this.handleError(error));
      return updater;
    }).catch((error: unknown) => {
      this.initialization = null;
      this.updater = null;
      throw error;
    });
    return this.initialization;
  }

  private handleError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    const interactive = this.interactiveCheck || this.downloadRequested;
    this.interactiveCheck = false;
    this.downloadRequested = false;
    const now = Date.now();
    if (message === this.lastErrorMessage && now - this.lastErrorAt < 2_000) return;
    this.lastErrorMessage = message;
    this.lastErrorAt = now;
    this.sendStatus({ stage: "error", interactive,
      message: "Could not check for updates. Check your network connection and try again." });
  }

  private sendStatus(event: AppUpdateStatusEvent): void { this.send(IPC_CHANNELS.appUpdateStatus, event); }

  private send(channel: string, payload: AppUpdateEvent | AppUpdateStatusEvent): void {
    const window = this.windowProvider();
    if (!window || window.isDestroyed() || window.webContents.isDestroyed()) return;
    try { window.webContents.send(channel, payload); }
    catch { /* A window may close between the lifecycle check and delivery. */ }
  }
}
