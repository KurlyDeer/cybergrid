type ITerminalOptions = import("xterm").ITerminalOptions;
type ITheme = import("xterm").ITheme;
type XtermTerminal = import("xterm").Terminal;
type XtermFitAddon = import("xterm-addon-fit").FitAddon;
type CyberGridApi = import("../shared/ipc").CyberGridApi;
type ConnectionProtocol = import("../shared/ipc").ConnectionProtocol;
type AssetInput = import("../shared/ipc").AssetInput;
type AssetRecord = import("../shared/ipc").AssetRecord;
type DeviceIcon = import("../shared/ipc").DeviceIcon;
type DiscoveredDevice = import("../shared/ipc").DiscoveredDevice;
type DiscoveryCompleteEvent = import("../shared/ipc").DiscoveryCompleteEvent;
type DiscoveryProgressEvent = import("../shared/ipc").DiscoveryProgressEvent;
type DiscoveryResultEvent = import("../shared/ipc").DiscoveryResultEvent;
type HealthStatusEvent = import("../shared/ipc").HealthStatusEvent;
type MigrationFormat = import("../shared/ipc").MigrationFormat;
type ProfileConnectionResult = import("../shared/ipc").ProfileConnectionResult;
type RdpConnectionConfig = import("../shared/ipc").RdpConnectionConfig;
type RdpConnectionStatus = import("../shared/ipc").RdpConnectionStatus;
type RdpStatusEvent = import("../shared/ipc").RdpStatusEvent;
type SerialConnectionConfig = import("../shared/ipc").SerialConnectionConfig;
type SerialDataEvent = import("../shared/ipc").SerialDataEvent;
type SerialStatusEvent = import("../shared/ipc").SerialStatusEvent;
type ServerAuthType = import("../shared/ipc").ServerAuthType;
type ServerProfileInput = import("../shared/ipc").ServerProfileInput;
type ServerProfileSummary = import("../shared/ipc").ServerProfileSummary;
type SessionVariableContext = import("../shared/ipc").SessionVariableContext;
type SnippetInput = import("../shared/ipc").SnippetInput;
type SnippetLanguage = import("../shared/ipc").SnippetLanguage;
type SnippetRecord = import("../shared/ipc").SnippetRecord;
type SftpDirectoryListing = import("../shared/ipc").SftpDirectoryListing;
type SftpEntry = import("../shared/ipc").SftpEntry;
type SftpProgressEvent = import("../shared/ipc").SftpProgressEvent;
type SshConnectionConfig = import("../shared/ipc").SshConnectionConfig;
type SshConnectionStatus = import("../shared/ipc").SshConnectionStatus;
type SshDataEvent = import("../shared/ipc").SshDataEvent;
type SshStatusEvent = import("../shared/ipc").SshStatusEvent;
type StreamConnectionConfig = import("../shared/ipc").StreamConnectionConfig;
type StreamDataEvent = import("../shared/ipc").StreamDataEvent;
type StreamStatusEvent = import("../shared/ipc").StreamStatusEvent;
type VncConnectionConfig = import("../shared/ipc").VncConnectionConfig;
type VncConnectionResult = import("../shared/ipc").VncConnectionResult;
type VncStatusEvent = import("../shared/ipc").VncStatusEvent;
type WebStatusEvent = import("../shared/ipc").WebStatusEvent;

declare const Terminal: new (options?: ITerminalOptions) => XtermTerminal;
declare const FitAddon: { FitAddon: new () => XtermFitAddon };

interface Window {
  cybergrid: CyberGridApi;
  NoVncRfb?: NoVncRfbConstructor;
}

interface NoVncRfbInstance {
  disconnect(): void;
  focus(): void;
  scaleViewport: boolean;
  resizeSession: boolean;
  addEventListener(type: string, listener: (event: Event) => void): void;
}

type NoVncRfbConstructor = new (
  target: HTMLElement,
  url: string,
  options?: { credentials?: { password?: string } },
) => NoVncRfbInstance;

type WorkspaceTabKind = ConnectionProtocol | "welcome";
type WorkspaceStatus = SshConnectionStatus | RdpConnectionStatus | "idle" | "loading" | "ready" | "opening";

