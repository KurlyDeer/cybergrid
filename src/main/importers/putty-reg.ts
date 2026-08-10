import type { ServerProfileInput } from "../../shared/ipc";

interface PuttyParseResult {
  profiles: ServerProfileInput[];
  warnings: string[];
}

type PuttyProtocol = "ssh" | "telnet" | "raw" | "serial";

export function decodePuttyRegistryBuffer(buffer: Buffer): string {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) return buffer.subarray(2).toString("utf16le");
  if (buffer[0] === 0xfe && buffer[1] === 0xff) {
    const body = Buffer.from(buffer.subarray(2));
    for (let index = 0; index + 1 < body.length; index += 2) {
      const first = body[index] as number;
      body[index] = body[index + 1] as number;
      body[index + 1] = first;
    }
    return body.toString("utf16le");
  }
  return buffer.toString("utf8").replace(/^\uFEFF/, "");
}

function decodeSessionName(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value.replace(/%([0-9a-f]{2})/gi, (_match, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    );
  }
}

function unescapeRegistryString(value: string): string {
  let result = "";
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index] as string;
    if (character === "\\" && index + 1 < value.length) {
      const next = value[index + 1] as string;
      if (next === "\\" || next === '"') {
        result += next;
        index += 1;
        continue;
      }
    }
    result += character;
  }
  return result;
}

function parseValues(body: string): Record<string, string | number> {
  const values: Record<string, string | number> = {};
  for (const line of body.split(/\r?\n/)) {
    const stringValue = /^"((?:[^"\\]|\\.)+)"="((?:[^"\\]|\\.)*)"\s*$/.exec(line);
    if (stringValue) {
      values[unescapeRegistryString(stringValue[1] as string)] = unescapeRegistryString(stringValue[2] as string);
      continue;
    }
    const dwordValue = /^"((?:[^"\\]|\\.)+)"=dword:([0-9a-f]{8})\s*$/i.exec(line);
    if (dwordValue) {
      values[unescapeRegistryString(dwordValue[1] as string)] = Number.parseInt(dwordValue[2] as string, 16);
    }
  }
  return values;
}

function protocolFrom(value: unknown): PuttyProtocol | undefined {
  switch (String(value ?? "ssh").toLowerCase()) {
    case "ssh": return "ssh";
    case "telnet": return "telnet";
    case "raw":
    case "rlogin": return "raw";
    case "serial": return "serial";
    default: return undefined;
  }
}

function parityFrom(value: unknown): ServerProfileInput["parity"] {
  return ({ 0: "none", 1: "odd", 2: "even", 3: "mark", 4: "space" } as const)[Number(value) as 0] ?? "none";
}

export function parsePuttyRegistry(content: string): PuttyParseResult {
  const profiles: ServerProfileInput[] = [];
  const warnings: string[] = [];
  const headerPattern = /^\[([^\]\r\n]+)\]\s*$/gm;
  const headers = [...content.matchAll(headerPattern)];
  for (let index = 0; index < headers.length; index += 1) {
    const match = headers[index] as RegExpMatchArray;
    const key = match[1] as string;
    const sessionMatch = /^(?:HKEY_CURRENT_USER|HKEY_USERS\\[^\\]+)\\Software\\SimonTatham\\PuTTY\\Sessions\\(.+)$/i.exec(key);
    if (!sessionMatch) continue;
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < headers.length ? (headers[index + 1]?.index ?? content.length) : content.length;
    const values = parseValues(content.slice(start, end));
    const name = decodeSessionName(sessionMatch[1] as string) || "PuTTY Session";
    const protocol = protocolFrom(values.Protocol);
    if (!protocol) {
      warnings.push(`${name}: unsupported PuTTY protocol.`);
      continue;
    }
    const host = String(protocol === "serial" ? values.SerialLine ?? "" : values.HostName ?? "").trim();
    if (!host) {
      warnings.push(`${name}: missing hostname or serial device.`);
      continue;
    }
    const defaultPort: number = { ssh: 22, telnet: 23, raw: 23, serial: 0 }[protocol];
    const port = Number(values.PortNumber ?? defaultPort);
    const privateKeyPath = String(values.PublicKeyFile ?? "").trim() || undefined;
    profiles.push({
      protocol,
      category: protocol === "serial" || protocol === "telnet" || protocol === "raw" ? "network" : "server",
      name,
      host,
      port: Number.isInteger(port) && port >= 0 && port <= 65_535 ? port : defaultPort,
      username: String(values.UserName ?? "").trim(),
      group: "PuTTY",
      authType: privateKeyPath ? "privateKey" : "none",
      privateKeyPath,
      baudRate: protocol === "serial" ? Number(values.SerialSpeed ?? 9_600) : undefined,
      dataBits: protocol === "serial" ? Number(values.SerialDataBits ?? 8) as 5 | 6 | 7 | 8 : undefined,
      stopBits: protocol === "serial" ? (Number(values.SerialStopHalfbits) === 4 ? 2 : 1) : undefined,
      parity: protocol === "serial" ? parityFrom(values.SerialParity) : undefined,
      tags: ["putty-import"],
      favorite: false,
    });
  }
  if (profiles.length === 0 && warnings.length === 0) {
    warnings.push("No PuTTY session keys were found in the registry export.");
  }
  return { profiles, warnings };
}
