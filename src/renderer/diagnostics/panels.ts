import type { CyberGridApi } from "../../shared/ipc";
import type { BugReportPreview, GlobalDiagnosticKind } from "../../shared/diagnostics";

const help = (id: string, what: string, when: string, why: string): string => `<span class="tool-help"><button type="button" aria-label="About this tool" aria-describedby="${id}">?</button><span class="tool-tooltip" id="${id}" role="tooltip" popover="manual"><strong>What it does</strong>${what}<strong>When to use it</strong>${when}<strong>Why it helps</strong>${why}</span></span>`;
const output = (kind: string): string => `<div class="tool-status" data-status="${kind}" role="status" aria-live="polite">Ready. Nothing runs until you choose Run.</div><table class="diagnostic-table" aria-label="${kind.toUpperCase()} results" hidden><thead><tr><th scope="col">Field / record</th><th scope="col">Result</th></tr></thead><tbody data-output="${kind}"></tbody></table>`;
const target = (kind: string): string => `<label for="diag-${kind}-target">Hostname / IP</label><input id="diag-${kind}-target" name="target" placeholder="server.example.com" maxlength="253" required autocomplete="off" spellcheck="false" />`;
const port = (kind: string): string => `<div><label for="diag-${kind}-port">Port</label><input id="diag-${kind}-port" name="port" type="number" min="1" max="65535" step="1" value="443" required /></div>`;
function dialog(id: string, html: string, visibility: () => void): HTMLDialogElement {
  const element = document.createElement("dialog");
  element.id = id;
  element.className = "diagnostics-dialog";
  element.setAttribute("aria-labelledby", `${id}-title`);
  element.innerHTML = html;
  document.body.append(element);
  element.querySelector<HTMLButtonElement>("[data-close]")!.addEventListener("click", () => element.close());
  element.addEventListener("click", event => {
    const bounds = element.getBoundingClientRect();
    if (event.target === element && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) element.close();
  });
  element.addEventListener("close", visibility);
  return element;
}
const message = (error: unknown): string => error instanceof Error ? error.message : String(error);

