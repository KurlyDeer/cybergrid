import { randomUUID } from "node:crypto";
import type { WebContents } from "electron";
import { SerialPort } from "serialport";
import { AuditController, type AuditSessionContext } from "./audit";
import {
  IPC_CHANNELS,
  type SerialConnectionConfig,
  type SerialDataEvent,
  type SerialPortInfo,
  type SerialStatusEvent,
} from "../shared/ipc";

interface SerialSession {
  port: SerialPort;
  sender: WebContents;
  closed: boolean;
}

export class SerialController {
  private readonly sessions = new Map<string, SerialSession>();

  constructor(private readonly audit: AuditController) {}

  async listPorts(): Promise<SerialPortInfo[]> {
    const ports = await SerialPort.list();
    return ports.map((port) => ({
      path: port.path,
      manufacturer: port.manufacturer,
      serialNumber: port.serialNumber,
      vendorId: port.vendorId,
      productId: port.productId,
    }));
  }

  connect(config: SerialConnectionConfig, sender: WebContents, auditContext: AuditSessionContext): string {
    const sessionId = randomUUID();
    const port = new SerialPort({ ...config, autoOpen: false });
    const session: SerialSession = { port, sender, closed: false };
    this.sessions.set(sessionId, session);
    this.audit.startSession(sessionId, auditContext);
    this.sendStatus(sessionId, session, "opening", `Opening ${config.path} at ${config.baudRate} baud...`);

    port.on("data", (chunk: Buffer) => {
      this.audit.recordOutput(sessionId, chunk);
      if (!sender.isDestroyed()) {
        const event: SerialDataEvent = { sessionId, data: chunk.toString("utf8") };
        sender.send(IPC_CHANNELS.serialData, event);
      }
    });
    port.on("error", (error) => this.sendStatus(sessionId, session, "error", error.message));
    port.on("close", () => this.finish(sessionId, session));
    port.open((error) => {
      if (error) {
        this.sendStatus(sessionId, session, "error", error.message);
        this.finish(sessionId, session);
      } else {
        this.sendStatus(sessionId, session, "connected");
      }
    });
    return sessionId;
  }

  write(sessionId: string, data: string): void {
    const session = this.requireSession(sessionId);
    session.port.write(data, "utf8", (error) => {
      if (error) {
        this.sendStatus(sessionId, session, "error", error.message);
      }
    });
  }

  disconnect(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }
    if (session.port.isOpen) {
      session.port.close(() => this.finish(sessionId, session));
    } else {
      this.finish(sessionId, session);
    }
  }

  disconnectAll(): void {
    for (const sessionId of [...this.sessions.keys()]) {
      this.disconnect(sessionId);
    }
  }

  private requireSession(sessionId: string): SerialSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error("Serial session was not found.");
    }
    return session;
  }

  private finish(sessionId: string, session: SerialSession): void {
    if (session.closed) {
      return;
    }
    session.closed = true;
    this.sessions.delete(sessionId);
    this.audit.endSession(sessionId, "Serial session disconnected");
    this.sendStatus(sessionId, session, "disconnected");
  }

  private sendStatus(
    sessionId: string,
    session: SerialSession,
    status: SerialStatusEvent["status"],
    message?: string,
  ): void {
    if (!session.sender.isDestroyed()) {
      const event: SerialStatusEvent = { sessionId, status, message };
      session.sender.send(IPC_CHANNELS.serialStatus, event);
    }
  }
}
