import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:net";
import type { WebContents } from "electron";
import { AuditController, type AuditSessionContext } from "./audit";
import { saveConfigBackup } from "./backup/config-backup";
import {
  IPC_CHANNELS,
  type SftpDirectoryListing,
  type SftpEntry,
  type SftpProgressEvent,
  type SshConnectionConfig,
  type SshConnectionStatus,
  type SshStatusEvent,
  type SwitchBackupResult,
  type SwitchModelEvent,
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
  forwardServer?: Server;
  closed: boolean;
  history: string;
  modelProbeStarted: boolean;
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
  ) {}

  async connect(
    config: SshConnectionConfig,
    sender: WebContents,
    auditContext: AuditSessionContext,
  ): Promise<string> {
    if (!config.username.trim()) {
      throw new Error("SSH requires a username. Enter it at the interactive terminal prompt.");
    }
    const { Client } = await loadSsh2();
    const sessionId = randomUUID();
    const client = new Client();
    const session: SshSession = {
      id: sessionId,
      client,
      sender,
      closed: false,
      history: "",
      modelProbeStarted: false,
    };

    this.sessions.set(sessionId, session);
    this.audit.startSession(sessionId, auditContext);
    this.emitStatus(session, "connecting", `Connecting to ${config.host}...`);

    client.on("ready", () => {
      if (config.portForward) {
        void this.startPortForward(session, config.portForward).catch((error: unknown) => {
          this.closeSession(session, "error", error instanceof Error ? error.message : String(error));
        });
      }
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
          if (session.closed) {
            stream.close();
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
          // Wake appliance shells so the MOTD and first prompt are emitted before
          // vendor probes run. Console-oriented appliances commonly wait for CRLF.
          stream.write("\r\n");
          const probeTimer = setTimeout(() => void this.detectSwitchModel(session), 1_500);
          probeTimer.unref();
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
      const legacyDhFailure = config.enableLegacyAlgorithms && /(?:unknown|invalid|unsupported).*dh group|dh group.*(?:unknown|invalid|unsupported)|key exchange/i.test(error.message);
      const message = legacyDhFailure
        ? `Legacy SSH key exchange failed safely: ${error.message}. CyberGrid offered fixed Oakley groups before group-exchange algorithms.`
        : error.message;
      this.closeSession(session, "error", message);
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
      keepaliveInterval: Math.max(10_000, config.keepaliveInterval ?? 10_000),
      keepaliveCountMax: 3,
      // Network appliances frequently expose password authentication only through
      // keyboard-interactive. Keep it enabled even when credentials were entered
      // interactively in the renderer immediately before connecting.
      tryKeyboard: true,
      algorithms: config.enableLegacyAlgorithms
        ? {
            kex: [
              "diffie-hellman-group14-sha256",
              "diffie-hellman-group14-sha1",
              "diffie-hellman-group1-sha1",
              "diffie-hellman-group-exchange-sha256",
              "diffie-hellman-group-exchange-sha1",
              "ecdh-sha2-nistp256",
              "ecdh-sha2-nistp384",
              "ecdh-sha2-nistp521",
              "curve25519-sha256",
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

  attachRenderer(sessionId: string, sender: WebContents): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.closed) return false;
    session.sender = sender;
    if (session.history) sender.send(IPC_CHANNELS.sshData, { sessionId, data: session.history });
    this.emitStatus(session, session.stream ? "connected" : "connecting", "Session moved to a detached window.");
    return true;
  }

  async quickBackup(
    sessionId: string,
    displayName: string,
    backupDirectory: string,
  ): Promise<SwitchBackupResult> {
    const session = this.getOpenSession(sessionId);
    await this.prepareApplianceTerminal(session);
    let versionOutput = await this.captureCommand(session, "show version", 12_000);
    let vendor = this.detectSwitchVendor(versionOutput);
    if (vendor === "unknown") {
      versionOutput += await this.captureCommand(session, "get system status", 12_000);
      vendor = this.detectSwitchVendor(versionOutput);
    }

    const command = vendor === "fortinet" ? "show full-configuration" : "show running-config";
    const output = this.cleanCapturedCommand(
      await this.captureCommand(session, command, 60_000, 1_500),
      command,
    );
    const saved = saveConfigBackup(backupDirectory, displayName, output);
    return { ...saved, vendor, command };
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

  private startPortForward(
    session: SshSession,
    config: NonNullable<SshConnectionConfig["portForward"]>,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const server = createServer((socket) => {
        session.client.forwardOut(
          socket.remoteAddress ?? "127.0.0.1",
          socket.remotePort ?? 0,
          config.remoteHost,
          config.remotePort,
          (error, channel) => {
            if (error) {
              socket.destroy(error);
              return;
            }
            socket.pipe(channel).pipe(socket);
            channel.on("error", () => socket.destroy());
            socket.on("error", () => channel.close());
          },
        );
      });
      session.forwardServer = server;
      server.once("error", reject);
      server.listen(config.localPort, "127.0.0.1", () => {
        server.off("error", reject);
        server.on("error", (error) => this.emitStatus(session, "error", `SSH tunnel error: ${error.message}`));
        this.emitStatus(
          session,
          "connected",
          `SSH tunnel listening on 127.0.0.1:${config.localPort} → ${config.remoteHost}:${config.remotePort}.`,
        );
        resolve();
      });
    });
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
      let promptTimer: NodeJS.Timeout | undefined;
      let timeout: NodeJS.Timeout | undefined;
      const cleanup = (): void => {
        if (timeout) clearTimeout(timeout);
        if (idleTimer) clearTimeout(idleTimer);
        if (promptTimer) clearTimeout(promptTimer);
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
        if (Buffer.byteLength(output, "utf8") > 16 * 1024 * 1024) {
          onError(new Error("SSH command output exceeded the 16 MB safety limit."));
          return;
        }
        if (/(?:--More--|Press any key to continue|More:)/i.test(output.slice(-256))) stream.write(" ");
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(finish, idleMs);
        if (this.hasReturnedPrompt(output)) {
          if (promptTimer) clearTimeout(promptTimer);
          promptTimer = setTimeout(finish, 120);
        }
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
      stream.write(`${command}\r\n`);
    });
  }

  private async prepareApplianceTerminal(session: SshSession): Promise<void> {
    try {
      await this.captureCommand(session, "terminal length 0", 4_000, 500);
    } catch {
      // FortiOS and other shells may reject this Cisco command. Their returned
      // prompt still confirms that it is safe to proceed with vendor probing.
    }
    await new Promise<void>((resolveDelay) => {
      const timer = setTimeout(resolveDelay, 500);
      timer.unref();
    });
  }

  private stripTerminalControls(output: string): string {
    return output
      .replace(/\u001b(?:[@-_]|\[[0-?]*[ -/]*[@-~])/g, "")
      .replace(/\r/g, "");
  }

  private hasReturnedPrompt(output: string): boolean {
    const lines = this.stripTerminalControls(output).split("\n");
    const finalLine = [...lines].reverse().find((line) => line.trim().length > 0)?.trim() ?? "";
    return /^[^\n]{0,160}[>#]\s*$/.test(finalLine);
  }

  private cleanCapturedCommand(output: string, command: string): string {
    const lines = this.stripTerminalControls(output).split("\n");
    while (lines.length > 0 && !lines[0]?.trim()) lines.shift();
    const commandIndex = lines.findIndex((line) => line.trim() === command);
    if (commandIndex >= 0) lines.splice(commandIndex, 1);
    while (lines.length > 0 && !lines.at(-1)?.trim()) lines.pop();
    if (lines.length > 0 && /^[^\n]{0,160}[>#]\s*$/.test(lines.at(-1)?.trim() ?? "")) lines.pop();
    const cleaned = lines.join("\n").trimEnd();
    return cleaned ? `${cleaned}\n` : "";
  }

  private detectSwitchVendor(output: string): SwitchBackupResult["vendor"] {
    if (/forti(?:gate|os|net)|fortinet/i.test(output)) return "fortinet";
    if (/\b(?:aruba|procurve|hewlett[- ]packard|hpe|comware)\b/i.test(output)) return "hp";
    if (/\b(?:cisco|ios(?: xe)?|nx-os|catalyst)\b/i.test(output)) return "cisco";
    return "unknown";
  }

  private async detectSwitchModel(session: SshSession): Promise<void> {
    if (session.modelProbeStarted || session.closed) return;
    session.modelProbeStarted = true;
    const bannerIdentity = this.parseSwitchIdentity(session.history);
    if (bannerIdentity) {
      this.emitSwitchModel(session, bannerIdentity.vendor, bannerIdentity.model);
      return;
    }
    await this.prepareApplianceTerminal(session);
    const commands = [
      "show version | include Cisco|IOS|Model|Forti|ProCurve",
      "show version",
      "get system status",
    ];
    for (const command of commands) {
      if (session.closed) return;
      try {
        const output = await this.captureCommand(session, command, 7_000, 700);
        const identity = this.parseSwitchIdentity(output);
        if (identity) {
          this.emitSwitchModel(session, identity.vendor, identity.model);
          return;
        }
      } catch {
        // Some appliances disable SSH exec channels while still allowing an
        // interactive shell. Fingerprinting is best-effort and never disrupts it.
      }
    }
    if (!session.closed) this.emitSwitchModel(session, "unknown", "Unknown");
  }

  private parseSwitchIdentity(output: string): { vendor: SwitchBackupResult["vendor"]; model: string } | undefined {
    if (!output.trim()) return undefined;
    const forti = output.match(/\b(FortiSwitch[- ]?[A-Z0-9-]+)\b/i);
    if (forti?.[1]) return { vendor: "fortinet", model: forti[1].replace(/FortiSwitch\s+/i, "FortiSwitch-") };

    const ciscoModel = output.match(/(?:Model\s+(?:Number|number)|cisco)\s*[: ]\s*(WS-C\d+[A-Z0-9-]*|C\d{3,4}[A-Z0-9-]*)\b/i)?.[1];
    if (ciscoModel || /\b(?:Cisco|IOS(?: XE)?|Catalyst)\b/i.test(output)) {
      const numeric = ciscoModel?.match(/(?:WS-C|C)(\d{3,4})/i)?.[1];
      return { vendor: "cisco", model: numeric ? `Cisco Catalyst ${numeric}` : "Cisco network device" };
    }

    const hpModel = output.match(/\b(?:ProCurve|Aruba)\s+(\d{3,4}[A-Z0-9-]*)\b/i)?.[1]
      ?? output.match(/\b(\d{3,4}[A-Z0-9-]*)\s+(?:Switch|Series)\b/i)?.[1];
    if (hpModel || /\b(?:HP|HPE|ProCurve|Aruba)\b/i.test(output)) {
      return { vendor: "hp", model: hpModel ? `HP ProCurve ${hpModel}` : "HP network device" };
    }
    return undefined;
  }

  private emitSwitchModel(
    session: SshSession,
    vendor: SwitchBackupResult["vendor"],
    model: string,
  ): void {
    if (session.closed || session.sender.isDestroyed()) return;
    const payload: SwitchModelEvent = { sessionId: session.id, vendor, model };
    session.sender.send(IPC_CHANNELS.sshModelDetected, payload);
  }

  private joinRemotePath(directory: string, name: string): string {
    return directory === "/" ? `/${name}` : `${directory.replace(/\/$/, "")}/${name}`;
  }

  private emitData(session: SshSession, data: string | Buffer): void {
    this.audit.recordOutput(session.id, data);
    const text = Buffer.isBuffer(data) ? data.toString("utf8") : data;
    session.history = `${session.history}${text}`.slice(-2_000_000);
    if (!session.closed && !session.sender.isDestroyed()) {
      session.sender.send(IPC_CHANNELS.sshData, {
        sessionId: session.id,
        data: text,
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
    if (session.forwardServer?.listening) session.forwardServer.close();
    if (session.stream && !session.stream.destroyed) {
      session.stream.close();
    }
    session.client.end();
  }
}
