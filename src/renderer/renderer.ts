type ITerminalOptions = import("xterm").ITerminalOptions;
type ITheme = import("xterm").ITheme;
type XtermTerminal = import("xterm").Terminal;
type XtermFitAddon = import("xterm-addon-fit").FitAddon;
type CyberGridApi = import("../shared/ipc").CyberGridApi;
type AssetInput = import("../shared/ipc").AssetInput;
type AssetRecord = import("../shared/ipc").AssetRecord;
type DeviceIcon = import("../shared/ipc").DeviceIcon;
type DiscoveredDevice = import("../shared/ipc").DiscoveredDevice;
type DiscoveryCompleteEvent = import("../shared/ipc").DiscoveryCompleteEvent;
type DiscoveryProgressEvent = import("../shared/ipc").DiscoveryProgressEvent;
type DiscoveryResultEvent = import("../shared/ipc").DiscoveryResultEvent;
type RdpConnectionConfig = import("../shared/ipc").RdpConnectionConfig;
type RdpConnectionStatus = import("../shared/ipc").RdpConnectionStatus;
type RdpStatusEvent = import("../shared/ipc").RdpStatusEvent;
type ServerAuthType = import("../shared/ipc").ServerAuthType;
type ServerProfileInput = import("../shared/ipc").ServerProfileInput;
type ServerProfileSummary = import("../shared/ipc").ServerProfileSummary;
type SftpDirectoryListing = import("../shared/ipc").SftpDirectoryListing;
type SftpEntry = import("../shared/ipc").SftpEntry;
type SftpProgressEvent = import("../shared/ipc").SftpProgressEvent;
type SshConnectionConfig = import("../shared/ipc").SshConnectionConfig;
type SshConnectionStatus = import("../shared/ipc").SshConnectionStatus;
type SshDataEvent = import("../shared/ipc").SshDataEvent;
type SshStatusEvent = import("../shared/ipc").SshStatusEvent;

declare const Terminal: new (options?: ITerminalOptions) => XtermTerminal;
declare const FitAddon: { FitAddon: new () => XtermFitAddon };

interface Window {
  cybergrid: CyberGridApi;
}

type WorkspaceTabKind = "ssh" | "rdp" | "welcome";
type WorkspaceStatus =
  | SshConnectionStatus
  | RdpConnectionStatus
  | "idle";

interface WorkspaceTab {
  id: string;
  kind: WorkspaceTabKind;
  sessionId?: string;
  rdpSessionId?: string;
  terminal?: XtermTerminal;
  fitAddon?: XtermFitAddon;
  tabElement: HTMLButtonElement;
  statusElement: HTMLSpanElement;
  paneElement: HTMLDivElement;
  rdpMessageElement?: HTMLParagraphElement;
  status: WorkspaceStatus;
  sftp?: SftpDirectoryListing;
}

interface UserSettings {
  theme: "dark" | "monochrome" | "custom";
  fontFamily: string;
  fontSize: number;
  cursorBlink: boolean;
  background: string;
  foreground: string;
  cursor: string;
  accent: string;
}

const DEFAULT_SETTINGS: UserSettings = {
  theme: "dark",
  fontFamily: "Cascadia Mono, JetBrains Mono, Consolas, monospace",
  fontSize: 14,
  cursorBlink: true,
  background: "#080d14",
  foreground: "#d7e2ef",
  cursor: "#23d5ab",
  accent: "#23d5ab",
};
const SETTINGS_KEY = "cybergrid:terminal-settings:v1";

const tabs = new Map<string, WorkspaceTab>();
const sshSessions = new Map<string, WorkspaceTab>();
const rdpSessions = new Map<string, WorkspaceTab>();
const queuedSshData = new Map<string, string[]>();
const queuedSshStatus = new Map<string, SshStatusEvent>();
const queuedRdpStatus = new Map<string, RdpStatusEvent>();
const collapsedGroups = new Set<string>();
let savedProfiles: ServerProfileSummary[] = [];
let savedAssets: AssetRecord[] = [];
let activeScanId: string | null = null;
let editingAssetId: string | null = null;
const scanDevices = new Map<string, DiscoveredDevice>();
let activeTabId: string | null = null;
let tabSequence = 0;
let vaultMode: "create" | "unlock" = "unlock";
let sftpDrawerOpen = false;
let currentSettings = loadSettings();

function elementById<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required element #${id}.`);
  }
  return element as T;
}

const appShell = elementById<HTMLElement>("app-shell");
const quickConnectForm = elementById<HTMLFormElement>("quick-connect-form");
const quickConnectInput = elementById<HTMLInputElement>("quick-connect-uri");
const quickPasswordInput = elementById<HTMLInputElement>("quick-connect-password");
const tabsElement = elementById<HTMLDivElement>("tabs");
const contentArea = elementById<HTMLDivElement>("content-area");
const terminalStack = elementById<HTMLDivElement>("terminal-stack");
const connectionState = elementById<HTMLDivElement>("connection-state");
const profileTree = elementById<HTMLDivElement>("profile-tree");
const assetList = elementById<HTMLDivElement>("asset-list");
const assetCount = elementById<HTMLSpanElement>("asset-count");
const scanButton = elementById<HTMLButtonElement>("scan-button");
const addServerButton = elementById<HTMLButtonElement>("add-server-button");
const lockButton = elementById<HTMLButtonElement>("lock-button");
const settingsButton = elementById<HTMLButtonElement>("settings-button");
const toggleSftpButton = elementById<HTMLButtonElement>("toggle-sftp-button");

const sftpDrawer = elementById<HTMLElement>("sftp-drawer");
const sftpCloseButton = elementById<HTMLButtonElement>("sftp-close-button");
const sftpPathForm = elementById<HTMLFormElement>("sftp-path-form");
const sftpPathInput = elementById<HTMLInputElement>("sftp-path");
const sftpUpButton = elementById<HTMLButtonElement>("sftp-up-button");
const sftpRefreshButton = elementById<HTMLButtonElement>("sftp-refresh-button");
const sftpUploadButton = elementById<HTMLButtonElement>("sftp-upload-button");
const sftpListing = elementById<HTMLDivElement>("sftp-listing");
const sftpStatus = elementById<HTMLDivElement>("sftp-status");
const sftpProgress = elementById<HTMLProgressElement>("sftp-progress");

const vaultOverlay = elementById<HTMLDivElement>("vault-overlay");
const vaultForm = elementById<HTMLFormElement>("vault-form");
const vaultTitle = elementById<HTMLHeadingElement>("vault-title");
const vaultSubtitle = elementById<HTMLParagraphElement>("vault-subtitle");
const masterPasswordInput = elementById<HTMLInputElement>("master-password");
const confirmPasswordField = elementById<HTMLDivElement>("confirm-password-field");
const confirmPasswordInput = elementById<HTMLInputElement>("master-password-confirm");
const vaultError = elementById<HTMLDivElement>("vault-error");
const vaultSubmit = elementById<HTMLButtonElement>("vault-submit");

