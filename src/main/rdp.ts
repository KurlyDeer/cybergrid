import { randomUUID } from "node:crypto";
import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import type { WebContents } from "electron";
import {
  IPC_CHANNELS,
  type RdpConnectionConfig,
  type RdpConnectionStatus,
  type RdpStatusEvent,
} from "../shared/ipc";

interface RdpSession {
  id: string;
  sender: WebContents;
  configurationPath: string;
  process?: ChildProcess;
  closed: boolean;
}

export class RdpController {
  private readonly sessions = new Map<string, RdpSession>();
  private readonly observedSenders = new WeakSet<WebContents>();

  constructor(private readonly temporaryDirectory: string) {}

  isSupported(): boolean {
    return process.platform === "win32";
  }

  async connect(config: RdpConnectionConfig, sender: WebContents): Promise<string> {
    if (!this.isSupported()) {
      throw new Error("Native RDP sessions are currently available on Windows only.");
    }

    const systemRoot = process.env.SystemRoot;
    if (!systemRoot) {
      throw new Error("Windows SystemRoot is unavailable; mstsc.exe could not be located.");
    }
    const executablePath = join(systemRoot, "System32", "mstsc.exe");
    await access(executablePath).catch(() => {
      throw new Error("Windows Remote Desktop client (mstsc.exe) is not installed.");
    });

    const sessionId = randomUUID();
    await mkdir(this.temporaryDirectory, { recursive: true, mode: 0o700 });
    const configurationPath = join(this.temporaryDirectory, `${sessionId}.rdp`);
    await writeFile(configurationPath, this.createConfiguration(config), {
      encoding: "utf16le",
      mode: 0o600,
    });

    const session: RdpSession = {
      id: sessionId,
      sender,
      configurationPath,
      closed: false,
    };
    this.sessions.set(sessionId, session);
    this.emitStatus(session, "launching", `Launching Windows Remote Desktop for ${config.host}...`);

    if (!this.observedSenders.has(sender)) {
      this.observedSenders.add(sender);
      sender.once("destroyed", () => this.disconnectForSender(sender));
    }

    try {
      const child = spawn(executablePath, [configurationPath], {
        windowsHide: false,
        stdio: "ignore",
      });
      session.process = child;
      child.once("spawn", () => {
        this.emitStatus(session, "running", `Native RDP session opened for ${config.host}.`);
      });
      child.once("error", (error) => {
        this.closeSession(session, "error", error.message, false);
      });
      child.once("exit", (code) => {
        const message = code === 0 || code === null
          ? "Native RDP session closed."
          : `Windows Remote Desktop exited with code ${code}.`;
        this.closeSession(session, code === 0 || code === null ? "closed" : "error", message, false);
      });
    } catch (error) {
      this.closeSession(session, "error", error instanceof Error ? error.message : String(error), false);
      throw error;
    }

    return sessionId;
  }

  disconnect(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.closeSession(session, "closed", "RDP session closed by user.", true);
    }
  }

  disconnectAll(): void {
    for (const session of [...this.sessions.values()]) {
      this.closeSession(session, "closed", "CyberGrid is closing.", true);
    }
  }

  private createConfiguration(config: RdpConnectionConfig): string {
    const address = config.host.includes(":") ? `[${config.host}]` : config.host;
    return `\uFEFF${[
      "screen mode id:i:2",
      "use multimon:i:0",
      "session bpp:i:32",
      `full address:s:${address}:${config.port}`,
      `username:s:${config.username}`,
      "prompt for credentials on client:i:1",
      "authentication level:i:2",
      "enablecredsspsupport:i:1",
      "redirectclipboard:i:1",
      "redirectprinters:i:0",
      "redirectcomports:i:0",
      "redirectsmartcards:i:0",
      "drivestoredirect:s:",
      "networkautodetect:i:1",
      "bandwidthautodetect:i:1",
      "compression:i:1",
      "connection type:i:7",
      "autoreconnection enabled:i:1",
      "promptcredentialonce:i:1",
      "",
    ].join("\r\n")}`;
  }

  private disconnectForSender(sender: WebContents): void {
    for (const session of [...this.sessions.values()]) {
      if (session.sender === sender) {
        this.closeSession(session, "closed", "Renderer closed.", true);
      }
    }
  }

  private emitStatus(
    session: RdpSession,
    status: RdpConnectionStatus,
    message?: string,
  ): void {
    if (session.closed || session.sender.isDestroyed()) {
      return;
    }
    const payload: RdpStatusEvent = { sessionId: session.id, status, message };
    session.sender.send(IPC_CHANNELS.rdpStatus, payload);
  }

  private closeSession(
    session: RdpSession,
    status: "closed" | "error",
    message: string,
    terminateProcess: boolean,
  ): void {
    if (session.closed) {
      return;
    }

    if (!session.sender.isDestroyed()) {
      const payload: RdpStatusEvent = { sessionId: session.id, status, message };
      session.sender.send(IPC_CHANNELS.rdpStatus, payload);
    }
    session.closed = true;
    this.sessions.delete(session.id);

    if (terminateProcess && session.process && !session.process.killed) {
      session.process.kill();
    }
    void rm(session.configurationPath, { force: true }).catch(() => undefined);
  }
}
