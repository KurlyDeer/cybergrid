import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { WebContents } from "electron";
import { AuditController, type AuditSessionContext } from "./audit";
import {
  IPC_CHANNELS,
  type SftpDirectoryListing,
  type SftpEntry,
  type SftpProgressEvent,
  type SshConnectionConfig,
  type SshConnectionStatus,
  type SshStatusEvent,
  type SwitchBackupResult,
} from "../shared/ipc";

type Client = import("ssh2").Client;
type ClientChannel = import("ssh2").ClientChannel;
type ConnectConfig = import("ssh2").ConnectConfig;
type SFTPWrapper = import("ssh2").SFTPWrapper;

interface SshSession {
  id: string;
  client: Client;
  sender: WebContents;
  stream?: ClientChannel;
  sftp?: SFTPWrapper;
  sftpPromise?: Promise<SFTPWrapper>;
  closed: boolean;
}

let ssh2ModulePromise: Promise<typeof import("ssh2")> | undefined;

function loadSsh2(): Promise<typeof import("ssh2")> {
  ssh2ModulePromise ??= import("ssh2");
  return ssh2ModulePromise;
}

export class SshController {
  private readonly sessions = new Map<string, SshSession>();
  private readonly observedSenders = new WeakSet<WebContents>();

  constructor(
    private readonly audit: AuditController,
    private readonly backupDirectory: string,
  ) {}

  async connect(
    config: SshConnectionConfig,
    sender: WebContents,
    auditContext: AuditSessionContext,
  ): Promise<string> {
    const { Client } = await loadSsh2();
    const sessionId = randomUUID();
    const client = new Client();
    const session: SshSession = {
      id: sessionId,
      client,
      sender,
      closed: false,
    };

    this.sessions.set(sessionId, session);
    this.audit.startSession(sessionId, auditContext);
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
          stream.on("data", (data: Buffer) => this.emitData(session, data));
          stream.stderr.on("data", (data: Buffer) => this.emitData(session, data));
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
      finish(prompts.map((prompt, index) => {
        const requestsTotp = /(?:otp|totp|verification|authenticator|token|passcode|one[- ]time)/i.test(prompt.prompt);
        if (config.totpCode && (requestsTotp || (index > 0 && Boolean(config.password)))) return config.totpCode;
        return config.password ?? config.totpCode ?? "";
      }));
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
      keepaliveInterval: config.keepaliveInterval ?? 10_000,
      keepaliveCountMax: 3,
      tryKeyboard: Boolean(config.password || config.totpCode),
      algorithms: config.enableLegacyAlgorithms
        ? {
            kex: [
              "diffie-hellman-group1-sha1",
              "diffie-hellman-group14-sha1",
              "diffie-hellman-group-exchange-sha1",
              "diffie-hellman-group-exchange-sha256",
              "ecdh-sha2-nistp256",
            ],
            cipher: [
              "aes128-ctr",
              "aes192-ctr",
              "aes256-ctr",
              "aes128-cbc",
              "3des-cbc",
              "aes256-cbc",
            ],
            serverHostKey: [
              "ssh-rsa",
              "ssh-dss",
              "ecdsa-sha2-nistp256",
              "rsa-sha2-512",
              "rsa-sha2-256",
            ],
          }
        : undefined,
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

  async quickBackup(sessionId: string, displayName: string): Promise<SwitchBackupResult> {
    const session = this.getOpenSession(sessionId);
    let versionOutput = await this.captureCommand(session, "show version", 12_000);
    let vendor = this.detectSwitchVendor(versionOutput);
    if (vendor === "unknown" && /(?:unknown|invalid|not found|unrecognized)/i.test(versionOutput)) {
      versionOutput += await this.captureCommand(session, "get system status", 12_000);
      vendor = this.detectSwitchVendor(versionOutput);
    }

    const command = vendor === "fortinet" ? "show full-configuration" : "show running-config";
    const output = await this.captureCommand(session, command, 45_000, 1_500);
    if (!output.trim()) throw new Error("The switch returned no configuration output.");

    await mkdir(this.backupDirectory, { recursive: true, mode: 0o700 });
    const timestamp = new Date().toISOString().replace(/:/g, "-").replace(/\.\d{3}Z$/, "Z");
    const safeName = displayName
      .normalize("NFKD")
      .replace(/[^a-z0-9._-]+/gi, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80) || "Switch";
    const path = join(this.backupDirectory, `${safeName}_${timestamp}.cfg`);
    await writeFile(path, output, { encoding: "utf8", mode: 0o600 });
    return { path, vendor, command, capturedBytes: Buffer.byteLength(output, "utf8") };
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

  private captureCommand(
    session: SshSession,
    command: string,
    timeoutMs: number,
    idleMs = 900,
  ): Promise<string> {
    const stream = session.stream;
    if (!stream) throw new Error("SSH session is not connected.");
    return new Promise<string>((resolve, reject) => {
      let output = "";
      let settled = false;
      let idleTimer: NodeJS.Timeout | undefined;
      let timeout: NodeJS.Timeout | undefined;
      const cleanup = (): void => {
        if (timeout) clearTimeout(timeout);
        if (idleTimer) clearTimeout(idleTimer);
        stream.off("data", onData);
        stream.off("error", onError);
      };
      const finish = (): void => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(output);
      };
      const onData = (data: Buffer): void => {
        output += data.toString("utf8");
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(finish, idleMs);
      };
      const onError = (error: Error): void => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      };
      stream.on("data", onData);
      stream.on("error", onError);
      timeout = setTimeout(finish, timeoutMs);
      stream.write(`${command}\r`);
    });
  }

  private detectSwitchVendor(output: string): SwitchBackupResult["vendor"] {
    if (/forti(?:gate|os|net)|fortinet/i.test(output)) return "fortinet";
    if (/\b(?:aruba|procurve|hewlett[- ]packard|hpe|comware)\b/i.test(output)) return "hp";
    if (/\b(?:cisco|ios(?: xe)?|nx-os|catalyst)\b/i.test(output)) return "cisco";
    return "unknown";
  }

  private joinRemotePath(directory: string, name: string): string {
    return directory === "/" ? `/${name}` : `${directory.replace(/\/$/, "")}/${name}`;
  }

  private emitData(session: SshSession, data: string | Buffer): void {
    this.audit.recordOutput(session.id, data);
    if (!session.closed && !session.sender.isDestroyed()) {
      session.sender.send(IPC_CHANNELS.sshData, {
        sessionId: session.id,
        data: Buffer.isBuffer(data) ? data.toString("utf8") : data,
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
    this.audit.endSession(session.id, `${status}: ${message}`);

    session.sftp?.end();
    if (session.stream && !session.stream.destroyed) {
      session.stream.close();
    }
    session.client.end();
  }
}
