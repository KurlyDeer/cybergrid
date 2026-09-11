import type { RdpBounds } from "../../shared/ipc";

export type NativeOperation =
  | { op: "prepare"; host: string; port?: number; marker: string }
  | { op: "find"; excluded: string[] }
  | { op: "claim"; handle: string }
  | { op: "watch" }
  | { op: "close" }
  | { op: "dock"; parent: string; bounds: RdpBounds; visible: boolean }
  | { op: "geometry"; bounds: RdpBounds; visible: boolean };
export type NativeRequest = NativeOperation & { id: number };
export interface NativeReply {
  id: number; ok: boolean; found?: boolean; windowHandle?: string;
  claimed?: boolean; alive?: boolean; windowClass?: string; error?: string;
}

export const RDP_POLL_INTERVAL_MS = 250;
export const RDP_ATTACH_TIMEOUT_MS = 10_000;
export const RDP_WATCH_INTERVAL_MS = 2_000;

/** Match an endpoint token, not an arbitrary substring (10.0.0.5 must not match .50). */
export function matchesRdpTitle(title: string, host: string, port = 3389): boolean {
  const target = host.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
  if (!target) return false;
  const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(?:^|[^a-z0-9._:%-])\\[?${escaped}\\]?(?::(\\d+))?(?=$|[^a-z0-9._:%-])`, "i");
  const match = pattern.exec(title);
  return Boolean(match && (match[1] ? Number(match[1]) === port : port === 3389));
}

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
