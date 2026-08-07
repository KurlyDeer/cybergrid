type ITerminalOptions = import("xterm").ITerminalOptions;
type XtermTerminal = import("xterm").Terminal;
type XtermFitAddon = import("xterm-addon-fit").FitAddon;
type CyberGridApi = import("../shared/ipc").CyberGridApi;
type SshConnectionConfig = import("../shared/ipc").SshConnectionConfig;
type SshConnectionStatus = import("../shared/ipc").SshConnectionStatus;
type SshDataEvent = import("../shared/ipc").SshDataEvent;
type SshStatusEvent = import("../shared/ipc").SshStatusEvent;

declare const Terminal: new (options?: ITerminalOptions) => XtermTerminal;
declare const FitAddon: { FitAddon: new () => XtermFitAddon };

interface Window {
  cybergrid: CyberGridApi;
}

interface TerminalTab {
  id: string;
  sessionId?: string;
  terminal: XtermTerminal;
  fitAddon: XtermFitAddon;
  tabElement: HTMLButtonElement;
  statusElement: HTMLSpanElement;
  paneElement: HTMLDivElement;
  status: SshConnectionStatus | "idle";
}

const tabs = new Map<string, TerminalTab>();
const sessions = new Map<string, TerminalTab>();
const queuedData = new Map<string, string[]>();
const queuedStatus = new Map<string, SshStatusEvent>();
let activeTabId: string | null = null;
let tabSequence = 0;

function elementById<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required element #${id}.`);
  }
  return element as T;
}

const form = elementById<HTMLFormElement>("connection-form");
const hostInput = elementById<HTMLInputElement>("host");
const portInput = elementById<HTMLInputElement>("port");
const usernameInput = elementById<HTMLInputElement>("username");
const passwordInput = elementById<HTMLInputElement>("password");
const tabsElement = elementById<HTMLDivElement>("tabs");
const terminalStack = elementById<HTMLDivElement>("terminal-stack");
const connectionState = elementById<HTMLDivElement>("connection-state");

function createTerminalTab(label: string): TerminalTab {
  const id = `tab-${++tabSequence}`;
  const tabElement = document.createElement("button");
  tabElement.className = "tab";
  tabElement.type = "button";
  tabElement.role = "tab";
  tabElement.setAttribute("aria-selected", "false");

  const statusElement = document.createElement("span");
  statusElement.className = "tab-status";
  statusElement.setAttribute("aria-hidden", "true");

  const labelElement = document.createElement("span");
  labelElement.className = "tab-label";
  labelElement.textContent = label;

  const closeElement = document.createElement("span");
  closeElement.className = "tab-close";
  closeElement.title = "Close tab";
  closeElement.setAttribute("aria-label", `Close ${label}`);
  closeElement.textContent = "×";

  tabElement.append(statusElement, labelElement, closeElement);
  tabsElement.append(tabElement);

  const paneElement = document.createElement("div");
  paneElement.className = "terminal-pane";
  paneElement.id = `pane-${id}`;
  paneElement.role = "tabpanel";
  terminalStack.append(paneElement);

  const terminal = new Terminal({
    cursorBlink: true,
    cursorStyle: "bar",
    fontFamily: "Cascadia Mono, JetBrains Mono, Consolas, monospace",
    fontSize: 14,
    lineHeight: 1.18,
    scrollback: 10_000,
    allowTransparency: true,
    theme: {
      background: "#080d14",
      foreground: "#d7e2ef",
      cursor: "#23d5ab",
      cursorAccent: "#080d14",
      selectionBackground: "#244b55",
      black: "#0a1018",
      red: "#ff6b7a",
      green: "#23d5ab",
      yellow: "#e6c86e",
      blue: "#65a9ff",
      magenta: "#bf8cff",
      cyan: "#5eddeb",
      white: "#d7e2ef",
      brightBlack: "#53657a",
      brightRed: "#ff8995",
      brightGreen: "#56e6c2",
      brightYellow: "#f2d98f",
      brightBlue: "#8abfff",
      brightMagenta: "#d1a9ff",
      brightCyan: "#86e8f2",
      brightWhite: "#f5f9ff",
    },
  });
  const fitAddon = new FitAddon.FitAddon();
  terminal.loadAddon(fitAddon);
  terminal.open(paneElement);

  const tab: TerminalTab = {
    id,
    terminal,
    fitAddon,
    tabElement,
    statusElement,
    paneElement,
    status: "idle",
  };
  tabs.set(id, tab);

  terminal.onData((data) => {
    if (tab.sessionId) {
      window.cybergrid.ssh.write(tab.sessionId, data);
    }
  });
  terminal.onResize(({ cols, rows }) => {
    if (tab.sessionId) {
      window.cybergrid.ssh.resize(tab.sessionId, cols, rows);
    }
  });

  tabElement.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (target.closest(".tab-close")) {
      void closeTab(id);
      return;
    }
    activateTab(id);
  });

  activateTab(id);
  return tab;
}

