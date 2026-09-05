export type GlobalDiagnosticKind = "tcp" | "dns" | "tls" | "mac";
export interface GlobalDiagnosticRequest {
  kind: GlobalDiagnosticKind;
  target: string;
  port?: number;
  dnsServer?: string;
}
export interface GlobalDiagnosticRow {
  label: string;
  value: string;
  warning?: boolean;
}
export interface GlobalDiagnosticResult {
  kind: GlobalDiagnosticKind;
  success: boolean;
  summary: string;
  rows: GlobalDiagnosticRow[];
  code?: string;
  durationMs: number;
}
export interface BugReportPreview {
  id: string;
  markdown: string;
  fullMarkdown: string;
  truncated: boolean;
}