export function createDiagnosticsPanels(api: CyberGridApi, visibility: () => void): { openDiagnostics(): void; openBugReport(): void } {
  const modal = dialog("global-diagnostics", `
    <header class="diagnostics-heading"><div><span class="diagnostics-eyebrow">SYSTEM UTILITIES</span><h2 id="global-diagnostics-title">Global Diagnostics</h2><p>Native, on-demand tools. Run only against systems you are authorized to test.</p></div><button type="button" data-close aria-label="Close diagnostics">Close</button></header>
    <div class="diagnostics-layout"><nav class="diagnostics-tabs" role="tablist" aria-label="Diagnostic categories" aria-orientation="vertical">
      <button type="button" role="tab" id="diag-tab-network" aria-controls="diag-panel-network" aria-selected="true" data-diag-tab="network">Network<span>TCP &amp; DNS</span></button>
      <button type="button" role="tab" id="diag-tab-security" aria-controls="diag-panel-security" aria-selected="false" tabindex="-1" data-diag-tab="security">Security<span>SSL / TLS</span></button>
      <button type="button" role="tab" id="diag-tab-hardware" aria-controls="diag-panel-hardware" aria-selected="false" tabindex="-1" data-diag-tab="hardware">Hardware<span>MAC / OUI</span></button>
    </nav><div class="diagnostics-body">
      <section role="tabpanel" id="diag-panel-network" aria-labelledby="diag-tab-network" data-diag-panel="network">
        <form data-tool="tcp" class="diagnostic-tool"><h3>TCP Port Bouncer ${help("tcp-help", "Opens one TCP connection, times the handshake, then closes it. It does not forward traffic.", "Check whether an administration service accepts connections on a custom port.", "Distinguishes refusal from timeout without launching external programs.")}</h3><div class="diagnostic-inputs"><div>${target("tcp")}</div>${port("tcp")}</div><button type="submit" class="primary-button">Run TCP Check</button>${output("tcp")}</form>
        <form data-tool="dns" class="diagnostic-tool"><h3>Native DNS Query ${help("dns-help", "Asks the selected DNS resolver for ANY records, bypassing OS name resolution.", "Compare a DNS server's view while diagnosing stale or missing records.", "Shows returned records directly. ANY may be restricted; upstream DNS caches still apply.")}</h3><div class="diagnostic-inputs"><div>${target("dns")}</div><div><label for="diag-dns-server">DNS server IP (optional)</label><input id="diag-dns-server" name="dnsServer" placeholder="System DNS servers" maxlength="45" autocomplete="off" spellcheck="false" /></div></div><button type="submit" class="primary-button">Query DNS</button>${output("dns")}</form>
      </section>
      <section role="tabpanel" id="diag-panel-security" aria-labelledby="diag-tab-security" data-diag-panel="security" hidden>
        <form data-tool="tls" class="diagnostic-tool"><h3>SSL / TLS Inspector ${help("tls-help", "Retrieves the peer certificate and reports identity, validity, SANs, and trust errors.", "Inspect appliance self-signed certificates or certificates nearing expiration.", "Highlights expiry within 30 days. Untrusted certificates are inspected, not trusted globally; no credentials are sent.")}</h3><div class="diagnostic-inputs"><div>${target("tls")}</div>${port("tls")}</div><button type="submit" class="primary-button">Inspect Certificate</button>${output("tls")}</form>
      </section>
      <section role="tabpanel" id="diag-panel-hardware" aria-labelledby="diag-tab-hardware" data-diag-panel="hardware" hidden>
        <form data-tool="mac" class="diagnostic-tool"><h3>MAC OUI Lookup ${help("mac-help", "Matches a MAC prefix against a small offline Cisco, Dell, HP, and Apple dictionary.", "Identify a likely vendor while reviewing switch ARP or MAC tables.", "Requires no network request. Randomized, spoofed, and unknown MACs cannot reliably identify a manufacturer.")}</h3><label for="diag-mac-target">MAC address</label><input id="diag-mac-target" name="target" placeholder="00:00:0C:12:34:56" maxlength="17" autocomplete="off" spellcheck="false" required /><button type="submit" class="primary-button">Look Up Vendor</button>${output("mac")}</form>
      </section>
    </div></div><footer class="diagnostics-footer"><span id="diag-operation-status" role="status">No background scans. Results stay in this window.</span><button type="button" id="diag-cancel" disabled>Cancel Running Check</button></footer>`, visibility);
  let busy = false;
  let generation = 0;
  const cancelButton = modal.querySelector<HTMLButtonElement>("#diag-cancel")!;
  const state = modal.querySelector<HTMLElement>("#diag-operation-status")!;
  const tabButtons = [...modal.querySelectorAll<HTMLButtonElement>("[data-diag-tab]")];
  const hideHelp = (): void => { for (const tip of modal.querySelectorAll<HTMLElement>(".tool-tooltip")) tip.hidePopover(); };
  for (const wrapper of modal.querySelectorAll<HTMLElement>(".tool-help")) {
    const button = wrapper.querySelector<HTMLButtonElement>("button")!;
    const tip = wrapper.querySelector<HTMLElement>(".tool-tooltip")!;
    const show = (): void => {
      tip.showPopover();
      const anchor = button.getBoundingClientRect();
      tip.style.left = `${Math.max(12, Math.min(anchor.left, innerWidth - tip.offsetWidth - 12))}px`;
      tip.style.top = `${Math.max(12, Math.min(anchor.bottom + 6, innerHeight - tip.offsetHeight - 12))}px`;
    };
    wrapper.addEventListener("mouseenter", show);
    wrapper.addEventListener("mouseleave", () => { if (!wrapper.contains(document.activeElement)) tip.hidePopover(); });
    wrapper.addEventListener("focusin", show);
    wrapper.addEventListener("focusout", event => { if (!wrapper.contains(event.relatedTarget as Node | null)) tip.hidePopover(); });
    button.addEventListener("click", show);
    wrapper.addEventListener("keydown", event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); tip.hidePopover(); } });
  }
  modal.querySelector(".diagnostics-body")!.addEventListener("scroll", hideHelp);
  window.addEventListener("resize", hideHelp);
  modal.addEventListener("close", hideHelp);
  const select = (button: HTMLButtonElement): void => {
    hideHelp();
    for (const candidate of tabButtons) { const active = candidate === button; candidate.setAttribute("aria-selected", String(active)); candidate.tabIndex = active ? 0 : -1; }
    for (const panel of modal.querySelectorAll<HTMLElement>("[data-diag-panel]")) panel.hidden = panel.dataset.diagPanel !== button.dataset.diagTab;
  };
  for (const [index, button] of tabButtons.entries()) {
    button.addEventListener("click", () => select(button));
    button.addEventListener("keydown", event => {
      const next = event.key === "ArrowDown" ? (index + 1) % 3 : event.key === "ArrowUp" ? (index + 2) % 3 : event.key === "Home" ? 0 : event.key === "End" ? 2 : undefined;
      if (next === undefined) return;
      event.preventDefault(); select(tabButtons[next]); tabButtons[next].focus();
    });
  }
  const cancel = (): void => { if (busy) void api.diagnostics.cancel().catch(error => { state.textContent = message(error); }); };
  cancelButton.addEventListener("click", cancel);
  modal.addEventListener("close", () => { generation++; cancel(); });
  for (const form of modal.querySelectorAll<HTMLFormElement>("form[data-tool]")) {
    form.addEventListener("submit", async event => {
      event.preventDefault();
      if (busy) return;
      const kind = form.dataset.tool as GlobalDiagnosticKind;
      const fields = new FormData(form);
      const status = form.querySelector<HTMLElement>(".tool-status")!;
      const tbody = form.querySelector<HTMLTableSectionElement>("tbody")!;
      const table = form.querySelector<HTMLTableElement>("table")!;
      const epoch = generation;
      busy = true; cancelButton.disabled = false;
      for (const button of modal.querySelectorAll<HTMLButtonElement>('button[type="submit"]')) button.disabled = true;
      status.textContent = "Running…"; status.classList.remove("tool-error"); tbody.replaceChildren(); table.hidden = true;
      state.textContent = "Check in progress (maximum 5 seconds).";
      try {
        const result = await api.diagnostics.global({ kind, target: String(fields.get("target") ?? "").trim(), port: fields.has("port") ? Number(fields.get("port")) : undefined, dnsServer: fields.has("dnsServer") ? String(fields.get("dnsServer")).trim() : undefined });
        if (epoch !== generation) return;
        status.textContent = `${result.summary} · ${result.durationMs} ms`;
        status.classList.toggle("tool-error", !result.success);
        for (const row of result.rows) {
          const tr = document.createElement("tr");
          if (row.warning) tr.className = "diagnostic-warning";
          const th = document.createElement("th"); th.scope = "row"; th.textContent = row.label;
          const td = document.createElement("td"); td.textContent = row.value;
          tr.append(th, td); tbody.append(tr);
        }
        table.hidden = !result.rows.length;
      } catch (error) { if (epoch === generation) { status.textContent = message(error); status.classList.add("tool-error"); } }
      finally {
        busy = false; cancelButton.disabled = true; state.textContent = "Ready. No background scans.";
        for (const button of modal.querySelectorAll<HTMLButtonElement>('button[type="submit"]')) button.disabled = false;
      }
    });
  }

  const report = dialog("bug-report", `
    <header class="diagnostics-heading"><div><span class="diagnostics-eyebrow">COMMUNITY SUPPORT</span><h2 id="bug-report-title">Report an Issue</h2></div><button type="button" data-close aria-label="Close bug report">Close</button></header>
    <div class="bug-report-body"><p>No automatic telemetry is sent. This tool prepares a <strong>public GitHub issue draft</strong> with your app version, OS, memory usage, and up to 50 recent main-process error lines.</p>
    <label for="bug-description">What happened? (optional)</label><textarea id="bug-description" rows="3" maxlength="2000" placeholder="Describe the problem and how to reproduce it. Do not include passwords or confidential data."></textarea>
    <p class="report-privacy">Review the exact outgoing preview below. Likely secrets, IPs, and user paths are redacted, but filtering is not guaranteed. Send Report shares this preview with GitHub through a browser URL (which may be retained in browser history). You must submit the issue on GitHub yourself.</p>
    <h3>Outgoing GitHub draft</h3><pre id="bug-preview" tabindex="0" aria-label="Outgoing report preview">Preparing local preview…</pre><p id="bug-report-status" role="status" aria-live="polite"></p></div>
    <footer class="diagnostics-footer"><button type="button" id="bug-refresh">Refresh Preview</button><button type="button" id="bug-copy" disabled>Copy Full Report</button><button type="button" id="bug-send" class="primary-button" disabled>Send Report</button></footer>`, visibility);
  const description = report.querySelector<HTMLTextAreaElement>("#bug-description")!;
  const preview = report.querySelector<HTMLElement>("#bug-preview")!;
  const reportStatus = report.querySelector<HTMLElement>("#bug-report-status")!;
  const send = report.querySelector<HTMLButtonElement>("#bug-send")!;
  const copy = report.querySelector<HTMLButtonElement>("#bug-copy")!;
  let snapshot: BugReportPreview | undefined;
  let previewEpoch = 0;
  let previewTimer: ReturnType<typeof setTimeout> | undefined;
  const refresh = async (): Promise<void> => {
    clearTimeout(previewTimer);
    const epoch = ++previewEpoch; snapshot = undefined; send.disabled = true; copy.disabled = true;
    preview.textContent = "Preparing local preview…"; reportStatus.textContent = "";
    try {
      const result = await api.system.previewBugReport(description.value);
      if (epoch !== previewEpoch || !report.open) return;
      snapshot = result; preview.textContent = result.markdown;
      reportStatus.textContent = result.truncated ? "Excerpt shortened for the Windows URL limit. Copy Full Report to attach the complete redacted report after reviewing it." : "Ready for review. Nothing has been sent.";
      send.disabled = false; copy.disabled = false;
    } catch (error) { if (epoch === previewEpoch) { preview.textContent = ""; reportStatus.textContent = message(error); } }
  };
  description.addEventListener("input", () => { ++previewEpoch; snapshot = undefined; send.disabled = true; copy.disabled = true; clearTimeout(previewTimer); previewTimer = setTimeout(() => void refresh(), 300); });
  report.querySelector("#bug-refresh")!.addEventListener("click", () => void refresh());
  report.addEventListener("close", () => { ++previewEpoch; clearTimeout(previewTimer); snapshot = undefined; preview.textContent = ""; description.value = ""; });
  copy.addEventListener("click", () => {
    if (snapshot) void navigator.clipboard.writeText(snapshot.fullMarkdown).then(() => { reportStatus.textContent = "Full redacted report copied. Review it before posting; clipboard data may be retained by your system."; }).catch(error => { reportStatus.textContent = message(error); });
  });
  send.addEventListener("click", async () => {
    if (!snapshot) return;
    send.disabled = true;
    try { await api.system.sendBugReport(snapshot.id); reportStatus.textContent = "GitHub draft opened in your browser. Review and submit it there."; }
    catch (error) { reportStatus.textContent = `${message(error)} Use Refresh Preview to try again.`; }
  });
  return {
    openDiagnostics: () => { if (!modal.open) modal.showModal(); visibility(); tabButtons.find(button => button.tabIndex === 0)?.focus(); },
    openBugReport: () => { if (!report.open) report.showModal(); visibility(); description.focus(); void refresh(); },
  };
}
