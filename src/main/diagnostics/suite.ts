import { Resolver } from "node:dns/promises";
import { Socket, isIP } from "node:net";
import { performance } from "node:perf_hooks";
import { connect, checkServerIdentity, type PeerCertificate } from "node:tls";
import type { GlobalDiagnosticRequest, GlobalDiagnosticResult, GlobalDiagnosticRow } from "../../shared/diagnostics";

// Small offline IEEE MA-L subset, verified against https://standards-oui.ieee.org/oui/oui.csv
// on 2026-09-05. Not a complete vendor database or proof of device identity.
const oui: Record<string, string> = require("./oui.json");
const TCP_TIMEOUT = 2_000;
const NETWORK_TIMEOUT = 5_000;
function host(value: unknown): string {
  if (typeof value !== "string") throw new Error("Enter a hostname or IP address.");
  const result = value.trim().replace(/^\[([^\]]+)\]$/, "$1");
  if (!result || result.length > 253 || (!isIP(result) && !/^(?=.{1,253}$)[a-z0-9](?:[a-z0-9._-]*[a-z0-9.])?$/i.test(result))) {
    throw new Error("Enter only a hostname or IP, without a URL, path, or credentials.");
  }
  return result;
}
export function normalizeDiagnosticRequest(value: unknown): GlobalDiagnosticRequest {
  if (!value || typeof value !== "object") throw new Error("Invalid diagnostic request.");
  const input = value as Record<string, unknown>;
  if (!["tcp", "dns", "tls", "mac"].includes(String(input.kind))) throw new Error("Unknown diagnostic tool.");
  const kind = input.kind as GlobalDiagnosticRequest["kind"];
  if (typeof input.target !== "string" || input.target.length > 253) throw new Error("Invalid target.");
  if (kind === "mac") return { kind, target: input.target.trim() };
  const request: GlobalDiagnosticRequest = { kind, target: host(input.target) };
  if (kind === "tcp" || kind === "tls") {
    if (!Number.isInteger(input.port) || Number(input.port) < 1 || Number(input.port) > 65535) throw new Error("Port must be an integer from 1 to 65535.");
    request.port = Number(input.port);
  }
  if (kind === "dns" && input.dnsServer !== undefined && input.dnsServer !== "") {
    if (typeof input.dnsServer !== "string" || !isIP(input.dnsServer.trim())) throw new Error("DNS server must be an IPv4 or IPv6 address.");
    request.dnsServer = input.dnsServer.trim();
  }
  return request;
}
type Outcome = Omit<GlobalDiagnosticResult, "durationMs" | "kind">;
function failure(error: unknown): Outcome {
  const code = (error as NodeJS.ErrnoException)?.code ?? "ERROR";
  return { success: false, code, summary: `Diagnostic failed: ${code}`, rows: [{ label: "Error", value: error instanceof Error ? error.message : String(error), warning: true }] };
}
export function tcpCheck(target: string, port: number, signal?: AbortSignal): Promise<Outcome> {
  return new Promise((resolve) => {
    const socket = new Socket();
    const started = performance.now();
    let settled = false;
    const finish = (result: Outcome): void => {
      if (settled) return;
      settled = true; clearTimeout(timer); signal?.removeEventListener("abort", abort); socket.destroy(); resolve(result);
    };
    const abort = (): void => finish(failure(Object.assign(new Error("Diagnostic cancelled."), { code: "ECANCELED" })));
    const timeout = (): void => finish(failure(Object.assign(new Error(`No TCP connection within ${TCP_TIMEOUT} ms.`), { code: "ETIMEDOUT" })));
    const timer = setTimeout(timeout, TCP_TIMEOUT);
    socket.once("error", (error) => finish(failure(error)));
    socket.once("timeout", timeout);
    socket.once("close", () => finish(failure(Object.assign(new Error("Connection closed."), { code: "ECONNRESET" }))));
    socket.once("connect", () => finish({ success: true, summary: "TCP connection accepted", rows: [
      { label: "Endpoint", value: `${target}:${port}` },
      { label: "Connection time", value: `${(performance.now() - started).toFixed(2)} ms` },
      { label: "Scope", value: "TCP handshake only; no service payload or credentials sent." },
    ] }));
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) { abort(); return; }
    socket.setTimeout(TCP_TIMEOUT);
    try { socket.connect({ host: target, port }); } catch (error) { finish(failure(error)); }
  });
}
export function certificateRows(cert: PeerCertificate, authorized: boolean, authorizationError: string, now = Date.now()): GlobalDiagnosticRow[] {
  const remaining = (Date.parse(cert.valid_to) - now) / 86_400_000;
  const notYetValid = Date.parse(cert.valid_from) > now;
  return [
    { label: "Subject", value: JSON.stringify(cert.subject) ?? "Unknown" },
    { label: "Issuer", value: JSON.stringify(cert.issuer) ?? "Unknown" },
    { label: "Valid from", value: cert.valid_from ?? "Unknown", warning: notYetValid },
    { label: "Valid until", value: cert.valid_to ?? "Unknown", warning: !Number.isFinite(remaining) || remaining < 30 },
    { label: "Expiry", value: !Number.isFinite(remaining) ? "Unknown" : remaining < 0 ? "EXPIRED" : `${Math.floor(remaining)} days remaining`, warning: !Number.isFinite(remaining) || remaining < 30 },
    { label: "Subject alternative names", value: cert.subjectaltname ?? "None" },
    { label: "Trust / hostname", value: authorized ? "Trusted chain and matching hostname" : authorizationError || "Unverified", warning: !authorized },
    { label: "SHA-256 fingerprint", value: cert.fingerprint256 ?? "Unknown" },
  ];
}
async function inspectTls(target: string, port: number, signal: AbortSignal): Promise<Outcome> {
  return new Promise((resolve) => {
    // Inspection only: do not change app-wide verification or send credentials/application data.
    const socket = connect({ host: target, port, servername: isIP(target) ? undefined : target, rejectUnauthorized: false });
    let settled = false;
    const finish = (result: Outcome): void => {
      if (settled) return;
      settled = true; clearTimeout(timer); signal.removeEventListener("abort", abort); socket.destroy(); resolve(result);
    };
    const abort = (): void => finish(failure(Object.assign(new Error("Inspection cancelled."), { code: "ECANCELED" })));
    const timer = setTimeout(() => finish(failure(Object.assign(new Error("TLS handshake exceeded 5000 ms."), { code: "ETIMEDOUT" }))), NETWORK_TIMEOUT);
    socket.once("error", (error) => finish(failure(error)));
    socket.once("close", () => finish(failure(new Error("TLS connection closed before a certificate was received."))));
    socket.once("secureConnect", () => {
      try {
        const cert = socket.getPeerCertificate();
        if (!cert.raw) throw new Error("Peer did not present a certificate.");
        const identityError = checkServerIdentity(target, cert);
        const authorized = socket.authorized && !identityError;
        finish({ success: true, summary: "Certificate retrieved — inspect trust and expiry below", rows: certificateRows(cert, authorized, identityError?.message ?? String(socket.authorizationError ?? "")) });
      } catch (error) { finish(failure(error)); }
    });
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
  });
}
async function queryDns(target: string, server: string | undefined, signal: AbortSignal): Promise<Outcome> {
  // Per-request setServers must not alter process-global DNS for active sessions.
  const resolver = new Resolver({ timeout: 2_000, tries: 1 });
  if (server) resolver.setServers([server]);
  if (signal.aborted) return failure(Object.assign(new Error("DNS query cancelled."), { code: "ECANCELED" }));
  const abort = (): void => resolver.cancel();
  signal.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, NETWORK_TIMEOUT);
  try {
    const records = await resolver.resolveAny(target);
    return { success: true, summary: `${records.length} DNS record(s) returned`, rows: [
      { label: "Resolver", value: resolver.getServers().join(", ") },
      ...records.slice(0, 128).map(record => ({ label: record.type, value: JSON.stringify(record).slice(0, 4096) })),
      { label: "Note", value: "ANY may be restricted or incomplete. Direct DNS bypasses the OS cache; the upstream resolver may still cache records." },
    ] };
  } catch (error) { return failure(error); }
  finally { clearTimeout(timer); signal.removeEventListener("abort", abort); resolver.cancel(); }
}
export function lookupMac(input: string): Outcome {
  if (!/^(?:[a-f\d]{12}|(?:[a-f\d]{2}:){5}[a-f\d]{2}|(?:[a-f\d]{2}-){5}[a-f\d]{2}|(?:[a-f\d]{4}\.){2}[a-f\d]{4})$/i.test(input)) throw new Error("Enter a complete 48-bit MAC address (colon, hyphen, dotted, or plain hex).");
  const normalized = input.replace(/[:.-]/g, "").toUpperCase();
  const prefix = normalized.slice(0, 6);
  const firstByte = parseInt(normalized.slice(0, 2), 16);
  const special = (firstByte & 1) !== 0 ? "Multicast / group address" : (firstByte & 2) !== 0 ? "Locally administered / randomized address" : undefined;
  return { success: true, summary: special ?? oui[prefix] ?? "Unknown vendor (not in bundled subset)", rows: [
    { label: "MAC address", value: normalized.match(/.{2}/g)!.join(":") },
    { label: "OUI prefix", value: prefix },
    { label: "Vendor", value: special ? "Cannot infer vendor from this address" : oui[prefix] ?? "Unknown" },
    { label: "Coverage", value: "Small offline IEEE MA-L subset: Cisco, Dell, HP, Apple. MAC addresses can be spoofed; an OUI is not device authentication." },
  ] };
}
export async function runGlobalDiagnostic(input: unknown, signal = new AbortController().signal): Promise<GlobalDiagnosticResult> {
  const request = normalizeDiagnosticRequest(input);
  const started = performance.now();
  let result: Outcome;
  try {
    switch (request.kind) {
      case "tcp": result = await tcpCheck(request.target, request.port!, signal); break;
      case "tls": result = await inspectTls(request.target, request.port!, signal); break;
      case "dns": result = await queryDns(request.target, request.dnsServer, signal); break;
      case "mac": result = lookupMac(request.target); break;
    }
  } catch (error) { result = failure(error); }
  return { ...result, kind: request.kind, durationMs: Math.round(performance.now() - started) };
}
