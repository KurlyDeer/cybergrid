import { loadBindings } from "./win32";
import type { NativeRequest, NativeReply } from "./native-protocol";

// This entrypoint runs only in Electron's utility process. It receives handles and
// geometry, never server passwords. Native calls may block this helper, not the UI.
const port = process.parentPort;
let bindings: ReturnType<typeof loadBindings> | undefined;
port.on("message", ({ data }: { data: NativeRequest }) => { void handle(data); });
async function handle(data: NativeRequest): Promise<void> {
  const reply: NativeReply = { id: data.id, ok: true };
  try {
    bindings ??= loadBindings();
    const native = await bindings;
    switch (data.op) {
      case "prepare": native.prepare(data.host, data.port, BigInt(data.marker)); break;
      case "find": Object.assign(reply, native.find(data.excluded)); break;
      case "claim": reply.claimed = native.claim(data.handle); break;
      case "watch": reply.alive = native.alive(); break;
      case "close": native.close(); break;
      case "dock": native.dock(BigInt(data.parent), data.bounds, data.visible); break;
      case "geometry": native.geometry(data.bounds, data.visible); break;
      default: throw new Error("Unknown RDP native operation.");
    }
  } catch (error) {
    reply.ok = false;
    reply.error = error instanceof Error ? error.message : "RDP native operation failed.";
  }
  port.postMessage(reply);
}