const serverModal = elementById<HTMLDialogElement>("server-modal");
const serverForm = elementById<HTMLFormElement>("server-form");
const serverNameInput = elementById<HTMLInputElement>("server-name");
const serverHostInput = elementById<HTMLInputElement>("server-host");
const serverPortInput = elementById<HTMLInputElement>("server-port");
const serverUsernameInput = elementById<HTMLInputElement>("server-username");
const serverGroupInput = elementById<HTMLInputElement>("server-group");
const groupOptions = elementById<HTMLDataListElement>("group-options");
const authTypeInput = elementById<HTMLSelectElement>("auth-type");
const serverPasswordSection = elementById<HTMLDivElement>("server-password-section");
const serverPasswordInput = elementById<HTMLInputElement>("server-password");
const serverKeySection = elementById<HTMLDivElement>("server-key-section");
const serverKeyPathInput = elementById<HTMLInputElement>("server-key-path");
const serverPassphraseInput = elementById<HTMLInputElement>("server-passphrase");
const browseKeyButton = elementById<HTMLButtonElement>("browse-key-button");
const cancelServerButton = elementById<HTMLButtonElement>("cancel-server-button");
const serverFormError = elementById<HTMLDivElement>("server-form-error");

const scanModal = elementById<HTMLDialogElement>("scan-modal");
const scanForm = elementById<HTMLFormElement>("scan-form");
const scanTargetInput = elementById<HTMLInputElement>("scan-target");
const scanStartButton = elementById<HTMLButtonElement>("scan-start-button");
const scanCancelButton = elementById<HTMLButtonElement>("scan-cancel-button");
const scanCloseButton = elementById<HTMLButtonElement>("scan-close-button");
const scanProgress = elementById<HTMLProgressElement>("scan-progress");
const scanStatus = elementById<HTMLSpanElement>("scan-status");
const scanResults = elementById<HTMLDivElement>("scan-results");
const scanError = elementById<HTMLDivElement>("scan-error");

const assetModal = elementById<HTMLDialogElement>("asset-modal");
const assetForm = elementById<HTMLFormElement>("asset-form");
const assetFingerprint = elementById<HTMLDivElement>("asset-fingerprint");
const assetNameInput = elementById<HTMLInputElement>("asset-name");
const assetIconInput = elementById<HTMLSelectElement>("asset-icon");
const assetSerialInput = elementById<HTMLInputElement>("asset-serial");
const assetTagInput = elementById<HTMLInputElement>("asset-tag");
const assetRackInput = elementById<HTMLInputElement>("asset-rack");
const assetSiteInput = elementById<HTMLInputElement>("asset-site");
const assetOsVersionInput = elementById<HTMLInputElement>("asset-os-version");
const assetSlaInput = elementById<HTMLInputElement>("asset-sla");
const assetFormError = elementById<HTMLDivElement>("asset-form-error");
const deleteAssetButton = elementById<HTMLButtonElement>("delete-asset-button");
const cancelAssetButton = elementById<HTMLButtonElement>("cancel-asset-button");

const settingsModal = elementById<HTMLDialogElement>("settings-modal");
const settingsForm = elementById<HTMLFormElement>("settings-form");
const themeInput = elementById<HTMLSelectElement>("theme-mode");
const fontFamilyInput = elementById<HTMLInputElement>("terminal-font-family");
const fontSizeInput = elementById<HTMLInputElement>("terminal-font-size");
const cursorBlinkInput = elementById<HTMLInputElement>("terminal-cursor-blink");
const backgroundInput = elementById<HTMLInputElement>("terminal-background");
const foregroundInput = elementById<HTMLInputElement>("terminal-foreground");
const cursorInput = elementById<HTMLInputElement>("terminal-cursor");
const accentInput = elementById<HTMLInputElement>("ui-accent");
const customPaletteFields = elementById<HTMLDivElement>("custom-palette-fields");
const resetSettingsButton = elementById<HTMLButtonElement>("reset-settings-button");
const cancelSettingsButton = elementById<HTMLButtonElement>("cancel-settings-button");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

function loadSettings(): UserSettings {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null") as unknown;
    if (!isRecord(parsed)) {
      return { ...DEFAULT_SETTINGS };
    }
    const theme = parsed.theme === "monochrome" || parsed.theme === "custom"
      ? parsed.theme
      : "dark";
    const fontSize = Number(parsed.fontSize);
    return {
      theme,
      fontFamily:
        typeof parsed.fontFamily === "string" && parsed.fontFamily.trim().length > 0
          ? parsed.fontFamily.slice(0, 200)
          : DEFAULT_SETTINGS.fontFamily,
      fontSize:
        Number.isFinite(fontSize) && fontSize >= 10 && fontSize <= 28
          ? Math.round(fontSize)
          : DEFAULT_SETTINGS.fontSize,
      cursorBlink:
        typeof parsed.cursorBlink === "boolean"
          ? parsed.cursorBlink
          : DEFAULT_SETTINGS.cursorBlink,
      background: isHexColor(parsed.background) ? parsed.background : DEFAULT_SETTINGS.background,
      foreground: isHexColor(parsed.foreground) ? parsed.foreground : DEFAULT_SETTINGS.foreground,
      cursor: isHexColor(parsed.cursor) ? parsed.cursor : DEFAULT_SETTINGS.cursor,
      accent: isHexColor(parsed.accent) ? parsed.accent : DEFAULT_SETTINGS.accent,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function terminalTheme(settings: UserSettings): ITheme {
  if (settings.theme === "monochrome") {
    return {
      background: "#000000",
      foreground: "#ffffff",
      cursor: "#ffffff",
      cursorAccent: "#000000",
      selectionBackground: "#ffffff55",
      black: "#000000",
      red: "#ffffff",
      green: "#ffffff",
      yellow: "#ffffff",
      blue: "#ffffff",
      magenta: "#ffffff",
      cyan: "#ffffff",
      white: "#ffffff",
      brightBlack: "#808080",
      brightRed: "#ffffff",
      brightGreen: "#ffffff",
      brightYellow: "#ffffff",
      brightBlue: "#ffffff",
      brightMagenta: "#ffffff",
      brightCyan: "#ffffff",
      brightWhite: "#ffffff",
    };
  }

  const background = settings.theme === "custom" ? settings.background : DEFAULT_SETTINGS.background;
  const foreground = settings.theme === "custom" ? settings.foreground : DEFAULT_SETTINGS.foreground;
  const cursor = settings.theme === "custom" ? settings.cursor : DEFAULT_SETTINGS.cursor;
  return {
    background,
    foreground,
    cursor,
    cursorAccent: background,
    selectionBackground: "#244b55",
    black: "#0a1018",
    red: "#ff6b7a",
    green: "#23d5ab",
    yellow: "#e6c86e",
    blue: "#65a9ff",
    magenta: "#bf8cff",
    cyan: "#5eddeb",
    white: foreground,
    brightBlack: "#53657a",
    brightRed: "#ff8995",
    brightGreen: "#56e6c2",
    brightYellow: "#f2d98f",
    brightBlue: "#8abfff",
    brightMagenta: "#d1a9ff",
    brightCyan: "#86e8f2",
    brightWhite: "#f5f9ff",
  };
}

function applySettings(settings: UserSettings, persist: boolean): void {
  currentSettings = settings;
  document.documentElement.dataset.theme = settings.theme;
  document.documentElement.style.setProperty(
    "--accent",
    settings.theme === "custom" ? settings.accent : DEFAULT_SETTINGS.accent,
  );
  for (const tab of tabs.values()) {
    if (tab.terminal) {
      tab.terminal.options.fontFamily = settings.fontFamily;
      tab.terminal.options.fontSize = settings.fontSize;
      tab.terminal.options.cursorBlink = settings.cursorBlink;
      tab.terminal.options.theme = terminalTheme(settings);
      tab.fitAddon?.fit();
    }
  }
  if (persist) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }
}

function errorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw
    .replace(/^Error invoking remote method '[^']+':\s*/i, "")
    .replace(/^Error:\s*/i, "");
}

