import type { RdpBounds } from "../../shared/ipc";

export type NativeOperation =
  | { op: "find"; processId: number }
  | { op: "dock"; parent: string; bounds: RdpBounds; visible: boolean }
  | { op: "geometry"; bounds: RdpBounds; visible: boolean };
export type NativeRequest = NativeOperation & { id: number };
export interface NativeReply { id: number; ok: boolean; found?: boolean; windowClass?: string; error?: string }

export const RDP_POLL_INTERVAL_MS = 250;
export const RDP_ATTACH_TIMEOUT_MS = 10_000;

/** One in-flight native request per polling loop; the deadline also covers a stuck call. */
export function pollForRdpWindow(probe: () => Promise<boolean>, signal: AbortSignal,
  intervalMs = RDP_POLL_INTERVAL_MS, timeoutMs = RDP_ATTACH_TIMEOUT_MS): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let busy = false;
    const finish = (error?: Error): void => {
      if (settled) return;
      settled = true;
      clearInterval(interval);
      clearTimeout(deadline);
      signal.removeEventListener("abort", cancel);
      if (error) reject(error); else resolve();
    };
    const cancel = (): void => finish(new Error("RDP window attachment cancelled."));
    const interval = setInterval(() => {
      if (settled || busy) return;
      busy = true;
      void Promise.resolve().then(probe).then((found) => {
        if (found) finish();
      }, (error: unknown) => finish(error instanceof Error ? error : new Error("RDP window probe failed.")))
        .finally(() => { busy = false; });
    }, intervalMs);
    const deadline = setTimeout(() => finish(new Error("RDP window attachment timed out after 10 seconds.")), timeoutMs);
    signal.addEventListener("abort", cancel, { once: true });
    if (signal.aborted) cancel();
  });
}

export function rdpAddress(host: string, port?: number | string): string {
  const raw = host.replace(/^\[|\]$/g, "");
  const address = raw.includes(":") ? `[${raw}]` : raw;
  if (port === undefined || port === "" || Number(port) === 3389) return address;
  const value = Number(port);
  if (!Number.isInteger(value) || value < 1 || value > 65535) throw new Error("Invalid RDP port.");
  return `${address}:${value}`;
}
