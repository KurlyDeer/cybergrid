import { mkdirSync, writeFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

export interface SavedConfigBackup {
  path: string;
  capturedBytes: number;
}

function backupTimestamp(date: Date): string {
  const component = (value: number): string => String(value).padStart(2, "0");
  return `${date.getFullYear()}${component(date.getMonth() + 1)}${component(date.getDate())}` +
    `_${component(date.getHours())}${component(date.getMinutes())}${component(date.getSeconds())}`;
}

function safeConnectionName(displayName: string): string {
  return displayName
    .normalize("NFKD")
    .replace(/[^a-z0-9._-]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "Switch";
}

export function saveConfigBackup(
  backupDirectory: string,
  displayName: string,
  content: string,
): SavedConfigBackup {
  if (!isAbsolute(backupDirectory)) {
    throw new Error("The configuration backup directory must be an absolute path.");
  }
  if (!content.trim()) {
    throw new Error("The switch returned no configuration output.");
  }

  const directory = resolve(backupDirectory);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const path = join(directory, `${safeConnectionName(displayName)}_${backupTimestamp(new Date())}.cfg`);
  writeFileSync(path, content, { encoding: "utf8", mode: 0o600 });
  return { path, capturedBytes: Buffer.byteLength(content, "utf8") };
}
