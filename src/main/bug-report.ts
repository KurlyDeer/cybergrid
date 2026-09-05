import { randomUUID } from "node:crypto";
import { formatWithOptions } from "node:util";
import type { BugReportPreview } from "../shared/diagnostics";

export function redactReportText(value: string): string {
  return value
    .replace(/-----BEGIN [^-]*(?:PRIVATE KEY|CERTIFICATE)-----[\s\S]*?(?:-----END [^-]+-----|$)/gi, "[REDACTED KEY/CERTIFICATE]")
    .replace(/\b(?:ssh-rsa|ssh-ed25519|ecdsa-sha2-\S+)\s+[a-z\d+/=]+(?:[^\r\n]*)/gi, "[REDACTED SSH KEY]")
    .replace(/((?:password|passwd|passphrase|secret|token|api[_-]?key|authorization|cookie|private[_-]?key|username|domain)\s*["']?\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;}]+)/gi, "$1[REDACTED]")
    .replace(/\b(?:Bearer|Basic)\s+[^\s,;]+/gi, "[REDACTED AUTH]")
    .replace(/((?:--?pass(?:word)?|\/pass):?\s*)(?:"[^"]*"|'[^']*'|\S+)/gi, "$1[REDACTED]")
    .replace(/([a-z][a-z\d+.-]*:\/\/)[^\s/@]+(?::[^\s/@]*)?@/gi, "$1[REDACTED]@")
    .replace(/\b(?:gh[pousr]_[a-z\d_]+|github_pat_[a-z\d_]+)\b/gi, "[REDACTED TOKEN]")
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[IP]")
    .replace(/(?:[a-f\d]{1,4}:){2,}[a-f\d:]*/gi, "[IPv6]")
    .replace(/[a-z]:\\Users\\[^\\\s]+/gi, "C:\\Users\\[USER]")
    .replace(/\/(?:home|Users)\/[^/\s]+/g, "/home/[USER]")
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "")
    .replace(/`/g, "'");
}

export class RollingErrorBuffer {
  private lines: string[] = [];
  capture(...values: unknown[]): void {
    try {
      const text = formatWithOptions({ depth: 2, maxArrayLength: 10, maxStringLength: 2048, customInspect: false, getters: false }, ...values);
      const redacted = redactReportText(text.slice(0, 32_768));
      const timestamp = new Date().toISOString();
      this.lines.push(...redacted.split(/\r?\n/).filter(Boolean).slice(-50).map(line => `${timestamp} ${line.slice(0, 400)}`));
      this.lines = this.lines.slice(-50);
    } catch { this.lines.push("[Error could not be serialized]"); this.lines = this.lines.slice(-50); }
  }
  snapshot(): string[] { return [...this.lines]; }
  install(): () => void {
    const original = console.error;
    const capture = (...args: unknown[]): void => {
      this.capture(...args);
      try { original.apply(console, args); } catch { /* A closed stderr must not recurse into fatal handling. */ }
    };
    console.error = capture;
    return () => { if (console.error === capture) console.error = original; };
  }
}

export interface ReportEnvironment {
  version: string;
  systemVersion: string;
  osRelease: string;
  platform: string;
  arch: string;
  memory: { rss: number; heapUsed: number; heapTotal: number };
}
const ISSUE_BASE = "https://github.com/KurlyDeer/cybergrid/issues/new";
function issueUrl(markdown: string): string {
  const url = new URL(ISSUE_BASE);
  url.searchParams.set("title", "Automated Crash Report");
  // Bypass YAML form selection for this prefilled Markdown report.
  url.searchParams.set("template", "");
  url.searchParams.set("body", markdown);
  return url.href;
}
export function buildReport(description: string, environment: ReportEnvironment, errors: string[]): Omit<BugReportPreview, "id"> & { url: string } {
  const cleanDescription = redactReportText(description.trim()).slice(0, 2000) || "No description provided.";
  const mib = (bytes: number): string => `${(bytes / 1048576).toFixed(1)} MiB`;
  const metadata = `## Environment\nCyberGrid: ${environment.version}\nSystem: ${environment.systemVersion}\nOS release: ${environment.osRelease}\nPlatform: ${environment.platform} / ${environment.arch}\nMemory: RSS ${mib(environment.memory.rss)}, heap ${mib(environment.memory.heapUsed)} / ${mib(environment.memory.heapTotal)}\n`;
  const logs = errors.slice(-50).map(redactReportText);
  const compose = (desc: string, lines: string[], truncated: boolean): string => `## Description\n${desc}\n\n${metadata}\n## Recent main-process errors\n${truncated ? "Excerpt shortened for Windows browser URL limit. Full report can be copied in CyberGrid.\n" : ""}\n\`\`\`log\n${lines.join("\n") || "No captured errors."}\n\`\`\`\n`;
  const fullMarkdown = compose(cleanDescription, logs, false);
  let markdown = fullMarkdown;
  let excerpt = cleanDescription;
  let truncated = false;
  // Electron shell.openExternal supports at most 2081 URL characters on Windows.
  // Use 2000 for margin and show the exact outgoing excerpt before launch.
  while (issueUrl(markdown).length > 2000) {
    truncated = true;
    if (logs.length > 1) logs.shift();
    else if (logs[0] && logs[0].length > 100) logs[0] = logs[0].slice(-Math.max(100, logs[0].length - 100));
    else if (excerpt.length > 100) excerpt = excerpt.slice(0, Math.max(100, excerpt.length - 100));
    else { logs.length = 0; excerpt = "See copied full report for description."; }
    markdown = compose(excerpt, logs, true);
    if (!logs.length && excerpt === "See copied full report for description." && issueUrl(markdown).length > 2000) throw new Error("System metadata exceeds browser URL limit.");
  }
  return { markdown, fullMarkdown, truncated, url: issueUrl(markdown) };
}

/** Binds Send to exactly the locally previewed payload, not an arbitrary URL from IPC. */
export class BugReporter {
  private prepared = new Map<number, { id: string; url: string; expires: number }>();
  constructor(private readonly errors: RollingErrorBuffer, private readonly environment: () => ReportEnvironment) {}
  preview(senderId: number, description: unknown): BugReportPreview {
    if (typeof description !== "string" || description.length > 2000) throw new Error("Description must be at most 2000 characters.");
    const report = buildReport(description, this.environment(), this.errors.snapshot());
    const id = randomUUID();
    this.prepared.set(senderId, { id, url: report.url, expires: Date.now() + 5 * 60_000 });
    return { id, markdown: report.markdown, fullMarkdown: report.fullMarkdown, truncated: report.truncated };
  }
  async send(senderId: number, id: unknown, openExternal: (url: string) => Promise<void>): Promise<void> {
    const report = this.prepared.get(senderId);
    if (!report || id !== report.id || Date.now() > report.expires) throw new Error("Report preview expired. Refresh the preview before sending.");
    await openExternal(report.url);
    this.prepared.delete(senderId);
  }
  clear(senderId: number): void { this.prepared.delete(senderId); }
}