function createWorkspaceTab(kind: WorkspaceTabKind, label: string): WorkspaceTab {
  const id = `tab-${++tabSequence}`;
  const tabElement = document.createElement("button");
  tabElement.className = "tab";
  tabElement.type = "button";
  tabElement.role = "tab";
  tabElement.setAttribute("aria-selected", "false");

  const statusElement = document.createElement("span");
  statusElement.className = "tab-status";
  statusElement.setAttribute("aria-hidden", "true");

  const protocolElement = document.createElement("span");
  protocolElement.className = "tab-protocol";
  protocolElement.textContent = kind === "rdp" ? "RDP" : kind === "ssh" ? "SSH" : "CG";

  const labelElement = document.createElement("span");
  labelElement.className = "tab-label";
  labelElement.textContent = label;

  const closeElement = document.createElement("span");
  closeElement.className = "tab-close";
  closeElement.title = "Close tab";
  closeElement.setAttribute("aria-label", `Close ${label}`);
  closeElement.textContent = "\u00d7";

  tabElement.append(statusElement, protocolElement, labelElement, closeElement);
  tabsElement.append(tabElement);

  const paneElement = document.createElement("div");
  paneElement.className = "workspace-pane";
  paneElement.id = `pane-${id}`;
  paneElement.role = "tabpanel";
  terminalStack.append(paneElement);

  const tab: WorkspaceTab = {
    id,
    kind,
    tabElement,
    statusElement,
    paneElement,
    status: "idle",
  };
  tabs.set(id, tab);

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

function createTerminalTab(label: string, kind: "ssh" | "welcome" = "ssh"): WorkspaceTab {
  const tab = createWorkspaceTab(kind, label);
  tab.paneElement.classList.add("terminal-pane");
  const terminal = new Terminal({
    cursorBlink: currentSettings.cursorBlink,
    cursorStyle: "bar",
    fontFamily: currentSettings.fontFamily,
    fontSize: currentSettings.fontSize,
    lineHeight: 1.18,
    scrollback: 10_000,
    allowTransparency: true,
    theme: terminalTheme(currentSettings),
  });
  const fitAddon = new FitAddon.FitAddon();
  terminal.loadAddon(fitAddon);
  terminal.open(tab.paneElement);
  tab.terminal = terminal;
  tab.fitAddon = fitAddon;

  terminal.onData((data) => {
    if (tab.kind === "ssh" && tab.sessionId) {
      window.cybergrid.ssh.write(tab.sessionId, data);
    }
  });
  terminal.onResize(({ cols, rows }) => {
    if (tab.kind === "ssh" && tab.sessionId) {
      window.cybergrid.ssh.resize(tab.sessionId, cols, rows);
    }
  });
  return tab;
}

function createRdpTab(label: string, config: RdpConnectionConfig): WorkspaceTab {
  const tab = createWorkspaceTab("rdp", label);
  tab.paneElement.classList.add("rdp-pane");

  const canvas = document.createElement("div");
  canvas.className = "rdp-canvas";
  const mark = document.createElement("div");
  mark.className = "rdp-mark";
  mark.textContent = "RDP";
  const title = document.createElement("h2");
  title.textContent = `${config.username}@${config.host}:${config.port}`;
  const message = document.createElement("p");
  message.textContent = "Preparing the native Windows Remote Desktop client...";
  tab.rdpMessageElement = message;
  const note = document.createElement("div");
  note.className = "rdp-native-note";
  note.textContent =
    "The secure desktop surface runs in the Windows RDP client. This tab tracks its lifecycle.";
  const disconnectButton = document.createElement("button");
  disconnectButton.className = "secondary-button";
  disconnectButton.type = "button";
  disconnectButton.textContent = "Close RDP session";
  disconnectButton.addEventListener("click", () => {
    if (tab.rdpSessionId) {
      void window.cybergrid.rdp.disconnect(tab.rdpSessionId);
    }
  });
  canvas.append(mark, title, message, note, disconnectButton);
  tab.paneElement.append(canvas);
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
  updateSftpAvailability();
  requestAnimationFrame(() => {
    tab.fitAddon?.fit();
    tab.terminal?.focus();
  });
  if (sftpDrawerOpen && tab.kind === "ssh" && tab.sessionId && tab.status === "connected") {
    if (tab.sftp) {
      renderSftpListing(tab.sftp);
    } else {
      void loadSftpDirectory(tab, ".");
    }
  }
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
    const sessionId = tab.sessionId;
    sshSessions.delete(sessionId);
    await window.cybergrid.ssh.disconnect(sessionId).catch(() => undefined);
    queuedSshData.delete(sessionId);
    queuedSshStatus.delete(sessionId);
  }
  if (tab.rdpSessionId) {
    const sessionId = tab.rdpSessionId;
    rdpSessions.delete(sessionId);
    await window.cybergrid.rdp.disconnect(sessionId).catch(() => undefined);
    queuedRdpStatus.delete(sessionId);
  }

  tab.terminal?.dispose();
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
      setSftpDrawerOpen(false);
    }
  }
}

function updateSshTabStatus(tab: WorkspaceTab, event: SshStatusEvent): void {
  tab.status = event.status;
  tab.statusElement.classList.toggle("connected", event.status === "connected");
  tab.statusElement.classList.toggle("error", event.status === "error");
  if (event.status === "error") {
    tab.terminal?.writeln(
      `\r\n\x1b[31mConnection error: ${event.message ?? "Unknown error"}\x1b[0m`,
    );
  } else if (event.status === "disconnected") {
    tab.terminal?.writeln(`\r\n\x1b[90m${event.message ?? "Disconnected."}\x1b[0m`);
  }

  if (activeTabId === tab.id) {
    updateConnectionState(tab, event.message);
    updateSftpAvailability();
  }
}

function updateRdpTabStatus(tab: WorkspaceTab, event: RdpStatusEvent): void {
  tab.status = event.status;
  tab.statusElement.classList.toggle("connected", event.status === "running");
  tab.statusElement.classList.toggle("error", event.status === "error");
  if (tab.rdpMessageElement) {
    tab.rdpMessageElement.textContent = event.message ?? event.status;
  }
  if (activeTabId === tab.id) {
    updateConnectionState(tab, event.message);
  }
}