interface WorkspaceTab {
  id: string;
  kind: WorkspaceTabKind;
  label: string;
  context: SessionVariableContext;
  sessionId?: string;
  rdpSessionId?: string;
  streamSessionId?: string;
  serialSessionId?: string;
  vncSessionId?: string;
  webSessionId?: string;
  vncClient?: NoVncRfbInstance;
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
const streamSessions = new Map<string, WorkspaceTab>();
const serialSessions = new Map<string, WorkspaceTab>();
const vncSessions = new Map<string, WorkspaceTab>();
const webSessions = new Map<string, WorkspaceTab>();
const queuedSshData = new Map<string, string[]>();
const queuedSshStatus = new Map<string, SshStatusEvent>();
const queuedRdpStatus = new Map<string, RdpStatusEvent>();
const queuedStreamData = new Map<string, string[]>();
const queuedStreamStatus = new Map<string, StreamStatusEvent>();
const queuedSerialData = new Map<string, string[]>();
const queuedSerialStatus = new Map<string, SerialStatusEvent>();
const queuedVncStatus = new Map<string, VncStatusEvent>();
const queuedWebStatus = new Map<string, WebStatusEvent>();
const healthStatuses = new Map<string, HealthStatusEvent>();
const collapsedGroups = new Set<string>();
let savedProfiles: ServerProfileSummary[] = [];
let savedAssets: AssetRecord[] = [];
let savedSnippets: SnippetRecord[] = [];
let activeScanId: string | null = null;
let editingAssetId: string | null = null;
const scanDevices = new Map<string, DiscoveredDevice>();
let activeTabId: string | null = null;
let tabSequence = 0;
let vaultMode: "create" | "unlock" = "unlock";
let sftpDrawerOpen = false;
let snippetsDrawerOpen = false;
let broadcastMode = false;
const excludedBroadcastGroups = new Set<string>();
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
const migrationButton = elementById<HTMLButtonElement>("migration-button");
const toggleSftpButton = elementById<HTMLButtonElement>("toggle-sftp-button");
const toggleSnippetsButton = elementById<HTMLButtonElement>("toggle-snippets-button");
const broadcastToggleButton = elementById<HTMLButtonElement>("broadcast-toggle-button");
const broadcastTargetsButton = elementById<HTMLButtonElement>("broadcast-targets-button");

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

const snippetsDrawer = elementById<HTMLElement>("snippets-drawer");
const snippetsCloseButton = elementById<HTMLButtonElement>("snippets-close-button");
const snippetSearchInput = elementById<HTMLInputElement>("snippet-search");
const snippetList = elementById<HTMLDivElement>("snippet-list");
const snippetStatus = elementById<HTMLDivElement>("snippet-status");
const addSnippetButton = elementById<HTMLButtonElement>("add-snippet-button");
const snippetForm = elementById<HTMLFormElement>("snippet-form");
const snippetFormTitle = elementById<HTMLHeadingElement>("snippet-form-title");
const snippetIdInput = elementById<HTMLInputElement>("snippet-id");
const snippetNameInput = elementById<HTMLInputElement>("snippet-name");
const snippetLanguageInput = elementById<HTMLSelectElement>("snippet-language");
const snippetTagsInput = elementById<HTMLInputElement>("snippet-tags");
const snippetBodyInput = elementById<HTMLTextAreaElement>("snippet-body");
const snippetCancelButton = elementById<HTMLButtonElement>("snippet-cancel-button");
const snippetFormError = elementById<HTMLDivElement>("snippet-form-error");

const broadcastTargetsModal = elementById<HTMLDialogElement>("broadcast-targets-modal");
const broadcastTargetList = elementById<HTMLDivElement>("broadcast-target-list");
const broadcastTargetCount = elementById<HTMLSpanElement>("broadcast-target-count");
const broadcastSelectAllButton = elementById<HTMLButtonElement>("broadcast-select-all");
const broadcastSelectNoneButton = elementById<HTMLButtonElement>("broadcast-select-none");
const broadcastTargetCancelButton = elementById<HTMLButtonElement>("broadcast-target-cancel");
const broadcastTargetApplyButton = elementById<HTMLButtonElement>("broadcast-target-apply");

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
const serverProtocolInput = elementById<HTMLSelectElement>("server-protocol");
const serverHostInput = elementById<HTMLInputElement>("server-host");
const serverHostLabel = elementById<HTMLLabelElement>("server-host-label");
const serverPortInput = elementById<HTMLInputElement>("server-port");
const serverUsernameInput = elementById<HTMLInputElement>("server-username");
const serverGroupInput = elementById<HTMLInputElement>("server-group");
const groupOptions = elementById<HTMLDataListElement>("group-options");
const authTypeInput = elementById<HTMLSelectElement>("auth-type");
const serverUsernameField = elementById<HTMLDivElement>("server-username-field");
const serverAuthField = elementById<HTMLDivElement>("server-auth-field");
const serverSerialSection = elementById<HTMLDivElement>("server-serial-section");
const serverBaudRateInput = elementById<HTMLInputElement>("server-baud-rate");
const serverDataBitsInput = elementById<HTMLSelectElement>("server-data-bits");
const serverStopBitsInput = elementById<HTMLSelectElement>("server-stop-bits");
const serverParityInput = elementById<HTMLSelectElement>("server-parity");
const serverPasswordSection = elementById<HTMLDivElement>("server-password-section");
const serverPasswordInput = elementById<HTMLInputElement>("server-password");
const serverKeySection = elementById<HTMLDivElement>("server-key-section");
const serverKeyPathInput = elementById<HTMLInputElement>("server-key-path");
const serverPassphraseInput = elementById<HTMLInputElement>("server-passphrase");
const browseKeyButton = elementById<HTMLButtonElement>("browse-key-button");
const cancelServerButton = elementById<HTMLButtonElement>("cancel-server-button");
const serverFormError = elementById<HTMLDivElement>("server-form-error");

const migrationModal = elementById<HTMLDialogElement>("migration-modal");
const migrationImportFormat = elementById<HTMLSelectElement>("migration-import-format");
const migrationExportFormat = elementById<HTMLSelectElement>("migration-export-format");
const migrationPassphrase = elementById<HTMLInputElement>("migration-passphrase");
const migrationImportButton = elementById<HTMLButtonElement>("migration-import-button");
const migrationExportButton = elementById<HTMLButtonElement>("migration-export-button");
const migrationCloseButton = elementById<HTMLButtonElement>("migration-close-button");
const migrationStatus = elementById<HTMLDivElement>("migration-status");
const migrationError = elementById<HTMLDivElement>("migration-error");

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

const PROTOCOL_LABELS: Record<WorkspaceTabKind, string> = {
  ssh: "SSH", rdp: "RDP", telnet: "TEL", raw: "RAW", vnc: "VNC",
  http: "WEB", https: "WEB", serial: "COM", welcome: "CG",
};

function tabContext(label: string, context?: Partial<SessionVariableContext>): SessionVariableContext {
  return {
    displayName: context?.displayName ?? label,
    host: context?.host ?? "",
    ip: context?.ip ?? context?.host ?? "",
    username: context?.username ?? "",
    group: context?.group ?? (label === "Welcome" ? "Local" : "Quick Connect"),
  };
}

function createWorkspaceTab(
  kind: WorkspaceTabKind,
  label: string,
  context?: Partial<SessionVariableContext>,
): WorkspaceTab {
  const id = `tab-${++tabSequence}`;
  const tabElement = document.createElement("button");
  tabElement.className = "tab";
  tabElement.type = "button";
  tabElement.role = "tab";
  tabElement.setAttribute("aria-selected", "false");
  const statusElement = createTextElement("span", "tab-status", "") as HTMLSpanElement;
  statusElement.setAttribute("aria-hidden", "true");
  const protocolElement = createTextElement("span", "tab-protocol", PROTOCOL_LABELS[kind]);
  const labelElement = createTextElement("span", "tab-label", label);
  const closeElement = createTextElement("span", "tab-close", "\u00d7");
  closeElement.title = "Close tab";
  closeElement.setAttribute("aria-label", `Close ${label}`);
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
    label,
    context: tabContext(label, context),
    tabElement,
    statusElement,
    paneElement,
    status: "idle",
  };
  tabs.set(id, tab);
  tabElement.addEventListener("click", (event) => {
    if ((event.target as HTMLElement).closest(".tab-close")) void closeTab(id);
    else activateTab(id);
  });
  activateTab(id);
  return tab;
}

function createTerminalTab(
  label: string,
  kind: "ssh" | "telnet" | "raw" | "serial" | "welcome" = "ssh",
  context?: Partial<SessionVariableContext>,
): WorkspaceTab {
  const tab = createWorkspaceTab(kind, label, context);
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
    if (broadcastMode && activeTabId === tab.id && isBroadcastCapable(tab)) {
      for (const target of selectedBroadcastTabs()) writeTerminalInput(target, data);
      return;
    }
    writeTerminalInput(tab, data);
  });
  terminal.onResize(({ cols, rows }) => {
    if (tab.kind === "ssh" && tab.sessionId) window.cybergrid.ssh.resize(tab.sessionId, cols, rows);
  });
  return tab;
}

function isBroadcastCapable(tab: WorkspaceTab): boolean {
  return tab.status === "connected" && (
    (tab.kind === "ssh" && Boolean(tab.sessionId)) ||
    (tab.kind === "serial" && Boolean(tab.serialSessionId))
  );
}

function activeBroadcastTabs(): WorkspaceTab[] {
  return [...tabs.values()].filter(isBroadcastCapable);
}

function selectedBroadcastTabs(): WorkspaceTab[] {
  return activeBroadcastTabs().filter((tab) => !excludedBroadcastGroups.has(tab.context.group));
}

function writeTerminalInput(tab: WorkspaceTab, data: string): void {
  if (tab.kind === "ssh" && tab.sessionId) window.cybergrid.ssh.write(tab.sessionId, data);
  else if ((tab.kind === "telnet" || tab.kind === "raw") && tab.streamSessionId) {
    window.cybergrid.stream.write(tab.streamSessionId, data);
  } else if (tab.kind === "serial" && tab.serialSessionId) {
    window.cybergrid.serial.write(tab.serialSessionId, data);
  }
}

