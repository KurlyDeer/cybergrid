import { Socket } from "node:net";
import { performance } from "node:perf_hooks";
import type { WebContents } from "electron";
import { IPC_CHANNELS, type HealthStatusEvent, type HealthTarget } from "../shared/ipc";

export const HEALTH_TIMEOUT_MS = 1_500;
export const HEALTH_INTERVAL_SECONDS = 45;
const CONCURRENCY = 8;

export function healthPort(target: HealthTarget): number | undefined {
  if (target.protocol === "serial" || target.protocol === "local" || !target.host) return undefined;
  if (Number.isInteger(target.port) && target.port! > 0 && target.port! <= 65_535) return target.port;
  return { rdp: 3389, ssh: 22, https: 443, http: 80, vnc: 5900, telnet: 23, raw: 23 }[target.protocol];
}

/** Absolute deadline includes DNS lookup; every resolution destroys the socket. */
export function checkTcpPort(host: string, port: number, signal?: AbortSignal): Promise<number | undefined> {
  return new Promise((resolve) => {
    if (signal?.aborted) { resolve(undefined); return; }
    const socket = new Socket();
    const started = performance.now();
    let settled = false;
    const finish = (online: boolean): void => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      signal?.removeEventListener("abort", abort);
      socket.destroy();
      resolve(online ? Math.max(1, Math.round(performance.now() - started)) : undefined);
    };
    const abort = (): void => finish(false);
    const deadline = setTimeout(() => finish(false), HEALTH_TIMEOUT_MS);
    deadline.unref();
    signal?.addEventListener("abort", abort, { once: true });
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.once("timeout", () => finish(false));
    socket.once("close", () => finish(false));
    socket.setTimeout(HEALTH_TIMEOUT_MS);
    try { socket.connect({ host, port }); } catch { finish(false); }
  });
}

export class HealthController {
  private targets: HealthTarget[] = [];
  private sender?: WebContents;
  private interval?: NodeJS.Timeout;
  private generation = new AbortController();
  private sweeping?: AbortSignal;
  private senderDestroyed?: () => void;

  setTargets(targets: HealthTarget[], sender: WebContents, intervalSeconds = HEALTH_INTERVAL_SECONDS): void {
    this.stop();
    this.targets = targets.map((target) => ({ ...target }));
    this.sender = sender;
    this.senderDestroyed = () => this.stop();
    sender.once("destroyed", this.senderDestroyed);
    const intervalMs = Math.min(600, Math.max(10, intervalSeconds)) * 1_000;
    if (targets.length) {
      this.interval = setInterval(() => void this.sweep(), intervalMs);
      this.interval.unref();
      void this.sweep();
    }
  }

  async sweep(): Promise<void> {
    const signal = this.generation.signal;
    if (this.sweeping === signal || !this.sender || this.sender.isDestroyed()) return;
    this.sweeping = signal;
    const targets = this.targets;
    let nextIndex = 0;
    const worker = async (): Promise<void> => {
      while (!signal.aborted) {
        const target = targets[nextIndex++];
        if (!target) return;
        const port = healthPort(target);
        if (port === undefined) {
          this.send({ profileId: target.profileId, status: "unsupported", checkedAt: new Date().toISOString() }, signal);
          continue;
        }
        this.send({ profileId: target.profileId, status: "checking", port, checkedAt: new Date().toISOString() }, signal);
        const latencyMs = await checkTcpPort(target.host, port, signal);
        this.send({
          profileId: target.profileId, status: latencyMs === undefined ? "offline" : "online",
          port, latencyMs, checkedAt: new Date().toISOString(),
        }, signal);
      }
    };
    try {
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker));
    } finally {
      if (this.sweeping === signal) this.sweeping = undefined;
    }
  }

  stop(): void {
    this.generation.abort();
    this.generation = new AbortController();
    if (this.interval) clearInterval(this.interval);
    this.interval = undefined;
    if (this.senderDestroyed) this.sender?.removeListener("destroyed", this.senderDestroyed);
    this.senderDestroyed = undefined;
    this.targets = [];
    this.sender = undefined;
  }

  private send(event: HealthStatusEvent, signal: AbortSignal): void {
    if (!signal.aborted && this.sender && !this.sender.isDestroyed()) {
      this.sender.send(IPC_CHANNELS.healthStatus, event);
    }
  }
}
