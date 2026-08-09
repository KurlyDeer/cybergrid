import { readFile, stat, writeFile } from "node:fs/promises";
import { extname } from "node:path";
import { dialog, type BrowserWindow } from "electron";
import { XMLParser } from "fast-xml-parser";
import type {
  AssetRecord,
  ConnectionProtocol,
  MigrationExportResult,
  MigrationFormat,
  MigrationRequest,
  ServerAuthType,
  ServerProfileInput,
} from "../shared/ipc";
import { decryptTeamVault, encryptTeamVault } from "./team-vault";

const MAX_IMPORT_BYTES = 25 * 1024 * 1024;

export interface ParsedMigration {
  profiles: unknown[];
  assets: unknown[];
  warnings: string[];
  path: string;
}

interface ExportPayload {
  content: string | Buffer;
  count: number;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : undefined;
}

function text(value: unknown): string {
  return value === undefined || value === null ? "" : String(value).trim();
}

function defaultPort(protocol: ConnectionProtocol): number {
  return { ssh: 22, rdp: 3389, telnet: 23, raw: 23, vnc: 5900, http: 80, https: 443, serial: 0 }[
    protocol
  ];
}

function mapProtocol(value: string): ConnectionProtocol | undefined {
  const normalized = value.toLowerCase();
  if (normalized === "ssh" || normalized === "ssh2") return "ssh";
  if (normalized === "rdp" || normalized === "rdp2") return "rdp";
  if (normalized === "telnet") return "telnet";
  if (normalized === "raw" || normalized === "rlogin") return "raw";
  if (normalized === "vnc") return "vnc";
  if (normalized === "http") return "http";
  if (normalized === "https") return "https";
  if (normalized === "serial") return "serial";
  return undefined;
}

function profileFromFields(fields: Record<string, unknown>, fallbackGroup: string): ServerProfileInput | undefined {
  const protocol = mapProtocol(text(fields.protocol ?? fields.Protocol));
  const host = text(fields.host ?? fields.hostname ?? fields.Hostname ?? fields.path ?? fields.serialline ?? fields.SerialLine);
  if (!protocol || !host) {
    return undefined;
  }
  const password = text(fields.password ?? fields.Password) || undefined;
  const privateKeyPath = text(fields.privateKeyPath ?? fields.privatekeypath ?? fields.KeyFile ?? fields.keyfile ?? fields.PublicKeyFile) || undefined;
  let authType: ServerAuthType = text(fields.authType ?? fields.authtype) as ServerAuthType;
  if (authType !== "none" && authType !== "password" && authType !== "privateKey") {
    authType = privateKeyPath ? "privateKey" : password ? "password" : "none";
  }
  const requestedPort = Number(fields.port ?? fields.Port ?? defaultPort(protocol));
  return {
    protocol,
    name: text(fields.name ?? fields.Name) || host,
    host,
    port: Number.isInteger(requestedPort) ? requestedPort : defaultPort(protocol),
    username: text(fields.username ?? fields.Username ?? fields.UserName),
    group: text(fields.group ?? fields.Group) || fallbackGroup || "Imported",
    authType,
    password: authType === "password" ? password : undefined,
    privateKeyPath: authType === "privateKey" ? privateKeyPath : undefined,
    passphrase: authType === "privateKey" ? text(fields.passphrase) || undefined : undefined,
    baudRate: protocol === "serial" ? Number(fields.baudRate ?? fields.baudrate ?? 9_600) : undefined,
    dataBits: protocol === "serial" ? Number(fields.dataBits ?? fields.databits ?? 8) as 5 | 6 | 7 | 8 : undefined,
    stopBits: protocol === "serial" ? Number(fields.stopBits ?? fields.stopbits ?? 1) as 1 | 2 : undefined,
    parity: protocol === "serial" ? (text(fields.parity) || "none") as ServerProfileInput["parity"] : undefined,
    tags: text(fields.tags).split(/[;,]/).map((tag) => tag.trim()).filter(Boolean),
    favorite: /^(?:true|1|yes)$/i.test(text(fields.favorite)),
  };
}