function updateBroadcastControls(): void {
  const available = activeBroadcastTabs();
  const selected = selectedBroadcastTabs();
  if (available.length === 0) broadcastMode = false;
  broadcastToggleButton.disabled = available.length === 0;
  broadcastTargetsButton.disabled = available.length === 0;
  broadcastToggleButton.classList.toggle("active", broadcastMode);
  broadcastToggleButton.setAttribute("aria-pressed", String(broadcastMode));
  broadcastToggleButton.textContent = broadcastMode
    ? `Broadcast On (${selected.length})`
    : "Broadcast Off";
  broadcastTargetsButton.textContent = `Targets (${selected.length}/${available.length})`;
  broadcastTargetsButton.title = available.length === 0
    ? "Open an SSH or serial session to use broadcast mode"
    : "Choose the active SSH and serial groups that receive broadcast input";
}

function createRdpTab(label: string, config: RdpConnectionConfig): WorkspaceTab {
  const tab = createWorkspaceTab("rdp", label);
  tab.paneElement.classList.add("rdp-pane");
  const canvas = document.createElement("div");
  canvas.className = "rdp-canvas";
  const mark = createTextElement("div", "rdp-mark", "RDP");
  const title = document.createElement("h2");
  title.textContent = `${config.username}@${config.host}:${config.port}`;
  const message = document.createElement("p");
  message.textContent = "Preparing the native Windows Remote Desktop client...";
  tab.rdpMessageElement = message;
  const note = createTextElement("div", "rdp-native-note", "The secure desktop surface runs in the Windows RDP client. This tab tracks its lifecycle.");
  const disconnectButton = document.createElement("button");
  disconnectButton.className = "secondary-button";
  disconnectButton.type = "button";
  disconnectButton.textContent = "Close RDP session";
  disconnectButton.addEventListener("click", () => {
    if (tab.rdpSessionId) void window.cybergrid.rdp.disconnect(tab.rdpSessionId);
  });
  canvas.append(mark, title, message, note, disconnectButton);
  tab.paneElement.append(canvas);
  return tab;
}

function createVncTab(label: string): WorkspaceTab {
  const tab = createWorkspaceTab("vnc", label);
  tab.paneElement.classList.add("vnc-pane");
  const screen = document.createElement("div");
  screen.className = "vnc-screen";
  screen.tabIndex = 0;
  screen.append(createTextElement("div", "sidebar-empty", "Preparing embedded VNC canvas..."));
  tab.paneElement.append(screen);
  return tab;
}

function createWebTab(label: string, protocol: "http" | "https"): WorkspaceTab {
  const tab = createWorkspaceTab(protocol, label);
  tab.paneElement.classList.add("web-pane");
  tab.paneElement.textContent = "Loading isolated Chromium management view...";
  return tab;
}

function updateWebBounds(tab: WorkspaceTab): void {
  if (!tab.webSessionId || activeTabId !== tab.id) return;
  const rect = tab.paneElement.getBoundingClientRect();
  window.cybergrid.web.setBounds(tab.webSessionId, {
    x: rect.left, y: rect.top, width: rect.width, height: rect.height,
  });
}

function activateTab(id: string): void {
  const tab = tabs.get(id);
  if (!tab) return;
  activeTabId = id;
  for (const candidate of tabs.values()) {
    const isActive = candidate.id === id;
    candidate.tabElement.classList.toggle("active", isActive);
    candidate.tabElement.setAttribute("aria-selected", String(isActive));
    candidate.paneElement.classList.toggle("active", isActive);
    if (candidate.webSessionId) window.cybergrid.web.setVisible(candidate.webSessionId, isActive);
  }
  updateConnectionState(tab);
  updateSftpAvailability();
  updateBroadcastControls();
  requestAnimationFrame(() => {
    tab.fitAddon?.fit();
    tab.terminal?.focus();
    tab.vncClient?.focus();
    updateWebBounds(tab);
  });
  if (sftpDrawerOpen && tab.kind === "ssh" && tab.sessionId && tab.status === "connected") {
    if (tab.sftp) renderSftpListing(tab.sftp);
    else void loadSftpDirectory(tab, ".");
  }
}

async function closeTab(id: string): Promise<void> {
  const tab = tabs.get(id);
  if (!tab) return;
  const tabOrder = [...tabs.keys()];
  const closedIndex = tabOrder.indexOf(id);
  tabs.delete(id);
  if (tab.sessionId) {
    sshSessions.delete(tab.sessionId);
    await window.cybergrid.ssh.disconnect(tab.sessionId).catch(() => undefined);
    queuedSshData.delete(tab.sessionId);
    queuedSshStatus.delete(tab.sessionId);
  }
  if (tab.rdpSessionId) {
    rdpSessions.delete(tab.rdpSessionId);
    await window.cybergrid.rdp.disconnect(tab.rdpSessionId).catch(() => undefined);
    queuedRdpStatus.delete(tab.rdpSessionId);
  }
  if (tab.streamSessionId) {
    streamSessions.delete(tab.streamSessionId);
    await window.cybergrid.stream.disconnect(tab.streamSessionId).catch(() => undefined);
    queuedStreamData.delete(tab.streamSessionId);
    queuedStreamStatus.delete(tab.streamSessionId);
  }
  if (tab.serialSessionId) {
    serialSessions.delete(tab.serialSessionId);
    await window.cybergrid.serial.disconnect(tab.serialSessionId).catch(() => undefined);
    queuedSerialData.delete(tab.serialSessionId);
    queuedSerialStatus.delete(tab.serialSessionId);
  }
  if (tab.vncSessionId) {
    vncSessions.delete(tab.vncSessionId);
    tab.vncClient?.disconnect();
    await window.cybergrid.vnc.disconnect(tab.vncSessionId).catch(() => undefined);
    queuedVncStatus.delete(tab.vncSessionId);
  }
  if (tab.webSessionId) {
    webSessions.delete(tab.webSessionId);
    window.cybergrid.web.setVisible(tab.webSessionId, false);
    await window.cybergrid.web.disconnect(tab.webSessionId).catch(() => undefined);
    queuedWebStatus.delete(tab.webSessionId);
  }
  tab.terminal?.dispose();
  tab.tabElement.remove();
  tab.paneElement.remove();
  if (activeTabId === id) {
    const remainingIds = [...tabs.keys()];
    const nextId = remainingIds[Math.min(closedIndex, remainingIds.length - 1)];
    if (nextId) activateTab(nextId);
    else {
      activeTabId = null;
      connectionState.textContent = "Ready";
      setSftpDrawerOpen(false);
    }
  }
  updateBroadcastControls();
}

function updateTabStatus(tab: WorkspaceTab, status: WorkspaceStatus, message?: string): void {
  tab.status = status;
  tab.statusElement.classList.toggle("connected", status === "connected" || status === "running" || status === "ready");
  tab.statusElement.classList.toggle("error", status === "error");
  if (status === "error") tab.terminal?.writeln(`\r\n\x1b[31mConnection error: ${message ?? "Unknown error"}\x1b[0m`);
  else if (status === "disconnected" || status === "closed") tab.terminal?.writeln(`\r\n\x1b[90m${message ?? "Disconnected."}\x1b[0m`);
  if (activeTabId === tab.id) {
    updateConnectionState(tab, message);
    updateSftpAvailability();
  }
  updateBroadcastControls();
}

