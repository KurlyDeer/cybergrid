import { randomUUID } from "node:crypto";
import {
  Client,
  type ClientChannel,
  type ConnectConfig,
  type SFTPWrapper,
} from "ssh2";
import type { WebContents } from "electron";
import {
  IPC_CHANNELS,
  type SftpDirectoryListing,
  type SftpEntry,
  type SftpProgressEvent,
  type SshConnectionConfig,
  type SshConnectionStatus,
  type SshStatusEvent,
} from "../shared/ipc";

interface SshSession {
  id: string;
  client: Client;
  sender: WebContents;
  stream?: ClientChannel;
  sftp?: SFTPWrapper;
  sftpPromise?: Promise<SFTPWrapper>;
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

    setImmediate(() => {
      if (!session.closed) {
        client.connect(connectConfig);
      }
    });

    return sessionId;
  }

  write(sessionId: string, data: string): void {
    this.getOpenSession(sessionId).stream?.write(data);
  }

  resize(sessionId: string, cols: number, rows: number): void {
    this.getOpenSession(sessionId).stream?.setWindow(rows, cols, 0, 0);
  }

  async listDirectory(sessionId: string, remotePath: string): Promise<SftpDirectoryListing> {
    const session = this.getOpenSession(sessionId);
    const sftp = await this.getSftp(session);
    const resolvedPath = await new Promise<string>((resolve, reject) => {
      sftp.realpath(remotePath, (error, absolutePath) => {
        if (error) {
          reject(error);
        } else {
          resolve(absolutePath);
        }
      });
    });
    const entries = await new Promise<SftpEntry[]>((resolve, reject) => {
      sftp.readdir(resolvedPath, (error, list) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(
          list
            .filter((entry) => entry.filename !== "." && entry.filename !== "..")
            .map((entry): SftpEntry => ({
              name: entry.filename,
              path: this.joinRemotePath(resolvedPath, entry.filename),
              type: entry.attrs.isDirectory()
                ? "directory"
                : entry.attrs.isFile()
                  ? "file"
                  : entry.attrs.isSymbolicLink()
                    ? "symlink"
                    : "other",
              size: entry.attrs.size,
              modifiedAt: entry.attrs.mtime * 1_000,
              permissions: entry.attrs.mode,
            }))
            .sort((left, right) => {
              if (left.type === "directory" && right.type !== "directory") {
                return -1;
              }
              if (left.type !== "directory" && right.type === "directory") {
                return 1;
              }
              return left.name.localeCompare(right.name);
            }),
        );
      });
    });
    return { path: resolvedPath, entries };
  }

  async uploadFile(sessionId: string, localPath: string, remotePath: string): Promise<void> {
    const session = this.getOpenSession(sessionId);
    const sftp = await this.getSftp(session);
    await new Promise<void>((resolve, reject) => {
      sftp.fastPut(
        localPath,
        remotePath,
        {
          step: (transferred, _chunk, total) => {
            this.emitSftpProgress(session, "upload", remotePath, transferred, total);
          },
        },
        (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        },
      );
    });
  }

  async downloadFile(sessionId: string, remotePath: string, localPath: string): Promise<void> {
    const session = this.getOpenSession(sessionId);
    const sftp = await this.getSftp(session);
    await new Promise<void>((resolve, reject) => {
      sftp.fastGet(
        remotePath,
        localPath,
        {
          step: (transferred, _chunk, total) => {
            this.emitSftpProgress(session, "download", remotePath, transferred, total);
          },
        },
        (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        },
      );
    });
  }

  disconnect(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.closeSession(session, "disconnected", "Disconnected by user.");
    }
  }

  disconnectAll(message = "Application is closing."): void {
    for (const session of [...this.sessions.values()]) {
      this.closeSession(session, "disconnected", message);
    }
  }

  private disconnectForSender(sender: WebContents): void {
    for (const session of [...this.sessions.values()]) {
      if (session.sender === sender) {
        this.closeSession(session, "disconnected", "Renderer closed.");
      }
    }
  }

  private getOpenSession(sessionId: string): SshSession {
    const session = this.sessions.get(sessionId);
    if (!session || session.closed || !session.stream) {
      throw new Error("SSH session is not connected.");
    }
    return session;
  }

  private getSftp(session: SshSession): Promise<SFTPWrapper> {
    if (session.sftp) {
      return Promise.resolve(session.sftp);
    }
    if (session.sftpPromise) {
      return session.sftpPromise;
    }

    session.sftpPromise = new Promise<SFTPWrapper>((resolve, reject) => {
      session.client.sftp((error, sftp) => {
        session.sftpPromise = undefined;
        if (error) {
          reject(error);
          return;
        }
        session.sftp = sftp;
        sftp.once("end", () => {
          session.sftp = undefined;
        });
        resolve(sftp);
      });
    });
    return session.sftpPromise;
  }

  private joinRemotePath(directory: string, name: string): string {
    return directory === "/" ? `/${name}` : `${directory.replace(/\/$/, "")}/${name}`;
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

  private emitSftpProgress(
    session: SshSession,
    direction: "upload" | "download",
    remotePath: string,
    transferred: number,
    total: number,
  ): void {
    if (session.closed || session.sender.isDestroyed()) {
      return;
    }
    const payload: SftpProgressEvent = {
      sessionId: session.id,
      direction,
      fileName: remotePath.split("/").pop() || remotePath,
      transferred,
      total,
    };
    session.sender.send(IPC_CHANNELS.sftpProgress, payload);
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

    session.sftp?.end();
    if (session.stream && !session.stream.destroyed) {
      session.stream.close();
    }
    session.client.end();
  }
}