function parseMRemoteNg(content: string): { profiles: ServerProfileInput[]; warnings: string[] } {
  const warnings: string[] = [];
  const profiles: ServerProfileInput[] = [];
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    allowBooleanAttributes: true,
    processEntities: false,
    trimValues: false,
  });
  let document: unknown;
  try {
    document = parser.parse(content) as unknown;
  } catch (error) {
    throw new Error(`mRemoteNG XML could not be parsed: ${error instanceof Error ? error.message : "invalid XML"}`);
  }

  const visit = (value: unknown, groupPath: string[]): void => {
    if (Array.isArray(value)) {
      for (const entry of value) visit(entry, groupPath);
      return;
    }
    const node = asRecord(value);
    if (!node) return;
    if (text(node.FullFileEncryption).toLowerCase() === "true") {
      throw new Error("Fully encrypted mRemoteNG files must be decrypted in mRemoteNG before import.");
    }
    const type = text(node.Type ?? node.NodeType).toLowerCase();
    const name = text(node.Name);
    const nextPath = type === "container" && name ? [...groupPath, name] : groupPath;
    if (type === "connection" || node.Hostname !== undefined) {
      const password = text(node.Password);
      const encryptedPassword = password && !password.includes("${") && /^[A-Za-z0-9+/]{24,}={0,2}$/.test(password);
      if (encryptedPassword) {
        warnings.push(`${name || text(node.Hostname)}: mRemoteNG-encrypted password was omitted; use a team token or re-enter it locally.`);
        node.Password = "";
      }
      const profile = profileFromFields(node, nextPath.join(" / ") || "mRemoteNG");
      if (profile) profiles.push(profile);
      else warnings.push(`${name || "Unnamed node"}: unsupported protocol or missing host.`);
    }
    for (const [key, child] of Object.entries(node)) {
      if (key === "Node" || key === "Connections" || key.endsWith(":Connections")) {
        visit(child, nextPath);
      }
    }
  };
  visit(document, []);
  return { profiles, warnings };
}

function decodeRegistryBuffer(buffer: Buffer): string {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.subarray(2).toString("utf16le");
  }
  return buffer.toString("utf8");
}

function unescapeRegistryString(value: string): string {
  return value.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

function decodePuttySessionName(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function puttyParity(value: unknown): ServerProfileInput["parity"] {
  return ({ 0: "none", 1: "odd", 2: "even", 3: "mark", 4: "space" } as const)[Number(value) as 0] ?? "none";
}

function parsePuttyRegistry(content: string): { profiles: ServerProfileInput[]; warnings: string[] } {
  const profiles: ServerProfileInput[] = [];
  const warnings: string[] = [];
  const sessions = content.split(/^\[(?=HKEY_)/m).slice(1);
  for (const section of sessions) {
    const headerEnd = section.indexOf("]");
    const key = section.slice(0, headerEnd);
    if (!/\\Software\\SimonTatham\\PuTTY\\Sessions\\/i.test(key)) continue;
    const rawName = key.split("\\").at(-1) ?? "PuTTY Session";
    const fields: Record<string, unknown> = { name: decodePuttySessionName(rawName), group: "PuTTY" };
    for (const line of section.slice(headerEnd + 1).split(/\r?\n/)) {
      const stringValue = /^"([^"]+)"="(.*)"$/.exec(line);
      if (stringValue) {
        fields[stringValue[1] as string] = unescapeRegistryString(stringValue[2] as string);
        continue;
      }
      const dword = /^"([^"]+)"=dword:([0-9a-f]{8})$/i.exec(line);
      if (dword) fields[dword[1] as string] = Number.parseInt(dword[2] as string, 16);
    }
    const serial = text(fields.Protocol).toLowerCase() === "serial";
    const profile = profileFromFields({
      ...fields,
      protocol: fields.Protocol ?? "ssh",
      host: serial ? fields.SerialLine : fields.HostName,
      port: fields.PortNumber,
      username: fields.UserName,
      privateKeyPath: fields.PublicKeyFile,
      baudRate: fields.SerialSpeed,
      dataBits: fields.SerialDataBits,
      stopBits: Number(fields.SerialStopHalfbits) === 4 ? 2 : 1,
      parity: puttyParity(fields.SerialParity),
    }, "PuTTY");
    if (profile) profiles.push(profile);
    else warnings.push(`${text(fields.name)}: missing hostname or unsupported PuTTY protocol.`);
  }
  return { profiles, warnings };
}

