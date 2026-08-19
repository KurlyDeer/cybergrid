import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import type { WebContents } from "electron";
import { AuditController, type AuditSessionContext } from "./audit";
import {
  IPC_CHANNELS,
  type LocalShell,
  type LocalTerminalConfig,
  type LocalTerminalDataEvent,
  type LocalTerminalStatusEvent,
} from "../shared/ipc";

type IPty = import("node-pty").IPty;

interface LocalTerminalSession {
  process: IPty;
  sender: WebContents;
  shell: LocalShell;
  closed: boolean;
  history: string;
}

let nodePtyPromise: Promise<typeof import("node-pty")> | undefined;

function loadNodePty(): Promise<typeof import("node-pty")> {
  nodePtyPromise ??= import("node-pty");
  return nodePtyPromise;
}

function shellExecutable(shell: LocalShell): string {
  if (process.platform === "win32") {
    if (shell === "cmd") return process.env.ComSpec || "cmd.exe";
    if (shell === "wsl") return "wsl.exe";
    return "powershell.exe";
  }
  if (shell === "wsl") return process.env.SHELL || "/bin/bash";
  if (shell === "cmd") return process.env.SHELL || "/bin/sh";
  return process.env.SHELL || "/bin/bash";
}

export class LocalTerminalController {
  private readonly sessions = new Map<string, LocalTerminalSession>();

  constructor(private readonly audit: AuditController) {}

  async connect(
    config: LocalTerminalConfig,
    sender: WebContents,
    auditContext: AuditSessionContext,
  ): Promise<string> {
    const nodePty = await loadNodePty();
    const sessionId = randomUUID();
    const executable = shellExecutable(config.shell);
    const args = config.shell === "powershell" && process.platform === "win32"
      ? ["-NoLogo"] : [];
    this.sendStatus(sender, sessionId, "launching", `Starting ${config.shell}...`);
    let child: IPty;
    try {
      child = nodePty.spawn(executable, args, {
        name: "xterm-256color",
        cols: config.cols ?? 80,
        rows: config.rows ?? 24,
        cwd: homedir(),
        env: process.env as Record<string, string>,
      });
    } catch (error) {
      this.sendStatus(sender, sessionId, "error", error instanceof Error ? error.message : String(error));
      throw error;
    }
    const session: LocalTerminalSession = { process: child, sender, shell: config.shell, closed: false, history: "" };
    this.sessions.set(sessionId, session);
    this.audit.startSession(sessionId, auditContext);
    child.onData((data) => {
      this.audit.recordOutput(sessionId, data);
      session.history = `${session.history}${data}`.slice(-2_000_000);
      if (!session.sender.isDestroyed()) {
        const event: LocalTerminalDataEvent = { sessionId, data };
        session.sender.send(IPC_CHANNELS.localData, event);
      }
    });
    child.onExit(({ exitCode }) => this.finish(sessionId, session, `Local shell exited with code ${exitCode}.`));
    this.sendStatus(sender, sessionId, "connected", `${config.shell} is ready.`);
    return sessionId;
  }

  attachRenderer(sessionId: string, sender: WebContents): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.closed) return false;
    session.sender = sender;
    if (session.history) sender.send(IPC_CHANNELS.localData, { sessionId, data: session.history });
    this.sendStatus(sender, sessionId, "connected", `${session.shell} is attached.`);
    return true;
  }

  write(sessionId: string, data: string): void {
    this.requireSession(sessionId).process.write(data);
  }

  resize(sessionId: string, cols: number, rows: number): void {
    this.requireSession(sessionId).process.resize(Math.max(2, cols), Math.max(1, rows));
  }

  disconnect(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.process.kill();
    this.finish(sessionId, session, "Local shell closed by user.");
  }

  disconnectAll(): void {
    for (const id of [...this.sessions.keys()]) this.disconnect(id);
  }

  private requireSession(sessionId: string): LocalTerminalSession {
    const session = this.sessions.get(sessionId);
    if (!session || session.closed) throw new Error("Local terminal session was not found.");
    return session;
  }

  private finish(sessionId: string, session: LocalTerminalSession, message: string): void {
    if (session.closed) return;
    session.closed = true;
    this.sessions.delete(sessionId);
    this.audit.endSession(sessionId, message);
    this.sendStatus(session.sender, sessionId, "disconnected", message);
  }

  private sendStatus(
    sender: WebContents,
    sessionId: string,
    status: LocalTerminalStatusEvent["status"],
    message?: string,
  ): void {
    if (!sender.isDestroyed()) sender.send(IPC_CHANNELS.localStatus, { sessionId, status, message });
  }
}
