import { randomUUID } from "node:crypto";
import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { BrowserWindow, type WebContents } from "electron";
import {
  IPC_CHANNELS,
  type RdpBounds,
  type RdpConnectionConfig,
  type RdpConnectionStatus,
  type RdpStatusEvent,
} from "../shared/ipc";

interface RdpSession {
  id: string;
  sender: WebContents;
  configurationPath: string;
  hostProcess?: ChildProcess;
  bounds: RdpBounds;
  visible: boolean;
  hostReady: boolean;
  closed: boolean;
  stderr: string;
}

const RDP_HOST_SCRIPT = String.raw`param(
  [Parameter(Mandatory=$true)][UInt64]$ParentHandle,
  [Parameter(Mandatory=$true)][string]$ConfigurationPath
)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class CyberGridRdpHost {
  private const int GWL_STYLE = -16;
  private const int GWL_EXSTYLE = -20;
  private const long WS_CHILD = 0x40000000L;
  private const long WS_POPUP = 0x80000000L;
  private const long WS_CAPTION = 0x00C00000L;
  private const long WS_THICKFRAME = 0x00040000L;
  private const long WS_EX_DLGMODALFRAME = 0x00000001L;
  private const long WS_EX_WINDOWEDGE = 0x00000100L;
  private const long WS_EX_CLIENTEDGE = 0x00000200L;
  private const long WS_EX_STATICEDGE = 0x00020000L;
  private const uint SWP_NOMOVE = 0x0002;
  private const uint SWP_NOSIZE = 0x0001;
  private const uint SWP_NOZORDER = 0x0004;
  private const uint SWP_FRAMECHANGED = 0x0020;
  private const uint RDW_INVALIDATE = 0x0001;
  private const uint RDW_ERASE = 0x0004;
  private const uint RDW_ALLCHILDREN = 0x0080;
  private const uint RDW_UPDATENOW = 0x0100;
  private const uint RDW_FRAME = 0x0400;
  private const uint WM_CLOSE = 0x0010;
  private delegate bool EnumWindowsProc(IntPtr hwnd, IntPtr state);
  [DllImport("user32.dll")] private static extern bool EnumWindows(EnumWindowsProc callback, IntPtr state);
  [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint processId);
  [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr hwnd);
  [DllImport("user32.dll", EntryPoint="GetWindowLongPtrW")] private static extern IntPtr GetWindowLongPtr(IntPtr hwnd, int index);
  [DllImport("user32.dll", EntryPoint="SetWindowLongPtrW")] private static extern IntPtr SetWindowLongPtr(IntPtr hwnd, int index, IntPtr value);
  [DllImport("user32.dll")] private static extern IntPtr SetParent(IntPtr child, IntPtr parent);
  [DllImport("user32.dll")] private static extern bool MoveWindow(IntPtr hwnd, int x, int y, int width, int height, bool repaint);
  [DllImport("user32.dll")] private static extern bool SetWindowPos(IntPtr hwnd, IntPtr after, int x, int y, int width, int height, uint flags);
  [DllImport("user32.dll")] private static extern bool RedrawWindow(IntPtr hwnd, IntPtr updateRect, IntPtr updateRegion, uint flags);
  [DllImport("user32.dll")] private static extern bool ShowWindow(IntPtr hwnd, int command);
  [DllImport("user32.dll")] private static extern bool PostMessage(IntPtr hwnd, uint message, IntPtr wParam, IntPtr lParam);
  public static IntPtr FindWindow(uint processId) {
    IntPtr found = IntPtr.Zero;
    EnumWindows(delegate(IntPtr hwnd, IntPtr state) {
      uint owner;
      GetWindowThreadProcessId(hwnd, out owner);
      if (owner == processId && IsWindowVisible(hwnd)) { found = hwnd; return false; }
      return true;
    }, IntPtr.Zero);
    return found;
  }
  public static void Dock(IntPtr child, IntPtr parent) {
    long style = GetWindowLongPtr(child, GWL_STYLE).ToInt64();
    style = (style & ~WS_POPUP & ~WS_CAPTION & ~WS_THICKFRAME) | WS_CHILD;
    SetWindowLongPtr(child, GWL_STYLE, new IntPtr(style));
    long exStyle = GetWindowLongPtr(child, GWL_EXSTYLE).ToInt64();
    exStyle = exStyle & ~WS_EX_DLGMODALFRAME & ~WS_EX_WINDOWEDGE & ~WS_EX_CLIENTEDGE & ~WS_EX_STATICEDGE;
    SetWindowLongPtr(child, GWL_EXSTYLE, new IntPtr(exStyle));
    SetParent(child, parent);
    SetWindowPos(child, IntPtr.Zero, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_FRAMECHANGED);
    uint repaint = RDW_INVALIDATE | RDW_ERASE | RDW_ALLCHILDREN | RDW_UPDATENOW | RDW_FRAME;
    RedrawWindow(child, IntPtr.Zero, IntPtr.Zero, repaint);
    RedrawWindow(parent, IntPtr.Zero, IntPtr.Zero, repaint);
  }
  public static void Move(IntPtr hwnd, int x, int y, int width, int height) { MoveWindow(hwnd, x, y, width, height, true); }
  public static void SetVisible(IntPtr hwnd, bool visible) {
    ShowWindow(hwnd, visible ? 5 : 0);
    if (visible) RedrawWindow(hwnd, IntPtr.Zero, IntPtr.Zero, RDW_INVALIDATE | RDW_ERASE | RDW_ALLCHILDREN | RDW_UPDATENOW);
  }
  public static void Close(IntPtr hwnd) { PostMessage(hwnd, WM_CLOSE, IntPtr.Zero, IntPtr.Zero); }
}
"@

$mstsc = Join-Path $env:SystemRoot 'System32\mstsc.exe'
$quotedConfiguration = '"' + $ConfigurationPath.Replace('"', '\"') + '"'
$rdp = Start-Process -FilePath $mstsc -ArgumentList $quotedConfiguration -PassThru
$windowHandle = [IntPtr]::Zero
$deadline = [DateTime]::UtcNow.AddSeconds(20)
while ([DateTime]::UtcNow -lt $deadline -and $windowHandle -eq [IntPtr]::Zero -and -not $rdp.HasExited) {
  Start-Sleep -Milliseconds 100
  $rdp.Refresh()
  $windowHandle = [CyberGridRdpHost]::FindWindow([uint32]$rdp.Id)
}
if ($windowHandle -eq [IntPtr]::Zero) { throw 'The Windows RDP client did not expose an embeddable window.' }
[CyberGridRdpHost]::Dock($windowHandle, [IntPtr]::new([Int64]$ParentHandle))
[CyberGridRdpHost]::Move($windowHandle, 0, 0, 1, 1)
[CyberGridRdpHost]::SetVisible($windowHandle, $false)
[Console]::Out.WriteLine('READY')
[Console]::Out.Flush()

try {
  $read = [Console]::In.ReadLineAsync()
  while (-not $rdp.HasExited) {
    if ($read.Wait(100)) {
      $line = $read.Result
      if ($null -eq $line) { break }
      $parts = $line.Split(' ')
      switch ($parts[0]) {
        'BOUNDS' {
          if ($parts.Length -eq 5) {
            [CyberGridRdpHost]::Move($windowHandle, [int]$parts[1], [int]$parts[2], [int]$parts[3], [int]$parts[4])
          }
        }
        'SHOW' { [CyberGridRdpHost]::SetVisible($windowHandle, $true) }
        'HIDE' { [CyberGridRdpHost]::SetVisible($windowHandle, $false) }
        'PARENT' {
          if ($parts.Length -eq 2) {
            [CyberGridRdpHost]::Dock($windowHandle, [IntPtr]::new([Int64]$parts[1]))
          }
        }
        'CLOSE' { break }
      }
      if ($parts[0] -eq 'CLOSE') { break }
      $read = [Console]::In.ReadLineAsync()
    }
    $rdp.Refresh()
  }
} finally {
  if (-not $rdp.HasExited) {
    [CyberGridRdpHost]::Close($windowHandle)
    if (-not $rdp.WaitForExit(1500)) { $rdp.Kill() }
  }
}
`;