function parseCsvRows(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < content.length; index += 1) {
    const character = content[index] as string;
    if (quoted) {
      if (character === '"' && content[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  row.push(field.replace(/\r$/, ""));
  if (row.some((cell) => cell.length > 0)) rows.push(row);
  if (quoted) throw new Error("CSV contains an unterminated quoted field.");
  return rows;
}

function parseCsv(content: string): { profiles: ServerProfileInput[]; warnings: string[] } {
  const rows = parseCsvRows(content.replace(/^\uFEFF/, ""));
  const header = rows.shift()?.map((value) => value.trim()) ?? [];
  if (header.length === 0) throw new Error("CSV header row is missing.");
  const profiles: ServerProfileInput[] = [];
  const warnings: string[] = [];
  rows.forEach((row, index) => {
    const fields: Record<string, unknown> = {};
    header.forEach((name, column) => {
      const value = row[column] ?? "";
      fields[name] = value;
      fields[name.toLowerCase()] = value;
    });
    const profile = profileFromFields(fields, "CSV Import");
    if (profile) profiles.push(profile);
    else warnings.push(`CSV row ${index + 2}: missing host/path or unsupported protocol.`);
  });
  return { profiles, warnings };
}

function portableSecret(value: string | undefined): string {
  if (!value) return "";
  let containsToken = false;
  const remainder = value.replace(/\$\{[A-Z_][A-Z0-9_]*\}/g, () => {
    containsToken = true;
    return "";
  });
  return containsToken && !remainder.includes("${") ? value : "";
}

function xmlEscape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function exportMRemoteNg(profiles: ServerProfileInput[]): ExportPayload {
  const protocolNames: Record<ConnectionProtocol, string> = {
    ssh: "SSH2", rdp: "RDP", telnet: "Telnet", raw: "RAW", vnc: "VNC",
    http: "HTTP", https: "HTTPS", serial: "RAW",
  };
  interface GroupNode { groups: Map<string, GroupNode>; profiles: ServerProfileInput[] }
  const root: GroupNode = { groups: new Map(), profiles: [] };
  const supported = profiles.filter((profile) => profile.protocol !== "serial");
  for (const profile of supported) {
    const segments = profile.group.split(/\s*\/\s*/).map((segment) => segment.trim()).filter(Boolean);
    let group = root;
    for (const segment of segments) {
      let child = group.groups.get(segment);
      if (!child) {
        child = { groups: new Map(), profiles: [] };
        group.groups.set(segment, child);
      }
      group = child;
    }
    group.profiles.push(profile);
  }
  const renderGroup = (group: GroupNode, depth: number): string[] => {
    const indent = "  ".repeat(depth);
    const lines = group.profiles.map((profile) =>
      `${indent}<Node Name="${xmlEscape(profile.name)}" Type="Connection" Protocol="${protocolNames[profile.protocol]}" Hostname="${xmlEscape(profile.host)}" Port="${profile.port}" Username="${xmlEscape(profile.username)}" Password="" />`,
    );
    for (const [name, child] of group.groups) {
      lines.push(`${indent}<Node Name="${xmlEscape(name)}" Type="Container" Expanded="true">`);
      lines.push(...renderGroup(child, depth + 1));
      lines.push(`${indent}</Node>`);
    }
    return lines;
  };
  const nodes = renderGroup(root, 1);
  return {
    count: supported.length,
    content: `<?xml version="1.0" encoding="utf-8"?>\n<mrng:Connections xmlns:mrng="http://mremoteng.org" Name="CyberGrid Export" Export="true" ConfVersion="1.3">\n${nodes.join("\n")}\n</mrng:Connections>\n`,
  };
}

function regEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function exportPutty(profiles: ServerProfileInput[]): ExportPayload {
  const supported = profiles.filter((profile) => profile.protocol === "ssh" || profile.protocol === "telnet" || profile.protocol === "raw" || profile.protocol === "serial");
  const sections = supported.map((profile) => {
    const sessionName = encodeURIComponent(profile.name).replace(/%2F/gi, "%252F");
    return [
      `[HKEY_CURRENT_USER\\Software\\SimonTatham\\PuTTY\\Sessions\\${sessionName}]`,
      `"HostName"="${regEscape(profile.host)}"`,
      `"PortNumber"=dword:${profile.port.toString(16).padStart(8, "0")}`,
      `"UserName"="${regEscape(profile.username)}"`,
      `"Protocol"="${profile.protocol === "ssh" ? "ssh" : profile.protocol}"`,
      `"PublicKeyFile"="${regEscape(profile.privateKeyPath ?? "")}"`,
      `"SerialLine"="${regEscape(profile.protocol === "serial" ? profile.host : "COM1")}"`,
      `"SerialSpeed"=dword:${(profile.baudRate ?? 9_600).toString(16).padStart(8, "0")}`,
      `"SerialDataBits"=dword:${(profile.dataBits ?? 8).toString(16).padStart(8, "0")}`,
      `"SerialStopHalfbits"=dword:${(profile.stopBits === 2 ? 4 : 2).toString(16).padStart(8, "0")}`,
      `"SerialParity"=dword:${({ none: 0, odd: 1, even: 2, mark: 3, space: 4 }[profile.parity ?? "none"]).toString(16).padStart(8, "0")}`,
    ].join("\r\n");
  });
  const content = `Windows Registry Editor Version 5.00\r\n\r\n${sections.join("\r\n\r\n")}\r\n`;
  return { count: supported.length, content: Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(content, "utf16le")]) };
}

function csvCell(value: unknown): string {
  const normalized = value === undefined ? "" : String(value);
  return /[",\r\n]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized;
}

function exportCsv(profiles: ServerProfileInput[]): ExportPayload {
  const header = ["protocol", "name", "group", "host", "port", "username", "authType", "password", "privateKeyPath", "passphrase", "baudRate", "dataBits", "stopBits", "parity", "tags", "favorite"];
  const rows = profiles.map((profile) => [
    profile.protocol, profile.name, profile.group, profile.host, profile.port, profile.username,
    profile.authType, portableSecret(profile.password), profile.privateKeyPath ?? "",
    portableSecret(profile.passphrase), profile.baudRate, profile.dataBits, profile.stopBits, profile.parity,
    profile.tags?.join(";"), profile.favorite ?? false,
  ].map(csvCell).join(","));
  return { count: profiles.length, content: `${header.join(",")}\n${rows.join("\n")}\n` };
}

function detectFormat(path: string, requested: MigrationFormat): Exclude<MigrationFormat, "auto"> {
  if (requested !== "auto") return requested;
  const extension = extname(path).toLowerCase();
  if (extension === ".xml") return "mremoteng";
  if (extension === ".reg") return "putty";
  if (extension === ".csv") return "csv";
  if (extension === ".cgvault") return "cgvault";
  throw new Error("Could not detect migration format from the selected file extension.");
}

export class MigrationController {
  constructor(private readonly windowProvider: () => BrowserWindow | null) {}

  async importConnections(request: MigrationRequest): Promise<ParsedMigration | null> {
    const window = this.windowProvider();
    if (!window) throw new Error("CyberGrid window is not available.");
    const selection = await dialog.showOpenDialog(window, {
      title: "Import connection tree",
      properties: ["openFile"],
      filters: [
        { name: "Supported connection files", extensions: ["xml", "reg", "csv", "cgvault"] },
        { name: "All files", extensions: ["*"] },
      ],
    });
    if (selection.canceled || !selection.filePaths[0]) return null;
    const path = selection.filePaths[0];
    const info = await stat(path);
    if (!info.isFile() || info.size > MAX_IMPORT_BYTES) {
      throw new Error("Migration file must be smaller than 25 MB.");
    }
    const buffer = await readFile(path);
    const format = detectFormat(path, request.format);
    if (format === "cgvault") {
      const bundle = await decryptTeamVault(buffer.toString("utf8"), request.teamPassphrase ?? "");
      return { profiles: bundle.profiles, assets: bundle.assets, warnings: [], path };
    }
    const parsed = format === "mremoteng"
      ? parseMRemoteNg(buffer.toString("utf8"))
      : format === "putty"
        ? parsePuttyRegistry(decodeRegistryBuffer(buffer))
        : parseCsv(buffer.toString("utf8"));
    return { profiles: parsed.profiles, assets: [], warnings: parsed.warnings, path };
  }

  async exportConnections(
    request: MigrationRequest,
    profiles: ServerProfileInput[],
    assets: AssetRecord[],
  ): Promise<MigrationExportResult> {
    const window = this.windowProvider();
    if (!window) throw new Error("CyberGrid window is not available.");
    if (request.format === "auto") throw new Error("Choose an export format.");
    const extension = { mremoteng: "xml", putty: "reg", csv: "csv", cgvault: "cgvault" }[request.format];
    const selection = await dialog.showSaveDialog(window, {
      title: "Export connection tree",
      defaultPath: `CyberGrid-${new Date().toISOString().slice(0, 10)}.${extension}`,
      filters: [{ name: `${request.format} export`, extensions: [extension] }],
    });
    if (selection.canceled || !selection.filePath) return { exported: 0, path: null };
    const payload = request.format === "mremoteng"
      ? exportMRemoteNg(profiles)
      : request.format === "putty"
        ? exportPutty(profiles)
        : request.format === "csv"
          ? exportCsv(profiles)
          : {
              count: profiles.length,
              content: await encryptTeamVault(profiles, assets, request.teamPassphrase ?? ""),
            };
    await writeFile(selection.filePath, payload.content, { mode: 0o600 });
    return { exported: payload.count, path: selection.filePath };
  }
}

export const migrationParsers = {
  parseMRemoteNg,
  parsePuttyRegistry,
  parseCsv,
  exportMRemoteNg,
  exportPutty,
  exportCsv,
};