function updateSshTabStatus(tab: WorkspaceTab, event: SshStatusEvent): void {
  updateTabStatus(tab, event.status, event.message);
}

function updateRdpTabStatus(tab: WorkspaceTab, event: RdpStatusEvent): void {
  updateTabStatus(tab, event.status, event.message);
  if (tab.rdpMessageElement) tab.rdpMessageElement.textContent = event.message ?? event.status;
}

function updateConnectionState(tab: WorkspaceTab, message?: string): void {
  const labels: Record<WorkspaceStatus, string> = {
    idle: "Ready", connecting: "Connecting...", connected: "Connected", disconnected: "Disconnected",
    launching: "Launching RDP...", running: "RDP running", closed: "Closed", error: "Connection error",
    loading: "Loading...", ready: "Ready", opening: "Opening serial port...",
  };
  connectionState.textContent = message ?? labels[tab.status];
}

function setTabConnecting(tab: WorkspaceTab, description: string): void {
  tab.status = "connecting";
  updateConnectionState(tab);
  tab.terminal?.writeln(`\x1b[36mCyberGrid\x1b[0m ${description}`);
}

function replayBufferedData(tab: WorkspaceTab, sessionId: string, queue: Map<string, string[]>): void {
  for (const data of queue.get(sessionId) ?? []) tab.terminal?.write(data);
  queue.delete(sessionId);
}

function attachSshSession(tab: WorkspaceTab, sessionId: string): void {
  tab.sessionId = sessionId;
  sshSessions.set(sessionId, tab);
  replayBufferedData(tab, sessionId, queuedSshData);
  const status = queuedSshStatus.get(sessionId);
  if (status) updateSshTabStatus(tab, status);
  queuedSshStatus.delete(sessionId);
  tab.fitAddon?.fit();
  if (tab.terminal) window.cybergrid.ssh.resize(sessionId, tab.terminal.cols, tab.terminal.rows);
  updateBroadcastControls();
}

function attachRdpSession(tab: WorkspaceTab, sessionId: string): void {
  tab.rdpSessionId = sessionId;
  rdpSessions.set(sessionId, tab);
  const status = queuedRdpStatus.get(sessionId);
  if (status) updateRdpTabStatus(tab, status);
  queuedRdpStatus.delete(sessionId);
}

function attachStreamSession(tab: WorkspaceTab, sessionId: string): void {
  tab.streamSessionId = sessionId;
  streamSessions.set(sessionId, tab);
  replayBufferedData(tab, sessionId, queuedStreamData);
  const status = queuedStreamStatus.get(sessionId);
  if (status) updateTabStatus(tab, status.status, status.message);
  queuedStreamStatus.delete(sessionId);
}

function attachSerialSession(tab: WorkspaceTab, sessionId: string): void {
  tab.serialSessionId = sessionId;
  serialSessions.set(sessionId, tab);
  replayBufferedData(tab, sessionId, queuedSerialData);
  const status = queuedSerialStatus.get(sessionId);
  if (status) updateTabStatus(tab, status.status, status.message);
  queuedSerialStatus.delete(sessionId);
  updateBroadcastControls();
}

async function waitForNoVnc(): Promise<NoVncRfbConstructor> {
  if (window.NoVncRfb) return window.NoVncRfb;
  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("noVNC failed to load.")), 5_000);
    window.addEventListener("cybergrid:novnc-ready", () => {
      window.clearTimeout(timeout);
      resolve();
    }, { once: true });
  });
  if (!window.NoVncRfb) throw new Error("noVNC failed to initialize.");
  return window.NoVncRfb;
}

async function attachVncSession(tab: WorkspaceTab, result: VncConnectionResult): Promise<void> {
  tab.vncSessionId = result.sessionId;
  vncSessions.set(result.sessionId, tab);
  const Rfb = await waitForNoVnc();
  const screen = tab.paneElement.querySelector<HTMLElement>(".vnc-screen");
  if (!screen) throw new Error("VNC canvas is unavailable.");
  screen.replaceChildren();
  const client = new Rfb(screen, result.proxyUrl, { credentials: { password: result.password } });
  client.scaleViewport = true;
  client.resizeSession = true;
  client.addEventListener("connect", () => updateTabStatus(tab, "connected"));
  client.addEventListener("disconnect", () => updateTabStatus(tab, "disconnected"));
  client.addEventListener("securityfailure", () => updateTabStatus(tab, "error", "VNC authentication failed."));
  tab.vncClient = client;
  const status = queuedVncStatus.get(result.sessionId);
  if (status) updateTabStatus(tab, status.status, status.message);
  queuedVncStatus.delete(result.sessionId);
}

function attachWebSession(tab: WorkspaceTab, sessionId: string): void {
  tab.webSessionId = sessionId;
  webSessions.set(sessionId, tab);
  const status = queuedWebStatus.get(sessionId);
  if (status) updateTabStatus(tab, status.status, status.message);
  queuedWebStatus.delete(sessionId);
  window.cybergrid.web.setVisible(sessionId, activeTabId === tab.id);
  requestAnimationFrame(() => updateWebBounds(tab));
}

function queueData(event: { sessionId: string; data: string }, sessions: Map<string, WorkspaceTab>, queue: Map<string, string[]>): void {
  const tab = sessions.get(event.sessionId);
  if (tab) {
    tab.terminal?.write(event.data);
    return;
  }
  const buffered = queue.get(event.sessionId) ?? [];
  if (buffered.reduce((size, chunk) => size + chunk.length, 0) < 1_000_000) {
    buffered.push(event.data);
    queue.set(event.sessionId, buffered);
  }
}

function handleSshData(event: SshDataEvent): void { queueData(event, sshSessions, queuedSshData); }
function handleStreamData(event: StreamDataEvent): void { queueData(event, streamSessions, queuedStreamData); }
function handleSerialData(event: SerialDataEvent): void { queueData(event, serialSessions, queuedSerialData); }

function handleSshStatus(event: SshStatusEvent): void {
  const tab = sshSessions.get(event.sessionId);
  if (tab) updateSshTabStatus(tab, event); else queuedSshStatus.set(event.sessionId, event);
}
function handleRdpStatus(event: RdpStatusEvent): void {
  const tab = rdpSessions.get(event.sessionId);
  if (tab) updateRdpTabStatus(tab, event); else queuedRdpStatus.set(event.sessionId, event);
}
function handleStreamStatus(event: StreamStatusEvent): void {
  const tab = streamSessions.get(event.sessionId);
  if (tab) updateTabStatus(tab, event.status, event.message); else queuedStreamStatus.set(event.sessionId, event);
}
function handleSerialStatus(event: SerialStatusEvent): void {
  const tab = serialSessions.get(event.sessionId);
  if (tab) updateTabStatus(tab, event.status, event.message); else queuedSerialStatus.set(event.sessionId, event);
}
function handleVncStatus(event: VncStatusEvent): void {
  const tab = vncSessions.get(event.sessionId);
  if (tab) updateTabStatus(tab, event.status, event.message); else queuedVncStatus.set(event.sessionId, event);
}
function handleWebStatus(event: WebStatusEvent): void {
  const tab = webSessions.get(event.sessionId);
  if (tab) updateTabStatus(tab, event.status, event.message); else queuedWebStatus.set(event.sessionId, event);
}

