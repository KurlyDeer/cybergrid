import { randomUUID } from "node:crypto";
import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { BrowserWindow, type WebContents } from "electron";
import {
  IPC_CHANNELS,
  type RdpBounds,
  type RdpConnectionConfig,
  type RdpConnectionStatus,
  type RdpStatusEvent,
} from "../shared/ipc";

type NativeWindowHandle = unknown;

interface Win32Bindings {
  findMstscWindow(processId: number): NativeWindowHandle | undefined;
  embed(windowHandle: NativeWindowHandle, parentHandle: bigint): void;
  move(windowHandle: NativeWindowHandle, bounds: RdpBounds): void;
  setVisible(windowHandle: NativeWindowHandle, visible: boolean): void;
  close(windowHandle: NativeWindowHandle): void;
}

interface RdpSession {
  id: string;
  sender: WebContents;
  configurationPath: string;
  hostProcess?: ChildProcess;
  credentialTarget?: string;
  cmdkeyPath?: string;
  native?: Win32Bindings;
  windowHandle?: NativeWindowHandle;
  bounds: RdpBounds;
  visible: boolean;
  hostReady: boolean;
  closed: boolean;
}

const GWL_STYLE = -16;
const WS_CHILD = 0x40000000;
const WS_CLIPCHILDREN = 0x02000000;
const WS_VISIBLE = 0x10000000;
const EMBEDDED_RDP_STYLE = WS_CHILD | WS_CLIPCHILDREN | WS_VISIBLE;
const SW_HIDE = 0;
const SW_SHOW = 5;
const SWP_NOZORDER = 0x0004;
const SWP_NOACTIVATE = 0x0010;
const SWP_FRAMECHANGED = 0x0020;
const SWP_SHOWWINDOW = 0x0040;
const WM_CLOSE = 0x0010;

let win32Promise: Promise<Win32Bindings> | undefined;