function updateConnectionState(tab: WorkspaceTab, message?: string): void {
  const labels: Record<WorkspaceStatus, string> = {
    idle: "Ready",
    connecting: "Connecting...",
    connected: "Connected",
    disconnected: "Disconnected",
    launching: "Launching RDP...",
    running: "RDP running",
    closed: "RDP closed",
    error: "Connection error",
  };
  connectionState.textContent = message ?? labels[tab.status];
}

function setTabConnecting(tab: WorkspaceTab, description: string): void {
  tab.status = "connecting";
  updateConnectionState(tab);
  tab.terminal?.writeln(`\x1b[36mCyberGrid\x1b[0m ${description}`);
}

function attachSshSession(tab: WorkspaceTab, sessionId: string): void {
  tab.sessionId = sessionId;
  sshSessions.set(sessionId, tab);

  const buffered = queuedSshData.get(sessionId);
  if (buffered) {
    for (const data of buffered) {
      tab.terminal?.write(data);
    }
    queuedSshData.delete(sessionId);
  }

  const status = queuedSshStatus.get(sessionId);
  if (status) {
    updateSshTabStatus(tab, status);
    queuedSshStatus.delete(sessionId);
  }

  tab.fitAddon?.fit();
  if (tab.terminal) {
    window.cybergrid.ssh.resize(sessionId, tab.terminal.cols, tab.terminal.rows);
  }
}

function attachRdpSession(tab: WorkspaceTab, sessionId: string): void {
  tab.rdpSessionId = sessionId;
  rdpSessions.set(sessionId, tab);
  const status = queuedRdpStatus.get(sessionId);
  if (status) {
    updateRdpTabStatus(tab, status);
    queuedRdpStatus.delete(sessionId);
  }
}

function handleConnectionFailure(tab: WorkspaceTab, error: unknown): void {
  if (tab.kind === "rdp") {
    updateRdpTabStatus(tab, {
      sessionId: tab.rdpSessionId ?? "pending",
      status: "error",
      message: errorMessage(error),
    });
  } else {
    updateSshTabStatus(tab, {
      sessionId: tab.sessionId ?? "pending",
      status: "error",
      message: errorMessage(error),
    });
  }
}

function handleSshData(event: SshDataEvent): void {
  const tab = sshSessions.get(event.sessionId);
  if (tab) {
    tab.terminal?.write(event.data);
    return;
  }

  const buffered = queuedSshData.get(event.sessionId) ?? [];
  if (buffered.reduce((size, chunk) => size + chunk.length, 0) < 1_000_000) {
    buffered.push(event.data);
    queuedSshData.set(event.sessionId, buffered);
  }
}

function handleSshStatus(event: SshStatusEvent): void {
  const tab = sshSessions.get(event.sessionId);
  if (tab) {
    updateSshTabStatus(tab, event);
  } else {
    queuedSshStatus.set(event.sessionId, event);
  }
}

function handleRdpStatus(event: RdpStatusEvent): void {
  const tab = rdpSessions.get(event.sessionId);
  if (tab) {
    updateRdpTabStatus(tab, event);
  } else {
    queuedRdpStatus.set(event.sessionId, event);
  }
}

async function connectSavedProfile(profile: ServerProfileSummary): Promise<void> {
  const tab = createTerminalTab(profile.name);
  setTabConnecting(
    tab,
    `connecting to ${profile.username}@${profile.host}:${profile.port} from the encrypted vault...`,
  );

  try {
    attachSshSession(tab, await window.cybergrid.ssh.connectProfile(profile.id));
  } catch (error) {
    handleConnectionFailure(tab, error);
  }
}

async function connectQuickSsh(config: SshConnectionConfig): Promise<void> {
  const tab = createTerminalTab(config.host);
  setTabConnecting(tab, `connecting to ${config.username}@${config.host}:${config.port}...`);
  try {
    attachSshSession(tab, await window.cybergrid.ssh.connect(config));
  } catch (error) {
    handleConnectionFailure(tab, error);
  }
}

async function connectQuickRdp(config: RdpConnectionConfig): Promise<void> {
  const tab = createRdpTab(config.host, config);
  tab.status = "launching";
  updateConnectionState(tab);
  try {
    attachRdpSession(tab, await window.cybergrid.rdp.connect(config));
  } catch (error) {
    handleConnectionFailure(tab, error);
  }
}

function parseQuickConnect(value: string):
  | { protocol: "ssh"; config: SshConnectionConfig }
  | { protocol: "rdp"; config: RdpConnectionConfig } {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Use protocol://user@host:port, for example ssh://admin@server:22.");
  }

  const protocol = url.protocol.replace(":", "");
  if (protocol !== "ssh" && protocol !== "rdp") {
    throw new Error("Quick Connect supports ssh:// and rdp:// URLs.");
  }
  const username = decodeURIComponent(url.username);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!username || !host) {
    throw new Error("Quick Connect requires both a username and host.");
  }

  if (protocol === "ssh") {
    return {
      protocol,
      config: {
        host,
        port: url.port ? Number(url.port) : 22,
        username,
        password: decodeURIComponent(url.password) || quickPasswordInput.value || undefined,
      },
    };
  }
  return {
    protocol,
    config: {
      host,
      port: url.port ? Number(url.port) : 3389,
      username,
    },
  };
}

function createTextElement(tag: "span" | "div", className: string, text: string): HTMLElement {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}

const DEVICE_ICON_LABELS: Record<DeviceIcon, string> = {
  windows: "WIN",
  linux: "LNX",
  cisco: "CIS",
  fortinet: "FNT",
  vmware: "VMW",
  printer: "PRN",
  network: "NET",
  server: "SRV",
  unknown: "DEV",
};

function displayedIcon(asset: Pick<AssetRecord, "iconOverride" | "suggestedIcon">): DeviceIcon {
  return asset.iconOverride ?? asset.suggestedIcon;
}

function portSummary(device: Pick<DiscoveredDevice, "openPorts">): string {
  return device.openPorts.map((port) => `${port.protocol.toUpperCase()} ${port.port}`).join("  ");
}

function fingerprintCell(label: string, value: string): HTMLDivElement {
  const cell = document.createElement("div");
  cell.className = "fingerprint-cell";
  cell.append(
    createTextElement("span", "fingerprint-label", label),
    createTextElement("span", "fingerprint-value", value || "Not detected"),
  );
  return cell;
}

function openAssetModal(asset: AssetRecord): void {
  editingAssetId = asset.id;
  assetFormError.textContent = "";
  assetFingerprint.replaceChildren(
    fingerprintCell("IP address", asset.ipAddress),
    fingerprintCell("Hostname", asset.hostname ?? ""),
    fingerprintCell("MAC address", asset.macAddress ?? ""),
    fingerprintCell("Vendor", asset.vendor ?? ""),
    fingerprintCell("OS family", asset.osFamily),
    fingerprintCell("Open services", portSummary(asset)),
  );
  assetNameInput.value = asset.name;
  assetIconInput.value = asset.iconOverride ?? "";
  assetSerialInput.value = asset.metadata.serialNumber;
  assetTagInput.value = asset.metadata.assetTag;
  assetRackInput.value = asset.metadata.rackPosition;
  assetSiteInput.value = asset.metadata.site;
  assetOsVersionInput.value = asset.metadata.osVersion;
  assetSlaInput.value = asset.metadata.maintenanceSla;
  if (!assetModal.open) {
    assetModal.showModal();
  }
  requestAnimationFrame(() => assetNameInput.focus());
}

