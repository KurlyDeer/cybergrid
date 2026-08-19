export interface ParsedConnectionTarget {
  host: string;
  port?: number;
  username?: string;
}

function parsePort(rawPort: string): number {
  if (!/^\d{1,5}$/.test(rawPort)) {
    throw new Error("Connection port must be a number between 1 and 65535.");
  }
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("Connection port must be between 1 and 65535.");
  }
  return port;
}

/**
 * Splits user@host:port connection text without misreading an unbracketed IPv6
 * address as a host/port pair. IPv6 ports therefore use the standard
 * user@[2001:db8::1]:22 form.
 */
export function parseConnectionTarget(rawValue: string): ParsedConnectionTarget {
  let target = rawValue.trim();
  if (!target) throw new Error("Hostname or IP is required.");

  let username: string | undefined;
  const atIndex = target.lastIndexOf("@");
  if (atIndex >= 0) {
    username = target.slice(0, atIndex).trim();
    target = target.slice(atIndex + 1).trim();
    if (!username) throw new Error("Connection username cannot be empty before @.");
  }

  let host = target;
  let port: number | undefined;
  if (target.startsWith("[")) {
    const closeBracket = target.indexOf("]");
    if (closeBracket < 0) throw new Error("IPv6 addresses with a port must use [address]:port syntax.");
    host = target.slice(1, closeBracket);
    const suffix = target.slice(closeBracket + 1);
    if (suffix) {
      if (!suffix.startsWith(":")) throw new Error("Unexpected text after the bracketed IPv6 address.");
      port = parsePort(suffix.slice(1));
    }
  } else {
    const colonCount = [...target].filter((character) => character === ":").length;
    if (colonCount === 1) {
      const separator = target.lastIndexOf(":");
      host = target.slice(0, separator);
      port = parsePort(target.slice(separator + 1));
    }
  }

  host = host.trim();
  if (!host || /\s/.test(host) || host.includes("@") || host.includes("[") || host.includes("]")) {
    throw new Error("Enter a valid hostname, IPv4 address, or bracketed IPv6 address.");
  }
  return { host, port, username };
}
