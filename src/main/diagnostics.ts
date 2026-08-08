import { execFile } from "node:child_process";
import { lookup, reverse } from "node:dns/promises";
import { Socket } from "node:net";
import type { DiagnosticKind, DiagnosticResult } from "../shared/ipc";

const MAX_OUTPUT_LENGTH = 64 * 1024;

interface CommandResult {
  success: boolean;
  output: string;
}

function normalizeDiagnosticHost(host: string): string {
  const normalized = host.replace(/^\[|\]$/g, "");
  if (
    normalized.length === 0 ||
    normalized.length > 253 ||
    normalized.startsWith("-") ||
    !/^[a-z0-9._:%-]+$/i.test(normalized)
  ) {
    throw new Error("The saved profile does not contain a diagnostic-safe hostname or IP address.");
  }
  return normalized;
}

function runCommand(command: string, args: string[], timeout: number): Promise<CommandResult> {
  return new Promise((resolve) => {
    execFile(
      command,
      args,
      { encoding: "utf8", timeout, windowsHide: true, maxBuffer: MAX_OUTPUT_LENGTH },
      (error, stdout, stderr) => {
        const output = `${stdout ?? ""}${stderr ? `\n${stderr}` : ""}`.trim().slice(0, MAX_OUTPUT_LENGTH);
        resolve({
          success: !error,
          output: output || (error instanceof Error ? error.message : "The command returned no output."),
        });
      },
    );
  });
}

async function ping(host: string): Promise<CommandResult> {
  if (process.platform === "win32") {
    return runCommand("ping.exe", ["-n", "1", "-w", "3000", host], 6_000);
  }
  if (process.platform === "darwin") {
    return runCommand("ping", ["-c", "1", "-W", "3000", host], 6_000);
  }
  return runCommand("ping", ["-c", "1", "-W", "3", host], 6_000);
}

async function traceroute(host: string): Promise<CommandResult> {
  if (process.platform === "win32") {
    return runCommand("tracert.exe", ["-d", "-h", "15", "-w", "1000", host], 25_000);
  }
  return runCommand("traceroute", ["-n", "-m", "15", "-w", "1", host], 25_000);
}

async function dnsLookup(host: string): Promise<CommandResult> {
  try {
    const addresses = await lookup(host, { all: true, verbatim: true });
    if (addresses.length === 0) return { success: false, output: "No DNS records were returned." };
    const lines = addresses.map((address) => `${address.family === 6 ? "AAAA" : "A"}  ${address.address}`);
    const firstAddress = addresses[0]?.address;
    if (firstAddress) {
      const names = await reverse(firstAddress).catch(() => []);
      if (names.length > 0) lines.push(`PTR  ${names.join(", ")}`);
    }
    return { success: true, output: lines.join("\n") };
  } catch (error) {
    return { success: false, output: error instanceof Error ? error.message : "DNS lookup failed." };
  }
}

function portCheck(host: string, port: number): Promise<CommandResult> {
  return new Promise((resolve) => {
    const socket = new Socket();
    const finish = (success: boolean, output: string): void => {
      socket.removeAllListeners();
      socket.destroy();
      resolve({ success, output });
    };
    socket.setTimeout(4_000);
    socket.once("connect", () => finish(true, `${host}:${port} accepted a TCP connection.`));
    socket.once("timeout", () => finish(false, `${host}:${port} timed out after 4000 ms.`));
    socket.once("error", (error) => finish(false, `${host}:${port} ${error.message}`));
    socket.connect(port, host);
  });
}

export async function runDiagnostic(
  profileId: string,
  kind: DiagnosticKind,
  rawHost: string,
  port: number,
): Promise<DiagnosticResult> {
  const host = normalizeDiagnosticHost(rawHost);
  const started = Date.now();
  let result: CommandResult;
  switch (kind) {
    case "ping":
      result = await ping(host);
      break;
    case "traceroute":
      result = await traceroute(host);
      break;
    case "dns":
      result = await dnsLookup(host);
      break;
    case "port":
      result = await portCheck(host, port);
      break;
  }
  const durationMs = Date.now() - started;
  const labels: Record<DiagnosticKind, string> = {
    ping: "Ping",
    traceroute: "Traceroute",
    dns: "DNS lookup",
    port: `Port ${port} check`,
  };
  return {
    profileId,
    kind,
    success: result.success,
    summary: `${labels[kind]} ${result.success ? "succeeded" : "failed"} in ${durationMs} ms`,
    output: result.output,
    durationMs,
    checkedAt: new Date().toISOString(),
  };
}
