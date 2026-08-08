import { createConnection, type Socket } from "node:net";
import { randomUUID } from "node:crypto";
import type { WebContents } from "electron";
import { AuditController, type AuditSessionContext } from "./audit";
import {
  IPC_CHANNELS,
  type StreamConnectionConfig,
  type StreamDataEvent,
  type StreamStatusEvent,
} from "../shared/ipc";

type TelnetState = "data" | "iac" | "option" | "subnegotiation" | "subnegotiation-iac";

interface StreamSession {
  socket: Socket;
  sender: WebContents;
  protocol: "telnet" | "raw";
  telnetState: TelnetState;
  telnetCommand?: number;
  closed: boolean;
}

const IAC = 255;
const DONT = 254;
const DO = 253;
const WONT = 252;
const WILL = 251;
const SB = 250;
const SE = 240;

export class StreamController {
  private readonly sessions = new Map<string, StreamSession>();

  constructor(private readonly audit: AuditController) {}

  connect(config: StreamConnectionConfig, sender: WebContents, auditContext: AuditSessionContext): string {
    const sessionId = randomUUID();
    const socket = createConnection({ host: config.host, port: config.port });
    const session: StreamSession = {
      socket,
      sender,
      protocol: config.protocol,
      telnetState: "data",
      closed: false,
    };
    this.sessions.set(sessionId, session);
    this.audit.startSession(sessionId, auditContext);
    this.sendStatus(sessionId, session, "connecting", `Connecting to ${config.host}:${config.port}...`);

    socket.setKeepAlive(true, 20_000);
    socket.on("connect", () => this.sendStatus(sessionId, session, "connected"));
    socket.on("data", (chunk: Buffer) => {
      const data = session.protocol === "telnet" ? this.decodeTelnet(session, chunk) : chunk;
      if (data.length > 0) this.audit.recordOutput(sessionId, data);
      if (data.length > 0 && !sender.isDestroyed()) {
        const event: StreamDataEvent = { sessionId, data: data.toString("utf8") };
        sender.send(IPC_CHANNELS.streamData, event);
      }
    });
    socket.on("error", (error) => {
      this.sendStatus(sessionId, session, "error", error.message);
    });
    socket.on("close", () => this.finish(sessionId, session));
    return sessionId;
  }

  write(sessionId: string, data: string): void {
    const session = this.requireSession(sessionId);
    if (!session.socket.writable) {
      throw new Error("Terminal socket is not writable.");
    }
    session.socket.write(data, "utf8");
  }

  disconnect(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.socket.destroy();
      this.finish(sessionId, session);
    }
  }

  disconnectAll(): void {
    for (const sessionId of [...this.sessions.keys()]) {
      this.disconnect(sessionId);
    }
  }

  private decodeTelnet(session: StreamSession, input: Buffer): Buffer {
    const output: number[] = [];
    for (const byte of input) {
      switch (session.telnetState) {
        case "data":
          if (byte === IAC) {
            session.telnetState = "iac";
          } else {
            output.push(byte);
          }
          break;
        case "iac":
          if (byte === IAC) {
            output.push(IAC);
            session.telnetState = "data";
          } else if (byte === WILL || byte === WONT || byte === DO || byte === DONT) {
            session.telnetCommand = byte;
            session.telnetState = "option";
          } else if (byte === SB) {
            session.telnetState = "subnegotiation";
          } else {
            session.telnetState = "data";
          }
          break;
        case "option": {
          const command = session.telnetCommand;
          if (command === WILL) {
            session.socket.write(Buffer.from([IAC, DONT, byte]));
          } else if (command === DO) {
            session.socket.write(Buffer.from([IAC, WONT, byte]));
          }
          session.telnetCommand = undefined;
          session.telnetState = "data";
          break;
        }
        case "subnegotiation":
          if (byte === IAC) {
            session.telnetState = "subnegotiation-iac";
          }
          break;
        case "subnegotiation-iac":
          session.telnetState = byte === SE ? "data" : "subnegotiation";
          break;
      }
    }
    return Buffer.from(output);
  }

  private requireSession(sessionId: string): StreamSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error("Terminal socket session was not found.");
    }
    return session;
  }

  private finish(sessionId: string, session: StreamSession): void {
    if (session.closed) {
      return;
    }
    session.closed = true;
    this.sessions.delete(sessionId);
    this.audit.endSession(sessionId, `${session.protocol.toUpperCase()} session disconnected`);
    this.sendStatus(sessionId, session, "disconnected");
  }

  private sendStatus(
    sessionId: string,
    session: StreamSession,
    status: StreamStatusEvent["status"],
    message?: string,
  ): void {
    if (!session.sender.isDestroyed()) {
      const event: StreamStatusEvent = { sessionId, status, message };
      session.sender.send(IPC_CHANNELS.streamStatus, event);
    }
  }
}