function createTabForProfile(profile: ServerProfileSummary): WorkspaceTab {
  if (profile.protocol === "rdp") return createRdpTab(profile.name, { host: profile.host, port: profile.port, username: profile.username });
  if (profile.protocol === "vnc") return createVncTab(profile.name);
  if (profile.protocol === "http" || profile.protocol === "https") return createWebTab(profile.name, profile.protocol);
  return createTerminalTab(profile.name, profile.protocol, {
    displayName: profile.name,
    host: profile.host,
    ip: profile.host,
    username: profile.username,
    group: profile.group,
  });
}

async function attachProfileResult(tab: WorkspaceTab, result: ProfileConnectionResult): Promise<void> {
  tab.context = result.context;
  if (result.protocol === "ssh") attachSshSession(tab, result.sessionId);
  else if (result.protocol === "rdp") attachRdpSession(tab, result.sessionId);
  else if (result.protocol === "telnet" || result.protocol === "raw") attachStreamSession(tab, result.sessionId);
  else if (result.protocol === "serial") attachSerialSession(tab, result.sessionId);
  else if (result.protocol === "vnc") await attachVncSession(tab, result);
  else attachWebSession(tab, result.sessionId);
}

function handleConnectionFailure(tab: WorkspaceTab, error: unknown): void {
  updateTabStatus(tab, "error", errorMessage(error));
  if (tab.rdpMessageElement) tab.rdpMessageElement.textContent = errorMessage(error);
}

async function connectSavedProfile(profile: ServerProfileSummary): Promise<void> {
  const tab = createTabForProfile(profile);
  setTabConnecting(tab, `opening ${profile.protocol.toUpperCase()} profile ${profile.name} from the encrypted vault...`);
  try {
    await attachProfileResult(tab, await window.cybergrid.profiles.connect(profile.id));
  } catch (error) {
    handleConnectionFailure(tab, error);
  }
}

async function connectQuickSsh(config: SshConnectionConfig): Promise<void> {
  const tab = createTerminalTab(config.host, "ssh", {
    host: config.host, ip: config.host, username: config.username, group: "Quick Connect",
  });
  setTabConnecting(tab, `connecting to ${config.username}@${config.host}:${config.port}...`);
  try { attachSshSession(tab, await window.cybergrid.ssh.connect(config)); }
  catch (error) { handleConnectionFailure(tab, error); }
}

async function connectQuickRdp(config: RdpConnectionConfig): Promise<void> {
  const tab = createRdpTab(config.host, config);
  tab.status = "launching";
  updateConnectionState(tab);
  try { attachRdpSession(tab, await window.cybergrid.rdp.connect(config)); }
  catch (error) { handleConnectionFailure(tab, error); }
}

async function connectQuickStream(config: StreamConnectionConfig): Promise<void> {
  const tab = createTerminalTab(config.host, config.protocol, {
    host: config.host, ip: config.host, group: "Quick Connect",
  });
  setTabConnecting(tab, `connecting to ${config.host}:${config.port}...`);
  try { attachStreamSession(tab, await window.cybergrid.stream.connect(config)); }
  catch (error) { handleConnectionFailure(tab, error); }
}

async function connectQuickSerial(config: SerialConnectionConfig): Promise<void> {
  const tab = createTerminalTab(config.path, "serial", {
    host: config.path, ip: config.path, group: "Quick Connect",
  });
  setTabConnecting(tab, `opening ${config.path} at ${config.baudRate} baud...`);
  try { attachSerialSession(tab, await window.cybergrid.serial.connect(config)); }
  catch (error) { handleConnectionFailure(tab, error); }
}

async function connectQuickVnc(config: VncConnectionConfig): Promise<void> {
  const tab = createVncTab(config.host);
  setTabConnecting(tab, `connecting to VNC ${config.host}:${config.port}...`);
  try { await attachVncSession(tab, await window.cybergrid.vnc.connect(config)); }
  catch (error) { handleConnectionFailure(tab, error); }
}

async function connectQuickWeb(url: string): Promise<void> {
  const parsed = new URL(url);
  const protocol = parsed.protocol === "https:" ? "https" : "http";
  const tab = createWebTab(parsed.hostname, protocol);
  updateTabStatus(tab, "loading");
  try { attachWebSession(tab, await window.cybergrid.web.connect({ url: parsed.toString() })); }
  catch (error) { handleConnectionFailure(tab, error); }
}

type QuickConnection =
  | { protocol: "ssh"; config: SshConnectionConfig }
  | { protocol: "rdp"; config: RdpConnectionConfig }
  | { protocol: "telnet" | "raw"; config: StreamConnectionConfig }
  | { protocol: "serial"; config: SerialConnectionConfig }
  | { protocol: "vnc"; config: VncConnectionConfig }
  | { protocol: "http" | "https"; url: string };

