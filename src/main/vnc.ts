import { randomBytes, randomUUID } from "node:crypto";
import { createConnection, type Socket } from "node:net";
import type { AddressInfo } from "node:net";
import type { WebContents } from "electron";
import { WebSocket, WebSocketServer, type RawData } from "ws";
import {
  IPC_CHANNELS,
  type VncConnectionConfig,
  type VncConnectionResult,
  type VncStatusEvent,
} from "../shared/ipc";

interface VncSession {
  server: WebSocketServer;
  sender: WebContents;
  tokenPath: string;
  config: VncConnectionConfig;
  socket?: Socket;
  client?: WebSocket;
  closed: boolean;
}

function rawDataToBuffer(data: RawData): Buffer {
  if (Buffer.isBuffer(data)) {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return Buffer.from(data);
  }
  if (Array.isArray(data)) {
    return Buffer.concat(data);
  }
  throw new Error("Unsupported VNC WebSocket payload type.");
}

export class VncController {
  private readonly sessions = new Map<string, VncSession>();

  async connect(config: VncConnectionConfig, sender: WebContents): Promise<VncConnectionResult> {
    const sessionId = randomUUID();
    const tokenPath = `/${randomBytes(24).toString("hex")}`;
    const server = new WebSocketServer({ host: "127.0.0.1", port: 0 });
    const session: VncSession = { server, sender, tokenPath, config, closed: false };
    this.sessions.set(sessionId, session);
    this.sendStatus(sessionId, session, "connecting", `Preparing VNC tunnel to ${config.host}:${config.port}...`);

    server.on("connection", (client, request) => {
      if (request.url !== tokenPath || session.client) {
        client.close(1008, "Invalid or already-used CyberGrid VNC token.");
        return;
      }
      session.client = client;
      const socket = createConnection({ host: config.host, port: config.port });
      session.socket = socket;
      socket.setKeepAlive(true, 20_000);
      socket.on("connect", () => this.sendStatus(sessionId, session, "connected"));
      socket.on("data", (chunk) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(chunk, { binary: true });
        }
      });
      socket.on("error", (error) => {
        this.sendStatus(sessionId, session, "error", error.message);
        client.close(1011, "VNC target connection failed.");
      });
      socket.on("close", () => this.disconnect(sessionId));
      client.on("message", (data) => {
        if (socket.writable) {
          socket.write(rawDataToBuffer(data));
        }
      });
      client.on("close", () => this.disconnect(sessionId));
      client.on("error", (error) => this.sendStatus(sessionId, session, "error", error.message));
    });
    server.on("error", (error) => this.sendStatus(sessionId, session, "error", error.message));

    await new Promise<void>((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });
    const address = server.address() as AddressInfo;
    return {
      sessionId,
      proxyUrl: `ws://127.0.0.1:${address.port}${tokenPath}`,
      password: config.password,
    };
  }

  disconnect(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session || session.closed) {
      return;
    }
    session.closed = true;
    this.sessions.delete(sessionId);
    session.socket?.destroy();
    if (session.client && session.client.readyState < WebSocket.CLOSING) {
      session.client.close(1000, "CyberGrid VNC session closed.");
    }
    session.server.close();
    this.sendStatus(sessionId, session, "disconnected");
  }

  disconnectAll(): void {
    for (const sessionId of [...this.sessions.keys()]) {
      this.disconnect(sessionId);
    }
  }

  private sendStatus(
    sessionId: string,
    session: VncSession,
    status: VncStatusEvent["status"],
    message?: string,
  ): void {
    if (!session.sender.isDestroyed()) {
      const event: VncStatusEvent = { sessionId, status, message };
      session.sender.send(IPC_CHANNELS.vncStatus, event);
    }
  }
}
