import { utilityProcess, type UtilityProcess } from "electron";
import { join } from "node:path";
import type { NativeOperation, NativeReply } from "./native-protocol";

/** All user32 calls live in a killable helper, never in Electron's event loop. */
export class RdpNativeHost {
  private readonly child: UtilityProcess;
  private sequence = 0;
  private disposed = false;
  private readonly pending = new Map<number, {
    resolve: (value: NativeReply) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout>;
  }>();

  constructor(private readonly onFailure: (error: Error) => void) {
    this.child = utilityProcess.fork(join(__dirname, "rdp-native-worker.js"), [], {
      serviceName: "CyberGrid RDP Window Host", stdio: "ignore",
    });
    this.child.on("message", (message: NativeReply) => {
      if (!message || !Number.isInteger(message.id)) return;
      const request = this.pending.get(message.id);
      if (!request) return;
      clearTimeout(request.timer);
      this.pending.delete(message.id);
      if (message.ok) request.resolve(message);
      else request.reject(new Error(message.error || "RDP native operation failed."));
    });
    this.child.once("exit", () => {
      if (!this.disposed) this.fail(new Error("RDP window helper exited unexpectedly."));
    });
  }

  request(operation: NativeOperation): Promise<NativeReply> {
    if (this.disposed) return Promise.reject(new Error("RDP window helper is closed."));
    if (this.pending.size >= 2) return Promise.reject(new Error("RDP native operation is already pending."));
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.fail(new Error("RDP native operation did not respond.")), 10_000);
      this.pending.set(id, { resolve, reject, timer });
      try { this.child.postMessage({ ...operation, id }); }
      catch { this.fail(new Error("Unable to contact the RDP window helper.")); }
    });
  }

  private fail(error: Error): void {
    if (this.disposed) return;
    this.dispose(error);
    this.onFailure(error);
  }

  dispose(error = new Error("RDP window helper closed.")): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const request of this.pending.values()) { clearTimeout(request.timer); request.reject(error); }
    this.pending.clear();
    this.child.kill();
  }
}