function parseQuickConnect(value: string): QuickConnection {
  const raw = value.trim();
  let url: URL;
  try { url = new URL(raw); }
  catch { throw new Error("Use protocol://user@host:port, serial://COM3?baud=9600, or an HTTP(S) URL."); }
  const protocol = url.protocol.replace(":", "") as ConnectionProtocol;
  if (!(["ssh", "rdp", "telnet", "raw", "vnc", "http", "https", "serial"] as string[]).includes(protocol)) {
    throw new Error("Unsupported Quick Connect protocol.");
  }
  if (protocol === "http" || protocol === "https") return { protocol, url: url.toString() };
  if (protocol === "serial") {
    const pathPart = raw.replace(/^serial:\/\//i, "").split("?")[0] ?? "";
    const path = decodeURIComponent(pathPart.startsWith("/") ? pathPart : url.hostname);
    if (!path) throw new Error("Serial Quick Connect requires a COM or device path.");
    return { protocol, config: {
      path,
      baudRate: Number(url.searchParams.get("baud") ?? 9_600),
      dataBits: Number(url.searchParams.get("dataBits") ?? 8) as 5 | 6 | 7 | 8,
      stopBits: Number(url.searchParams.get("stopBits") ?? 1) as 1 | 2,
      parity: (url.searchParams.get("parity") ?? "none") as SerialConnectionConfig["parity"],
    } };
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!host) throw new Error("Quick Connect requires a host.");
  const username = decodeURIComponent(url.username);
  if (protocol === "ssh") {
    if (!username) throw new Error("SSH Quick Connect requires a username.");
    return { protocol, config: { host, port: Number(url.port || 22), username, password: decodeURIComponent(url.password) || quickPasswordInput.value || undefined } };
  }
  if (protocol === "rdp") {
    if (!username) throw new Error("RDP Quick Connect requires a username.");
    return { protocol, config: { host, port: Number(url.port || 3389), username } };
  }
  if (protocol === "vnc") return { protocol, config: { host, port: Number(url.port || 5900), password: decodeURIComponent(url.password) || quickPasswordInput.value || undefined } };
  return { protocol, config: { protocol, host, port: Number(url.port || 23) } };
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
  const [profiles, assets, snippets] = await Promise.all([
    window.cybergrid.vault.listProfiles(),
    window.cybergrid.vault.listAssets(),
    window.cybergrid.vault.listSnippets(),
  ]);
  savedProfiles = profiles;
  savedAssets = assets;
  savedSnippets = snippets;
  renderProfiles();
  renderAssets();
  renderSnippets();
  await configureHealthMonitor();
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
  if (profile.protocol === "serial") {
    quickConnectInput.value = `serial://${profile.host}?baud=${profile.baudRate ?? 9_600}`;
  } else if (profile.protocol === "http" || profile.protocol === "https") {
    quickConnectInput.value = `${profile.protocol}://${profile.host}:${profile.port}`;
  } else {
    const user = profile.username ? `${encodeURIComponent(profile.username)}@` : "";
    quickConnectInput.value = `${profile.protocol}://${user}${profile.host}:${profile.port}`;
  }
  quickPasswordInput.value = "";
}

function applyHealthStatus(dot: HTMLElement, event: HealthStatusEvent | undefined): void {
  dot.classList.remove("checking", "online", "offline", "unsupported");
  if (event) {
    dot.classList.add(event.status);
    dot.title = event.status === "online" && event.latencyMs
      ? `Online (${event.latencyMs} ms)`
      : event.status.charAt(0).toUpperCase() + event.status.slice(1);
  } else {
    dot.title = "Health check pending";
  }
}

function handleHealthStatus(event: HealthStatusEvent): void {
  healthStatuses.set(event.profileId, event);
  const dot = profileTree.querySelector<HTMLElement>(`[data-health-id="${event.profileId}"]`);
  if (dot) applyHealthStatus(dot, event);
}

async function configureHealthMonitor(): Promise<void> {
  await window.cybergrid.health.setTargets(savedProfiles.map((profile) => ({
    profileId: profile.id,
    host: profile.host,
    protocol: profile.protocol,
  })));
}

function renderProfiles(): void {
  profileTree.replaceChildren();
  groupOptions.replaceChildren();

  if (savedProfiles.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "sidebar-empty";
    emptyState.textContent = "No saved connections yet. Add one or import an existing connection tree.";
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
      const endpoint = profile.protocol === "serial"
        ? `${profile.host} / ${profile.baudRate ?? 9_600} baud`
        : `${profile.protocol.toUpperCase()}  ${profile.username ? `${profile.username}@` : ""}${profile.host}:${profile.port}`;
      meta.append(
        createTextElement("span", "server-name", profile.name),
        createTextElement("span", "server-host", endpoint),
      );
      const healthDot = createTextElement("span", "server-dot", "");
      healthDot.dataset.healthId = profile.id;
      applyHealthStatus(healthDot, healthStatuses.get(profile.id));
      serverButton.append(healthDot, meta);
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
  await configureHealthMonitor();
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
  if (open) setSnippetsDrawerOpen(false);
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

function setSnippetsDrawerOpen(open: boolean): void {
  if (open && sftpDrawerOpen) setSftpDrawerOpen(false);
  snippetsDrawerOpen = open;
  contentArea.classList.toggle("snippets-open", open);
  snippetsDrawer.hidden = !open;
  toggleSnippetsButton.classList.toggle("active", open);
  if (open) renderSnippets();
  requestAnimationFrame(() => tabs.get(activeTabId ?? "")?.fitAddon?.fit());
}

function editableSnippet(snippet?: SnippetRecord): void {
  snippetIdInput.value = snippet?.id ?? "";
  snippetNameInput.value = snippet?.name ?? "";
  snippetLanguageInput.value = snippet?.language ?? "bash";
  snippetTagsInput.value = snippet?.tags.join(", ") ?? "";
  snippetBodyInput.value = snippet?.body ?? "";
  snippetFormTitle.textContent = snippet ? "Edit snippet" : "New snippet";
  snippetFormError.textContent = "";
  snippetForm.hidden = false;
  requestAnimationFrame(() => snippetNameInput.focus());
}

function hideSnippetForm(): void {
  snippetForm.reset();
  snippetIdInput.value = "";
  snippetFormError.textContent = "";
  snippetForm.hidden = true;
}

function substituteSnippetTokens(snippet: SnippetRecord, tab: WorkspaceTab): string {
  const values: Record<string, string> = {
    HOST: tab.context.host,
    USERNAME: tab.context.username,
    IP: tab.context.ip,
  };
  return snippet.body.replace(/\$\{([A-Z_][A-Z0-9_]*)\}/g, (token, name: string) => {
    if (!(name in values)) {
      throw new Error(`Unsupported snippet token ${token}. Use \${HOST}, \${USERNAME}, or \${IP}.`);
    }
    return values[name] ?? "";
  });
}

function commandForTerminal(value: string): string {
  const normalized = value.replace(/\r\n|\r|\n/g, "\r");
  return normalized.endsWith("\r") ? normalized : `${normalized}\r`;
}

function activeSnippetTab(): WorkspaceTab | undefined {
  const tab = activeTabId ? tabs.get(activeTabId) : undefined;
  if (!tab || tab.status !== "connected") return undefined;
  if (tab.kind === "ssh" && tab.sessionId) return tab;
  if ((tab.kind === "telnet" || tab.kind === "raw") && tab.streamSessionId) return tab;
  if (tab.kind === "serial" && tab.serialSessionId) return tab;
  return undefined;
}

function executeSnippet(snippet: SnippetRecord): void {
  const targets = broadcastMode ? selectedBroadcastTabs() : [activeSnippetTab()].filter(
    (tab): tab is WorkspaceTab => Boolean(tab),
  );
  if (targets.length === 0) {
    snippetStatus.textContent = broadcastMode
      ? "No selected broadcast targets are connected."
      : "Select a connected SSH, Telnet, RAW, or serial tab first.";
    return;
  }
  try {
    for (const tab of targets) {
      writeTerminalInput(tab, commandForTerminal(substituteSnippetTokens(snippet, tab)));
    }
    snippetStatus.textContent = `Executed "${snippet.name}" on ${targets.length} session${targets.length === 1 ? "" : "s"}.`;
  } catch (error) {
    snippetStatus.textContent = errorMessage(error);
  }
}

function renderSnippets(): void {
  const query = snippetSearchInput.value.trim().toLocaleLowerCase();
  const filtered = savedSnippets.filter((snippet) =>
    !query || [snippet.name, snippet.language, snippet.body, ...snippet.tags]
      .some((value) => value.toLocaleLowerCase().includes(query)),
  );
  snippetList.replaceChildren();
  if (filtered.length === 0) {
    snippetList.append(createTextElement(
      "div",
      "sidebar-empty",
      savedSnippets.length === 0 ? "No command snippets saved yet." : "No snippets match this filter.",
    ));
    return;
  }
  for (const snippet of filtered) {
    const card = document.createElement("article");
    card.className = "snippet-card";
    const heading = createTextElement("div", "snippet-card-heading", "");
    heading.append(
      createTextElement("span", "snippet-name", snippet.name),
      createTextElement("span", "snippet-language", snippet.language === "cisco" ? "CISCO CLI" : snippet.language.toUpperCase()),
    );
    const tags = createTextElement("div", "snippet-tags", "");
    for (const tag of snippet.tags) tags.append(createTextElement("span", "snippet-tag", tag));
    const preview = createTextElement("div", "snippet-preview", snippet.body.split(/\r?\n/)[0] ?? "");
    const actions = createTextElement("div", "snippet-actions", "");
    const runButton = document.createElement("button");
    runButton.className = "primary-button compact-button";
    runButton.type = "button";
    runButton.textContent = "Run";
    runButton.addEventListener("click", () => executeSnippet(snippet));
    const editButton = document.createElement("button");
    editButton.className = "secondary-button compact-button";
    editButton.type = "button";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => editableSnippet(snippet));
    const deleteButton = document.createElement("button");
    deleteButton.className = "secondary-button compact-button";
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", async () => {
      if (!window.confirm(`Delete the snippet "${snippet.name}"?`)) return;
      try {
        await window.cybergrid.vault.deleteSnippet(snippet.id);
        savedSnippets = await window.cybergrid.vault.listSnippets();
        renderSnippets();
      } catch (error) {
        snippetStatus.textContent = errorMessage(error);
      }
    });
    actions.append(runButton, editButton, deleteButton);
    card.append(heading, tags, preview, actions);
    snippetList.append(card);
  }
}