function activateTab(id: string): void {
  const tab = tabs.get(id);
  if (!tab) {
    return;
  }

  activeTabId = id;
  for (const candidate of tabs.values()) {
    const isActive = candidate.id === id;
    candidate.tabElement.classList.toggle("active", isActive);
    candidate.tabElement.setAttribute("aria-selected", String(isActive));
    candidate.paneElement.classList.toggle("active", isActive);
  }

  updateConnectionState(tab);
  requestAnimationFrame(() => {
    tab.fitAddon.fit();
    tab.terminal.focus();
  });
}

async function closeTab(id: string): Promise<void> {
  const tab = tabs.get(id);
  if (!tab) {
    return;
  }

  const tabOrder = [...tabs.keys()];
  const closedIndex = tabOrder.indexOf(id);
  tabs.delete(id);
  if (tab.sessionId) {
    sessions.delete(tab.sessionId);
    await window.cybergrid.ssh.disconnect(tab.sessionId).catch(() => undefined);
  }

  tab.terminal.dispose();
  tab.tabElement.remove();
  tab.paneElement.remove();

  if (activeTabId === id) {
    const remainingIds = [...tabs.keys()];
    const nextId = remainingIds[Math.min(closedIndex, remainingIds.length - 1)];
    if (nextId) {
      activateTab(nextId);
    } else {
      activeTabId = null;
      connectionState.textContent = "Ready";
    }
  }
}

function updateTabStatus(tab: TerminalTab, event: SshStatusEvent): void {
  tab.status = event.status;
  tab.statusElement.classList.toggle("connected", event.status === "connected");
  tab.statusElement.classList.toggle("error", event.status === "error");
  if (event.status === "error") {
    tab.terminal.writeln(`\r\n\x1b[31mConnection error: ${event.message ?? "Unknown error"}\x1b[0m`);
  } else if (event.status === "disconnected") {
    tab.terminal.writeln(`\r\n\x1b[90m${event.message ?? "Disconnected."}\x1b[0m`);
  }

  if (activeTabId === tab.id) {
    updateConnectionState(tab, event.message);
  }
}

function updateConnectionState(tab: TerminalTab, message?: string): void {
  const labels: Record<TerminalTab["status"], string> = {
    idle: "Ready",
    connecting: "Connecting…",
    connected: "Connected",
    disconnected: "Disconnected",
    error: "Connection error",
  };
  connectionState.textContent = message ?? labels[tab.status];
}

function attachSession(tab: TerminalTab, sessionId: string): void {
  tab.sessionId = sessionId;
  sessions.set(sessionId, tab);

  const buffered = queuedData.get(sessionId);
  if (buffered) {
    for (const data of buffered) {
      tab.terminal.write(data);
    }
    queuedData.delete(sessionId);
  }

  const status = queuedStatus.get(sessionId);
  if (status) {
    updateTabStatus(tab, status);
    queuedStatus.delete(sessionId);
  }
}

function handleSshData(event: SshDataEvent): void {
  const tab = sessions.get(event.sessionId);
  if (tab) {
    tab.terminal.write(event.data);
    return;
  }

  const buffered = queuedData.get(event.sessionId) ?? [];
  if (buffered.reduce((size, chunk) => size + chunk.length, 0) < 1_000_000) {
    buffered.push(event.data);
    queuedData.set(event.sessionId, buffered);
  }
}

function handleSshStatus(event: SshStatusEvent): void {
  const tab = sessions.get(event.sessionId);
  if (tab) {
    updateTabStatus(tab, event);
  } else {
    queuedStatus.set(event.sessionId, event);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const config: SshConnectionConfig = {
    host: hostInput.value.trim(),
    port: Number(portInput.value),
    username: usernameInput.value.trim(),
    password: passwordInput.value || undefined,
  };
  const tab = createTerminalTab(config.host);
  tab.status = "connecting";
  updateConnectionState(tab);
  tab.terminal.writeln(`\x1b[36mCyberGrid\x1b[0m connecting to ${config.username}@${config.host}:${config.port}...`);

  try {
    const sessionId = await window.cybergrid.ssh.connect(config);
    attachSession(tab, sessionId);
    tab.fitAddon.fit();
    window.cybergrid.ssh.resize(sessionId, tab.terminal.cols, tab.terminal.rows);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    updateTabStatus(tab, {
      sessionId: tab.sessionId ?? "pending",
      status: "error",
      message,
    });
  } finally {
    passwordInput.value = "";
  }
});

document.querySelectorAll<HTMLButtonElement>(".server-item").forEach((button) => {
  button.addEventListener("click", () => {
    hostInput.value = button.dataset.host ?? "";
    usernameInput.value = button.dataset.user ?? "";
    passwordInput.focus();
  });
});

window.cybergrid.ssh.onData(handleSshData);
window.cybergrid.ssh.onStatus(handleSshStatus);

const resizeObserver = new ResizeObserver(() => {
  if (activeTabId) {
    const tab = tabs.get(activeTabId);
    tab?.fitAddon.fit();
  }
});
resizeObserver.observe(terminalStack);

const welcomeTab = createTerminalTab("Welcome");
welcomeTab.terminal.writeln("\x1b[36mCyberGrid\x1b[0m");
welcomeTab.terminal.writeln("Fast SSH sessions in a secure, tabbed workspace.\r\n");
welcomeTab.terminal.writeln("Choose a saved server or enter connection details above to begin.");
