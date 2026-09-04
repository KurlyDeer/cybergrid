import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { reverse } from "node:dns/promises";
import { createConnection, type Socket } from "node:net";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { WebContents } from "electron";
import getVendor from "mac-oui-lookup";
import {
  IPC_CHANNELS,
  type AdministrationProtocol,
  type DeviceIcon,
  type DeviceOsFamily,
  type DiscoveredDevice,
  type DiscoveryCompleteEvent,
  type DiscoveryProgressEvent,
  type DiscoveryResultEvent,
  type OpenPortInfo,
} from "../shared/ipc";

const execFileAsync = promisify(execFile);
const MAX_SCAN_HOSTS = 1_024;
const SOCKET_TIMEOUT_MS = 2_000;
const DNS_TIMEOUT_MS = 900;
const MAX_BANNER_BYTES = 2_048;

const ADMIN_PORTS: ReadonlyArray<{ port: number; protocol: AdministrationProtocol }> = [
  { port: 22, protocol: "ssh" },
  { port: 23, protocol: "telnet" },
  { port: 80, protocol: "http" },
  { port: 443, protocol: "https" },
  { port: 3389, protocol: "rdp" },
  { port: 5900, protocol: "vnc" },
];

const MAX_ACTIVE_TCP_SOCKETS = 50;
// Each host probes every administration port concurrently. Deriving the worker
// count from that fan-out guarantees the scan never exceeds the socket cap.
const HOST_CONCURRENCY = Math.max(1, Math.floor(MAX_ACTIVE_TCP_SOCKETS / ADMIN_PORTS.length));

interface ScanSession {
  sender: WebContents;
  canceled: boolean;
  sockets: Set<Socket>;
}

interface BasicDevice {
  ipAddress: string;
  hostname?: string;
  openPorts: OpenPortInfo[];
}

function ipv4ToNumber(address: string): number {
  const parts = address.split(".");
  if (parts.length !== 4) {
    throw new Error(`Invalid IPv4 address: ${address}`);
  }
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) {
      throw new Error(`Invalid IPv4 address: ${address}`);
    }
    const octet = Number(part);
    if (octet > 255) {
      throw new Error(`Invalid IPv4 address: ${address}`);
    }
    value = ((value << 8) | octet) >>> 0;
  }
  return value;
}

function numberToIpv4(value: number): string {
  return [value >>> 24, (value >>> 16) & 255, (value >>> 8) & 255, value & 255].join(".");
}