export class RdpController {
  private readonly sessions = new Map<string, RdpSession>();
  private readonly observedSenders = new WeakSet<WebContents>();
  private hostScriptPromise?: Promise<string>;

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
    const powershellPath = join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
    await Promise.all([access(mstscPath), access(powershellPath)]).catch(() => {
      throw new Error("Windows Remote Desktop or Windows PowerShell is not installed.");
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
      stderr: "",
    };
    this.sessions.set(sessionId, session);
    this.emitStatus(session, "launching", `Embedding Windows Remote Desktop for ${config.host}...`);
    if (!this.observedSenders.has(sender)) {
      this.observedSenders.add(sender);
      sender.once("destroyed", () => this.disconnectForSender(sender));
    }

    try {
      const hostScriptPath = await this.ensureHostScript();
      const child = spawn(powershellPath, [
        "-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
        "-File", hostScriptPath, "-ParentHandle", this.nativeHandle(parentWindow),
        "-ConfigurationPath", configurationPath,
      ], { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
      session.hostProcess = child;
      let output = "";
      child.stdout?.setEncoding("utf8");
      child.stdout?.on("data", (chunk: string) => {
        output += chunk;
        const lines = output.split(/\r?\n/);
        output = lines.pop() ?? "";
        for (const line of lines) {
          if (line.trim() === "READY" && !session.closed) {
            session.hostReady = true;
            if (!parentWindow.isDestroyed() && !parentWindow.webContents.isDestroyed()) {
              parentWindow.webContents.invalidate();
            }
            this.applyGeometry(session);
            setImmediate(() => {
              if (!parentWindow.isDestroyed() && !parentWindow.webContents.isDestroyed()) {
                parentWindow.webContents.invalidate();
              }
            });
            this.emitStatus(session, "running", `RDP session embedded for ${config.host}.`);
          }
        }
      });
      child.stderr?.setEncoding("utf8");
      child.stderr?.on("data", (chunk: string) => {
        session.stderr = `${session.stderr}${chunk}`.slice(-4_096);
      });
      child.once("error", (error) => this.closeSession(session, "error", error.message, false));
      child.once("exit", (code) => {
        if (session.closed) return;
        const detail = session.stderr.trim();
        const normal = session.hostReady && (code === 0 || code === null);
        this.closeSession(
          session,
          normal ? "closed" : "error",
          normal ? "Embedded RDP session closed." : detail || `RDP host exited with code ${code}.`,
          false,
        );
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

  attachRenderer(sessionId: string, sender: WebContents): boolean {
    const session = this.sessions.get(sessionId);
    const parentWindow = BrowserWindow.fromWebContents(sender);
    if (!session || session.closed || !parentWindow || parentWindow.isDestroyed()) return false;
    session.sender = sender;
    if (session.hostReady && session.hostProcess?.stdin?.writable) {
      session.hostProcess.stdin.write(`PARENT ${this.nativeHandle(parentWindow)}\n`);
      setImmediate(() => {
        if (!parentWindow.isDestroyed() && !parentWindow.webContents.isDestroyed()) {
          parentWindow.webContents.invalidate();
        }
      });
    }
    this.applyGeometry(session);
    this.emitStatus(session, session.hostReady ? "running" : "launching", "RDP session moved to a detached window.");
    return true;
  }

  disconnect(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) this.closeSession(session, "closed", "RDP session closed by user.", true);
  }

  disconnectAll(): void {
    for (const session of [...this.sessions.values()]) {
      this.closeSession(session, "closed", "CyberGrid is closing.", true);
    }
  }

  private ensureHostScript(): Promise<string> {
    this.hostScriptPromise ??= (async () => {
      await mkdir(this.temporaryDirectory, { recursive: true, mode: 0o700 });
      const path = join(this.temporaryDirectory, "cybergrid-rdp-host.ps1");
      await writeFile(path, RDP_HOST_SCRIPT, { encoding: "utf8", mode: 0o600 });
      return path;
    })();
    return this.hostScriptPromise;
  }

  private nativeHandle(window: BrowserWindow): string {
    const buffer = window.getNativeWindowHandle();
    if (buffer.length >= 8) return buffer.readBigUInt64LE(0).toString();
    if (buffer.length >= 4) return String(buffer.readUInt32LE(0));
    throw new Error("CyberGrid could not read its native window handle.");
  }

  private applyGeometry(session: RdpSession): void {
    if (!session.hostReady || !session.hostProcess?.stdin?.writable) return;
    const { x, y, width, height } = session.bounds;
    session.hostProcess.stdin.write(`BOUNDS ${Math.round(x)} ${Math.round(y)} ${Math.max(1, Math.round(width))} ${Math.max(1, Math.round(height))}\n`);
    session.hostProcess.stdin.write(session.visible ? "SHOW\n" : "HIDE\n");
  }

  private createConfiguration(config: RdpConnectionConfig): string {
    const address = config.host.includes(":") ? `[${config.host}]` : config.host;
    const username = this.formatUsername(config.username, config.domain);
    return `\uFEFF${[
      "screen mode id:i:1", "use multimon:i:0", "session bpp:i:32",
      "smart sizing:i:1", "dynamic resolution:i:1", "desktopwidth:i:1920", "desktopheight:i:1080",
      "desktopscalefactor:i:100", "devicescalefactor:i:100",
      `full address:s:${address}:${config.port}`, `username:s:${username}`,
      "prompt for credentials on client:i:1", "authentication level:i:2", "enablecredsspsupport:i:1",
      "redirectclipboard:i:1", "redirectprinters:i:0", "redirectcomports:i:0", "redirectsmartcards:i:0",
      "drivestoredirect:s:", "networkautodetect:i:1", "bandwidthautodetect:i:1", "compression:i:1",
      "connection type:i:7", "autoreconnection enabled:i:1", "promptcredentialonce:i:1", "",
    ].join("\r\n")}`;
  }

  private formatUsername(username: string, domain?: string): string {
    const cleanUsername = username.trim().replace(/^~+/, "");
    const cleanDomain = domain?.trim();
    if (!cleanDomain || cleanDomain === "." || cleanUsername.includes("\\")) return cleanUsername;
    return `${cleanDomain}\\${cleanUsername}`;
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
    if (terminate && session.hostProcess && !session.hostProcess.killed) {
      session.hostProcess.stdin?.write("CLOSE\n");
      const timer = setTimeout(() => session.hostProcess?.kill(), 2_000);
      timer.unref();
    }
    void rm(session.configurationPath, { force: true }).catch(() => undefined);
  }
}
