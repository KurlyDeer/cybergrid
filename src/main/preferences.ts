import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { AppPreferences } from "../shared/ipc";

const PREFERENCES_VERSION = 1 as const;
const MAX_PREFERENCES_BYTES = 64 * 1024;

interface PreferencesFile {
  version: typeof PREFERENCES_VERSION;
  preferences: AppPreferences;
}

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  minimizeToTray: true,
  startMinimized: false,
  launchAtLogin: false,
  masterPasswordEnabled: false,
  autoLockMinutes: 15,
  clipboardClearSeconds: 30,
  theme: "dark",
  fontFamily: "Cascadia Mono, JetBrains Mono, Consolas, monospace",
  fontSize: 14,
  cursorBlink: true,
  background: "#080d14",
  foreground: "#d7e2ef",
  cursor: "#23d5ab",
  accent: "#23d5ab",
  proxyMode: "system",
  proxyUrl: "",
  proxyBypassRules: "<local>",
  healthCheckIntervalSeconds: 30,
  externalToolPaths: {
    wireshark: "",
    winscp: "",
    nmap: "",
    powershell: "powershell.exe",
  },
};

function clonePreferences(preferences: AppPreferences): AppPreferences {
  return { ...preferences, externalToolPaths: { ...preferences.externalToolPaths } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function storedString(value: unknown, fallback: string, maxLength: number): string {
  return typeof value === "string" && value.length <= maxLength && !/[\r\n\0]/.test(value)
    ? value
    : fallback;
}

function storedColor(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function parseStoredPreferences(value: unknown): AppPreferences {
  if (!isRecord(value)) return clonePreferences(DEFAULT_APP_PREFERENCES);
  const preferences = value.preferences;
  if (value.version !== PREFERENCES_VERSION || !isRecord(preferences)) {
    return clonePreferences(DEFAULT_APP_PREFERENCES);
  }
  return {
    minimizeToTray: typeof preferences.minimizeToTray === "boolean"
      ? preferences.minimizeToTray
      : DEFAULT_APP_PREFERENCES.minimizeToTray,
    startMinimized: preferences.startMinimized === true,
    launchAtLogin: preferences.launchAtLogin === true,
    masterPasswordEnabled: typeof preferences.masterPasswordEnabled === "boolean"
      ? preferences.masterPasswordEnabled
      : true,
    autoLockMinutes: Number.isInteger(preferences.autoLockMinutes) &&
      Number(preferences.autoLockMinutes) >= 0 && Number(preferences.autoLockMinutes) <= 480
      ? Number(preferences.autoLockMinutes)
      : DEFAULT_APP_PREFERENCES.autoLockMinutes,
    clipboardClearSeconds: Number.isInteger(preferences.clipboardClearSeconds) &&
      Number(preferences.clipboardClearSeconds) >= 0 && Number(preferences.clipboardClearSeconds) <= 300
      ? Number(preferences.clipboardClearSeconds)
      : DEFAULT_APP_PREFERENCES.clipboardClearSeconds,
    theme: preferences.theme === "monochrome" || preferences.theme === "custom"
      ? preferences.theme
      : "dark",
    fontFamily: storedString(
      preferences.fontFamily,
      DEFAULT_APP_PREFERENCES.fontFamily,
      200,
    ) || DEFAULT_APP_PREFERENCES.fontFamily,
    fontSize: Number.isInteger(preferences.fontSize) &&
      Number(preferences.fontSize) >= 10 && Number(preferences.fontSize) <= 28
      ? Number(preferences.fontSize)
      : DEFAULT_APP_PREFERENCES.fontSize,
    cursorBlink: typeof preferences.cursorBlink === "boolean"
      ? preferences.cursorBlink
      : DEFAULT_APP_PREFERENCES.cursorBlink,
    background: storedColor(preferences.background, DEFAULT_APP_PREFERENCES.background),
    foreground: storedColor(preferences.foreground, DEFAULT_APP_PREFERENCES.foreground),
    cursor: storedColor(preferences.cursor, DEFAULT_APP_PREFERENCES.cursor),
    accent: storedColor(preferences.accent, DEFAULT_APP_PREFERENCES.accent),
    proxyMode: preferences.proxyMode === "direct" || preferences.proxyMode === "manual"
      ? preferences.proxyMode
      : "system",
    proxyUrl: storedString(preferences.proxyUrl, "", 2_048),
    proxyBypassRules: storedString(
      preferences.proxyBypassRules,
      DEFAULT_APP_PREFERENCES.proxyBypassRules,
      2_048,
    ),
    healthCheckIntervalSeconds: Number.isInteger(preferences.healthCheckIntervalSeconds) &&
      Number(preferences.healthCheckIntervalSeconds) >= 10 && Number(preferences.healthCheckIntervalSeconds) <= 600
      ? Number(preferences.healthCheckIntervalSeconds)
      : DEFAULT_APP_PREFERENCES.healthCheckIntervalSeconds,
    externalToolPaths: isRecord(preferences.externalToolPaths) ? {
      wireshark: storedString(preferences.externalToolPaths.wireshark, "", 2_048),
      winscp: storedString(preferences.externalToolPaths.winscp, "", 2_048),
      nmap: storedString(preferences.externalToolPaths.nmap, "", 2_048),
      powershell: storedString(
        preferences.externalToolPaths.powershell,
        DEFAULT_APP_PREFERENCES.externalToolPaths.powershell,
        2_048,
      ),
    } : { ...DEFAULT_APP_PREFERENCES.externalToolPaths },
  };
}

export class PreferencesController {
  private preferences = clonePreferences(DEFAULT_APP_PREFERENCES);

  constructor(private readonly preferencesPath: string) {}

  async load(): Promise<AppPreferences> {
    const fileInfo = await stat(this.preferencesPath).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return undefined;
      throw error;
    });
    if (!fileInfo) return this.get();
    if (!fileInfo.isFile() || fileInfo.size > MAX_PREFERENCES_BYTES) {
      throw new Error("CyberGrid preferences file is invalid or too large.");
    }
    try {
      this.preferences = parseStoredPreferences(
        JSON.parse(await readFile(this.preferencesPath, "utf8")) as unknown,
      );
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error("CyberGrid preferences file contains invalid JSON.");
      }
      throw error;
    }
    return this.get();
  }

  get(): AppPreferences {
    return clonePreferences(this.preferences);
  }

  async save(preferences: AppPreferences): Promise<AppPreferences> {
    const previous = this.preferences;
    this.preferences = clonePreferences(preferences);
    const payload: PreferencesFile = {
      version: PREFERENCES_VERSION,
      preferences: this.preferences,
    };
    await mkdir(dirname(this.preferencesPath), { recursive: true, mode: 0o700 });
    const temporaryPath = `${this.preferencesPath}.${process.pid}.tmp`;
    try {
      await writeFile(temporaryPath, `${JSON.stringify(payload, null, 2)}\n`, {
        encoding: "utf8",
        mode: 0o600,
      });
      await rename(temporaryPath, this.preferencesPath);
    } catch (error) {
      this.preferences = previous;
      await rm(temporaryPath, { force: true }).catch(() => undefined);
      throw error;
    }
    return this.get();
  }
}