function renderAssets(): void {
  assetList.replaceChildren();
  assetCount.textContent = String(savedAssets.length);
  if (savedAssets.length === 0) {
    assetList.append(
      createTextElement("div", "sidebar-empty", "No CMDB assets yet. Use network discovery to fingerprint and import devices."),
    );
    return;
  }

  for (const asset of savedAssets) {
    const button = document.createElement("button");
    button.className = "asset-item";
    button.type = "button";
    button.title = "Open asset metadata";
    const details = createTextElement("span", "server-meta", "");
    details.append(
      createTextElement("span", "server-name", asset.name),
      createTextElement(
        "span",
        "server-host",
        `${asset.ipAddress}${asset.metadata.site ? `  /  ${asset.metadata.site}` : ""}`,
      ),
    );
    button.append(
      createTextElement("span", "device-icon", DEVICE_ICON_LABELS[displayedIcon(asset)]),
      details,
    );
    button.addEventListener("click", () => openAssetModal(asset));
    assetList.append(button);
  }
}

async function refreshAssets(): Promise<void> {
  savedAssets = await window.cybergrid.vault.listAssets();
  renderAssets();
}

async function refreshVaultContent(): Promise<void> {
  const [profiles, assets] = await Promise.all([
    window.cybergrid.vault.listProfiles(),
    window.cybergrid.vault.listAssets(),
  ]);
  savedProfiles = profiles;
  savedAssets = assets;
  renderProfiles();
  renderAssets();
}

function assetInputForDevice(device: DiscoveredDevice): AssetInput {
  const existing = savedAssets.find((asset) => asset.ipAddress === device.ipAddress);
  return {
    id: existing?.id,
    name: existing?.name ?? device.hostname ?? device.ipAddress,
    ipAddress: device.ipAddress,
    hostname: device.hostname ?? existing?.hostname,
    macAddress: device.macAddress ?? existing?.macAddress,
    vendor: device.vendor ?? existing?.vendor,
    osFamily: device.osFamily,
    openPorts: device.openPorts.map((port) => ({ ...port })),
    suggestedIcon: device.suggestedIcon,
    iconOverride: existing?.iconOverride,
    metadata: {
      serialNumber: existing?.metadata.serialNumber ?? "",
      assetTag: existing?.metadata.assetTag ?? "",
      rackPosition: existing?.metadata.rackPosition ?? "",
      site: existing?.metadata.site ?? "",
      osVersion: existing?.metadata.osVersion || device.osVersion || "",
      maintenanceSla: existing?.metadata.maintenanceSla ?? "",
    },
    lastSeenAt: device.lastSeenAt,
  };
}

async function importDiscoveredDevice(device: DiscoveredDevice, button: HTMLButtonElement): Promise<void> {
  button.disabled = true;
  button.textContent = "Saving...";
  try {
    await window.cybergrid.vault.saveAsset(assetInputForDevice(device));
    await refreshAssets();
    renderScanResults();
  } catch (error) {
    scanError.textContent = errorMessage(error);
    button.disabled = false;
    button.textContent = "Retry";
  }
}

function renderScanResults(): void {
  scanResults.replaceChildren();
  const devices = [...scanDevices.values()].sort((left, right) =>
    left.ipAddress.localeCompare(right.ipAddress, undefined, { numeric: true }),
  );
  if (devices.length === 0) {
    scanResults.append(createTextElement("div", "sidebar-empty", "No devices with supported administration ports found yet."));
    return;
  }

  for (const device of devices) {
    const existing = savedAssets.find((asset) => asset.ipAddress === device.ipAddress);
    const row = document.createElement("div");
    row.className = "scan-result-row";
    const deviceDetails = createTextElement("div", "", "");
    deviceDetails.append(
      createTextElement("div", "scan-primary", device.hostname ?? device.ipAddress),
      createTextElement("div", "scan-secondary", device.hostname ? device.ipAddress : (device.macAddress ?? "No MAC in neighbor table")),
    );
    const vendorDetails = createTextElement("div", "scan-vendor-column", "");
    vendorDetails.append(
      createTextElement("div", "scan-primary", device.vendor ?? "Vendor unknown"),
      createTextElement("div", "scan-secondary", `${device.osFamily} / ${device.confidence}% confidence`),
    );
    const serviceDetails = createTextElement("div", "", "");
    serviceDetails.append(
      createTextElement("div", "scan-primary", portSummary(device)),
      createTextElement("div", "scan-secondary", device.osVersion ?? "No version banner"),
    );
    const importButton = document.createElement("button");
    importButton.className = "compact-button";
    importButton.type = "button";
    importButton.textContent = existing ? "Update" : "Import";
    importButton.addEventListener("click", () => void importDiscoveredDevice(device, importButton));
    row.append(
      createTextElement("span", "device-icon", DEVICE_ICON_LABELS[device.suggestedIcon]),
      deviceDetails,
      vendorDetails,
      serviceDetails,
      importButton,
    );
    scanResults.append(row);
  }
}

function setScanRunning(running: boolean): void {
  scanStartButton.disabled = running;
  scanTargetInput.disabled = running;
  scanCancelButton.disabled = !running;
}

function handleDiscoveryProgress(event: DiscoveryProgressEvent): void {
  if (event.scanId !== activeScanId) {
    return;
  }
  scanProgress.max = Math.max(1, event.total);
  scanProgress.value = event.scanned;
  scanStatus.textContent = `${event.scanned} / ${event.total} scanned  -  ${event.currentIp}`;
}

function handleDiscoveryResult(event: DiscoveryResultEvent): void {
  if (event.scanId !== activeScanId) {
    return;
  }
  scanDevices.set(event.device.ipAddress, event.device);
  renderScanResults();
}

function handleDiscoveryComplete(event: DiscoveryCompleteEvent): void {
  if (event.scanId !== activeScanId) {
    return;
  }
  activeScanId = null;
  setScanRunning(false);
  scanProgress.max = Math.max(1, event.total);
  scanProgress.value = event.scanned;
  if (event.error) {
    scanStatus.textContent = "Discovery failed";
    scanError.textContent = event.error;
  } else if (event.canceled) {
    scanStatus.textContent = `Canceled after ${event.scanned} of ${event.total} addresses`;
  } else {
    scanStatus.textContent = `Complete: ${event.discovered} device${event.discovered === 1 ? "" : "s"} found`;
  }
}

function populateQuickConnect(profile: ServerProfileSummary): void {
  quickConnectInput.value = `ssh://${encodeURIComponent(profile.username)}@${profile.host}:${profile.port}`;
  quickPasswordInput.value = "";
}

