import { execFile } from "node:child_process";
import { performance } from "node:perf_hooks";
import { promisify } from "node:util";
import type { WebContents } from "electron";
import { IPC_CHANNELS, type HealthStatusEvent, type HealthTarget } from "../shared/ipc";

const execFileAsync = promisify(execFile);
const CONCURRENCY = 8;

export class HealthController {
  private targets: HealthTarget[] = [];
  private sender?: WebContents;
  private interval?: NodeJS.Timeout;
  private sweeping = false;

  setTargets(targets: HealthTarget[], sender: WebContents, intervalSeconds = 30): void {
    this.targets = targets;
    this.sender = sender;
    if (this.interval) {
      clearInterval(this.interval);
    }
    const intervalMs = Math.min(600, Math.max(10, intervalSeconds)) * 1_000;
    this.interval = setInterval(() => void this.sweep(), intervalMs);
    void this.sweep();
  }

  async sweep(): Promise<void> {
    if (this.sweeping || !this.sender || this.sender.isDestroyed()) {
      return;
    }
    this.sweeping = true;
    let nextIndex = 0;
    const worker = async (): Promise<void> => {
      while (true) {
        const target = this.targets[nextIndex];
        nextIndex += 1;
        if (!target) {
          return;
        }
        if (target.protocol === "serial") {
          this.send({
            profileId: target.profileId,
            status: "unsupported",
            checkedAt: new Date().toISOString(),
          });
          continue;
        }
        this.send({
          profileId: target.profileId,
          status: "checking",
          checkedAt: new Date().toISOString(),
        });
        const started = performance.now();
        const online = await this.ping(target.host);
        this.send({
          profileId: target.profileId,
          status: online ? "online" : "offline",
          latencyMs: online ? Math.max(1, Math.round(performance.now() - started)) : undefined,
          checkedAt: new Date().toISOString(),
        });
      }
    };
    try {
      await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, this.targets.length) }, () => worker()),
      );
    } finally {
      this.sweeping = false;
    }
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
    this.targets = [];
    this.sender = undefined;
  }

  private async ping(host: string): Promise<boolean> {
    const args = process.platform === "win32"
      ? ["-n", "1", "-w", "1000", host]
      : ["-c", "1", "-W", "1", host];
    try {
      await execFileAsync(process.platform === "win32" ? "ping.exe" : "ping", args, {
        timeout: 3_000,
        windowsHide: true,
        maxBuffer: 64 * 1024,
      });
      return true;
    } catch {
      return false;
    }
  }

  private send(event: HealthStatusEvent): void {
    if (this.sender && !this.sender.isDestroyed()) {
      this.sender.send(IPC_CHANNELS.healthStatus, event);
    }
  }
}
