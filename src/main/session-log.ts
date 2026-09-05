import { createWriteStream, type WriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

/** Opt-in raw output logging. Disk I/O never blocks terminal IPC. */
export class SessionLog {
  private closing = false;
  private readonly completion: Promise<void>;

  private constructor(
    readonly path: string,
    private readonly stream: WriteStream,
    private readonly onError: (message: string) => void,
  ) {
    this.completion = new Promise((resolve) => stream.once("close", resolve));
    stream.on("error", (error) => {
      this.closing = true;
      onError(`Session logging stopped: ${error.message}`);
    });
  }

  static async start(directory: string, name: string, onError: (message: string) => void): Promise<SessionLog> {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const safeName = name.replace(/[^a-z0-9_-]/gi, "_").slice(0, 80) || "session";
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const path = join(directory, `${safeName}_${timestamp}_${randomUUID().slice(0, 8)}.log`);
    const stream = createWriteStream(path, { flags: "wx", mode: 0o600 });
    const log = new SessionLog(path, stream, onError);
    await new Promise<void>((resolve, reject) => {
      stream.once("open", () => { stream.removeListener("error", reject); resolve(); });
      stream.once("error", reject);
    });
    return log;
  }

  write(data: string | Buffer): void {
    if (this.closing) return;
    // A failed/slow disk must not consume unlimited RAM or stall the SSH socket.
    if (this.stream.writableLength + Buffer.byteLength(data) > 8 * 1024 * 1024) {
      this.onError("Session logging stopped: disk could not keep up with terminal output.");
      void this.stop();
      return;
    }
    this.stream.write(data);
  }

  stop(): Promise<void> {
    if (!this.closing) {
      this.closing = true;
      this.stream.end();
    }
    return this.completion;
  }
}
