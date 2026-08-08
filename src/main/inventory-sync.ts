import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { connect as connectTls } from "node:tls";
import type {
  ConnectionProtocol,
  InventorySyncProvider,
  ServerProfileInput,
} from "../shared/ipc";

const execFileAsync = promisify(execFile);
const MAX_LDAP_MESSAGE = 8 * 1024 * 1024;

export interface InventorySourceSecret {
  id: string;
  name: string;
  provider: InventorySyncProvider;
  endpoint: string;
  baseDn?: string;
  username?: string;
  password?: string;
  filter?: string;
  group: string;
  defaultProtocol: "ssh" | "rdp" | "https";
}

export interface SyncedProfileCandidate extends ServerProfileInput {
  managedBySyncId: string;
  managedObjectId: string;
}

function encodeLength(length: number): Buffer {
  if (length < 0x80) return Buffer.from([length]);
  const bytes: number[] = [];
  let remaining = length;
  while (remaining > 0) {
    bytes.unshift(remaining & 0xff);
    remaining >>>= 8;
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function tlv(tag: number, ...parts: Buffer[]): Buffer {
  const value = Buffer.concat(parts);
  return Buffer.concat([Buffer.from([tag]), encodeLength(value.length), value]);
}

function integer(value: number, tag = 0x02): Buffer {
  const bytes: number[] = [];
  let remaining = value;
  do {
    bytes.unshift(remaining & 0xff);
    remaining >>>= 8;
  } while (remaining > 0);
  if ((bytes[0] ?? 0) & 0x80) bytes.unshift(0);
  return tlv(tag, Buffer.from(bytes));
}

function text(value: string, tag = 0x04): Buffer {
  return tlv(tag, Buffer.from(value, "utf8"));
}

function ldapMessage(messageId: number, protocolOperation: Buffer): Buffer {
  return tlv(0x30, integer(messageId), protocolOperation);
}

function bindRequest(messageId: number, username: string, password: string): Buffer {
  return ldapMessage(messageId, tlv(0x60, integer(3), text(username), text(password, 0x80)));
}

function equalityFilter(filter: string): Buffer {
  const match = /^\(\s*([a-z][a-z0-9-]{0,63})\s*=\s*([^()]{1,512})\s*\)$/i.exec(filter);
  if (!match) {
    throw new Error("LDAP filter must be one equality expression such as (objectClass=computer).");
  }
  const attribute = match[1] as string;
  const value = match[2] as string;
  if (value.includes("*")) {
    if (value !== "*") throw new Error("LDAP filter supports either an exact value or a single wildcard value.");
    return tlv(0x87, Buffer.from(attribute, "utf8"));
  }
  return tlv(0xa3, text(attribute), text(value));
}

function searchRequest(messageId: number, source: InventorySourceSecret): Buffer {
  const attributes = ["objectGUID", "dNSHostName", "cn", "name", "operatingSystem", "distinguishedName"];
  return ldapMessage(messageId, tlv(
    0x63,
    text(source.baseDn ?? ""),
    integer(2, 0x0a),
    integer(0, 0x0a),
    integer(2_000),
    integer(25),
    tlv(0x01, Buffer.from([0x00])),
    equalityFilter(source.filter || "(objectClass=computer)"),
    tlv(0x30, ...attributes.map((attribute) => text(attribute))),
  ));
}

interface ParsedTlv {
  tag: number;
  valueStart: number;
  valueEnd: number;
  next: number;
}

function readTlv(buffer: Buffer, offset: number): ParsedTlv {
  if (offset + 2 > buffer.length) throw new Error("Truncated LDAP response.");
  const tag = buffer[offset] as number;
  const lengthByte = buffer[offset + 1] as number;
  let length = 0;
  let valueStart = offset + 2;
  if ((lengthByte & 0x80) === 0) {
    length = lengthByte;
  } else {
    const count = lengthByte & 0x7f;
    if (count < 1 || count > 4 || valueStart + count > buffer.length) throw new Error("Invalid LDAP response length.");
    for (let index = 0; index < count; index += 1) length = (length << 8) | (buffer[valueStart + index] as number);
    valueStart += count;
  }
  const valueEnd = valueStart + length;
  if (length > MAX_LDAP_MESSAGE || valueEnd > buffer.length) throw new Error("Truncated or oversized LDAP response.");
  return { tag, valueStart, valueEnd, next: valueEnd };
}

function completeMessageLength(buffer: Buffer): number | undefined {
  if (buffer.length < 2 || buffer[0] !== 0x30) return undefined;
  const first = buffer[1] as number;
  if ((first & 0x80) === 0) return buffer.length >= first + 2 ? first + 2 : undefined;
  const count = first & 0x7f;
  if (count < 1 || count > 4 || buffer.length < count + 2) return undefined;
  let length = 0;
  for (let index = 0; index < count; index += 1) length = (length << 8) | (buffer[2 + index] as number);
  const total = 2 + count + length;
  if (total > MAX_LDAP_MESSAGE) throw new Error("LDAP response exceeded the maximum message size.");
  return buffer.length >= total ? total : undefined;
}

function integerValue(buffer: Buffer, item: ParsedTlv): number {
  let value = 0;
  for (let offset = item.valueStart; offset < item.valueEnd; offset += 1) value = (value << 8) | (buffer[offset] as number);
  return value;
}

interface LdapEntry {
  dn: string;
  attributes: Map<string, string[]>;
}

function parseEntry(buffer: Buffer, operation: ParsedTlv): LdapEntry {
  let offset = operation.valueStart;
  const dnItem = readTlv(buffer, offset);
  const dn = buffer.subarray(dnItem.valueStart, dnItem.valueEnd).toString("utf8");
  offset = dnItem.next;
  const attributesItem = readTlv(buffer, offset);
  const attributes = new Map<string, string[]>();
  offset = attributesItem.valueStart;
  while (offset < attributesItem.valueEnd) {
    const attribute = readTlv(buffer, offset);
    let attributeOffset = attribute.valueStart;
    const nameItem = readTlv(buffer, attributeOffset);
    const name = buffer.subarray(nameItem.valueStart, nameItem.valueEnd).toString("utf8").toLowerCase();
    attributeOffset = nameItem.next;
    const valuesItem = readTlv(buffer, attributeOffset);
    const values: string[] = [];
    let valuesOffset = valuesItem.valueStart;
    while (valuesOffset < valuesItem.valueEnd) {
      const valueItem = readTlv(buffer, valuesOffset);
      const rawValue = buffer.subarray(valueItem.valueStart, valueItem.valueEnd);
      values.push(name === "objectguid" ? rawValue.toString("hex") : rawValue.toString("utf8"));
      valuesOffset = valueItem.next;
    }
    attributes.set(name, values);
    offset = attribute.next;
  }
  return { dn, attributes };
}

async function queryLdaps(source: InventorySourceSecret): Promise<LdapEntry[]> {
  const endpoint = new URL(source.endpoint);
  if (endpoint.protocol !== "ldaps:") throw new Error("LDAP synchronization requires an ldaps:// endpoint with a trusted certificate.");
  if (!source.baseDn || !source.username || source.password === undefined) {
    throw new Error("LDAPS source requires base DN, bind username, and password.");
  }
  return new Promise<LdapEntry[]>((resolve, reject) => {
    const socket = connectTls({ host: endpoint.hostname, port: Number(endpoint.port || 636), servername: endpoint.hostname, rejectUnauthorized: true });
    const entries: LdapEntry[] = [];
    let pending = Buffer.alloc(0);
    let state: "bind" | "search" = "bind";
    let settled = false;
    const finish = (error?: Error): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      socket.destroy();
      if (error) reject(error); else resolve(entries);
    };
    const timeout = setTimeout(() => finish(new Error("LDAPS synchronization timed out.")), 30_000);
    socket.once("secureConnect", () => socket.write(bindRequest(1, source.username as string, source.password as string)));
    socket.on("data", (chunk: Buffer) => {
      try {
        pending = Buffer.concat([pending, chunk]);
        let messageLength = completeMessageLength(pending);
        while (messageLength !== undefined) {
          const message = pending.subarray(0, messageLength);
          pending = pending.subarray(messageLength);
          const outer = readTlv(message, 0);
          const id = readTlv(message, outer.valueStart);
          const operation = readTlv(message, id.next);
          if (state === "bind") {
            if (operation.tag !== 0x61) throw new Error("Unexpected LDAPS bind response.");
            const resultCode = readTlv(message, operation.valueStart);
            if (integerValue(message, resultCode) !== 0) throw new Error("LDAPS bind was rejected.");
            state = "search";
            socket.write(searchRequest(2, source));
          } else if (operation.tag === 0x64) {
            entries.push(parseEntry(message, operation));
          } else if (operation.tag === 0x65) {
            const resultCode = readTlv(message, operation.valueStart);
            const code = integerValue(message, resultCode);
            if (code !== 0 && code !== 4) throw new Error(`LDAPS search failed with result code ${code}.`);
            finish();
          }
          messageLength = completeMessageLength(pending);
        }
      } catch (error) {
        finish(error instanceof Error ? error : new Error("Invalid LDAPS response."));
      }
    });
    socket.once("error", (error) => finish(error));
  });
}

function protocolPort(protocol: "ssh" | "rdp" | "https"): number {
  return protocol === "ssh" ? 22 : protocol === "rdp" ? 3389 : 443;
}

function folderFromDn(baseGroup: string, dn: string): string {
  const ous = dn.split(",").map((part) => part.trim()).filter((part) => /^OU=/i.test(part))
    .map((part) => part.slice(3).replace(/\\,/g, ",")).reverse();
  return [baseGroup, ...ous].filter(Boolean).join("/").slice(0, 100);
}

async function discoverLdap(source: InventorySourceSecret): Promise<SyncedProfileCandidate[]> {
  const entries = await queryLdaps(source);
  return entries.flatMap((entry) => {
    const host = entry.attributes.get("dnshostname")?.[0] ?? entry.attributes.get("name")?.[0] ?? entry.attributes.get("cn")?.[0];
    if (!host) return [];
    const name = entry.attributes.get("name")?.[0] ?? entry.attributes.get("cn")?.[0] ?? host;
    const objectId = entry.attributes.get("objectguid")?.[0] ?? entry.dn;
    const os = entry.attributes.get("operatingsystem")?.[0];
    return [{
      protocol: source.defaultProtocol,
      name,
      host,
      port: protocolPort(source.defaultProtocol),
      username: "",
      group: folderFromDn(source.group, entry.dn),
      authType: "none" as const,
      inheritFolderDefaults: true,
      tags: ["directory-sync", "active-directory", ...(os ? [os.slice(0, 32)] : [])],
      managedBySyncId: source.id,
      managedObjectId: objectId,
    }];
  });
}

async function discoverVmware(source: InventorySourceSecret): Promise<SyncedProfileCandidate[]> {
  const endpoint = new URL(source.endpoint);
  if (endpoint.protocol !== "https:" || !source.username || source.password === undefined) {
    throw new Error("VMware source requires an https:// vCenter endpoint, username, and password.");
  }
  const baseUrl = `${endpoint.origin}${endpoint.pathname.replace(/\/$/, "")}`;
  const authorization = `Basic ${Buffer.from(`${source.username}:${source.password}`, "utf8").toString("base64")}`;
  const sessionResponse = await fetch(`${baseUrl}/api/session`, {
    method: "POST", headers: { authorization }, signal: AbortSignal.timeout(30_000),
  });
  if (!sessionResponse.ok) throw new Error(`vCenter authentication failed (${sessionResponse.status}).`);
  const sessionId = await sessionResponse.json() as unknown;
  if (typeof sessionId !== "string" || sessionId.length > 4_096) throw new Error("vCenter returned an invalid session token.");
  try {
    const response = await fetch(`${baseUrl}/api/vcenter/vm`, {
      headers: { "vmware-api-session-id": sessionId }, signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`vCenter inventory request failed (${response.status}).`);
    const payload = await response.json() as unknown;
    if (!Array.isArray(payload) || payload.length > 4_000) throw new Error("vCenter returned an invalid or oversized VM inventory.");
    return payload.flatMap((item): SyncedProfileCandidate[] => {
      if (typeof item !== "object" || item === null) return [];
      const record = item as Record<string, unknown>;
      if (typeof record.vm !== "string" || typeof record.name !== "string") return [];
      return [{
        protocol: source.defaultProtocol, name: record.name, host: record.name,
        port: protocolPort(source.defaultProtocol), username: "", group: `${source.group}/VMware`,
        authType: "none", inheritFolderDefaults: true,
        tags: ["hypervisor-sync", "vmware", String(record.power_state ?? "unknown").slice(0, 32)],
        managedBySyncId: source.id, managedObjectId: record.vm,
      }];
    });
  } finally {
    await fetch(`${baseUrl}/api/session`, {
      method: "DELETE", headers: { "vmware-api-session-id": sessionId }, signal: AbortSignal.timeout(10_000),
    }).catch(() => undefined);
  }
}

async function discoverHyperV(source: InventorySourceSecret): Promise<SyncedProfileCandidate[]> {
  if (process.platform !== "win32") throw new Error("Hyper-V inventory synchronization is available on Windows hosts only.");
  const host = source.endpoint.trim();
  if (!/^[a-z0-9_.-]{1,253}$/i.test(host)) throw new Error("Hyper-V host name is invalid.");
  const script = "$ErrorActionPreference='Stop'; Get-VM -ComputerName $env:CYBERGRID_HYPERV_HOST | Select-Object Id,Name,State | ConvertTo-Json -Compress";
  const { stdout } = await execFileAsync("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script], {
    encoding: "utf8", timeout: 30_000, maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, CYBERGRID_HYPERV_HOST: host }, windowsHide: true,
  });
  const parsed = JSON.parse(stdout || "[]") as unknown;
  const values = Array.isArray(parsed) ? parsed : parsed && typeof parsed === "object" ? [parsed] : [];
  return values.flatMap((item): SyncedProfileCandidate[] => {
    const record = item as Record<string, unknown>;
    if (typeof record.Name !== "string") return [];
    return [{
      protocol: source.defaultProtocol, name: record.Name, host: record.Name,
      port: protocolPort(source.defaultProtocol), username: "", group: `${source.group}/Hyper-V`,
      authType: "none", inheritFolderDefaults: true,
      tags: ["hypervisor-sync", "hyper-v", String(record.State ?? "unknown").slice(0, 32)],
      managedBySyncId: source.id, managedObjectId: String(record.Id ?? record.Name),
    }];
  });
}

export function discoverInventory(source: InventorySourceSecret): Promise<SyncedProfileCandidate[]> {
  if (source.provider === "ldap") return discoverLdap(source);
  if (source.provider === "vmware") return discoverVmware(source);
  return discoverHyperV(source);
}