function loadWin32(): Promise<Win32Bindings> {
  if (process.platform !== "win32") {
    return Promise.reject(new Error("Embedded RDP sessions are available on Windows only."));
  }
  win32Promise ??= import("koffi").then((koffi) => {
    const user32 = koffi.load("user32.dll");
    const hwndType = koffi.pointer("HWND", koffi.opaque());
    const enumWindowsProc = koffi.proto("__stdcall", "EnumWindowsProc", "bool", [hwndType, "intptr_t"]);
    const callbackPointer = koffi.pointer(enumWindowsProc);
    const enumWindows = user32.func("__stdcall", "EnumWindows", "bool", [callbackPointer, "intptr_t"]);
    const getWindowThreadProcessId = user32.func(
      "__stdcall",
      "GetWindowThreadProcessId",
      "uint32_t",
      [hwndType, koffi.out(koffi.pointer("uint32_t"))],
    );
    const getClassName = user32.func("__stdcall", "GetClassNameA", "int", [hwndType, "char *", "int"]);
    const getWindowLongPtr = user32.func("__stdcall", "GetWindowLongPtrA", "intptr_t", [hwndType, "int"]);
    const setWindowLongPtr = user32.func("__stdcall", "SetWindowLongPtrA", "intptr_t", [hwndType, "int", "intptr_t"]);
    const setParent = user32.func("__stdcall", "SetParent", hwndType, [hwndType, hwndType]);
    const setWindowPos = user32.func(
      "__stdcall",
      "SetWindowPos",
      "bool",
      [hwndType, hwndType, "int", "int", "int", "int", "uint32_t"],
    );
    const updateWindow = user32.func("__stdcall", "UpdateWindow", "bool", [hwndType]);
    const showWindow = user32.func("__stdcall", "ShowWindow", "bool", [hwndType, "int"]);
    const postMessage = user32.func("__stdcall", "PostMessageA", "bool", [hwndType, "uint32_t", "uintptr_t", "intptr_t"]);

    const processIdForWindow = (windowHandle: NativeWindowHandle): number => {
      const output = Buffer.alloc(4);
      getWindowThreadProcessId(windowHandle, output);
      return output.readUInt32LE(0);
    };
    const classNameForWindow = (windowHandle: NativeWindowHandle): string => {
      const output = Buffer.alloc(256);
      const length = Number(getClassName(windowHandle, output, output.length));
      return length > 0 ? output.toString("utf8", 0, length) : "";
    };

    return {
      findMstscWindow(processId: number): NativeWindowHandle | undefined {
        let found: NativeWindowHandle | undefined;
        enumWindows((topLevelWindow: NativeWindowHandle) => {
          if (processIdForWindow(topLevelWindow) !== processId) return true;
          if (classNameForWindow(topLevelWindow) !== "TscShellContainerClass") return true;
          found = topLevelWindow;
          return false;
        }, 0);
        return found;
      },
      embed(windowHandle: NativeWindowHandle, parentHandle: bigint): void {
        getWindowLongPtr(windowHandle, GWL_STYLE);
        setWindowLongPtr(windowHandle, GWL_STYLE, EMBEDDED_RDP_STYLE);
        setParent(windowHandle, parentHandle);
        setWindowPos(windowHandle, null, 0, 0, 1, 1, SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED);
        updateWindow(windowHandle);
        updateWindow(parentHandle);
      },
      move(windowHandle: NativeWindowHandle, bounds: RdpBounds): void {
        setWindowPos(
          windowHandle,
          null,
          Math.round(bounds.x),
          Math.round(bounds.y),
          Math.max(1, Math.round(bounds.width)),
          Math.max(1, Math.round(bounds.height)),
          SWP_NOZORDER | SWP_NOACTIVATE | SWP_SHOWWINDOW,
        );
        updateWindow(windowHandle);
      },
      setVisible(windowHandle: NativeWindowHandle, visible: boolean): void {
        showWindow(windowHandle, visible ? SW_SHOW : SW_HIDE);
        if (visible) updateWindow(windowHandle);
      },
      close(windowHandle: NativeWindowHandle): void {
        postMessage(windowHandle, WM_CLOSE, 0, 0);
      },
    };
  });
  return win32Promise;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

export class RdpController {
  private readonly sessions = new Map<string, RdpSession>();
  private readonly observedSenders = new WeakSet<WebContents>();

  constructor(private readonly temporaryDirectory: string) {}

  isSupported(): boolean {
    return process.platform === "win32";
  }

  async connect(config: RdpConnectionConfig, sender: WebContents): Promise<string> {
    if (!this.isSupported()) throw new Error("Embedded RDP sessions are currently available on Windows only.");
    const parentWindow = BrowserWindow.fromWebContents(sender);
    if (!parentWindow || parentWindow.isDestroyed()) throw new Error("The CyberGrid window is unavailable for RDP embedding.");
    const systemRoot = process.env.SystemRoot;
    if (!systemRoot) throw new Error("Windows SystemRoot is unavailable; mstsc.exe could not be located.");
    const mstscPath = join(systemRoot, "System32", "mstsc.exe");
    const cmdkeyPath = join(systemRoot, "System32", "cmdkey.exe");
    await Promise.all([access(mstscPath), access(cmdkeyPath)]).catch(() => {
      throw new Error("Windows Remote Desktop or Credential Manager tooling is not installed.");
    });

    const sessionId = randomUUID();
    await mkdir(this.temporaryDirectory, { recursive: true, mode: 0o700 });
    const configurationPath = join(this.temporaryDirectory, `${sessionId}.rdp`);
    await writeFile(configurationPath, this.createConfiguration(config), { encoding: "utf16le", mode: 0o600 });
    const session: RdpSession = {
      id: sessionId,
      sender,
      configurationPath,
      bounds: { x: 0, y: 0, width: 1, height: 1 },
      visible: false,
      hostReady: false,
      closed: false,
      cmdkeyPath,
    };
    this.sessions.set(sessionId, session);
    this.emitStatus(session, "launching", `Embedding Windows Remote Desktop for ${config.host}...`);
    if (!this.observedSenders.has(sender)) {
      this.observedSenders.add(sender);
      sender.once("destroyed", () => this.disconnectForSender(sender));
    }

    try {
      const decodedUsername = this.formatUsername(config.username, config.domain);
      if (config.password && decodedUsername) {
        session.credentialTarget = this.injectCredential(cmdkeyPath, config.host, decodedUsername, config.password);
      }
      const child = spawn(mstscPath, [configurationPath], { windowsHide: false, stdio: "ignore" });
      session.hostProcess = child;
      child.once("error", (error) => this.closeSession(session, "error", error.message, false));
      child.once("exit", (code) => {
        if (session.closed) return;
        const normal = session.hostReady && (code === 0 || code === null);
        this.closeSession(
          session,
          normal ? "closed" : "error",
          normal ? "Embedded RDP session closed." : `Windows RDP exited with code ${code}.`,
          false,
        );
      });
      void this.attachNativeWindow(session, parentWindow).catch((error: unknown) => {
        this.closeSession(session, "error", error instanceof Error ? error.message : String(error), true);
      });
    } catch (error) {
      this.closeSession(session, "error", error instanceof Error ? error.message : String(error), true);
      throw error;
    }
    return sessionId;
  }

  setBounds(sessionId: string, bounds: RdpBounds): void {
    const session = this.sessions.get(sessionId);
    if (!session || session.closed) return;
    session.bounds = bounds;
    this.applyGeometry(session);
  }

  setVisible(sessionId: string, visible: boolean): void {
    const session = this.sessions.get(sessionId);
    if (!session || session.closed) return;
    session.visible = visible;
    this.applyGeometry(session);
  }

  refreshForWindow(window: BrowserWindow): void {
    if (window.isDestroyed()) return;
    for (const session of this.sessions.values()) {
      if (!session.closed && BrowserWindow.fromWebContents(session.sender) === window) this.applyGeometry(session);
    }
  }

  attachRenderer(sessionId: string, sender: WebContents): boolean {
    const session = this.sessions.get(sessionId);
    const parentWindow = BrowserWindow.fromWebContents(sender);
    if (!session || session.closed || !parentWindow || parentWindow.isDestroyed()) return false;
    session.sender = sender;
    if (session.hostReady && session.native && session.windowHandle) {
      session.native.embed(session.windowHandle, this.nativeHandle(parentWindow));
      this.repaint(parentWindow);
    }
    this.applyGeometry(session);
    this.emitStatus(session, session.hostReady ? "running" : "launching", "RDP session moved to a detached window.");
    return true;
  }

  disconnect(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) this.closeSession(session, "closed", "RDP session closed by user.", true);
  }

  kill(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) this.closeSession(session, "closed", "RDP process terminated by user.", true);
  }

  disconnectAll(): void {
    for (const session of [...this.sessions.values()]) this.closeSession(session, "closed", "CyberGrid is closing.", true);
  }

  private async attachNativeWindow(session: RdpSession, parentWindow: BrowserWindow): Promise<void> {
    const processId = session.hostProcess?.pid;
    if (!processId) throw new Error("Windows RDP did not provide a process identifier.");
    const native = await loadWin32();
    const deadline = Date.now() + 20_000;
    let windowHandle: NativeWindowHandle | undefined;
    while (!session.closed && Date.now() < deadline) {
      windowHandle = native.findMstscWindow(processId);
      if (windowHandle) break;
      if (session.hostProcess?.exitCode !== null) break;
      await delay(100);
    }
    if (!windowHandle || session.closed) {
      throw new Error("The spawned Windows RDP process did not expose a matching TscShellContainerClass window.");
    }

    session.native = native;
    session.windowHandle = windowHandle;
    native.embed(windowHandle, this.nativeHandle(parentWindow));
    session.hostReady = true;
    this.applyGeometry(session);
    this.repaint(parentWindow);
    this.emitStatus(session, "running", "RDP session embedded in the active CyberGrid tab.");
  }

  private nativeHandle(window: BrowserWindow): bigint {
    const buffer = window.getNativeWindowHandle();
    if (buffer.length >= 8) return buffer.readBigUInt64LE(0);
    if (buffer.length >= 4) return BigInt(buffer.readUInt32LE(0));
    throw new Error("CyberGrid could not read its native window handle.");
  }

  private applyGeometry(session: RdpSession): void {
    if (!session.hostReady || !session.native || !session.windowHandle) return;
    session.native.move(session.windowHandle, session.bounds);
    session.native.setVisible(session.windowHandle, session.visible);
  }

  private repaint(window: BrowserWindow): void {
    if (window.isDestroyed() || window.webContents.isDestroyed()) return;
    window.webContents.invalidate();
    setImmediate(() => {
      if (!window.isDestroyed() && !window.webContents.isDestroyed()) window.webContents.invalidate();
    });
  }

  private createConfiguration(config: RdpConnectionConfig): string {
    const address = config.host.includes(":") ? `[${config.host}]` : config.host;
    const username = this.formatUsername(config.username, config.domain);
    const smartSizing = config.smartSizing !== false ? 1 : 0;
    const colorDepth = config.colorDepth ?? 32;
    const audioMode = config.soundMode === "remote" ? 1 : config.soundMode === "disabled" ? 2 : 0;
    return `\uFEFF${[
      "screen mode id:i:1", "use multimon:i:0", `session bpp:i:${colorDepth}`,
      `smart sizing:i:${smartSizing}`, `dynamic resolution:i:${smartSizing}`, "desktopwidth:i:1920", "desktopheight:i:1080",
      "desktopscalefactor:i:100", "devicescalefactor:i:100",
      `full address:s:${address}:${config.port}`, `username:s:${username}`,
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

  private injectCredential(cmdkeyPath: string, host: string, username: string, password: string): string {
    const target = `TERMSRV/${host.replace(/^\[|\]$/g, "")}`;
    try {
      // execFileSync preserves each value as one argument. Unlike execSync with
      // a composed command string, shell metacharacters in credentials cannot
      // be interpreted as commands.
      execFileSync(cmdkeyPath, [`/generic:${target}`, `/user:${username}`, `/pass:${password}`], {
        windowsHide: true,
        stdio: "ignore",
        timeout: 5_000,
      });
    } catch {
      throw new Error("Windows Credential Manager rejected the RDP credentials.");
    }
    return target;
  }

  private removeCredential(session: RdpSession): void {
    if (!session.cmdkeyPath || !session.credentialTarget) return;
    const target = session.credentialTarget;
    session.credentialTarget = undefined;
    try {
      execFileSync(session.cmdkeyPath, [`/delete:${target}`], {
        windowsHide: true,
        stdio: "ignore",
        timeout: 5_000,
      });
    } catch {
      // Credential deletion is best-effort during Windows shutdown, but the
      // target is cleared from session memory so it cannot be reused here.
    }
  }

  private terminateProcess(session: RdpSession): void {
    const processId = session.hostProcess?.pid;
    if (!processId || session.hostProcess?.exitCode !== null) return;
    const systemRoot = process.env.SystemRoot;
    if (systemRoot) {
      try {
        execFileSync(join(systemRoot, "System32", "taskkill.exe"), ["/PID", String(processId), "/T", "/F"], {
          windowsHide: true,
          stdio: "ignore",
          timeout: 5_000,
        });
        return;
      } catch {
        // Fall through to Node's direct process termination API.
      }
    }
    try {
      process.kill(processId, "SIGKILL");
    } catch {
      // The process may already have exited between the status check and kill.
    }
  }

  private disconnectForSender(sender: WebContents): void {
    for (const session of [...this.sessions.values()]) {
      if (session.sender === sender) this.closeSession(session, "closed", "Renderer closed.", true);
    }
  }

  private emitStatus(session: RdpSession, status: RdpConnectionStatus, message?: string): void {
    if (session.closed || session.sender.isDestroyed()) return;
    const payload: RdpStatusEvent = { sessionId: session.id, status, message };
    session.sender.send(IPC_CHANNELS.rdpStatus, payload);
  }

  private closeSession(session: RdpSession, status: "closed" | "error", message: string, terminate: boolean): void {
    if (session.closed) return;
    if (!session.sender.isDestroyed()) {
      const payload: RdpStatusEvent = { sessionId: session.id, status, message };
      session.sender.send(IPC_CHANNELS.rdpStatus, payload);
    }
    session.closed = true;
    this.sessions.delete(session.id);
    if (terminate) {
      try {
        if (session.native && session.windowHandle) session.native.close(session.windowHandle);
      } catch {
        // Forced PID termination below remains authoritative.
      }
      try {
        this.terminateProcess(session);
      } catch {
        // Teardown must continue so temporary credentials are never stranded.
      }
    }
    this.removeCredential(session);
    void rm(session.configurationPath, { force: true }).catch(() => undefined);
  }
}