function renderBroadcastTargets(): void {
  const groups = new Map<string, WorkspaceTab[]>();
  for (const tab of activeBroadcastTabs()) {
    const entries = groups.get(tab.context.group) ?? [];
    entries.push(tab);
    groups.set(tab.context.group, entries);
  }
  broadcastTargetList.replaceChildren();
  for (const [group, groupTabs] of [...groups.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const label = document.createElement("label");
    label.className = "broadcast-target-row";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = group;
    checkbox.checked = !excludedBroadcastGroups.has(group);
    const details = createTextElement("span", "broadcast-target-details", "");
    details.append(
      createTextElement("span", "broadcast-target-group", group),
      createTextElement("span", "broadcast-target-tabs", groupTabs.map((tab) => tab.label).join(", ")),
    );
    label.append(checkbox, details, createTextElement("span", "folder-count", String(groupTabs.length)));
    checkbox.addEventListener("change", updateBroadcastTargetCount);
    broadcastTargetList.append(label);
  }
  updateBroadcastTargetCount();
}

function updateBroadcastTargetCount(): void {
  const checkedGroups = new Set(
    [...broadcastTargetList.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked')]
      .map((input) => input.value),
  );
  const count = activeBroadcastTabs().filter((tab) => checkedGroups.has(tab.context.group)).length;
  broadcastTargetCount.textContent = `${count} session${count === 1 ? "" : "s"} selected`;
}

function openBroadcastTargets(): void {
  renderBroadcastTargets();
  if (!broadcastTargetsModal.open) broadcastTargetsModal.showModal();
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

const DEFAULT_PROTOCOL_PORTS: Record<Exclude<ConnectionProtocol, "serial">, number> = {
  ssh: 22,
  rdp: 3389,
  telnet: 23,
  raw: 23,
  vnc: 5900,
  http: 80,
  https: 443,
};

function updateProfileFields(resetDefaults = false): void {
  const protocol = serverProtocolInput.value as ConnectionProtocol;
  const serial = protocol === "serial";
  const usesUsername = protocol === "ssh" || protocol === "rdp";
  const usesAuthentication = protocol === "ssh" || protocol === "rdp" || protocol === "vnc";
  const privateKeyOption = authTypeInput.querySelector<HTMLOptionElement>('option[value="privateKey"]');

  serverHostLabel.textContent = serial ? "COM port or device path" : "Hostname or IP";
  serverHostInput.placeholder = serial ? "COM3 or /dev/ttyUSB0" : "server.example.net";
  serverPortInput.closest<HTMLElement>(".field")?.toggleAttribute("hidden", serial);
  serverPortInput.disabled = serial;
  serverPortInput.required = !serial;
  serverSerialSection.hidden = !serial;
  serverBaudRateInput.required = serial;
  serverUsernameField.hidden = !usesUsername;
  serverUsernameInput.required = usesUsername;
  serverAuthField.hidden = !usesAuthentication;
  privateKeyOption?.toggleAttribute("disabled", protocol !== "ssh");

  if (resetDefaults) {
    if (!serial) serverPortInput.value = String(DEFAULT_PROTOCOL_PORTS[protocol]);
    authTypeInput.value = usesAuthentication ? "password" : "none";
  } else if (protocol !== "ssh" && authTypeInput.value === "privateKey") {
    authTypeInput.value = usesAuthentication ? "password" : "none";
  } else if (!usesAuthentication) {
    authTypeInput.value = "none";
  }

  const usesPassword = usesAuthentication && authTypeInput.value === "password";
  const usesPrivateKey = protocol === "ssh" && authTypeInput.value === "privateKey";
  serverPasswordSection.hidden = !usesPassword;
  serverKeySection.hidden = !usesPrivateKey;
  serverPasswordInput.required = usesPassword;
  serverKeyPathInput.required = usesPrivateKey;
}

function openServerModal(): void {
  serverForm.reset();
  serverProtocolInput.value = "ssh";
  serverBaudRateInput.value = "9600";
  serverFormError.textContent = "";
  updateProfileFields(true);
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
    if (parsed.protocol === "ssh") await connectQuickSsh(parsed.config);
    else if (parsed.protocol === "rdp") await connectQuickRdp(parsed.config);
    else if (parsed.protocol === "telnet" || parsed.protocol === "raw") await connectQuickStream(parsed.config);
    else if (parsed.protocol === "serial") await connectQuickSerial(parsed.config);
    else if (parsed.protocol === "vnc") await connectQuickVnc(parsed.config);
    else if (parsed.protocol === "http" || parsed.protocol === "https") await connectQuickWeb(parsed.url);
  } catch (error) {
    connectionState.textContent = errorMessage(error);
  } finally {
    quickPasswordInput.value = "";
  }
});

broadcastToggleButton.addEventListener("click", () => {
  if (broadcastMode) {
    broadcastMode = false;
  } else if (selectedBroadcastTabs().length === 0) {
    openBroadcastTargets();
  } else {
    broadcastMode = true;
  }
  updateBroadcastControls();
  tabs.get(activeTabId ?? "")?.terminal?.focus();
});
broadcastTargetsButton.addEventListener("click", openBroadcastTargets);
broadcastSelectAllButton.addEventListener("click", () => {
  for (const input of broadcastTargetList.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')) {
    input.checked = true;
  }
  updateBroadcastTargetCount();
});
broadcastSelectNoneButton.addEventListener("click", () => {
  for (const input of broadcastTargetList.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')) {
    input.checked = false;
  }
  updateBroadcastTargetCount();
});
broadcastTargetCancelButton.addEventListener("click", () => broadcastTargetsModal.close());
broadcastTargetApplyButton.addEventListener("click", () => {
  const activeGroups = new Set(activeBroadcastTabs().map((tab) => tab.context.group));
  const checkedGroups = new Set(
    [...broadcastTargetList.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked')]
      .map((input) => input.value),
  );
  for (const group of activeGroups) {
    if (checkedGroups.has(group)) excludedBroadcastGroups.delete(group);
    else excludedBroadcastGroups.add(group);
  }
  if (selectedBroadcastTabs().length === 0) broadcastMode = false;
  broadcastTargetsModal.close();
  updateBroadcastControls();
});
broadcastTargetsModal.addEventListener("click", (event) => {
  if (event.target === broadcastTargetsModal) broadcastTargetsModal.close();
});

toggleSftpButton.addEventListener("click", () => setSftpDrawerOpen(!sftpDrawerOpen));
sftpCloseButton.addEventListener("click", () => setSftpDrawerOpen(false));
toggleSnippetsButton.addEventListener("click", () => setSnippetsDrawerOpen(!snippetsDrawerOpen));
snippetsCloseButton.addEventListener("click", () => setSnippetsDrawerOpen(false));
snippetSearchInput.addEventListener("input", renderSnippets);
addSnippetButton.addEventListener("click", () => editableSnippet());
snippetCancelButton.addEventListener("click", hideSnippetForm);
snippetForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  snippetFormError.textContent = "";
  const input: SnippetInput = {
    name: snippetNameInput.value.trim(),
    language: snippetLanguageInput.value as SnippetLanguage,
    tags: [...new Set(snippetTagsInput.value.split(",").map((tag) => tag.trim()).filter(Boolean))],
    body: snippetBodyInput.value,
  };
  if (snippetIdInput.value) input.id = snippetIdInput.value;
  try {
    await window.cybergrid.vault.saveSnippet(input);
    savedSnippets = await window.cybergrid.vault.listSnippets();
    hideSnippetForm();
    renderSnippets();
    snippetStatus.textContent = `Saved "${input.name}" in the encrypted vault.`;
  } catch (error) {
    snippetFormError.textContent = errorMessage(error);
  }
});
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
migrationButton.addEventListener("click", () => {
  migrationStatus.textContent = "";
  migrationError.textContent = "";
  migrationPassphrase.value = "";
  if (!migrationModal.open) migrationModal.showModal();
});

