import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { Resolver } from "node:dns/promises";
import { isIP } from "node:net";
import { delimiter, isAbsolute, join } from "node:path";
import { stripVTControlCharacters } from "node:util";
import type { ContextToolAction, ContextToolResult } from "../../shared/ipc";

const MAX_OUTPUT = 128 * 1024;

export function ipv4Subnet(address: string): string {
  if (isIP(address) !== 4) throw new Error("Nmap subnet scans require an IPv4 address or a hostname with an A record.");
  return `${address.split(".").slice(0, 3).join(".")}.0/24`;
}

async function resolveSubnet(host: string, signal: AbortSignal): Promise<string> {
  if (isIP(host)) return ipv4Subnet(host);
  if (!/^(?!-)[a-z0-9._-]{1,253}$/i.test(host)) throw new Error("Invalid subnet scan hostname.");
  const resolver = new Resolver({ timeout: 1_000, tries: 1 });
  const cancel = (): void => resolver.cancel();
  signal.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(cancel, 3_000);
  try {
    if (signal.aborted) throw new Error("Scan cancelled.");
    const addresses = await resolver.resolve4(host);
    return ipv4Subnet(addresses[0] ?? "");
  } finally { clearTimeout(timer); signal.removeEventListener("abort", cancel); }
}

async function findNmap(): Promise<string> {
  const name = process.platform === "win32" ? "nmap.exe" : "nmap";
  for (const entry of (process.env.PATH ?? "").split(delimiter)) {
    const directory = entry.replace(/^"|"$/g, "").trim();
    if (!directory || !isAbsolute(directory)) continue;
    const candidate = join(directory, name);
    try { await access(candidate, process.platform === "win32" ? constants.F_OK : constants.X_OK); return candidate; }
    catch { /* Try the next PATH entry, never an implicit current-directory executable. */ }
  }
  throw new Error("Nmap was not found in PATH. Install Nmap and restart CyberGrid to refresh PATH.");
}

export function runContextCommand(command: string, args: string[], signal: AbortSignal,
  timeoutMs = 60_000): Promise<{ success: boolean; output: string }> {
  if (signal.aborted) return Promise.resolve({ success: false, output: "Cancelled." });
  return new Promise((resolve) => {
    let finished = false;
    let length = 0;
    const chunks: Buffer[] = [];
    let truncated = false;
    const child = spawn(command, args, { windowsHide: true, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    const finish = (success: boolean, reason = ""): void => {
      if (finished) return;
      finished = true;
      clearTimeout(deadline);
      signal.removeEventListener("abort", cancel);
      if (child.exitCode === null) child.kill();
      child.stdout?.removeAllListeners("data"); child.stderr?.removeAllListeners("data");
      const output = stripVTControlCharacters(Buffer.concat(chunks).toString("utf8"))
        .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "");
      resolve({ success, output: [output.trim(), reason, truncated ? "[Output truncated at 128 KiB]" : ""].filter(Boolean).join("\n") });
    };
    const collect = (chunk: Buffer): void => {
      if (finished) return;
      const remaining = MAX_OUTPUT - length;
      if (chunk.length > remaining) truncated = true;
      if (remaining > 0) { const part = chunk.subarray(0, remaining); chunks.push(part); length += part.length; }
    };
    const cancel = (): void => finish(false, "Cancelled.");
    const deadline = setTimeout(() => finish(false, `Stopped after ${timeoutMs / 1000} seconds.`), timeoutMs);
    child.stdout.on("data", collect); child.stderr.on("data", collect);
    child.once("error", (error) => finish(false, error.message));
    child.once("close", (code) => finish(code === 0, code === 0 ? "" : `Process exited with code ${code}.`));
    signal.addEventListener("abort", cancel, { once: true });
    if (signal.aborted) cancel();
  });
}

export async function runContextTool(action: ContextToolAction, host: string, signal: AbortSignal): Promise<ContextToolResult> {
  if (signal.aborted) throw new Error("Diagnostic cancelled.");
  if (action === "flush-dns") {
    if (process.platform !== "win32" || !process.env.SystemRoot) throw new Error("Flush DNS (Local) requires Windows.");
    const result = await runContextCommand(join(process.env.SystemRoot, "System32", "ipconfig.exe"), ["/flushdns"], signal, 5_000);
    return { ...result, summary: result.success ? "Local DNS cache flushed" : "Local DNS flush failed; check permissions" };
  }
  const executable = await findNmap();
  const subnet = await resolveSubnet(host.replace(/^\[|\]$/g, ""), signal);
  const result = await runContextCommand(executable, ["-sn", "-n", "--max-retries", "1", "--host-timeout", "3s", subnet], signal);
  return { ...result, summary: `Nmap host discovery ${result.success ? "complete" : "failed"}: ${subnet}`,
    output: `Target: ${subnet}\nMode: host discovery (-sn), no port scan\n\n${result.output}` };
}