function isLocalAddress(value: number): boolean {
  const first = value >>> 24;
  const second = (value >>> 16) & 255;
  return (
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function requireLocalAddress(value: number): void {
  if (!isLocalAddress(value)) {
    throw new Error("Discovery is limited to private, loopback, and link-local IPv4 addresses.");
  }
}

function inclusiveRange(start: number, end: number): string[] {
  if (end < start) {
    throw new Error("IP range end must be greater than or equal to its start.");
  }
  const count = end - start + 1;
  if (count > MAX_SCAN_HOSTS) {
    throw new Error(`A scan may contain at most ${MAX_SCAN_HOSTS.toLocaleString()} hosts.`);
  }
  const addresses: string[] = [];
  for (let current = start; current <= end; current += 1) {
    requireLocalAddress(current);
    addresses.push(numberToIpv4(current));
  }
  return addresses;
}

export function parseScanTarget(rawTarget: string): string[] {
  const target = rawTarget.trim();
  if (target.length === 0 || target.length > 64 || /[\r\n\0]/.test(target)) {
    throw new Error("Enter a private IPv4 address, CIDR subnet, or address range.");
  }

  const cidr = /^([^/]+)\/(\d{1,2})$/.exec(target);
  if (cidr) {
    const address = ipv4ToNumber(cidr[1] as string);
    const prefix = Number(cidr[2]);
    if (prefix < 0 || prefix > 32) {
      throw new Error("CIDR prefix must be between 0 and 32.");
    }
    const size = 2 ** (32 - prefix);
    if (size > MAX_SCAN_HOSTS) {
      throw new Error(`CIDR subnet is too large. Limit scans to ${MAX_SCAN_HOSTS.toLocaleString()} addresses.`);
    }
    const mask = prefix === 0 ? 0 : (0xffff_ffff << (32 - prefix)) >>> 0;
    const network = (address & mask) >>> 0;
    const broadcast = network + size - 1;
    requireLocalAddress(network);
    requireLocalAddress(broadcast);
    if (prefix <= 30) {
      return inclusiveRange(network + 1, broadcast - 1);
    }
    return inclusiveRange(network, broadcast);
  }

  const shortRange = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.)(\d{1,3})\s*-\s*(\d{1,3})$/.exec(
    target,
  );
  if (shortRange) {
    return inclusiveRange(
      ipv4ToNumber(`${shortRange[1]}${shortRange[2]}`),
      ipv4ToNumber(`${shortRange[1]}${shortRange[3]}`),
    );
  }

  const fullRange = /^([\d.]+)\s*-\s*([\d.]+)$/.exec(target);
  if (fullRange) {
    return inclusiveRange(ipv4ToNumber(fullRange[1] as string), ipv4ToNumber(fullRange[2] as string));
  }

  const address = ipv4ToNumber(target);
  requireLocalAddress(address);
  return [numberToIpv4(address)];
}

function cleanBanner(buffer: Buffer): string | undefined {
  const value = buffer
    .toString("utf8")
    .replace(/[^\x20-\x7e\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
  return value || undefined;
}

function parseServerHeader(banner: string | undefined): string | undefined {
  if (!banner) {
    return undefined;
  }
  const match = /(?:^|\s)server:\s*([^\r\n]+)/i.exec(banner);
  return match?.[1]?.trim().slice(0, 160) ?? banner;
}

function normalizeMac(value: string): string {
  return value.replace(/-/g, ":").toUpperCase();
}

function parseNeighborTable(output: string): Map<string, string> {
  const neighbors = new Map<string, string>();
  const matcher = /(\d{1,3}(?:\.\d{1,3}){3})[^\r\n]*?([0-9a-f]{2}(?:[:-][0-9a-f]{2}){5})/gi;
  for (const match of output.matchAll(matcher)) {
    const ipAddress = match[1];
    const macAddress = match[2];
    if (ipAddress && macAddress) {
      neighbors.set(ipAddress, normalizeMac(macAddress));
    }
  }
  return neighbors;
}

async function readNeighborTable(): Promise<Map<string, string>> {
  const commands: Array<{ file: string; args: string[] }> = process.platform === "win32"
    ? [
        {
          file: join(process.env.SystemRoot ?? "C:\\Windows", "System32", "arp.exe"),
          args: ["-a"],
        },
      ]
    : [
        { file: "ip", args: ["neighbor", "show"] },
        { file: "arp", args: ["-an"] },
      ];

  for (const command of commands) {
    try {
      const { stdout } = await execFileAsync(command.file, command.args, {
        encoding: "utf8",
        timeout: 3_000,
        maxBuffer: 1024 * 1024,
        windowsHide: true,
      });
      const parsed = parseNeighborTable(stdout);
      if (parsed.size > 0 || commands.length === 1) {
        return parsed;
      }
    } catch {
      // Neighbor discovery is best-effort and varies by host OS and route topology.
    }
  }
  return new Map();
}

async function reverseHostname(ipAddress: string): Promise<string | undefined> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    const names = await Promise.race([
      reverse(ipAddress),
      new Promise<string[]>((resolve) => {
        timeout = setTimeout(() => resolve([]), DNS_TIMEOUT_MS);
      }),
    ]);
    return names[0]?.replace(/\.$/, "").slice(0, 253);
  } catch {
    return undefined;
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function inferDevice(
  device: BasicDevice,
  macAddress?: string,
  vendor?: string,
): Omit<DiscoveredDevice, "ipAddress" | "hostname" | "openPorts" | "macAddress" | "vendor" | "lastSeenAt"> {
  const bannerEvidence = device.openPorts.map((port) => port.banner ?? "").join(" ");
  const evidence = `${vendor ?? ""} ${device.hostname ?? ""} ${bannerEvidence}`.toLowerCase();
  const hasPort = (port: number): boolean => device.openPorts.some((candidate) => candidate.port === port);
  const isPrinter = /(printer|jetdirect|laserjet|brother|canon|epson|xerox|lexmark|ricoh|kyocera)/.test(
    evidence,
  );
  const isCisco = /cisco|meraki/.test(evidence);
  const isFortinet = /fortinet|fortigate/.test(evidence);
  const isVmware = /vmware|esxi|vcenter/.test(evidence);
  const isWindows = hasPort(3389) || /windows|microsoft-iis/.test(evidence);
  const isLinux = /ubuntu|debian|centos|red hat|rocky|alma|alpine|fedora|linux/.test(evidence) ||
    (hasPort(22) && !isCisco && !isFortinet && !isVmware);

  let osFamily: DeviceOsFamily = "Unknown";
  if (isPrinter) {
    osFamily = "Printer";
  } else if (isCisco || isFortinet) {
    osFamily = "Network appliance";
  } else if (isWindows) {
    osFamily = "Windows";
  } else if (isLinux || isVmware) {
    osFamily = "Linux";
  }

  let suggestedIcon: DeviceIcon = "unknown";
  if (isPrinter) {
    suggestedIcon = "printer";
  } else if (isCisco) {
    suggestedIcon = "cisco";
  } else if (isFortinet) {
    suggestedIcon = "fortinet";
  } else if (isVmware) {
    suggestedIcon = "vmware";
  } else if (isWindows) {
    suggestedIcon = "windows";
  } else if (isLinux) {
    suggestedIcon = "linux";
  } else if (hasPort(22) || hasPort(3389)) {
    suggestedIcon = "server";
  } else if (hasPort(80) || hasPort(443) || hasPort(23) || hasPort(5900)) {
    suggestedIcon = "network";
  }

  const versionMatch = /(microsoft-iis\/[\w.-]+|(?:ubuntu|debian|centos|rocky|alpine|fedora)[^;\r\n]{0,48}|openssh_[\w.p-]+)/i.exec(
    bannerEvidence,
  );
  const signals = [Boolean(macAddress), Boolean(vendor), Boolean(device.hostname), bannerEvidence.length > 0].filter(
    Boolean,
  ).length;
  const confidence = Math.min(95, 45 + signals * 10 + (osFamily !== "Unknown" ? 10 : 0));

  return {
    osFamily,
    osVersion: versionMatch?.[1]?.trim(),
    suggestedIcon,
    confidence,
  };
}

export class ScannerController {
  private readonly sessions = new Map<string, ScanSession>();

  start(target: string, sender: WebContents): string {
    const addresses = parseScanTarget(target);
    const scanId = randomUUID();
    const session: ScanSession = { sender, canceled: false, sockets: new Set() };
    this.sessions.set(scanId, session);
    void this.runScan(scanId, addresses, session);
    return scanId;
  }

  cancel(scanId: string): void {
    const session = this.sessions.get(scanId);
    if (!session) {
      return;
    }
    session.canceled = true;
    for (const socket of session.sockets) {
      socket.destroy();
    }
  }

  cancelAll(): void {
    for (const scanId of this.sessions.keys()) {
      this.cancel(scanId);
    }
  }

  private send<T>(session: ScanSession, channel: string, payload: T): void {
    if (!session.sender.isDestroyed()) {
      session.sender.send(channel, payload);
    }
  }

  private async runScan(scanId: string, addresses: string[], session: ScanSession): Promise<void> {
    const devices: BasicDevice[] = [];
    let nextIndex = 0;
    let scanned = 0;
    try {
      const worker = async (): Promise<void> => {
        while (!session.canceled) {
          const index = nextIndex;
          nextIndex += 1;
          const ipAddress = addresses[index];
          if (!ipAddress) {
            return;
          }
          const device = await this.scanHost(ipAddress, session);
          scanned += 1;
          if (device) {
            devices.push(device);
          }
          const progress: DiscoveryProgressEvent = {
            scanId,
            scanned,
            total: addresses.length,
            currentIp: ipAddress,
            hostStatus: device ? "online" : "offline",
          };
          this.send(session, IPC_CHANNELS.discoveryProgress, progress);
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(HOST_CONCURRENCY, addresses.length) }, () => worker()),
      );

      if (!session.canceled) {
        const neighbors = await readNeighborTable();
        devices.sort((left, right) => ipv4ToNumber(left.ipAddress) - ipv4ToNumber(right.ipAddress));
        for (const basicDevice of devices) {
          const macAddress = neighbors.get(basicDevice.ipAddress);
          const vendor = macAddress ? getVendor(macAddress) ?? undefined : undefined;
          const inference = inferDevice(basicDevice, macAddress, vendor);
          const device: DiscoveredDevice = {
            ...basicDevice,
            macAddress,
            vendor,
            ...inference,
            lastSeenAt: new Date().toISOString(),
          };
          const result: DiscoveryResultEvent = { scanId, device };
          this.send(session, IPC_CHANNELS.discoveryResult, result);
        }
      }

      const complete: DiscoveryCompleteEvent = {
        scanId,
        scanned,
        total: addresses.length,
        discovered: devices.length,
        canceled: session.canceled,
      };
      this.send(session, IPC_CHANNELS.discoveryComplete, complete);
    } catch (error) {
      const complete: DiscoveryCompleteEvent = {
        scanId,
        scanned,
        total: addresses.length,
        discovered: devices.length,
        canceled: session.canceled,
        error: error instanceof Error ? error.message : "Network discovery failed.",
      };
      this.send(session, IPC_CHANNELS.discoveryComplete, complete);
    } finally {
      for (const socket of session.sockets) {
        socket.destroy();
      }
      this.sessions.delete(scanId);
    }
  }

  private async scanHost(ipAddress: string, session: ScanSession): Promise<BasicDevice | undefined> {
    const results = await Promise.all(
      ADMIN_PORTS.map(({ port, protocol }) => this.probePort(ipAddress, port, protocol, session)),
    );
    const openPorts = results.filter((result): result is OpenPortInfo => Boolean(result));
    if (openPorts.length === 0 || session.canceled) {
      return undefined;
    }
    return {
      ipAddress,
      hostname: await reverseHostname(ipAddress),
      openPorts,
    };
  }

  private probePort(
    ipAddress: string,
    port: number,
    protocol: AdministrationProtocol,
    session: ScanSession,
  ): Promise<OpenPortInfo | undefined> {
    return new Promise((resolve) => {
      if (session.canceled) {
        resolve(undefined);
        return;
      }

      const socket = createConnection({ host: ipAddress, port });
      session.sockets.add(socket);
      const chunks: Buffer[] = [];
      let connected = false;
      let settled = false;
      const finish = (isOpen: boolean): void => {
        if (settled) {
          return;
        }
        settled = true;
        session.sockets.delete(socket);
        socket.destroy();
        const rawBanner = chunks.length > 0 ? Buffer.concat(chunks) : Buffer.alloc(0);
        const banner = protocol === "http"
          ? parseServerHeader(cleanBanner(rawBanner))
          : cleanBanner(rawBanner);
        resolve(isOpen ? { port, protocol, banner } : undefined);
      };

      socket.setTimeout(SOCKET_TIMEOUT_MS);
      socket.once("connect", () => {
        connected = true;
        if (protocol === "http") {
          socket.write(`HEAD / HTTP/1.0\r\nHost: ${ipAddress}\r\nConnection: close\r\n\r\n`);
        }
        if (protocol === "https" || protocol === "rdp") {
          finish(true);
        }
      });
      socket.on("data", (chunk: Buffer) => {
        const currentSize = chunks.reduce((total, candidate) => total + candidate.length, 0);
        if (currentSize < MAX_BANNER_BYTES) {
          chunks.push(chunk.subarray(0, MAX_BANNER_BYTES - currentSize));
        }
        const collected = Buffer.concat(chunks).toString("utf8");
        if (collected.includes("\n") || currentSize + chunk.length >= MAX_BANNER_BYTES) {
          finish(true);
        }
      });
      socket.once("timeout", () => finish(connected));
      socket.once("error", () => finish(false));
      socket.once("close", () => finish(connected));
    });
  }
}
