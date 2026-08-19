import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { WebglAddon } from "xterm-addon-webgl";
import type {
  CyberGridApi,
  DetachedSessionDescriptor,
  LocalTerminalDataEvent,
  LocalTerminalStatusEvent,
  RdpStatusEvent,
  SerialDataEvent,
  SerialStatusEvent,
  SshDataEvent,
  SshStatusEvent,
  StreamDataEvent,
  StreamStatusEvent,
} from "../shared/ipc";

declare global { interface Window { cybergrid: CyberGridApi } }

const terminalHost = document.getElementById("terminal") as HTMLDivElement;
const rdpHost = document.getElementById("rdp") as HTMLDivElement;
const title = document.getElementById("title") as HTMLSpanElement;
const protocol = document.getElementById("protocol") as HTMLSpanElement;
const status = document.getElementById("status") as HTMLSpanElement;
const closeButton = document.getElementById("close") as HTMLButtonElement;
const terminal = new Terminal({
  cursorBlink: true,
  cursorStyle: "bar",
  fontFamily: "Cascadia Mono, JetBrains Mono, Consolas, monospace",
  fontSize: 14,
  lineHeight: 1.18,
  scrollback: 10_000,
  allowTransparency: true,
  theme: { background: "#080d14", foreground: "#d7e2ef", cursor: "#23d5ab" },
});
const fitAddon = new FitAddon();
terminal.loadAddon(fitAddon);
terminal.open(terminalHost);
try {
  const webglAddon = new WebglAddon();
  terminal.loadAddon(webglAddon);
  webglAddon.onContextLoss(() => webglAddon.dispose());
} catch {
  // The canvas renderer is the safe fallback for blocked or unavailable WebGL.
}

let descriptor: DetachedSessionDescriptor | undefined;
const bufferedData: string[] = [];

function handleData(event: SshDataEvent | StreamDataEvent | SerialDataEvent | LocalTerminalDataEvent): void {
  if (descriptor?.sessionId === event.sessionId) terminal.write(event.data);
  else if (!descriptor && bufferedData.join("").length < 1_000_000) bufferedData.push(event.data);
}

function handleStatus(event: SshStatusEvent | StreamStatusEvent | SerialStatusEvent | LocalTerminalStatusEvent | RdpStatusEvent): void {
  if (descriptor?.sessionId !== event.sessionId) return;
  status.textContent = event.message || event.status;
}

function updateRdpBounds(): void {
  if (!descriptor || descriptor.protocol !== "rdp") return;
  const rect = rdpHost.getBoundingClientRect();
  window.cybergrid.rdp.setBounds(descriptor.sessionId, {
    x: rect.left, y: rect.top, width: rect.width, height: rect.height,
  });
  window.cybergrid.rdp.setVisible(descriptor.sessionId, true);
}

window.cybergrid.ssh.onData(handleData);
window.cybergrid.ssh.onStatus(handleStatus);
window.cybergrid.stream.onData(handleData);
window.cybergrid.stream.onStatus(handleStatus);
window.cybergrid.serial.onData(handleData);
window.cybergrid.serial.onStatus(handleStatus);
window.cybergrid.local.onData(handleData);
window.cybergrid.local.onStatus(handleStatus);
window.cybergrid.rdp.onStatus(handleStatus);
window.cybergrid.system.onDetachedSession((session) => {
  descriptor = session;
  document.title = `${session.label} — CyberGrid`;
  title.textContent = session.label;
  protocol.textContent = session.protocol.toUpperCase();
  status.textContent = "Connected";
  document.body.classList.toggle("rdp", session.protocol === "rdp");
  for (const chunk of bufferedData.splice(0)) terminal.write(chunk);
  requestAnimationFrame(() => {
    if (session.protocol === "rdp") updateRdpBounds();
    else {
      fitAddon.fit();
      terminal.focus();
      if (session.protocol === "ssh") window.cybergrid.ssh.resize(session.sessionId, terminal.cols, terminal.rows);
      if (session.protocol === "local") window.cybergrid.local.resize(session.sessionId, terminal.cols, terminal.rows);
    }
  });
});

terminal.onData((data) => {
  if (!descriptor) return;
  switch (descriptor.protocol) {
    case "ssh": window.cybergrid.ssh.write(descriptor.sessionId, data); break;
    case "telnet":
    case "raw": window.cybergrid.stream.write(descriptor.sessionId, data); break;
    case "serial": window.cybergrid.serial.write(descriptor.sessionId, data); break;
    case "local": window.cybergrid.local.write(descriptor.sessionId, data); break;
    case "rdp": break;
  }
});

terminal.onResize(({ cols, rows }) => {
  if (descriptor?.protocol === "ssh") window.cybergrid.ssh.resize(descriptor.sessionId, cols, rows);
  if (descriptor?.protocol === "local") window.cybergrid.local.resize(descriptor.sessionId, cols, rows);
});

const resizeObserver = new ResizeObserver(() => {
  if (descriptor?.protocol === "rdp") updateRdpBounds();
  else fitAddon.fit();
});
resizeObserver.observe(document.body);
closeButton.addEventListener("click", () => window.close());