function renderProfiles(): void {
  profileTree.replaceChildren();
  groupOptions.replaceChildren();

  if (savedProfiles.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "sidebar-empty";
    emptyState.textContent = "No saved SSH servers yet. Add one to create your first folder.";
    profileTree.append(emptyState);
    return;
  }

  const profilesByGroup = new Map<string, ServerProfileSummary[]>();
  for (const profile of savedProfiles) {
    const group = profile.group || "Ungrouped";
    const groupProfiles = profilesByGroup.get(group) ?? [];
    groupProfiles.push(profile);
    profilesByGroup.set(group, groupProfiles);
  }

  const groups = [...profilesByGroup.keys()].sort((left, right) => left.localeCompare(right));
  for (const group of groups) {
    const option = document.createElement("option");
    option.value = group;
    groupOptions.append(option);

    const section = document.createElement("section");
    section.className = "server-group";
    section.classList.toggle("collapsed", collapsedGroups.has(group));

    const folderButton = document.createElement("button");
    folderButton.className = "folder-header";
    folderButton.type = "button";
    folderButton.setAttribute("aria-expanded", String(!collapsedGroups.has(group)));
    folderButton.append(
      createTextElement("span", "folder-chevron", collapsedGroups.has(group) ? ">" : "v"),
      createTextElement("span", "folder-name", group),
      createTextElement("span", "folder-count", String(profilesByGroup.get(group)?.length ?? 0)),
    );
    folderButton.addEventListener("click", () => {
      if (collapsedGroups.has(group)) {
        collapsedGroups.delete(group);
      } else {
        collapsedGroups.add(group);
      }
      renderProfiles();
    });

    const list = document.createElement("div");
    list.className = "server-list";
    for (const profile of profilesByGroup.get(group) ?? []) {
      const row = document.createElement("div");
      row.className = "server-row";

      const serverButton = document.createElement("button");
      serverButton.className = "server-item";
      serverButton.type = "button";
      serverButton.title = "Double-click to connect";
      const meta = createTextElement("span", "server-meta", "");
      meta.append(
        createTextElement("span", "server-name", profile.name),
        createTextElement(
          "span",
          "server-host",
          `${profile.username}@${profile.host}:${profile.port}`,
        ),
      );
      serverButton.append(createTextElement("span", "server-dot", ""), meta);
      serverButton.addEventListener("click", () => populateQuickConnect(profile));
      serverButton.addEventListener("dblclick", () => void connectSavedProfile(profile));

      const deleteButton = document.createElement("button");
      deleteButton.className = "server-delete";
      deleteButton.type = "button";
      deleteButton.title = `Delete ${profile.name}`;
      deleteButton.setAttribute("aria-label", `Delete ${profile.name}`);
      deleteButton.textContent = "\u00d7";
      deleteButton.addEventListener("click", async () => {
        if (!window.confirm(`Delete the saved server "${profile.name}"?`)) {
          return;
        }
        try {
          await window.cybergrid.vault.deleteProfile(profile.id);
          await refreshProfiles();
        } catch (error) {
          window.alert(errorMessage(error));
        }
      });

      row.append(serverButton, deleteButton);
      list.append(row);
    }

    section.append(folderButton, list);
    profileTree.append(section);
  }
}

async function refreshProfiles(): Promise<void> {
  savedProfiles = await window.cybergrid.vault.listProfiles();
  renderProfiles();
}

function activeSshTab(): WorkspaceTab | undefined {
  const tab = activeTabId ? tabs.get(activeTabId) : undefined;
  return tab?.kind === "ssh" && tab.status === "connected" && tab.sessionId ? tab : undefined;
}

function updateSftpAvailability(): void {
  const available = Boolean(activeSshTab());
  toggleSftpButton.disabled = !available;
  if (!available && sftpDrawerOpen) {
    setSftpDrawerOpen(false);
  }
}

function setSftpDrawerOpen(open: boolean): void {
  sftpDrawerOpen = open;
  contentArea.classList.toggle("sftp-open", open);
  sftpDrawer.hidden = !open;
  toggleSftpButton.classList.toggle("active", open);
  const tab = activeSshTab();
  if (open && tab) {
    if (tab.sftp) {
      renderSftpListing(tab.sftp);
    } else {
      void loadSftpDirectory(tab, ".");
    }
  }
  requestAnimationFrame(() => tabs.get(activeTabId ?? "")?.fitAddon?.fit());
}