migrationImportButton.addEventListener("click", async () => {
  migrationStatus.textContent = "Choose an import file...";
  migrationError.textContent = "";
  migrationImportButton.disabled = true;
  try {
    const result = await window.cybergrid.migration.importConnections({
      format: migrationImportFormat.value as MigrationFormat,
      teamPassphrase: migrationPassphrase.value || undefined,
    });
    if (!result) {
      migrationStatus.textContent = "Import canceled.";
      return;
    }
    await refreshVaultContent();
    const warningText = result.warnings.length > 0
      ? ` ${result.warnings.length} warning${result.warnings.length === 1 ? "" : "s"}: ${result.warnings.slice(0, 3).join(" ")}`
      : "";
    migrationStatus.textContent = `Imported ${result.imported} connection${result.imported === 1 ? "" : "s"} from ${result.path}.${warningText}`;
  } catch (error) {
    migrationStatus.textContent = "";
    migrationError.textContent = errorMessage(error);
  } finally {
    migrationImportButton.disabled = false;
    migrationPassphrase.value = "";
  }
});

migrationExportButton.addEventListener("click", async () => {
  migrationStatus.textContent = "Choose an export destination...";
  migrationError.textContent = "";
  migrationExportButton.disabled = true;
  try {
    const result = await window.cybergrid.migration.exportConnections({
      format: migrationExportFormat.value as MigrationFormat,
      teamPassphrase: migrationPassphrase.value || undefined,
    });
    migrationStatus.textContent = result.path
      ? `Exported ${result.exported} connection${result.exported === 1 ? "" : "s"} to ${result.path}.`
      : "Export canceled.";
  } catch (error) {
    migrationStatus.textContent = "";
    migrationError.textContent = errorMessage(error);
  } finally {
    migrationExportButton.disabled = false;
    migrationPassphrase.value = "";
  }
});

migrationCloseButton.addEventListener("click", () => migrationModal.close());
migrationModal.addEventListener("close", () => {
  migrationPassphrase.value = "";
});
migrationModal.addEventListener("click", (event) => {
  if (event.target === migrationModal) migrationModal.close();
});

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
    if (migrationModal.open) {
      migrationModal.close();
    }
    if (broadcastTargetsModal.open) {
      broadcastTargetsModal.close();
    }
    setSftpDrawerOpen(false);
    setSnippetsDrawerOpen(false);
    broadcastMode = false;
    await window.cybergrid.vault.lock();
    activeScanId = null;
    setScanRunning(false);
    scanDevices.clear();
    savedProfiles = [];
    savedAssets = [];
    savedSnippets = [];
    healthStatuses.clear();
    renderProfiles();
    renderAssets();
    renderSnippets();
    updateBroadcastControls();
    setVaultPrompt(true);
  } catch (error) {
    window.alert(errorMessage(error));
  }
});

serverProtocolInput.addEventListener("change", () => updateProfileFields(true));
authTypeInput.addEventListener("change", () => updateProfileFields(false));
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
  const protocol = serverProtocolInput.value as ConnectionProtocol;
  const authType = authTypeInput.value as ServerAuthType;
  const profile: ServerProfileInput = {
    protocol,
    name: serverNameInput.value.trim(),
    host: serverHostInput.value.trim(),
    port: protocol === "serial" ? 0 : Number(serverPortInput.value),
    username: serverUsernameInput.value.trim(),
    group: serverGroupInput.value.trim() || "Ungrouped",
    authType,
    password: authType === "password" ? serverPasswordInput.value : undefined,
    privateKeyPath: authType === "privateKey" ? serverKeyPathInput.value.trim() : undefined,
    passphrase: authType === "privateKey" ? serverPassphraseInput.value : undefined,
    baudRate: protocol === "serial" ? Number(serverBaudRateInput.value) : undefined,
    dataBits: protocol === "serial" ? Number(serverDataBitsInput.value) as 5 | 6 | 7 | 8 : undefined,
    stopBits: protocol === "serial" ? Number(serverStopBitsInput.value) as 1 | 2 : undefined,
    parity: protocol === "serial" ? serverParityInput.value as ServerProfileInput["parity"] : undefined,
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
window.cybergrid.stream.onData(handleStreamData);
window.cybergrid.stream.onStatus(handleStreamStatus);
window.cybergrid.serial.onData(handleSerialData);
window.cybergrid.serial.onStatus(handleSerialStatus);
window.cybergrid.vnc.onStatus(handleVncStatus);
window.cybergrid.web.onStatus(handleWebStatus);
window.cybergrid.health.onStatus(handleHealthStatus);
window.cybergrid.discovery.onProgress(handleDiscoveryProgress);
window.cybergrid.discovery.onResult(handleDiscoveryResult);
window.cybergrid.discovery.onComplete(handleDiscoveryComplete);

const resizeObserver = new ResizeObserver(() => {
  if (activeTabId) {
    const tab = tabs.get(activeTabId);
    tab?.fitAddon?.fit();
    if (tab) updateWebBounds(tab);
  }
});
resizeObserver.observe(terminalStack);

applySettings(currentSettings, false);
const welcomeTab = createTerminalTab("Welcome", "welcome");
welcomeTab.terminal?.writeln("\x1b[36mCyberGrid\x1b[0m");
welcomeTab.terminal?.writeln("SSH, SFTP, RDP, VNC, Telnet, RAW TCP, serial, and web management in one workspace.\r\n");
welcomeTab.terminal?.writeln("Quick Connect examples: ssh://user@host:22, vnc://host:5900, serial://COM3?baud=9600");
welcomeTab.terminal?.writeln("Import team vaults and legacy connection trees, or scan a private IPv4 subnet from the sidebar.");
updateSftpAvailability();
void initializeVault();
