import { randomUUID } from "node:crypto";
import { Client, type ClientChannel, type ConnectConfig } from "ssh2";
import type { WebContents } from "electron";
import {
  IPC_CHANNELS,
  type SshConnectionConfig,
  type SshConnectionStatus,
  type SshStatusEvent,
} from "../shared/ipc";

interface SshSession {
  id: string;
  client: Client;
  sender: WebContents;
  stream?: ClientChannel;
  closed: boolean;
}

export class SshController {
  private readonly sessions = new Map<string, SshSession>();
  private readonly observedSenders = new WeakSet<WebContents>();

  connect(config: SshConnectionConfig, sender: WebContents): string {
    const sessionId = randomUUID();
    const client = new Client();
    const session: SshSession = {
      id: sessionId,
      client,
      sender,
      closed: false,
    };

    this.sessions.set(sessionId, session);
    this.emitStatus(session, "connecting", `Connecting to ${config.host}...`);

    client.on("ready", () => {
      client.shell(
        {
          term: "xterm-256color",
          cols: 80,
          rows: 24,
        },
        (error, stream) => {
          if (error) {
            this.closeSession(session, "error", error.message);
            return;
          }

          session.stream = stream;
          stream.setEncoding("utf8");
          stream.on("data", (data: string) => this.emitData(session, data));
          stream.stderr.setEncoding("utf8");
          stream.stderr.on("data", (data: string) => this.emitData(session, data));
          stream.on("error", (streamError: Error) => {
            this.closeSession(session, "error", streamError.message);
          });
          stream.on("close", () => {
            this.closeSession(session, "disconnected", "Remote shell closed.");
          });

          this.emitStatus(session, "connected", `Connected to ${config.host}.`);
        },
      );
    });

    client.on("keyboard-interactive", (_name, _instructions, _language, prompts, finish) => {
      finish(prompts.map(() => config.password ?? ""));
    });

    client.on("error", (error) => {
      this.closeSession(session, "error", error.message);
    });

    client.on("close", () => {
      this.closeSession(session, "disconnected", "SSH connection closed.");
    });

    if (!this.observedSenders.has(sender)) {
      this.observedSenders.add(sender);
      sender.once("destroyed", () => this.disconnectForSender(sender));
    }

    const connectConfig: ConnectConfig = {
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      privateKey: config.privateKey,
      passphrase: config.passphrase,
      readyTimeout: config.readyTimeout ?? 15_000,
      keepaliveInterval: 10_000,
      keepaliveCountMax: 3,
      tryKeyboard: Boolean(config.password),
    };

    // Defer the network connection so the renderer can associate the returned
    // session ID with its terminal before output begins arriving over IPC.
    setImmediate(() => {
      if (!session.closed) {
        client.connect(connectConfig);
      }
    });

    return sessionId;
  }

  write(sessionId: string, data: string): void {
    const stream = this.getOpenStream(sessionId);
    stream?.write(data);
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const stream = this.getOpenStream(sessionId);
    stream?.setWindow(rows, cols, 0, 0);
  }

  disconnect(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.closeSession(session, "disconnected", "Disconnected by user.");
    }
  }

  disconnectAll(): void {
    for (const session of [...this.sessions.values()]) {
      this.closeSession(session, "disconnected", "Application is closing.");
    }
  }

  private disconnectForSender(sender: WebContents): void {
    for (const session of [...this.sessions.values()]) {
      if (session.sender === sender) {
        this.closeSession(session, "disconnected", "Renderer closed.");
      }
    }
  }

  private getOpenStream(sessionId: string): ClientChannel | undefined {
    const session = this.sessions.get(sessionId);
    return session && !session.closed ? session.stream : undefined;
  }

  private emitData(session: SshSession, data: string): void {
    if (!session.closed && !session.sender.isDestroyed()) {
      session.sender.send(IPC_CHANNELS.sshData, {
        sessionId: session.id,
        data,
      });
    }
  }

  private emitStatus(
    session: SshSession,
    status: SshConnectionStatus,
    message?: string,
  ): void {
    if (session.sender.isDestroyed()) {
      return;
    }

    const payload: SshStatusEvent = {
      sessionId: session.id,
      status,
      message,
    };
    session.sender.send(IPC_CHANNELS.sshStatus, payload);
  }

  private closeSession(
    session: SshSession,
    status: "disconnected" | "error",
    message: string,
  ): void {
    if (session.closed) {
      return;
    }

    session.closed = true;
    this.sessions.delete(session.id);
    this.emitStatus(session, status, message);

    if (session.stream && !session.stream.destroyed) {
      session.stream.close();
    }
    session.client.end();
  }
}
