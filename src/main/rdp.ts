import { randomUUID } from "node:crypto";
import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { execFile, spawn, type ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import { BrowserWindow, type WebContents } from "electron";
import { IPC_CHANNELS, type RdpBounds, type RdpConnectionConfig, type RdpConnectionStatus, type RdpStatusEvent } from "../shared/ipc";
import { RdpNativeHost } from "./rdp/native-host";
import { pollForRdpWindow, rdpAddress } from "./rdp/native-protocol";

const runFile = promisify(execFile);

interface RdpSession {
  id: string;
  sender: WebContents;
  configurationPath: string;
  hostProcess?: ChildProcess;
  credentialTarget?: string;
  cmdkeyPath: string;
  credentialsPending?: Promise<void>;
  native?: RdpNativeHost;
  bounds: RdpBounds;
  visible: boolean;
  hostReady: boolean;
  geometryTimer?: ReturnType<typeof setTimeout>;
  geometryBusy?: boolean;
  geometryDirty?: boolean;
  parentDirty?: boolean;
  abort: AbortController;
  closed: boolean;
}

export class RdpController {
  private readonly sessions = new Map<string, RdpSession>();
  private readonly observedSenders = new WeakSet<WebContents>();
  private readonly pendingCleanup = new Set<Promise<void>>();

  constructor(private readonly temporaryDirectory: string) {}

  isSupported(): boolean { return process.platform === "win32"; }

  async connect(config: RdpConnectionConfig, sender: WebContents): Promise<string> {
    if (!this.isSupported()) throw new Error("Embedded RDP sessions require Windows.");
    const parent = BrowserWindow.fromWebContents(sender);
    if (!parent || parent.isDestroyed()) throw new Error("The CyberGrid window is unavailable.");
    const systemRoot = process.env.SystemRoot;
    if (!systemRoot) throw new Error("Windows SystemRoot is unavailable.");
    const mstscPath = join(systemRoot, "System32", "mstsc.exe");
    const cmdkeyPath = join(systemRoot, "System32", "cmdkey.exe");
    await Promise.all([access(mstscPath), access(cmdkeyPath)]);
    const id = randomUUID();
    await mkdir(this.temporaryDirectory, { recursive: true, mode: 0o700 });
    const configurationPath = join(this.temporaryDirectory, `${id}.rdp`);
    await writeFile(configurationPath, this.createConfiguration(config), { encoding: "utf16le", mode: 0o600 });
    const session: RdpSession = { id, sender, configurationPath, cmdkeyPath,
      bounds: { x: 0, y: 0, width: 1, height: 1 }, visible: false, hostReady: false,
      closed: false, abort: new AbortController() };
    this.sessions.set(id, session);
    if (!this.observedSenders.has(sender)) {
      this.observedSenders.add(sender);
      sender.once("destroyed", () => this.disconnectForSender(sender));
    }
    try {
      if (sender.isDestroyed() || parent.isDestroyed()) throw new Error("RDP launch cancelled: window closed.");
      this.emitStatus(session, "launching", `Opening Windows Remote Desktop for ${config.host}...`);
      session.credentialsPending = this.prepareCredential(session, config);
      await session.credentialsPending;
      if (session.closed) throw new Error("RDP launch cancelled.");
      const child = spawn(mstscPath, [configurationPath, `/v:${rdpAddress(config.host, config.port)}`],
        { windowsHide: false, stdio: "ignore" });
      session.hostProcess = child;
      child.once("error", () => this.closeSession(session, "error", "Windows RDP could not start.", false));
      child.once("exit", (code) => {
        if (session.closed) return;
        const normal = session.hostReady && (code === 0 || code === null);
        this.closeSession(session, normal ? "closed" : "error",
          normal ? "RDP session closed." : `Windows RDP exited with code ${code}.`, false);
      });
      void this.attachNativeWindow(session).catch((error: unknown) =>
        this.closeSession(session, "error", error instanceof Error ? error.message : "RDP docking failed.", true));
    } catch (error) {
      this.closeSession(session, "error", error instanceof Error ? error.message : "RDP launch failed.", true);
      throw error;
    }
    return id;
  }

  setBounds(id: string, bounds: RdpBounds): void {
    const session = this.sessions.get(id);
    if (!session || session.closed) return;
    if (session.bounds.x === bounds.x && session.bounds.y === bounds.y &&
        session.bounds.width === bounds.width && session.bounds.height === bounds.height) return;
    session.bounds = bounds;
    clearTimeout(session.geometryTimer);
    session.geometryTimer = setTimeout(() => this.applyGeometry(session), 150);
  }

  setVisible(id: string, visible: boolean): void {
    const session = this.sessions.get(id);
    if (!session || session.closed || session.visible === visible) return;
    session.visible = visible;
    this.applyGeometry(session);
  }

  refreshForWindow(window: BrowserWindow): void {
    if (window.isDestroyed()) return;
    for (const session of this.sessions.values()) {
      if (!session.closed && BrowserWindow.fromWebContents(session.sender) === window) this.applyGeometry(session);
    }
  }

  attachRenderer(id: string, sender: WebContents): boolean {
    const session = this.sessions.get(id);
    const parent = BrowserWindow.fromWebContents(sender);
    if (!session || session.closed || !parent || parent.isDestroyed()) return false;
    session.sender = sender;
    if (!this.observedSenders.has(sender)) {
      this.observedSenders.add(sender);
      sender.once("destroyed", () => this.disconnectForSender(sender));
    }
    session.parentDirty = true;
    this.applyGeometry(session);
    return true;
  }

  disconnect(id: string): void {
    const session = this.sessions.get(id);
    if (session) this.closeSession(session, "closed", "RDP session closed by user.", true);
  }
  kill(id: string): void { this.disconnect(id); }
  disconnectAll(): void {
    for (const session of [...this.sessions.values()]) this.closeSession(session, "closed", "CyberGrid is closing.", true);
  }
  async flush(): Promise<void> { await Promise.allSettled([...this.pendingCleanup]); }

  private async attachNativeWindow(session: RdpSession): Promise<void> {
    const processId = session.hostProcess?.pid;
    if (!processId) throw new Error("Windows RDP did not provide a process identifier.");
    session.native = new RdpNativeHost((error) => this.closeSession(session, "error", error.message, true));
    await pollForRdpWindow(async () => {
      if (session.closed || !session.native) return false;
      const result = await session.native.request({ op: "find", processId });
      return result.found === true;
    }, session.abort.signal);
    if (session.closed) return;
    session.hostReady = true;
    session.parentDirty = true;
    await this.drainGeometry(session);
    if (!session.closed) this.emitStatus(session, "running", "RDP window docked in the active tab.");
  }

  private nativeHandle(window: BrowserWindow): string {
    const buffer = window.getNativeWindowHandle();
    if (buffer.length >= 8) return buffer.readBigUInt64LE().toString();
    if (buffer.length >= 4) return BigInt(buffer.readUInt32LE()).toString();
    throw new Error("CyberGrid could not read its native window handle.");
  }

  private applyGeometry(session: RdpSession): void {
    clearTimeout(session.geometryTimer);
    session.geometryDirty = true;
    void this.drainGeometry(session).catch((error: unknown) =>
      this.closeSession(session, "error", error instanceof Error ? error.message : "RDP resize failed.", true));
  }

  private async drainGeometry(session: RdpSession): Promise<void> {
    if (session.closed || !session.hostReady || !session.native || session.geometryBusy) return;
    session.geometryBusy = true;
    try {
      do {
        session.geometryDirty = false;
        const parent = BrowserWindow.fromWebContents(session.sender);
        if (!parent || parent.isDestroyed()) throw new Error("RDP parent window closed.");
        if (session.parentDirty) {
          session.parentDirty = false;
          await session.native.request({ op: "dock", parent: this.nativeHandle(parent), bounds: session.bounds, visible: session.visible });
          if (!parent.isDestroyed() && !parent.webContents.isDestroyed()) parent.webContents.invalidate();
        } else {
          await session.native.request({ op: "geometry", bounds: session.bounds, visible: session.visible });
        }
      } while ((session.geometryDirty || session.parentDirty) && !session.closed);
    } finally { session.geometryBusy = false; }
  }

  private createConfiguration(config: RdpConnectionConfig): string {
    const address = rdpAddress(config.host, config.port);
    const username = this.formatUsername(config.username, config.domain);
    const smartSizing = config.smartSizing !== false ? 1 : 0;
    const colorDepth = config.colorDepth ?? 32;
    const audioMode = config.soundMode === "remote" ? 1 : config.soundMode === "disabled" ? 2 : 0;
    return `\uFEFF${[
      "screen mode id:i:1", "use multimon:i:0", `session bpp:i:${colorDepth}`,
      `smart sizing:i:${smartSizing}`, `dynamic resolution:i:${smartSizing}`, "desktopwidth:i:1920", "desktopheight:i:1080",
      "desktopscalefactor:i:100", "devicescalefactor:i:100",
      `full address:s:${address}`, `username:s:${username}`,
      `prompt for credentials on client:i:${config.password && username ? 0 : 1}`, "authentication level:i:2", "enablecredsspsupport:i:1",
      `audiomode:i:${audioMode}`, "audiocapturemode:i:0",
      "redirectclipboard:i:1", "redirectprinters:i:0", "redirectcomports:i:0", "redirectsmartcards:i:0",
      "drivestoredirect:s:", "networkautodetect:i:1", "bandwidthautodetect:i:1", "compression:i:1",
      "connection type:i:7", "autoreconnection enabled:i:1", "promptcredentialonce:i:1", "",
    ].join("\r\n")}`;
  }

  private formatUsername(username: string, domain?: string): string {
    const cleanUsername = this.decodeCredentialComponent(username.trim(), "RDP username").replace(/^~+/, "");
    const cleanDomain = domain
      ? this.decodeCredentialComponent(domain.trim(), "RDP domain")
      : undefined;
    if (!cleanDomain || cleanDomain === "." || cleanUsername.includes("\\")) return cleanUsername;
    return `${cleanDomain}\\${cleanUsername}`;
  }

  private decodeCredentialComponent(value: string, label: string): string {
    try {
      return decodeURIComponent(value);
    } catch {
      throw new Error(`${label} contains invalid URL encoding.`);
    }
  }


  private async prepareCredential(session: RdpSession, config: RdpConnectionConfig): Promise<void> {
    const username = this.formatUsername(config.username, config.domain);
    if (!config.password || !username) return;
    const target = `TERMSRV/${config.host.replace(/^\[|\]$/g, "")}`;
    try {
      await runFile(session.cmdkeyPath, [`/generic:${target}`, `/user:${username}`, `/pass:${config.password}`],
        { windowsHide: true, timeout: 5_000, maxBuffer: 64 * 1024 });
      session.credentialTarget = target;
    } catch { throw new Error("Windows Credential Manager rejected the RDP credentials."); }
  }

  private async terminateProcess(session: RdpSession): Promise<void> {
    const pid = session.hostProcess?.pid;
    if (!pid || session.hostProcess?.exitCode !== null) return;
    if (process.env.SystemRoot) {
      try {
        await runFile(join(process.env.SystemRoot, "System32", "taskkill.exe"), ["/PID", String(pid), "/T", "/F"],
          { windowsHide: true, timeout: 5_000, maxBuffer: 64 * 1024 });
        return;
      } catch { /* Fall back only to the exact process spawned by this session. */ }
    }
    try { session.hostProcess?.kill("SIGKILL"); } catch { /* Already exited. */ }
  }

  private disconnectForSender(sender: WebContents): void {
    for (const session of [...this.sessions.values()]) if (session.sender === sender) this.disconnect(session.id);
  }

  private emitStatus(session: RdpSession, status: RdpConnectionStatus, message: string): void {
    if (session.closed || session.sender.isDestroyed()) return;
    const payload: RdpStatusEvent = { sessionId: session.id, status, message };
    try { session.sender.send(IPC_CHANNELS.rdpStatus, payload); } catch { /* Renderer closed during delivery. */ }
  }

  private closeSession(session: RdpSession, status: "closed" | "error", message: string, terminate: boolean): void {
    if (session.closed) return;
    this.emitStatus(session, status, message);
    session.closed = true;
    session.abort.abort();
    clearTimeout(session.geometryTimer);
    session.native?.dispose();
    this.sessions.delete(session.id);
    const cleanup = (async () => {
      await session.credentialsPending?.catch(() => undefined);
      if (terminate) await this.terminateProcess(session);
      if (session.credentialTarget) {
        try {
          await runFile(session.cmdkeyPath, [`/delete:${session.credentialTarget}`],
            { windowsHide: true, timeout: 5_000, maxBuffer: 64 * 1024 });
        } catch { console.warn("RDP credential cleanup failed; review Windows Credential Manager."); }
        session.credentialTarget = undefined;
      }
      await rm(session.configurationPath, { force: true }).catch(() => undefined);
    })();
    this.pendingCleanup.add(cleanup);
    void cleanup.finally(() => this.pendingCleanup.delete(cleanup));
  }
}