function parentRemotePath(remotePath: string): string {
  if (remotePath === "/") {
    return "/";
  }
  const parts = remotePath.replace(/\/$/, "").split("/");
  parts.pop();
  return parts.join("/") || "/";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1_024) {
    return `${bytes} B`;
  }
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1_024;
  let unit = units[0];
  for (let index = 1; index < units.length && value >= 1_024; index += 1) {
    value /= 1_024;
    unit = units[index];
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${unit}`;
}

function renderSftpListing(listing: SftpDirectoryListing): void {
  sftpPathInput.value = listing.path;
  sftpListing.replaceChildren();
  if (listing.entries.length === 0) {
    sftpListing.append(createTextElement("div", "sftp-empty", "This directory is empty."));
    return;
  }

  for (const entry of listing.entries) {
    const row = document.createElement("button");
    row.className = "sftp-row";
    row.type = "button";
    row.title = entry.type === "directory" ? "Double-click to open" : "Double-click to download";
    const icon = entry.type === "directory" ? "DIR" : entry.type === "file" ? "FILE" : "LINK";
    row.append(
      createTextElement("span", `sftp-kind ${entry.type}`, icon),
      createTextElement("span", "sftp-name", entry.name),
      createTextElement("span", "sftp-size", entry.type === "directory" ? "" : formatFileSize(entry.size)),
      createTextElement("span", "sftp-date", new Date(entry.modifiedAt).toLocaleDateString()),
    );
    row.addEventListener("dblclick", () => void openSftpEntry(entry));
    sftpListing.append(row);
  }
}

async function loadSftpDirectory(tab: WorkspaceTab, remotePath: string): Promise<void> {
  if (!tab.sessionId) {
    return;
  }
  sftpStatus.textContent = "Loading directory...";
  try {
    const listing = await window.cybergrid.sftp.listDirectory(tab.sessionId, remotePath);
    tab.sftp = listing;
    if (activeTabId === tab.id && sftpDrawerOpen) {
      renderSftpListing(listing);
      sftpStatus.textContent = `${listing.entries.length} item${listing.entries.length === 1 ? "" : "s"}`;
    }
  } catch (error) {
    sftpStatus.textContent = errorMessage(error);
  }
}

async function openSftpEntry(entry: SftpEntry): Promise<void> {
  const tab = activeSshTab();
  if (!tab || !tab.sessionId) {
    return;
  }
  if (entry.type === "directory") {
    await loadSftpDirectory(tab, entry.path);
    return;
  }
  if (entry.type !== "file") {
    sftpStatus.textContent = "Only regular files can be downloaded.";
    return;
  }
  sftpStatus.textContent = `Downloading ${entry.name}...`;
  try {
    const localPath = await window.cybergrid.sftp.downloadFile(tab.sessionId, entry.path);
    sftpStatus.textContent = localPath ? `Downloaded to ${localPath}` : "Download canceled.";
  } catch (error) {
    sftpStatus.textContent = errorMessage(error);
  }
}

function handleSftpProgress(event: SftpProgressEvent): void {
  const tab = activeSshTab();
  if (!tab || tab.sessionId !== event.sessionId) {
    return;
  }
  sftpProgress.hidden = false;
  sftpProgress.max = Math.max(1, event.total);
  sftpProgress.value = event.transferred;
  const percent = event.total > 0 ? Math.round((event.transferred / event.total) * 100) : 0;
  sftpStatus.textContent = `${event.direction === "upload" ? "Uploading" : "Downloading"} ${event.fileName} (${percent}%)`;
  if (event.total > 0 && event.transferred >= event.total) {
    window.setTimeout(() => {
      sftpProgress.hidden = true;
    }, 700);
  }
}

function setVaultPrompt(shouldExist: boolean): void {
  vaultMode = shouldExist ? "unlock" : "create";
  vaultTitle.textContent = shouldExist ? "Unlock CyberGrid" : "Create your credential vault";
  vaultSubtitle.textContent = shouldExist
    ? "Enter your master password to decrypt saved servers and credentials."
    : "Choose a master password. It cannot be recovered if you lose it.";
  confirmPasswordField.hidden = shouldExist;
  confirmPasswordInput.required = !shouldExist;
  vaultSubmit.textContent = shouldExist ? "Unlock vault" : "Create vault";
  vaultError.textContent = "";
  vaultOverlay.hidden = false;
  appShell.inert = true;
  requestAnimationFrame(() => masterPasswordInput.focus());
}

function hideVaultPrompt(): void {
  masterPasswordInput.value = "";
  confirmPasswordInput.value = "";
  vaultError.textContent = "";
  vaultOverlay.hidden = true;
  appShell.inert = false;
}

async function initializeVault(): Promise<void> {
  try {
    const status = await window.cybergrid.vault.status();
    if (status.unlocked) {
      await refreshVaultContent();
      hideVaultPrompt();
    } else {
      setVaultPrompt(status.exists);
    }
  } catch (error) {
    setVaultPrompt(true);
    vaultError.textContent = errorMessage(error);
  }
}

function updateAuthenticationFields(): void {
  const usesPassword = authTypeInput.value === "password";
  serverPasswordSection.hidden = !usesPassword;
  serverKeySection.hidden = usesPassword;
  serverPasswordInput.required = usesPassword;
  serverKeyPathInput.required = !usesPassword;
}

function openServerModal(): void {
  serverForm.reset();
  serverPortInput.value = "22";
  authTypeInput.value = "password";
  serverFormError.textContent = "";
  updateAuthenticationFields();
  if (!serverModal.open) {
    serverModal.showModal();
  }
  requestAnimationFrame(() => serverNameInput.focus());
}

function populateSettingsForm(settings: UserSettings): void {
  themeInput.value = settings.theme;
  fontFamilyInput.value = settings.fontFamily;
  fontSizeInput.value = String(settings.fontSize);
  cursorBlinkInput.checked = settings.cursorBlink;
  backgroundInput.value = settings.background;
  foregroundInput.value = settings.foreground;
  cursorInput.value = settings.cursor;
  accentInput.value = settings.accent;
  customPaletteFields.hidden = settings.theme !== "custom";
}

function openSettingsModal(): void {
  populateSettingsForm(currentSettings);
  if (!settingsModal.open) {
    settingsModal.showModal();
  }
}

quickConnectForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  connectionState.textContent = "Parsing Quick Connect URL...";
  try {
    const parsed = parseQuickConnect(quickConnectInput.value);
    if (parsed.protocol === "ssh") {
      await connectQuickSsh(parsed.config);
    } else {
      await connectQuickRdp(parsed.config);
    }
  } catch (error) {
    connectionState.textContent = errorMessage(error);
  } finally {
    quickPasswordInput.value = "";
  }
});

toggleSftpButton.addEventListener("click", () => setSftpDrawerOpen(!sftpDrawerOpen));
sftpCloseButton.addEventListener("click", () => setSftpDrawerOpen(false));
sftpRefreshButton.addEventListener("click", () => {
  const tab = activeSshTab();
  if (tab) {
    void loadSftpDirectory(tab, tab.sftp?.path ?? ".");
  }
});
sftpUpButton.addEventListener("click", () => {
  const tab = activeSshTab();
  if (tab) {
    void loadSftpDirectory(tab, parentRemotePath(tab.sftp?.path ?? "/"));
  }
});
sftpPathForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const tab = activeSshTab();
  if (tab) {
    void loadSftpDirectory(tab, sftpPathInput.value.trim() || ".");
  }
});
sftpUploadButton.addEventListener("click", async () => {
  const tab = activeSshTab();
  if (!tab?.sessionId) {
    return;
  }
  sftpStatus.textContent = "Choose files to upload...";
  try {
    const uploaded = await window.cybergrid.sftp.uploadFiles(
      tab.sessionId,
      tab.sftp?.path ?? ".",
    );
    sftpStatus.textContent = uploaded.length > 0
      ? `Uploaded ${uploaded.length} file${uploaded.length === 1 ? "" : "s"}.`
      : "Upload canceled.";
    if (uploaded.length > 0) {
      await loadSftpDirectory(tab, tab.sftp?.path ?? ".");
    }
  } catch (error) {
    sftpStatus.textContent = errorMessage(error);
  }
});

vaultForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const password = masterPasswordInput.value;
  vaultError.textContent = "";

  if (vaultMode === "create") {
    if (password.length < 10) {
      vaultError.textContent = "Use at least 10 characters for the master password.";
      return;
    }
    if (password !== confirmPasswordInput.value) {
      vaultError.textContent = "Master passwords do not match.";
      return;
    }
  }

  vaultSubmit.disabled = true;
  vaultSubmit.textContent = vaultMode === "create" ? "Creating..." : "Unlocking...";
  try {
    if (vaultMode === "create") {
      await window.cybergrid.vault.create(password);
    } else {
      await window.cybergrid.vault.unlock(password);
    }
    await refreshVaultContent();
    hideVaultPrompt();
  } catch (error) {
    vaultError.textContent = errorMessage(error);
    masterPasswordInput.select();
  } finally {
    vaultSubmit.disabled = false;
    vaultSubmit.textContent = vaultMode === "create" ? "Create vault" : "Unlock vault";
  }
});

addServerButton.addEventListener("click", openServerModal);
scanButton.addEventListener("click", () => {
  scanError.textContent = "";
  if (!scanModal.open) {
    scanModal.showModal();
  }
  requestAnimationFrame(() => scanTargetInput.focus());
});

scanForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  scanError.textContent = "";
  scanDevices.clear();
  renderScanResults();
  scanProgress.max = 1;
  scanProgress.value = 0;
  scanStatus.textContent = "Starting discovery...";
  setScanRunning(true);
  try {
    activeScanId = await window.cybergrid.discovery.start(scanTargetInput.value.trim());
  } catch (error) {
    activeScanId = null;
    setScanRunning(false);
    scanStatus.textContent = "Scan did not start";
    scanError.textContent = errorMessage(error);
  }
});

scanCancelButton.addEventListener("click", async () => {
  if (!activeScanId) {
    return;
  }
  scanCancelButton.disabled = true;
  scanStatus.textContent = "Canceling discovery...";
  try {
    await window.cybergrid.discovery.cancel(activeScanId);
  } catch (error) {
    scanError.textContent = errorMessage(error);
  }
});

scanCloseButton.addEventListener("click", () => scanModal.close());
scanModal.addEventListener("click", (event) => {
  if (event.target === scanModal) {
    scanModal.close();
  }
});

assetForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  assetFormError.textContent = "";
  const asset = savedAssets.find((candidate) => candidate.id === editingAssetId);
  if (!asset) {
    assetFormError.textContent = "Asset record is no longer available.";
    return;
  }
  const input: AssetInput = {
    id: asset.id,
    name: assetNameInput.value.trim(),
    ipAddress: asset.ipAddress,
    hostname: asset.hostname,
    macAddress: asset.macAddress,
    vendor: asset.vendor,
    osFamily: asset.osFamily,
    openPorts: asset.openPorts.map((port) => ({ ...port })),
    suggestedIcon: asset.suggestedIcon,
    iconOverride: (assetIconInput.value || undefined) as DeviceIcon | undefined,
    metadata: {
      serialNumber: assetSerialInput.value.trim(),
      assetTag: assetTagInput.value.trim(),
      rackPosition: assetRackInput.value.trim(),
      site: assetSiteInput.value.trim(),
      osVersion: assetOsVersionInput.value.trim(),
      maintenanceSla: assetSlaInput.value.trim(),
    },
    lastSeenAt: asset.lastSeenAt,
  };
  try {
    await window.cybergrid.vault.saveAsset(input);
    await refreshAssets();
    assetModal.close();
    editingAssetId = null;
  } catch (error) {
    assetFormError.textContent = errorMessage(error);
  }
});

deleteAssetButton.addEventListener("click", async () => {
  const asset = savedAssets.find((candidate) => candidate.id === editingAssetId);
  if (!asset || !window.confirm(`Delete the asset "${asset.name}" from inventory?`)) {
    return;
  }
  try {
    await window.cybergrid.vault.deleteAsset(asset.id);
    await refreshAssets();
    assetModal.close();
    editingAssetId = null;
    renderScanResults();
  } catch (error) {
    assetFormError.textContent = errorMessage(error);
  }
});

cancelAssetButton.addEventListener("click", () => assetModal.close());
assetModal.addEventListener("close", () => {
  editingAssetId = null;
});
assetModal.addEventListener("click", (event) => {
  if (event.target === assetModal) {
    assetModal.close();
  }
});

lockButton.addEventListener("click", async () => {
  try {
    if (serverModal.open) {
      serverModal.close();
    }
    if (settingsModal.open) {
      settingsModal.close();
    }
    if (scanModal.open) {
      scanModal.close();
    }
    if (assetModal.open) {
      assetModal.close();
    }
    setSftpDrawerOpen(false);
    await window.cybergrid.vault.lock();
    activeScanId = null;
    setScanRunning(false);
    scanDevices.clear();
    savedProfiles = [];
    savedAssets = [];
    renderProfiles();
    renderAssets();
    setVaultPrompt(true);
  } catch (error) {
    window.alert(errorMessage(error));
  }
});

authTypeInput.addEventListener("change", updateAuthenticationFields);
cancelServerButton.addEventListener("click", () => serverModal.close());
browseKeyButton.addEventListener("click", async () => {
  const selectedPath = await window.cybergrid.system.selectPrivateKey();
  if (selectedPath) {
    serverKeyPathInput.value = selectedPath;
  }
});
serverModal.addEventListener("click", (event) => {
  if (event.target === serverModal) {
    serverModal.close();
  }
});
serverForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  serverFormError.textContent = "";
  const authType = authTypeInput.value as ServerAuthType;
  const profile: ServerProfileInput = {
    name: serverNameInput.value.trim(),
    host: serverHostInput.value.trim(),
    port: Number(serverPortInput.value),
    username: serverUsernameInput.value.trim(),
    group: serverGroupInput.value.trim() || "Ungrouped",
    authType,
    password: authType === "password" ? serverPasswordInput.value : undefined,
    privateKeyPath: authType === "privateKey" ? serverKeyPathInput.value.trim() : undefined,
    passphrase: authType === "privateKey" ? serverPassphraseInput.value : undefined,
  };

  try {
    await window.cybergrid.vault.saveProfile(profile);
    serverPasswordInput.value = "";
    serverPassphraseInput.value = "";
    serverModal.close();
    await refreshProfiles();
  } catch (error) {
    serverFormError.textContent = errorMessage(error);
  }
});

settingsButton.addEventListener("click", openSettingsModal);
themeInput.addEventListener("change", () => {
  customPaletteFields.hidden = themeInput.value !== "custom";
});
cancelSettingsButton.addEventListener("click", () => settingsModal.close());
resetSettingsButton.addEventListener("click", () => populateSettingsForm(DEFAULT_SETTINGS));
settingsModal.addEventListener("click", (event) => {
  if (event.target === settingsModal) {
    settingsModal.close();
  }
});
settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const settings: UserSettings = {
    theme: themeInput.value as UserSettings["theme"],
    fontFamily: fontFamilyInput.value.trim() || DEFAULT_SETTINGS.fontFamily,
    fontSize: Math.min(28, Math.max(10, Math.round(Number(fontSizeInput.value)))),
    cursorBlink: cursorBlinkInput.checked,
    background: backgroundInput.value,
    foreground: foregroundInput.value,
    cursor: cursorInput.value,
    accent: accentInput.value,
  };
  applySettings(settings, true);
  settingsModal.close();
});

window.cybergrid.ssh.onData(handleSshData);
window.cybergrid.ssh.onStatus(handleSshStatus);
window.cybergrid.sftp.onProgress(handleSftpProgress);
window.cybergrid.rdp.onStatus(handleRdpStatus);
window.cybergrid.discovery.onProgress(handleDiscoveryProgress);
window.cybergrid.discovery.onResult(handleDiscoveryResult);
window.cybergrid.discovery.onComplete(handleDiscoveryComplete);

const resizeObserver = new ResizeObserver(() => {
  if (activeTabId) {
    tabs.get(activeTabId)?.fitAddon?.fit();
  }
});
resizeObserver.observe(terminalStack);

applySettings(currentSettings, false);
const welcomeTab = createTerminalTab("Welcome", "welcome");
welcomeTab.terminal?.writeln("\x1b[36mCyberGrid\x1b[0m");
welcomeTab.terminal?.writeln("SSH, SFTP, RDP, subnet discovery, and encrypted asset inventory in one workspace.\r\n");
welcomeTab.terminal?.writeln("Use Quick Connect: ssh://user@host:22 or rdp://user@host:3389");
welcomeTab.terminal?.writeln("Use the discovery button in the sidebar to scan a private IPv4 subnet.");
updateSftpAvailability();
void initializeVault();
