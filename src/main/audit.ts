import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type AuditedTerminalProtocol = "ssh" | "serial" | "telnet" | "raw";

export interface AuditSessionContext {
  protocol: AuditedTerminalProtocol;
  displayName: string;
  target: string;
  username?: string;
  group?: string;
}

interface AuditMetadata extends AuditSessionContext {
  sessionId: string;
  startedAt: string;
  endedAt?: string;
  outcome?: string;
  rawLog: string;
  transcript: string;
}

interface AuditSession {
  metadata: AuditMetadata;
  metadataPath: string;
  rawPath: string;
  transcriptPath: string;
  queue: Promise<void>;
  closed: boolean;
}

function safeFilePart(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return normalized || "session";
}

export function terminalOutputToPlainText(value: string): string {
  return value
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, "")
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\x1b[@-_]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[^\x09\x0a\x20-\x7e\u0080-\uffff]/g, "");
}

export class AuditController {
  private logsDirectory?: string;
  private readonly sessions = new Map<string, AuditSession>();
  private readonly pending = new Set<Promise<void>>();

  configure(logsDirectory: string): void {
    this.logsDirectory = logsDirectory;
  }

  startSession(sessionId: string, context: AuditSessionContext): void {
    if (!this.logsDirectory || this.sessions.has(sessionId)) return;
    const startedAt = new Date().toISOString();
    const timestamp = startedAt.replace(/[:.]/g, "-");
    const baseName = `${timestamp}-${context.protocol}-${safeFilePart(context.displayName || context.target)}-${sessionId.slice(0, 8)}`;
    const rawLog = `${baseName}.raw.log`;
    const transcript = `${baseName}.txt`;
    const metadata: AuditMetadata = {
      ...context,
      sessionId,
      startedAt,
      rawLog,
      transcript,
    };
    const metadataPath = join(this.logsDirectory, `${baseName}.json`);
    const rawPath = join(this.logsDirectory, rawLog);
    const transcriptPath = join(this.logsDirectory, transcript);
    const header = [
      "CyberGrid session transcript",
      `Session: ${sessionId}`,
      `Protocol: ${context.protocol.toUpperCase()}`,
      `Name: ${context.displayName}`,
      `Target: ${context.target}`,
      `Username: ${context.username ?? ""}`,
      `Group: ${context.group ?? ""}`,
      `Started: ${startedAt}`,
      "",
      "--- terminal output ---",
      "",
    ].join("\n");
    const queue = mkdir(this.logsDirectory, { recursive: true, mode: 0o700 })
      .then(async () => {
        await Promise.all([
          writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, { encoding: "utf8", mode: 0o600 }),
          writeFile(rawPath, Buffer.alloc(0), { mode: 0o600 }),
          writeFile(transcriptPath, header, { encoding: "utf8", mode: 0o600 }),
        ]);
      })
      .catch((error: unknown) => {
        console.warn("CyberGrid audit log initialization failed:", error);
      });
    this.sessions.set(sessionId, {
      metadata,
      metadataPath,
      rawPath,
      transcriptPath,
      queue,
      closed: false,
    });
  }

  recordOutput(sessionId: string, value: string | Buffer): void {
    const session = this.sessions.get(sessionId);
    if (!session || session.closed) return;
    const raw = Buffer.isBuffer(value) ? Buffer.from(value) : Buffer.from(value, "utf8");
    const plainText = terminalOutputToPlainText(raw.toString("utf8"));
    this.enqueue(session, async () => {
      await appendFile(session.rawPath, raw);
      if (plainText) await appendFile(session.transcriptPath, plainText, "utf8");
    });
  }

  endSession(sessionId: string, outcome: string): void {
    const session = this.sessions.get(sessionId);
    if (!session || session.closed) return;
    session.closed = true;
    session.metadata.endedAt = new Date().toISOString();
    session.metadata.outcome = outcome;
    this.enqueue(session, async () => {
      await appendFile(
        session.transcriptPath,
        `\n\n--- session ended ${session.metadata.endedAt}: ${outcome} ---\n`,
        "utf8",
      );
      await writeFile(
        session.metadataPath,
        `${JSON.stringify(session.metadata, null, 2)}\n`,
        { encoding: "utf8", mode: 0o600 },
      );
    });
    this.sessions.delete(sessionId);
    let completion: Promise<void>;
    completion = session.queue.finally(() => {
      this.pending.delete(completion);
    });
    this.pending.add(completion);
  }

  closeAll(outcome = "Application closed"): void {
    for (const sessionId of [...this.sessions.keys()]) this.endSession(sessionId, outcome);
  }

  async flush(): Promise<void> {
    await Promise.allSettled([
      ...[...this.sessions.values()].map((session) => session.queue),
      ...this.pending,
    ]);
  }

  private enqueue(session: AuditSession, operation: () => Promise<void>): void {
    session.queue = session.queue.then(operation).catch((error: unknown) => {
      console.warn("CyberGrid audit log write failed:", error);
    });
  }
}
