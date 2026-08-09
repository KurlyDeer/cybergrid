import { Terminal, type ITheme } from "xterm";
import { FitAddon } from "xterm-addon-fit";

type XtermTerminal = Terminal;
type XtermFitAddon = FitAddon;
type CyberGridApi = import("../shared/ipc").CyberGridApi;
type ConnectionProtocol = import("../shared/ipc").ConnectionProtocol;
type AssetInput = import("../shared/ipc").AssetInput;
type AssetRecord = import("../shared/ipc").AssetRecord;
type AppPreferences = import("../shared/ipc").AppPreferences;
type AppUpdateEvent = import("../shared/ipc").AppUpdateEvent;
type ConfigBackupInput = import("../shared/ipc").ConfigBackupInput;
type ConnectionCategory = import("../shared/ipc").ConnectionCategory;
type DeviceIcon = import("../shared/ipc").DeviceIcon;
type DiscoveredDevice = import("../shared/ipc").DiscoveredDevice;
type DiscoveryCompleteEvent = import("../shared/ipc").DiscoveryCompleteEvent;
type DiscoveryProgressEvent = import("../shared/ipc").DiscoveryProgressEvent;
type DiscoveryResultEvent = import("../shared/ipc").DiscoveryResultEvent;
type DiagnosticKind = import("../shared/ipc").DiagnosticKind;
type DiagnosticResult = import("../shared/ipc").DiagnosticResult;
type ConnectionTaskInput = import("../shared/ipc").ConnectionTaskInput;
type ConnectionTaskRecord = import("../shared/ipc").ConnectionTaskRecord;
type ExternalToolInput = import("../shared/ipc").ExternalToolInput;
type ExternalToolRecord = import("../shared/ipc").ExternalToolRecord;
type FolderDefaultsInput = import("../shared/ipc").FolderDefaultsInput;
type FolderDefaultsSummary = import("../shared/ipc").FolderDefaultsSummary;
type HealthStatusEvent = import("../shared/ipc").HealthStatusEvent;
type MigrationFormat = import("../shared/ipc").MigrationFormat;
type InventorySyncSourceInput = import("../shared/ipc").InventorySyncSourceInput;
type InventorySyncSourceSummary = import("../shared/ipc").InventorySyncSourceSummary;
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
type SessionPolicy = import("../shared/ipc").SessionPolicy;
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
type TerminalAppearanceOverrides = import("../shared/ipc").TerminalAppearanceOverrides;
type VncConnectionConfig = import("../shared/ipc").VncConnectionConfig;
type VncConnectionResult = import("../shared/ipc").VncConnectionResult;
type VncStatusEvent = import("../shared/ipc").VncStatusEvent;
type WebStatusEvent = import("../shared/ipc").WebStatusEvent;
type WorkspaceSnapshot = import("../shared/ipc").WorkspaceSnapshot;

declare global {
  interface Window {
    cybergrid: CyberGridApi;
    NoVncRfb?: NoVncRfbConstructor;
  }
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
  duplicate?: () => Promise<void>;
  postConnectStarted?: boolean;
  policy?: SessionPolicy;
  reconnectTimer?: number;
}

const DEFAULT_SETTINGS: AppPreferences = {
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
  externalToolPaths: { wireshark: "", winscp: "", nmap: "", powershell: "powershell.exe" },
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
const diagnosticResults = new Map<string, DiagnosticResult | "running">();
const collapsedGroups = new Set<string>();
let savedProfiles: ServerProfileSummary[] = [];
let savedAssets: AssetRecord[] = [];
let savedSnippets: SnippetRecord[] = [];
let folderDefaults: FolderDefaultsSummary[] = [];
let externalTools: ExternalToolRecord[] = [];
let connectionTasks: ConnectionTaskRecord[] = [];
let syncSources: InventorySyncSourceSummary[] = [];
let activeScanId: string | null = null;
let editingAssetId: string | null = null;
const scanDevices = new Map<string, DiscoveredDevice>();
const ipamHostStatuses = new Map<string, "online" | "offline">();
let selectedIpamAddress: string | null = null;
let ipamRenderFrame: number | null = null;
let activeTabId: string | null = null;
let tabSequence = 0;
let vaultMode: "create" | "unlock" = "unlock";
let sftpDrawerOpen = false;
let snippetsDrawerOpen = false;
let selectedProfileId: string | null = null;
let connectionCategory: ConnectionCategory = "server";
let broadcastMode = false;
let layoutMode: "single" | "grid" = "single";
let recentTerminalTabIds: string[] = [];
let paletteSelectionIndex = 0;
let paletteMatches: ServerProfileSummary[] = [];
let vaultUnlocked = false;
let workspacePersistenceReady = false;
let workspaceRestoreStarted = false;
let restoringWorkspace = false;
let workspaceSaveTimer: number | null = null;
const excludedBroadcastGroups = new Set<string>();
let currentSettings: AppPreferences = { ...DEFAULT_SETTINGS };

function elementById<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required element #${id}.`);
  }
  return element as T;
}

const appShell = elementById<HTMLElement>("app-shell");
const startupSkeleton = elementById<HTMLElement>("startup-skeleton");
const startupStatus = elementById<HTMLElement>("startup-status");
const updateToastRegion = elementById<HTMLElement>("update-toast-region");
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
const helpButton = elementById<HTMLButtonElement>("help-button");
const toggleSftpButton = elementById<HTMLButtonElement>("toggle-sftp-button");
const toggleSnippetsButton = elementById<HTMLButtonElement>("toggle-snippets-button");
const broadcastToggleButton = elementById<HTMLButtonElement>("broadcast-toggle-button");
const broadcastTargetsButton = elementById<HTMLButtonElement>("broadcast-targets-button");
const layoutButton = elementById<HTMLButtonElement>("layout-button");
const commandPaletteButton = elementById<HTMLButtonElement>("command-palette-button");
const externalToolsButton = elementById<HTMLButtonElement>("external-tools-button");
const enterpriseButton = elementById<HTMLButtonElement>("enterprise-button");

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
const operationsTabButtons = [...document.querySelectorAll<HTMLButtonElement>("[data-operations-tab]")];
const operationsPanels = [...document.querySelectorAll<HTMLElement>("[data-operations-panel]")];
const notesNodeContext = elementById<HTMLDivElement>("notes-node-context");
const profileNotesForm = elementById<HTMLFormElement>("profile-notes-form");
const profileNotesInput = elementById<HTMLTextAreaElement>("profile-notes");
const profileNotesStatus = elementById<HTMLDivElement>("profile-notes-status");
const backupsNodeContext = elementById<HTMLDivElement>("backups-node-context");
const configBackupForm = elementById<HTMLFormElement>("config-backup-form");
const configBackupNameInput = elementById<HTMLInputElement>("config-backup-name");
const configBackupContentInput = elementById<HTMLTextAreaElement>("config-backup-content");
const configBackupStatus = elementById<HTMLDivElement>("config-backup-status");
const configBackupList = elementById<HTMLDivElement>("config-backup-list");

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
const masterPasswordField = elementById<HTMLDivElement>("master-password-field");
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
const serverTagsInput = elementById<HTMLInputElement>("server-tags");
const serverFavoriteInput = elementById<HTMLInputElement>("server-favorite");
const serverInheritFolderInput = elementById<HTMLInputElement>("server-inherit-folder");
const serverDomainInput = elementById<HTMLInputElement>("server-domain");
const serverTimeoutInput = elementById<HTMLInputElement>("server-timeout");
const serverKeepaliveInput = elementById<HTMLInputElement>("server-keepalive");
const serverKeepaliveEnabledInput = elementById<HTMLInputElement>("server-keepalive-enabled");
const serverPersistInput = elementById<HTMLInputElement>("server-persist");
const serverAutoReconnectInput = elementById<HTMLInputElement>("server-auto-reconnect");
const serverJumpHostInput = elementById<HTMLInputElement>("server-jump-host");
const serverProxyOverrideInput = elementById<HTMLInputElement>("server-proxy-override");
const serverIconInput = elementById<HTMLSelectElement>("server-icon");
const serverApplicationBadgeInput = elementById<HTMLInputElement>("server-application-badge");
const serverIndicatorColorInput = elementById<HTMLInputElement>("server-indicator-color");
const serverTerminalThemeInput = elementById<HTMLSelectElement>("server-terminal-theme");
const serverTerminalFontInput = elementById<HTMLInputElement>("server-terminal-font");
const serverTerminalSizeInput = elementById<HTMLInputElement>("server-terminal-size");
const serverTerminalLineHeightInput = elementById<HTMLInputElement>("server-terminal-line-height");
const serverTerminalBackgroundInput = elementById<HTMLInputElement>("server-terminal-background");
const serverTerminalForegroundInput = elementById<HTMLInputElement>("server-terminal-foreground");
const serverTerminalCursorInput = elementById<HTMLInputElement>("server-terminal-cursor");
const categoryButtons = [...serverModal.querySelectorAll<HTMLButtonElement>("[data-connection-category]")];
const serverPreTasksInput = elementById<HTMLSelectElement>("server-pre-tasks");
const serverPostTasksInput = elementById<HTMLSelectElement>("server-post-tasks");
const serverTotpSecretInput = elementById<HTMLInputElement>("server-totp-secret");
const serverTotpDigitsInput = elementById<HTMLSelectElement>("server-totp-digits");
const serverTotpAlgorithmInput = elementById<HTMLSelectElement>("server-totp-algorithm");
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

const folderDefaultsModal = elementById<HTMLDialogElement>("folder-defaults-modal");
const folderDefaultsForm = elementById<HTMLFormElement>("folder-defaults-form");
const folderDefaultsPathInput = elementById<HTMLInputElement>("folder-defaults-path");
const folderDefaultsUsernameInput = elementById<HTMLInputElement>("folder-defaults-username");
const folderDefaultsDomainInput = elementById<HTMLInputElement>("folder-defaults-domain");
const folderDefaultsAuthInput = elementById<HTMLSelectElement>("folder-defaults-auth");
const folderDefaultsPortInput = elementById<HTMLInputElement>("folder-defaults-port");
const folderDefaultsPasswordField = elementById<HTMLDivElement>("folder-defaults-password-field");
const folderDefaultsPasswordInput = elementById<HTMLInputElement>("folder-defaults-password");
const folderDefaultsKeyField = elementById<HTMLDivElement>("folder-defaults-key-field");
const folderDefaultsKeyInput = elementById<HTMLInputElement>("folder-defaults-key");
const folderDefaultsPassphraseField = elementById<HTMLDivElement>("folder-defaults-passphrase-field");
const folderDefaultsPassphraseInput = elementById<HTMLInputElement>("folder-defaults-passphrase");
const folderDefaultsTimeoutInput = elementById<HTMLInputElement>("folder-defaults-timeout");
const folderDefaultsKeepaliveInput = elementById<HTMLInputElement>("folder-defaults-keepalive");
const folderDefaultsKeepaliveEnabledInput = elementById<HTMLInputElement>("folder-defaults-keepalive-enabled");
const folderDefaultsAutoReconnectInput = elementById<HTMLInputElement>("folder-defaults-auto-reconnect");
const folderDefaultsIconInput = elementById<HTMLSelectElement>("folder-defaults-icon");
const folderDefaultsBadgeInput = elementById<HTMLInputElement>("folder-defaults-badge");
const folderDefaultsColorInput = elementById<HTMLInputElement>("folder-defaults-color");
const folderDefaultsTerminalThemeInput = elementById<HTMLSelectElement>("folder-defaults-terminal-theme");
const folderDefaultsTerminalFontInput = elementById<HTMLInputElement>("folder-defaults-terminal-font");
const folderDefaultsTerminalSizeInput = elementById<HTMLInputElement>("folder-defaults-terminal-size");
const folderDefaultsLineHeightInput = elementById<HTMLInputElement>("folder-defaults-line-height");
const folderDefaultsError = elementById<HTMLDivElement>("folder-defaults-error");
const folderDefaultsDeleteButton = elementById<HTMLButtonElement>("folder-defaults-delete");
const folderDefaultsCancelButton = elementById<HTMLButtonElement>("folder-defaults-cancel");

const enterpriseModal = elementById<HTMLDialogElement>("enterprise-modal");
const enterpriseCloseButton = elementById<HTMLButtonElement>("enterprise-close");
const enterpriseError = elementById<HTMLDivElement>("enterprise-error");
const externalToolForm = elementById<HTMLFormElement>("external-tool-form");
const externalToolIdInput = elementById<HTMLInputElement>("external-tool-id");
const externalToolNameInput = elementById<HTMLInputElement>("external-tool-name");
const externalToolExecutableInput = elementById<HTMLInputElement>("external-tool-executable");
const externalToolArgumentsInput = elementById<HTMLTextAreaElement>("external-tool-arguments");
const externalToolResetButton = elementById<HTMLButtonElement>("external-tool-reset");
const externalToolList = elementById<HTMLDivElement>("external-tool-list");
const connectionTaskForm = elementById<HTMLFormElement>("connection-task-form");
const connectionTaskIdInput = elementById<HTMLInputElement>("connection-task-id");
const connectionTaskNameInput = elementById<HTMLInputElement>("connection-task-name");
const connectionTaskKindInput = elementById<HTMLSelectElement>("connection-task-kind");
const connectionTaskExecutableInput = elementById<HTMLInputElement>("connection-task-executable");
const connectionTaskArgumentsInput = elementById<HTMLTextAreaElement>("connection-task-arguments");
const connectionTaskWaitInput = elementById<HTMLInputElement>("connection-task-wait");
const connectionTaskTimeoutInput = elementById<HTMLInputElement>("connection-task-timeout");
const connectionTaskResetButton = elementById<HTMLButtonElement>("connection-task-reset");
const connectionTaskList = elementById<HTMLDivElement>("connection-task-list");
const syncSourceForm = elementById<HTMLFormElement>("sync-source-form");
const syncSourceIdInput = elementById<HTMLInputElement>("sync-source-id");
const syncSourceNameInput = elementById<HTMLInputElement>("sync-source-name");
const syncSourceProviderInput = elementById<HTMLSelectElement>("sync-source-provider");
const syncSourceEndpointInput = elementById<HTMLInputElement>("sync-source-endpoint");
const syncSourceBaseDnInput = elementById<HTMLInputElement>("sync-source-base-dn");
const syncSourceFilterInput = elementById<HTMLInputElement>("sync-source-filter");
const syncSourceUsernameInput = elementById<HTMLInputElement>("sync-source-username");
const syncSourcePasswordInput = elementById<HTMLInputElement>("sync-source-password");
const syncSourceGroupInput = elementById<HTMLInputElement>("sync-source-group");
const syncSourceProtocolInput = elementById<HTMLSelectElement>("sync-source-protocol");
const syncSourceResetButton = elementById<HTMLButtonElement>("sync-source-reset");
const syncSourceList = elementById<HTMLDivElement>("sync-source-list");

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
const scanListViewButton = elementById<HTMLButtonElement>("scan-list-view-button");
const scanIpamViewButton = elementById<HTMLButtonElement>("scan-ipam-view-button");
const scanListView = elementById<HTMLElement>("scan-list-view");
const scanIpamView = elementById<HTMLElement>("scan-ipam-view");
const ipamGrid = elementById<HTMLDivElement>("ipam-grid");
const ipamGridStatus = elementById<HTMLSpanElement>("ipam-grid-status");

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
const minimizeToTrayInput = elementById<HTMLInputElement>("minimize-to-tray");
const startMinimizedInput = elementById<HTMLInputElement>("start-minimized");
const launchAtLoginInput = elementById<HTMLInputElement>("launch-at-login");
const masterPasswordEnabledInput = elementById<HTMLInputElement>("enable-master-password");
const newMasterPasswordFields = elementById<HTMLDivElement>("new-master-password-fields");
const newMasterPasswordInput = elementById<HTMLInputElement>("new-master-password");
const newMasterPasswordConfirmInput = elementById<HTMLInputElement>("new-master-password-confirm");
const autoLockInput = elementById<HTMLSelectElement>("auto-lock-minutes");
const clipboardClearInput = elementById<HTMLSelectElement>("clipboard-clear-seconds");
const themeInput = elementById<HTMLSelectElement>("theme-mode");
const fontFamilyInput = elementById<HTMLInputElement>("terminal-font-family");
const fontSizeInput = elementById<HTMLInputElement>("terminal-font-size");
const cursorBlinkInput = elementById<HTMLInputElement>("terminal-cursor-blink");
const backgroundInput = elementById<HTMLInputElement>("terminal-background");
const foregroundInput = elementById<HTMLInputElement>("terminal-foreground");
const cursorInput = elementById<HTMLInputElement>("terminal-cursor");
const accentInput = elementById<HTMLInputElement>("ui-accent");
const customPaletteFields = elementById<HTMLDivElement>("custom-palette-fields");
const proxyModeInput = elementById<HTMLSelectElement>("proxy-mode");
const proxyUrlInput = elementById<HTMLInputElement>("proxy-url");
const proxyBypassInput = elementById<HTMLInputElement>("proxy-bypass-rules");
const proxyManualFields = elementById<HTMLDivElement>("proxy-manual-fields");
const healthCheckIntervalInput = elementById<HTMLInputElement>("health-check-interval");
const toolWiresharkPathInput = elementById<HTMLInputElement>("tool-wireshark-path");
const toolWinscpPathInput = elementById<HTMLInputElement>("tool-winscp-path");
const toolNmapPathInput = elementById<HTMLInputElement>("tool-nmap-path");
const toolPowershellPathInput = elementById<HTMLInputElement>("tool-powershell-path");
const settingsError = elementById<HTMLDivElement>("settings-error");
const resetSettingsButton = elementById<HTMLButtonElement>("reset-settings-button");
const cancelSettingsButton = elementById<HTMLButtonElement>("cancel-settings-button");
const drPassphraseInput = elementById<HTMLInputElement>("dr-passphrase");
const drPassphraseConfirmInput = elementById<HTMLInputElement>("dr-passphrase-confirm");
const drExportButton = elementById<HTMLButtonElement>("dr-export-button");
const drExportStatus = elementById<HTMLDivElement>("dr-export-status");

const commandPalette = elementById<HTMLDialogElement>("command-palette");
const commandPaletteInput = elementById<HTMLInputElement>("command-palette-input");
const commandPaletteResults = elementById<HTMLDivElement>("command-palette-results");
const commandPaletteStatus = elementById<HTMLDivElement>("command-palette-status");

const helpModal = elementById<HTMLDialogElement>("help-modal");
const helpCloseButton = elementById<HTMLButtonElement>("help-close-button");
const helpTopicButtons = [...document.querySelectorAll<HTMLButtonElement>("[data-help-topic]")];
const helpTopicPanels = [...document.querySelectorAll<HTMLElement>("[data-help-panel]")];
const openShortcutsButton = elementById<HTMLButtonElement>("open-shortcuts-button");
const shortcutsModal = elementById<HTMLDialogElement>("shortcuts-modal");
const shortcutsCloseButton = elementById<HTMLButtonElement>("shortcuts-close-button");

const ipamActionModal = elementById<HTMLDialogElement>("ipam-action-modal");
const ipamActionTitle = elementById<HTMLHeadingElement>("ipam-action-title");
const ipamActionSummary = elementById<HTMLParagraphElement>("ipam-action-summary");
const ipamUsernameInput = elementById<HTMLInputElement>("ipam-username");
const ipamPasswordInput = elementById<HTMLInputElement>("ipam-password");
const ipamActionError = elementById<HTMLDivElement>("ipam-action-error");
const ipamActionCancelButton = elementById<HTMLButtonElement>("ipam-action-cancel");
const ipamAddServerButton = elementById<HTMLButtonElement>("ipam-add-server");
const ipamOpenSavedButton = elementById<HTMLButtonElement>("ipam-open-saved");
const ipamOpenRdpButton = elementById<HTMLButtonElement>("ipam-open-rdp");
const ipamOpenSshButton = elementById<HTMLButtonElement>("ipam-open-ssh");

const serverContextMenu = elementById<HTMLDivElement>("server-context-menu");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

function loadLegacySettings(): AppPreferences {
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
      ...DEFAULT_SETTINGS,
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

function terminalTheme(settings: AppPreferences): ITheme {
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

function terminalSettingsWithOverrides(overrides?: TerminalAppearanceOverrides): AppPreferences {
  if (!overrides) return currentSettings;
  return {
    ...currentSettings,
    theme: overrides.theme ?? currentSettings.theme,
    fontFamily: overrides.fontFamily ?? currentSettings.fontFamily,
    fontSize: overrides.fontSize ?? currentSettings.fontSize,
    background: overrides.background ?? currentSettings.background,
    foreground: overrides.foreground ?? currentSettings.foreground,
    cursor: overrides.cursor ?? currentSettings.cursor,
    externalToolPaths: { ...currentSettings.externalToolPaths },
  };
}

function applyTerminalAppearance(tab: WorkspaceTab, overrides?: TerminalAppearanceOverrides): void {
  if (!tab.terminal) return;
  const settings = terminalSettingsWithOverrides(overrides);
  tab.terminal.options.fontFamily = settings.fontFamily;
  tab.terminal.options.fontSize = settings.fontSize;
  tab.terminal.options.lineHeight = overrides?.lineHeight ?? 1.18;
  tab.terminal.options.cursorBlink = settings.cursorBlink;
  tab.terminal.options.theme = terminalTheme(settings);
  tab.fitAddon?.fit();
}

function applySettings(settings: AppPreferences): void {
  currentSettings = settings;
  document.documentElement.dataset.theme = settings.theme;
  document.documentElement.style.setProperty(
    "--accent",
    settings.theme === "custom" ? settings.accent : DEFAULT_SETTINGS.accent,
  );
  for (const tab of tabs.values()) {
    applyTerminalAppearance(tab, tab.policy?.terminalAppearance);
  }
}

function errorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw
    .replace(/^Error invoking remote method '[^']+':\s*/i, "")
    .replace(/^Error:\s*/i, "");
}

function showUpdateToast(stage: "available" | "downloaded", event: AppUpdateEvent): void {
  updateToastRegion.replaceChildren();
  const toast = document.createElement("article");
  toast.className = "update-toast";
  toast.dataset.updateStage = stage;
  toast.setAttribute("role", "status");

  const content = document.createElement("div");
  content.className = "update-toast-content";
  const mark = createTextElement("span", "update-toast-mark", "UP");
  const copy = document.createElement("div");
  copy.className = "update-toast-copy";
  const title = document.createElement("strong");
  title.textContent = stage === "available" ? `CyberGrid ${event.version} available` : "CyberGrid update ready";
  const message = document.createElement("p");
  message.textContent = stage === "available"
    ? "A new version of CyberGrid is available. It is downloading in the background."
    : "Update downloaded. Restart CyberGrid now to apply?";
  copy.append(title, message);
  content.append(mark, copy);

  const actions = document.createElement("div");
  actions.className = "update-toast-actions";
  const dismiss = document.createElement("button");
  dismiss.className = "secondary-button";
  dismiss.type = "button";
  dismiss.textContent = stage === "available" ? "Dismiss" : "Later";
  dismiss.addEventListener("click", () => toast.remove());
  actions.append(dismiss);

  if (stage === "downloaded") {
    const restart = document.createElement("button");
    restart.className = "primary-button";
    restart.type = "button";
    restart.textContent = "Restart now";
    restart.addEventListener("click", async () => {
      restart.disabled = true;
      restart.textContent = "Restarting...";
      try {
        await window.cybergrid.system.installUpdate();
      } catch (error) {
        message.textContent = errorMessage(error);
        restart.disabled = false;
        restart.textContent = "Restart now";
      }
    });
    actions.append(restart);
  }

  toast.append(content, actions);
  updateToastRegion.append(toast);
}

function fuzzyFieldScore(needle: string, value: string): number | null {
  const haystack = value.toLocaleLowerCase();
  if (haystack === needle) return 1_000;
  if (haystack.startsWith(needle)) return 800 - haystack.length;
  const substring = haystack.indexOf(needle);
  if (substring >= 0) return 600 - substring - haystack.length * 0.01;
  let cursor = 0;
  let gapPenalty = 0;
  for (const character of needle) {
    const match = haystack.indexOf(character, cursor);
    if (match < 0) return null;
    gapPenalty += match - cursor;
    cursor = match + 1;
  }
  return 300 - gapPenalty - haystack.length * 0.01;
}

function paletteScore(profile: ServerProfileSummary, query: string): number | null {
  const tokens = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return profile.favorite ? 100 : 0;
  const fields = [
    profile.name,
    profile.host,
    profile.username,
    profile.group,
    profile.protocol,
    ...profile.tags,
  ];
  let total = profile.favorite ? 25 : 0;
  for (const token of tokens) {
    const scores = fields.map((field) => fuzzyFieldScore(token, field)).filter(
      (score): score is number => score !== null,
    );
    if (scores.length === 0) return null;
    total += Math.max(...scores);
  }
  return total;
}

function selectPaletteIndex(index: number): void {
  if (paletteMatches.length === 0) {
    paletteSelectionIndex = 0;
    return;
  }
  paletteSelectionIndex = (index + paletteMatches.length) % paletteMatches.length;
  const options = [...commandPaletteResults.querySelectorAll<HTMLButtonElement>(".palette-result")];
  options.forEach((option, optionIndex) => {
    const selected = optionIndex === paletteSelectionIndex;
    option.classList.toggle("selected", selected);
    option.setAttribute("aria-selected", String(selected));
    if (selected) option.scrollIntoView({ block: "nearest" });
  });
}

async function runPaletteSelection(): Promise<void> {
  const profile = paletteMatches[paletteSelectionIndex];
  if (!profile) return;
  commandPalette.close();
  await connectSavedProfile(profile);
}

function renderCommandPalette(): void {
  const query = commandPaletteInput.value.trim();
  paletteMatches = savedProfiles
    .map((profile) => ({ profile, score: paletteScore(profile, query) }))
    .filter((candidate): candidate is { profile: ServerProfileSummary; score: number } =>
      candidate.score !== null,
    )
    .sort((left, right) => right.score - left.score || left.profile.name.localeCompare(right.profile.name))
    .slice(0, 30)
    .map((candidate) => candidate.profile);
  paletteSelectionIndex = Math.min(paletteSelectionIndex, Math.max(0, paletteMatches.length - 1));
  commandPaletteResults.replaceChildren();
  for (const [index, profile] of paletteMatches.entries()) {
    const button = document.createElement("button");
    button.className = "palette-result";
    button.type = "button";
    button.role = "option";
    button.append(
      createTextElement("span", "palette-protocol", profile.protocol.toUpperCase()),
      createTextElement("span", "palette-name", `${profile.favorite ? "★ " : ""}${profile.name}`),
      createTextElement("span", "palette-endpoint", `${profile.host}:${profile.port}`),
      createTextElement("span", "palette-group", profile.group),
    );
    button.addEventListener("pointerenter", () => selectPaletteIndex(index));
    button.addEventListener("click", () => {
      paletteSelectionIndex = index;
      void runPaletteSelection();
    });
    commandPaletteResults.append(button);
  }
  commandPaletteStatus.textContent = paletteMatches.length === 0
    ? "No matching saved servers"
    : `${paletteMatches.length} result${paletteMatches.length === 1 ? "" : "s"} · Enter to connect`;
  selectPaletteIndex(paletteSelectionIndex);
}

function openCommandPalette(): void {
  if (!vaultUnlocked) return;
  commandPaletteInput.value = "";
  paletteSelectionIndex = 0;
  renderCommandPalette();
  if (!commandPalette.open) commandPalette.showModal();
  requestAnimationFrame(() => commandPaletteInput.focus());
}

function selectHelpTopic(topic: string): void {
  for (const button of helpTopicButtons) {
    button.classList.toggle("active", button.dataset.helpTopic === topic);
  }
  for (const panel of helpTopicPanels) panel.hidden = panel.dataset.helpPanel !== topic;
}

function openHelp(): void {
  selectHelpTopic("quick-start");
  if (!helpModal.open) helpModal.showModal();
  requestAnimationFrame(() => helpTopicButtons[0]?.focus());
}

function openShortcuts(): void {
  if (helpModal.open) helpModal.close();
  if (!shortcutsModal.open) shortcutsModal.showModal();
  requestAnimationFrame(() => shortcutsCloseButton.focus());
}

const PROTOCOL_LABELS: Record<WorkspaceTabKind, string> = {
  ssh: "SSH", rdp: "RDP", telnet: "TEL", raw: "RAW", vnc: "VNC",
  http: "WEB", https: "WEB", serial: "COM", welcome: "CG",
};

function currentWorkspaceSnapshot(): WorkspaceSnapshot {
  const profileTabs = [...tabs.values()].filter((tab) => Boolean(tab.context.profileId));
  const profileIds = profileTabs.map((tab) => tab.context.profileId as string);
  const activeProfileId = activeTabId ? tabs.get(activeTabId)?.context.profileId : undefined;
  const activeIndex = activeTabId ? profileTabs.findIndex((tab) => tab.id === activeTabId) : -1;
  return {
    profileIds,
    activeProfileId,
    activeIndex: activeIndex >= 0 ? activeIndex : undefined,
    layout: layoutMode,
    updatedAt: new Date().toISOString(),
  };
}

function scheduleWorkspaceSave(): void {
  if (!workspacePersistenceReady || restoringWorkspace) return;
  if (workspaceSaveTimer !== null) window.clearTimeout(workspaceSaveTimer);
  workspaceSaveTimer = window.setTimeout(() => {
    workspaceSaveTimer = null;
    void window.cybergrid.system.saveWorkspace(currentWorkspaceSnapshot()).catch((error: unknown) => {
      console.warn("Could not persist workspace layout:", errorMessage(error));
    });
  }, 350);
}

async function restoreWorkspace(): Promise<void> {
  if (workspaceRestoreStarted || !vaultUnlocked) return;
  workspaceRestoreStarted = true;
  let snapshot: WorkspaceSnapshot;
  try {
    snapshot = await window.cybergrid.system.loadWorkspace();
  } catch (error) {
    console.warn("Could not load the saved workspace:", errorMessage(error));
    workspacePersistenceReady = true;
    return;
  }

  const profilesById = new Map(savedProfiles.map((profile) => [profile.id, profile]));
  const profiles = snapshot.profileIds
    .map((profileId) => profilesById.get(profileId))
    .filter((profile): profile is ServerProfileSummary => Boolean(profile));
  if (profiles.length === 0) {
    workspacePersistenceReady = true;
    return;
  }

  restoringWorkspace = true;
  try {
    const welcome = [...tabs.values()].find((tab) => tab.kind === "welcome");
    if (welcome) await closeTab(welcome.id);
    const restoredTabs: WorkspaceTab[] = [];
    for (const profile of profiles) {
      const previousIds = new Set(tabs.keys());
      await connectSavedProfile(profile);
      const restored = [...tabs.values()].find((tab) => !previousIds.has(tab.id));
      if (restored) restoredTabs.push(restored);
    }
    if (snapshot.layout === "grid" && terminalTabsForGrid().length >= 2) layoutMode = "grid";
    const indexedActive = snapshot.activeIndex === undefined ? undefined : restoredTabs[snapshot.activeIndex];
    if (indexedActive) activateTab(indexedActive.id);
    else if (snapshot.activeProfileId) {
      const restoredActive = restoredTabs.reverse().find(
        (tab) => tab.context.profileId === snapshot.activeProfileId,
      );
      if (restoredActive) activateTab(restoredActive.id);
    }
    renderWorkspaceLayout();
  } finally {
    restoringWorkspace = false;
    workspacePersistenceReady = true;
    scheduleWorkspaceSave();
  }
}

function tabContext(label: string, context?: Partial<SessionVariableContext>): SessionVariableContext {
  return {
    displayName: context?.displayName ?? label,
    host: context?.host ?? "",
    ip: context?.ip ?? context?.host ?? "",
    username: context?.username ?? "",
    group: context?.group ?? (label === "Welcome" ? "Local" : "Quick Connect"),
    port: context?.port ?? 0,
    profileId: context?.profileId,
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
  paneElement.addEventListener("pointerdown", () => {
    if (layoutMode === "grid" && activeTabId !== id) activateTab(id);
  });
  tabElement.addEventListener("click", (event) => {
    if ((event.target as HTMLElement).closest(".tab-close")) void closeTab(id);
    else activateTab(id);
  });
  tabElement.addEventListener("contextmenu", (event) => openTabContextMenu(event, tab));
  activateTab(id);
  return tab;
}

function createTerminalTab(
  label: string,
  kind: "ssh" | "telnet" | "raw" | "serial" | "welcome" = "ssh",
  context?: Partial<SessionVariableContext>,
  appearance?: TerminalAppearanceOverrides,
): WorkspaceTab {
  const requestedLayout = layoutMode;
  const tab = createWorkspaceTab(kind, label, context);
  tab.paneElement.classList.add("terminal-pane");
  const terminalSettings = terminalSettingsWithOverrides(appearance);
  const terminal = new Terminal({
    cursorBlink: terminalSettings.cursorBlink,
    cursorStyle: "bar",
    fontFamily: terminalSettings.fontFamily,
    fontSize: terminalSettings.fontSize,
    lineHeight: appearance?.lineHeight ?? 1.18,
    scrollback: 10_000,
    allowTransparency: true,
    theme: terminalTheme(terminalSettings),
  });
  const fitAddon = new FitAddon();
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
  layoutMode = requestedLayout;
  rememberTerminalTab(tab);
  renderWorkspaceLayout();
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

function terminalTabsForGrid(): WorkspaceTab[] {
  const ordered = recentTerminalTabIds
    .map((id) => tabs.get(id))
    .filter((tab): tab is WorkspaceTab => Boolean(tab?.terminal && tab.kind !== "welcome"));
  return ordered.slice(0, 4);
}

function rememberTerminalTab(tab: WorkspaceTab): void {
  if (!tab.terminal || tab.kind === "welcome") return;
  recentTerminalTabIds = [tab.id, ...recentTerminalTabIds.filter((id) => id !== tab.id)];
}

function updateLayoutControls(): void {
  const count = terminalTabsForGrid().length;
  if (count < 2) layoutMode = "single";
  layoutButton.disabled = count < 2;
  layoutButton.classList.toggle("active", layoutMode === "grid");
  layoutButton.setAttribute("aria-pressed", String(layoutMode === "grid"));
  layoutButton.textContent = layoutMode === "grid" ? `Grid (${Math.min(4, count)})` : "Grid 2x2";
}

function renderWorkspaceLayout(): void {
  const active = activeTabId ? tabs.get(activeTabId) : undefined;
  if (layoutMode === "grid" && !active?.terminal) layoutMode = "single";
  updateLayoutControls();
  const gridIds = new Set(layoutMode === "grid" ? terminalTabsForGrid().map((tab) => tab.id) : []);
  terminalStack.classList.toggle("tiled-layout", layoutMode === "grid");
  for (const candidate of tabs.values()) {
    const isActive = candidate.id === activeTabId;
    const isVisible = layoutMode === "grid" ? gridIds.has(candidate.id) : isActive;
    candidate.tabElement.classList.toggle("active", isActive);
    candidate.tabElement.setAttribute("aria-selected", String(isActive));
    candidate.paneElement.classList.toggle("active", isVisible);
    candidate.paneElement.classList.toggle("tiled-pane", layoutMode === "grid" && isVisible);
    candidate.paneElement.classList.toggle("primary-pane", layoutMode === "grid" && isActive);
    if (candidate.webSessionId) {
      window.cybergrid.web.setVisible(candidate.webSessionId, layoutMode === "single" && isActive);
    }
  }
  requestAnimationFrame(() => {
    for (const candidate of tabs.values()) {
      if (candidate.paneElement.classList.contains("active")) candidate.fitAddon?.fit();
    }
    if (active) updateWebBounds(active);
  });
}

function activateTab(id: string): void {
  const tab = tabs.get(id);
  if (!tab) return;
  activeTabId = id;
  rememberTerminalTab(tab);
  renderWorkspaceLayout();
  updateConnectionState(tab);
  updateSftpAvailability();
  updateBroadcastControls();
  requestAnimationFrame(() => {
    tab.terminal?.focus();
    tab.vncClient?.focus();
    updateWebBounds(tab);
  });
  if (sftpDrawerOpen && tab.kind === "ssh" && tab.sessionId && tab.status === "connected") {
    if (tab.sftp) renderSftpListing(tab.sftp);
    else void loadSftpDirectory(tab, ".");
  }
  scheduleWorkspaceSave();
}

async function closeTab(id: string): Promise<void> {
  const tab = tabs.get(id);
  if (!tab) return;
  const tabOrder = [...tabs.keys()];
  const closedIndex = tabOrder.indexOf(id);
  if (tab.reconnectTimer !== undefined) window.clearTimeout(tab.reconnectTimer);
  tabs.delete(id);
  recentTerminalTabIds = recentTerminalTabIds.filter((tabId) => tabId !== id);
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
  renderWorkspaceLayout();
  scheduleWorkspaceSave();
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
  if (!tab.postConnectStarted && tab.context.profileId && (status === "connected" || status === "running" || status === "ready")) {
    tab.postConnectStarted = true;
    void window.cybergrid.profiles.runPostConnect(tab.context.profileId).catch((error: unknown) => {
      connectionState.textContent = `Post-connect task failed: ${errorMessage(error)}`;
    });
  }
  if (status === "disconnected" && tab.policy?.autoReconnect) scheduleAutoReconnect(tab);
}

function scheduleAutoReconnect(tab: WorkspaceTab): void {
  if (tab.reconnectTimer !== undefined || !tab.duplicate || !tabs.has(tab.id)) return;
  tab.terminal?.writeln("\r\n\x1b[33mNetwork drop detected. Reconnecting in 2 seconds...\x1b[0m");
  tab.reconnectTimer = window.setTimeout(() => {
    tab.reconnectTimer = undefined;
    if (!tabs.has(tab.id) || !tab.duplicate) return;
    const reconnect = tab.duplicate;
    void closeTab(tab.id).then(reconnect).catch((error: unknown) => {
      connectionState.textContent = `Reconnect failed: ${errorMessage(error)}`;
    });
  }, 2_000);
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

let noVncLoadPromise: Promise<void> | undefined;

function loadNoVnc(): Promise<void> {
  if (window.NoVncRfb) return Promise.resolve();
  if (noVncLoadPromise) return noVncLoadPromise;
  noVncLoadPromise = new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("noVNC failed to load.")), 8_000);
    window.addEventListener("cybergrid:novnc-ready", () => {
      window.clearTimeout(timeout);
      resolve();
    }, { once: true });
    const script = document.createElement("script");
    script.type = "module";
    script.src = "./vnc-bootstrap.mjs";
    script.addEventListener("error", () => {
      window.clearTimeout(timeout);
      reject(new Error("noVNC module could not be loaded."));
    }, { once: true });
    document.head.append(script);
  });
  return noVncLoadPromise;
}

async function waitForNoVnc(): Promise<NoVncRfbConstructor> {
  if (window.NoVncRfb) return window.NoVncRfb;
  await loadNoVnc();
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
  let tab: WorkspaceTab;
  if (profile.protocol === "rdp") tab = createRdpTab(profile.name, { host: profile.host, port: profile.port, username: profile.username });
  else if (profile.protocol === "vnc") tab = createVncTab(profile.name);
  else if (profile.protocol === "http" || profile.protocol === "https") tab = createWebTab(profile.name, profile.protocol);
  else tab = createTerminalTab(profile.name, profile.protocol, {
    displayName: profile.name, host: profile.host, ip: profile.host, username: profile.username,
    group: profile.group, port: profile.port, profileId: profile.id,
  }, profile.terminalOverrides);
  tab.context = tabContext(profile.name, {
    displayName: profile.name, host: profile.host, ip: profile.host, username: profile.username,
    group: profile.group, port: profile.port, profileId: profile.id,
  });
  tab.duplicate = () => connectSavedProfile(profile);
  return tab;
}

async function attachProfileResult(tab: WorkspaceTab, result: ProfileConnectionResult): Promise<void> {
  tab.context = result.context;
  tab.policy = result.policy;
  applyTerminalAppearance(tab, result.policy.terminalAppearance);
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
    host: config.host, ip: config.host, username: config.username, group: "Quick Connect", port: config.port,
  });
  tab.duplicate = () => connectQuickSsh({ ...config });
  setTabConnecting(tab, `connecting to ${config.username}@${config.host}:${config.port}...`);
  try { attachSshSession(tab, await window.cybergrid.ssh.connect(config)); }
  catch (error) { handleConnectionFailure(tab, error); }
}

async function connectQuickRdp(config: RdpConnectionConfig): Promise<void> {
  const tab = createRdpTab(config.host, config);
  tab.context = tabContext(config.host, { host: config.host, ip: config.host, username: config.username, port: config.port });
  tab.duplicate = () => connectQuickRdp({ ...config });
  tab.status = "launching";
  updateConnectionState(tab);
  try { attachRdpSession(tab, await window.cybergrid.rdp.connect(config)); }
  catch (error) { handleConnectionFailure(tab, error); }
}

async function connectQuickStream(config: StreamConnectionConfig): Promise<void> {
  const tab = createTerminalTab(config.host, config.protocol, {
    host: config.host, ip: config.host, group: "Quick Connect", port: config.port,
  });
  tab.duplicate = () => connectQuickStream({ ...config });
  setTabConnecting(tab, `connecting to ${config.host}:${config.port}...`);
  try { attachStreamSession(tab, await window.cybergrid.stream.connect(config)); }
  catch (error) { handleConnectionFailure(tab, error); }
}

async function connectQuickSerial(config: SerialConnectionConfig): Promise<void> {
  const tab = createTerminalTab(config.path, "serial", {
    host: config.path, ip: config.path, group: "Quick Connect",
  });
  tab.duplicate = () => connectQuickSerial({ ...config });
  setTabConnecting(tab, `opening ${config.path} at ${config.baudRate} baud...`);
  try { attachSerialSession(tab, await window.cybergrid.serial.connect(config)); }
  catch (error) { handleConnectionFailure(tab, error); }
}

async function connectQuickVnc(config: VncConnectionConfig): Promise<void> {
  const tab = createVncTab(config.host);
  tab.context = tabContext(config.host, { host: config.host, ip: config.host, port: config.port });
  tab.duplicate = () => connectQuickVnc({ ...config });
  setTabConnecting(tab, `connecting to VNC ${config.host}:${config.port}...`);
  try { await attachVncSession(tab, await window.cybergrid.vnc.connect(config)); }
  catch (error) { handleConnectionFailure(tab, error); }
}

async function connectQuickWeb(url: string): Promise<void> {
  const parsed = new URL(url);
  const protocol = parsed.protocol === "https:" ? "https" : "http";
  const tab = createWebTab(parsed.hostname, protocol);
  tab.context = tabContext(parsed.hostname, { host: parsed.hostname, ip: parsed.hostname, port: Number(parsed.port || (protocol === "https" ? 443 : 80)) });
  tab.duplicate = () => connectQuickWeb(url);
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

function createTextElement(tag: "span" | "div" | "strong", className: string, text: string): HTMLElement {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}

const DEVICE_ICON_LABELS: Record<DeviceIcon, string> = {
  windows: "WIN",
  linux: "LNX",
  ubuntu: "UBU",
  redhat: "RHL",
  macos: "MAC",
  "bare-metal": "HW",
  cisco: "CIS",
  fortinet: "FNT",
  vmware: "VMW",
  hyperv: "HYP",
  router: "RTR",
  database: "DB",
  "web-server": "WEB",
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
  scheduleIpamRender();
}

function argumentsFromTextarea(input: HTMLTextAreaElement): string[] {
  return input.value.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
}

function recordButton(label: string, action: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = "secondary-button compact-button";
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", action);
  return button;
}

function resetExternalToolForm(): void {
  externalToolForm.reset();
  externalToolIdInput.value = "";
}

function resetConnectionTaskForm(): void {
  connectionTaskForm.reset();
  connectionTaskIdInput.value = "";
  connectionTaskWaitInput.checked = true;
  connectionTaskTimeoutInput.value = "60";
}

function resetSyncSourceForm(): void {
  syncSourceForm.reset();
  syncSourceIdInput.value = "";
  syncSourceGroupInput.value = "Synchronized";
  updateSyncSourceFields();
}

function renderTaskOptions(): void {
  for (const select of [serverPreTasksInput, serverPostTasksInput]) {
    const selected = new Set([...select.selectedOptions].map((option) => option.value));
    select.replaceChildren();
    for (const task of connectionTasks) {
      const option = document.createElement("option");
      option.value = task.id;
      option.textContent = `${task.kind === "vpn" ? "VPN" : "Script"} · ${task.name}`;
      option.selected = selected.has(task.id);
      select.append(option);
    }
  }
}

function renderEnterpriseData(): void {
  externalToolList.replaceChildren();
  for (const tool of externalTools) {
    const row = createTextElement("div", "enterprise-record", "");
    row.append(createTextElement("span", "", `${tool.name} · ${tool.executablePath}`));
    row.append(
      recordButton("Edit", () => {
        externalToolIdInput.value = tool.id;
        externalToolNameInput.value = tool.name;
        externalToolExecutableInput.value = tool.executablePath;
        externalToolArgumentsInput.value = tool.arguments.join("\n");
      }),
      recordButton("Delete", () => {
        if (!window.confirm(`Delete external tool "${tool.name}"?`)) return;
        void window.cybergrid.vault.deleteExternalTool(tool.id).then(refreshEnterpriseData)
          .catch((error: unknown) => { enterpriseError.textContent = errorMessage(error); });
      }),
    );
    externalToolList.append(row);
  }

  connectionTaskList.replaceChildren();
  for (const task of connectionTasks) {
    const row = createTextElement("div", "enterprise-record", "");
    row.append(createTextElement("span", "", `${task.kind.toUpperCase()} · ${task.name} · ${task.waitForExit ? "wait" : "detached"}`));
    row.append(
      recordButton("Edit", () => {
        connectionTaskIdInput.value = task.id;
        connectionTaskNameInput.value = task.name;
        connectionTaskKindInput.value = task.kind;
        connectionTaskExecutableInput.value = task.executablePath;
        connectionTaskArgumentsInput.value = task.arguments.join("\n");
        connectionTaskWaitInput.checked = task.waitForExit;
        connectionTaskTimeoutInput.value = String(task.timeoutSeconds);
      }),
      recordButton("Delete", () => {
        if (!window.confirm(`Delete connection task "${task.name}" and remove it from profiles?`)) return;
        void window.cybergrid.vault.deleteConnectionTask(task.id).then(refreshEnterpriseData)
          .catch((error: unknown) => { enterpriseError.textContent = errorMessage(error); });
      }),
    );
    connectionTaskList.append(row);
  }

  syncSourceList.replaceChildren();
  for (const source of syncSources) {
    const row = createTextElement("div", "enterprise-record", "");
    row.append(createTextElement("span", "", `${source.provider.toUpperCase()} · ${source.name}${source.lastSyncedAt ? ` · ${new Date(source.lastSyncedAt).toLocaleString()}` : ""}`));
    row.append(
      recordButton("Sync now", () => {
        enterpriseError.textContent = `Synchronizing ${source.name}...`;
        void window.cybergrid.inventorySync.run(source.id).then(async (result) => {
          await refreshVaultContent();
          enterpriseError.textContent = `Sync complete: ${result.imported} added, ${result.updated} updated, ${result.removed} removed.`;
        }).catch((error: unknown) => { enterpriseError.textContent = errorMessage(error); });
      }),
      recordButton("Edit", () => {
        syncSourceIdInput.value = source.id;
        syncSourceNameInput.value = source.name;
        syncSourceProviderInput.value = source.provider;
        syncSourceEndpointInput.value = source.endpoint;
        syncSourceBaseDnInput.value = source.baseDn ?? "";
        syncSourceFilterInput.value = source.filter ?? "";
        syncSourceUsernameInput.value = source.username ?? "";
        syncSourcePasswordInput.value = "";
        syncSourcePasswordInput.placeholder = source.hasPassword ? "Stored password (leave blank to keep)" : "Password";
        syncSourceGroupInput.value = source.group;
        syncSourceProtocolInput.value = source.defaultProtocol;
        updateSyncSourceFields();
      }),
      recordButton("Delete", () => {
        if (!window.confirm(`Delete sync source "${source.name}" and its managed server nodes?`)) return;
        void window.cybergrid.vault.deleteSyncSource(source.id).then(refreshVaultContent)
          .catch((error: unknown) => { enterpriseError.textContent = errorMessage(error); });
      }),
    );
    syncSourceList.append(row);
  }
  renderTaskOptions();
}

async function refreshEnterpriseData(): Promise<void> {
  [folderDefaults, externalTools, connectionTasks, syncSources] = await Promise.all([
    window.cybergrid.vault.listFolderDefaults(),
    window.cybergrid.vault.listExternalTools(),
    window.cybergrid.vault.listConnectionTasks(),
    window.cybergrid.vault.listSyncSources(),
  ]);
  renderEnterpriseData();
  renderProfiles();
}

function openEnterpriseModal(): void {
  enterpriseError.textContent = "";
  renderEnterpriseData();
  if (!enterpriseModal.open) enterpriseModal.showModal();
}

function updateFolderDefaultsFields(): void {
  const password = folderDefaultsAuthInput.value === "password";
  const key = folderDefaultsAuthInput.value === "privateKey";
  folderDefaultsPasswordField.hidden = !password;
  folderDefaultsKeyField.hidden = !key;
  folderDefaultsPassphraseField.hidden = !key;
  folderDefaultsPasswordInput.required = password && !folderDefaultsPasswordInput.placeholder.startsWith("Stored");
  folderDefaultsKeyInput.required = key;
}

function openFolderDefaultsModal(path: string): void {
  folderDefaultsForm.reset();
  folderDefaultsError.textContent = "";
  const existing = folderDefaults.find((item) => item.path === path);
  folderDefaultsPathInput.value = path;
  folderDefaultsUsernameInput.value = existing?.username ?? "";
  folderDefaultsDomainInput.value = existing?.domain ?? "";
  folderDefaultsAuthInput.value = existing?.authType ?? "none";
  folderDefaultsPortInput.value = existing?.port ? String(existing.port) : "";
  folderDefaultsPasswordInput.value = "";
  folderDefaultsPasswordInput.placeholder = existing?.hasPassword ? "Stored password (leave blank to keep)" : "";
  folderDefaultsKeyInput.value = existing?.privateKeyPath ?? "";
  folderDefaultsPassphraseInput.value = "";
  folderDefaultsPassphraseInput.placeholder = existing?.hasPassphrase ? "Stored passphrase (leave blank to keep)" : "";
  folderDefaultsTimeoutInput.value = existing?.readyTimeoutSeconds ? String(existing.readyTimeoutSeconds) : "";
  folderDefaultsKeepaliveInput.value = existing?.keepaliveSeconds ? String(existing.keepaliveSeconds) : "";
  folderDefaultsKeepaliveEnabledInput.checked = existing?.keepAliveEnabled !== false;
  folderDefaultsAutoReconnectInput.checked = existing?.autoReconnect === true;
  folderDefaultsIconInput.value = existing?.icon ?? "";
  folderDefaultsBadgeInput.value = existing?.applicationBadge ?? "";
  folderDefaultsColorInput.value = existing?.indicatorColor ?? currentSettings.accent;
  folderDefaultsTerminalThemeInput.value = existing?.terminalOverrides?.theme ?? "";
  folderDefaultsTerminalFontInput.value = existing?.terminalOverrides?.fontFamily ?? "";
  folderDefaultsTerminalSizeInput.value = existing?.terminalOverrides?.fontSize ? String(existing.terminalOverrides.fontSize) : "";
  folderDefaultsLineHeightInput.value = existing?.terminalOverrides?.lineHeight ? String(existing.terminalOverrides.lineHeight) : "";
  folderDefaultsDeleteButton.disabled = !existing;
  updateFolderDefaultsFields();
  if (!folderDefaultsModal.open) folderDefaultsModal.showModal();
}

function updateSyncSourceFields(): void {
  const provider = syncSourceProviderInput.value;
  const ldap = provider === "ldap";
  const hyperv = provider === "hyperv";
  syncSourceEndpointInput.placeholder = ldap ? "ldaps://dc.example.com:636" : hyperv ? "hyperv-host.example.com" : "https://vcenter.example.com";
  syncSourceBaseDnInput.disabled = !ldap;
  syncSourceFilterInput.disabled = !ldap;
  syncSourceUsernameInput.disabled = hyperv;
  syncSourcePasswordInput.disabled = hyperv;
}

async function refreshVaultContent(): Promise<void> {
  const [profiles, assets, snippets, defaults, tools, tasks, sources] = await Promise.all([
    window.cybergrid.vault.listProfiles(),
    window.cybergrid.vault.listAssets(),
    window.cybergrid.vault.listSnippets(),
    window.cybergrid.vault.listFolderDefaults(),
    window.cybergrid.vault.listExternalTools(),
    window.cybergrid.vault.listConnectionTasks(),
    window.cybergrid.vault.listSyncSources(),
  ]);
  savedProfiles = profiles;
  savedAssets = assets;
  savedSnippets = snippets;
  folderDefaults = defaults;
  externalTools = tools;
  connectionTasks = tasks;
  syncSources = sources;
  if (selectedProfileId && !savedProfiles.some((profile) => profile.id === selectedProfileId)) selectedProfileId = null;
  renderProfiles();
  renderAssets();
  renderSnippets();
  renderNodeWorkspace();
  renderEnterpriseData();
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

function parseIpv4(value: string): number[] | null {
  const parts = value.trim().split(".");
  if (parts.length !== 4) return null;
  const octets = parts.map((part) => Number(part));
  return octets.every((octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255)
    ? octets
    : null;
}

function ipamSubnetPrefix(target: string): string | null {
  const trimmed = target.trim();
  const cidr = /^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/.exec(trimmed);
  if (cidr) {
    const address = parseIpv4(cidr[1]);
    if (!address || Number(cidr[2]) !== 24) return null;
    return `${address[0]}.${address[1]}.${address[2]}`;
  }
  const range = /^(\d{1,3}(?:\.\d{1,3}){3})\s*-\s*(\d{1,3}(?:\.\d{1,3}){3})$/.exec(trimmed);
  if (range) {
    const start = parseIpv4(range[1]);
    const end = parseIpv4(range[2]);
    if (!start || !end || start.slice(0, 3).join(".") !== end.slice(0, 3).join(".")) return null;
    return start.slice(0, 3).join(".");
  }
  const address = parseIpv4(trimmed);
  return address ? address.slice(0, 3).join(".") : null;
}

function openIpamAction(address: string): void {
  selectedIpamAddress = address;
  const profile = savedProfiles.find((candidate) => candidate.host === address);
  const device = scanDevices.get(address);
  const status = profile ? "Saved vault server" : ipamHostStatuses.get(address) === "online"
    ? "Online with an administration service"
    : ipamHostStatuses.get(address) === "offline" ? "No supported service detected" : "Not scanned";
  ipamActionTitle.textContent = profile?.name ?? device?.hostname ?? address;
  ipamActionSummary.textContent = `${address} · ${status}${device ? ` · ${portSummary(device)}` : ""}`;
  ipamUsernameInput.value = profile?.username ?? "";
  ipamPasswordInput.value = "";
  ipamActionError.textContent = "";
  ipamOpenSavedButton.hidden = !profile;
  if (!ipamActionModal.open) ipamActionModal.showModal();
  requestAnimationFrame(() => (profile ? ipamOpenSavedButton : ipamUsernameInput).focus());
}

function renderIpamGrid(): void {
  ipamRenderFrame = null;
  const prefix = ipamSubnetPrefix(scanTargetInput.value);
  ipamGrid.replaceChildren();
  if (!prefix) {
    ipamGridStatus.textContent = "IPAM supports a /24 subnet, a single IPv4 address, or a range within one /24.";
    ipamGrid.append(createTextElement("div", "sidebar-empty", "Enter a valid IPv4 /24 subnet to build the address map."));
    return;
  }
  const fragment = document.createDocumentFragment();
  const totals = { saved: 0, online: 0, offline: 0, unassigned: 0 };
  for (let host = 0; host <= 255; host += 1) {
    const address = `${prefix}.${host}`;
    const profile = savedProfiles.find((candidate) => candidate.host === address);
    const discoveredStatus = ipamHostStatuses.get(address);
    const state = profile ? "saved" : discoveredStatus ?? "unassigned";
    totals[state] += 1;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `ipam-host ${state}`;
    button.textContent = String(host);
    button.title = `${address} — ${profile ? `Saved: ${profile.name}` : state === "online" ? "Online" : state === "offline" ? "Offline" : "Unassigned / not scanned"}`;
    button.setAttribute("role", "gridcell");
    button.setAttribute("aria-label", button.title);
    button.addEventListener("click", () => openIpamAction(address));
    fragment.append(button);
  }
  ipamGrid.append(fragment);
  ipamGridStatus.textContent = `${prefix}.0/24 · ${totals.saved} saved · ${totals.online} online · ${totals.offline} offline · ${totals.unassigned} unassigned`;
}

function scheduleIpamRender(): void {
  if (scanIpamView.hidden) return;
  if (ipamRenderFrame !== null) return;
  ipamRenderFrame = requestAnimationFrame(renderIpamGrid);
}

function setScanView(view: "list" | "ipam"): void {
  const ipam = view === "ipam";
  scanListView.hidden = ipam;
  scanIpamView.hidden = !ipam;
  scanListViewButton.setAttribute("aria-pressed", String(!ipam));
  scanIpamViewButton.setAttribute("aria-pressed", String(ipam));
  if (ipam) scheduleIpamRender();
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
  ipamHostStatuses.set(event.currentIp, event.hostStatus);
  scheduleIpamRender();
}

function handleDiscoveryResult(event: DiscoveryResultEvent): void {
  if (event.scanId !== activeScanId) {
    return;
  }
  scanDevices.set(event.device.ipAddress, event.device);
  ipamHostStatuses.set(event.device.ipAddress, "online");
  renderScanResults();
  scheduleIpamRender();
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
  scheduleIpamRender();
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

function closeServerContextMenu(): void {
  serverContextMenu.hidden = true;
  serverContextMenu.replaceChildren();
}

function positionContextMenu(x: number, y: number, estimatedHeight: number): void {
  serverContextMenu.hidden = false;
  const width = 250;
  serverContextMenu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - width - 8))}px`;
  serverContextMenu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - estimatedHeight - 8))}px`;
  serverContextMenu.querySelector<HTMLButtonElement>("button")?.focus();
}

function appendContextAction(label: string, action: () => void, disabled = false): void {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.disabled = disabled;
  button.addEventListener("click", action);
  serverContextMenu.append(button);
}

function appendContextSeparator(): void {
  const separator = document.createElement("div");
  separator.className = "context-separator";
  serverContextMenu.append(separator);
}

async function runExternalToolForProfile(tool: ExternalToolRecord, profileId: string): Promise<void> {
  if (!window.confirm(`Launch the local tool "${tool.name}" for this server?`)) return;
  closeServerContextMenu();
  try {
    const result = await window.cybergrid.externalTools.run(tool.id, profileId);
    connectionState.textContent = `${result.toolName} launched`;
  } catch (error) {
    window.alert(errorMessage(error));
  }
}

async function copyProfileTotp(profileId: string): Promise<void> {
  try {
    const result = await window.cybergrid.vault.generateTotp(profileId);
    await navigator.clipboard.writeText(result.code);
    connectionState.textContent = `TOTP copied (${result.remainingSeconds}s remaining)`;
    if (currentSettings.clipboardClearSeconds > 0) {
      window.setTimeout(() => {
        void navigator.clipboard.readText().then((value) => {
          if (value === result.code) return navigator.clipboard.writeText("");
          return undefined;
        }).catch(() => undefined);
      }, currentSettings.clipboardClearSeconds * 1_000);
    }
  } catch (error) {
    window.alert(errorMessage(error));
  }
  closeServerContextMenu();
}

function openExternalToolsMenu(event: MouseEvent): void {
  event.preventDefault();
  serverContextMenu.replaceChildren();
  const active = activeTabId ? tabs.get(activeTabId) : undefined;
  const profileId = active?.context.profileId;
  if (externalTools.length === 0) {
    appendContextAction("No tools configured", () => undefined, true);
  } else {
    for (const tool of externalTools) {
      appendContextAction(tool.name, () => {
        if (profileId) void runExternalToolForProfile(tool, profileId);
      }, !profileId);
    }
  }
  appendContextSeparator();
  appendContextAction("Manage External Tools...", () => {
    closeServerContextMenu();
    openEnterpriseModal();
  });
  const rect = externalToolsButton.getBoundingClientRect();
  positionContextMenu(rect.left, rect.bottom + 4, Math.min(420, 48 + externalTools.length * 34));
}

async function duplicateWorkspaceTab(tab: WorkspaceTab, split = false): Promise<void> {
  if (!tab.duplicate) {
    window.alert("This local tab cannot be duplicated because its original connection parameters are unavailable.");
    return;
  }
  if (split) layoutMode = "grid";
  await tab.duplicate();
  renderWorkspaceLayout();
}

async function captureWorkspaceTab(tab: WorkspaceTab): Promise<void> {
  const rect = tab.paneElement.getBoundingClientRect();
  try {
    const result = await window.cybergrid.system.captureScreenshot({
      x: rect.left, y: rect.top, width: rect.width, height: rect.height, label: tab.label,
    });
    if (result.path) connectionState.textContent = `Screenshot saved: ${result.path}`;
  } catch (error) {
    window.alert(errorMessage(error));
  }
}

function openTabContextMenu(event: MouseEvent, tab: WorkspaceTab): void {
  event.preventDefault();
  event.stopPropagation();
  serverContextMenu.replaceChildren();
  appendContextAction("Duplicate tab", () => {
    closeServerContextMenu();
    void duplicateWorkspaceTab(tab);
  }, !tab.duplicate);
  appendContextAction("Split session", () => {
    closeServerContextMenu();
    void duplicateWorkspaceTab(tab, true);
  }, !tab.duplicate || !tab.terminal || tab.kind === "welcome");
  appendContextAction("Capture screenshot...", () => {
    closeServerContextMenu();
    void captureWorkspaceTab(tab);
  });
  if (tab.context.profileId) {
    const profile = savedProfiles.find((candidate) => candidate.id === tab.context.profileId);
    if (profile?.hasTotp) appendContextAction("Copy current TOTP", () => void copyProfileTotp(profile.id));
    if (externalTools.length > 0) {
      appendContextSeparator();
      for (const tool of externalTools) {
        appendContextAction(`Tool: ${tool.name}`, () => void runExternalToolForProfile(tool, tab.context.profileId as string));
      }
    }
  }
  positionContextMenu(event.clientX, event.clientY, Math.min(500, 130 + externalTools.length * 34));
}

async function executeProfileDiagnostic(profile: ServerProfileSummary, kind: DiagnosticKind): Promise<void> {
  diagnosticResults.set(profile.id, "running");
  closeServerContextMenu();
  renderProfiles();
  try {
    diagnosticResults.set(profile.id, await window.cybergrid.diagnostics.run(profile.id, kind));
  } catch (error) {
    diagnosticResults.set(profile.id, {
      profileId: profile.id,
      kind,
      success: false,
      summary: `${kind} failed`,
      output: errorMessage(error),
      durationMs: 0,
      checkedAt: new Date().toISOString(),
    });
  }
  renderProfiles();
}

function openServerContextMenu(event: MouseEvent, profile: ServerProfileSummary): void {
  event.preventDefault();
  event.stopPropagation();
  serverContextMenu.replaceChildren();
  const addAction = (label: string, action: () => void, disabled = false): void => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.disabled = disabled;
    button.addEventListener("click", action);
    serverContextMenu.append(button);
  };
  addAction("Open connection", () => {
    closeServerContextMenu();
    void connectSavedProfile(profile);
  });
  addAction(profile.favorite ? "Remove from favorites" : "Add to favorites", () => {
    closeServerContextMenu();
    void window.cybergrid.vault.setFavorite(profile.id, !profile.favorite)
      .then(refreshProfiles)
      .catch((error: unknown) => window.alert(errorMessage(error)));
  });
  addAction("Notes & Docs", () => { closeServerContextMenu(); openNodeWorkspace(profile, "notes"); });
  addAction("Config Backups", () => { closeServerContextMenu(); openNodeWorkspace(profile, "backups"); }, profile.category !== "network");
  if (profile.hasTotp) addAction("Copy current TOTP", () => void copyProfileTotp(profile.id));
  for (const tool of externalTools) {
    addAction(`Tool: ${tool.name}`, () => void runExternalToolForProfile(tool, profile.id));
  }
  const separator = document.createElement("div");
  separator.className = "context-separator";
  serverContextMenu.append(separator);
  const serial = profile.protocol === "serial";
  addAction("Ping test", () => void executeProfileDiagnostic(profile, "ping"), serial);
  addAction("Traceroute", () => void executeProfileDiagnostic(profile, "traceroute"), serial);
  addAction("DNS lookup", () => void executeProfileDiagnostic(profile, "dns"), serial);
  addAction(`Port check (${profile.port})`, () => void executeProfileDiagnostic(profile, "port"), serial);
  positionContextMenu(event.clientX, event.clientY, Math.min(520, 258 + externalTools.length * 34));
}

function diagnosticElement(profileId: string): HTMLElement | undefined {
  const diagnostic = diagnosticResults.get(profileId);
  if (!diagnostic) return undefined;
  const panel = document.createElement("section");
  panel.className = "diagnostic-inline";
  if (diagnostic === "running") {
    panel.append(createTextElement("div", "diagnostic-summary", "Running remote diagnostic..."));
    return panel;
  }
  panel.classList.toggle("success", diagnostic.success);
  panel.classList.toggle("error", !diagnostic.success);
  const header = createTextElement("div", "diagnostic-header", "");
  header.append(createTextElement("span", "diagnostic-summary", diagnostic.summary));
  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.textContent = "×";
  closeButton.title = "Dismiss diagnostic result";
  closeButton.addEventListener("click", () => {
    diagnosticResults.delete(profileId);
    renderProfiles();
  });
  header.append(closeButton);
  const output = document.createElement("pre");
  output.textContent = diagnostic.output;
  panel.append(header, output);
  return panel;
}

interface ProfileFolderNode {
  name: string;
  path: string;
  profiles: ServerProfileSummary[];
  children: Map<string, ProfileFolderNode>;
}

function renderProfiles(): void {
  profileTree.replaceChildren();
  groupOptions.replaceChildren();
  if (savedProfiles.length === 0) {
    profileTree.append(createTextElement("div", "sidebar-empty", "No saved connections yet. Add one or import an existing connection tree."));
    return;
  }
  const root: ProfileFolderNode = { name: "", path: "", profiles: [], children: new Map() };
  const knownPaths = new Set<string>();
  for (const profile of savedProfiles) {
    const parts = (profile.group || "Ungrouped").split(/[/>]/).map((part) => part.trim()).filter(Boolean);
    let node = root;
    for (const part of parts.length > 0 ? parts : ["Ungrouped"]) {
      const path = node.path ? `${node.path}/${part}` : part;
      let child = node.children.get(part);
      if (!child) {
        child = { name: part, path, profiles: [], children: new Map() };
        node.children.set(part, child);
      }
      node = child;
      knownPaths.add(path);
    }
    node.profiles.push(profile);
  }
  for (const path of [...knownPaths].sort((left, right) => left.localeCompare(right))) {
    const option = document.createElement("option");
    option.value = path;
    groupOptions.append(option);
  }
  const count = (node: ProfileFolderNode): number => node.profiles.length +
    [...node.children.values()].reduce((total, child) => total + count(child), 0);

  const renderProfile = (profile: ServerProfileSummary, list: HTMLElement): void => {
    const row = document.createElement("div");
    row.className = "server-row";
    const button = document.createElement("button");
    button.className = "server-item";
    button.classList.toggle("selected", selectedProfileId === profile.id);
    button.type = "button";
    button.title = `Select for notes; double-click to connect${profile.inheritFolderDefaults ? " · inherited defaults" : ""}`;
    button.style.setProperty("--node-color", profile.indicatorColor ?? "var(--accent)");
    const endpoint = profile.protocol === "serial"
      ? `${profile.host} / ${profile.baudRate ?? 9_600} baud`
      : `${profile.protocol.toUpperCase()}  ${profile.username ? `${profile.username}@` : ""}${profile.host}:${profile.port}`;
    const meta = createTextElement("span", "server-meta", "");
    meta.append(
      createTextElement("span", "server-name", `${profile.favorite ? "★ " : ""}${profile.name}${profile.managedBySyncId ? " ↻" : ""}`),
      createTextElement("span", "server-host", `${endpoint}${profile.tags.length > 0 ? ` · ${profile.tags.join(", ")}` : ""}`),
    );
    const health = createTextElement("span", "server-dot", "");
    health.dataset.healthId = profile.id;
    applyHealthStatus(health, healthStatuses.get(profile.id));
    button.append(health, createTextElement("span", "node-icon", DEVICE_ICON_LABELS[profile.icon]), meta);
    if (profile.applicationBadge) button.append(createTextElement("span", "node-badge", profile.applicationBadge));
    button.addEventListener("click", () => {
      selectedProfileId = profile.id;
      populateQuickConnect(profile);
      renderProfiles();
      if (snippetsDrawerOpen) renderNodeWorkspace();
    });
    button.addEventListener("dblclick", () => void connectSavedProfile(profile));
    button.addEventListener("contextmenu", (event) => openServerContextMenu(event, profile));
    const remove = document.createElement("button");
    remove.className = "server-delete";
    remove.type = "button";
    remove.title = `Delete ${profile.name}`;
    remove.setAttribute("aria-label", `Delete ${profile.name}`);
    remove.textContent = "\u00d7";
    remove.addEventListener("click", async () => {
      if (!window.confirm(`Delete the saved server "${profile.name}"?`)) return;
      try {
        await window.cybergrid.vault.deleteProfile(profile.id);
        if (selectedProfileId === profile.id) selectedProfileId = null;
        await refreshProfiles();
        renderNodeWorkspace();
      } catch (error) { window.alert(errorMessage(error)); }
    });
    row.append(button, remove);
    list.append(row);
    const diagnostic = diagnosticElement(profile.id);
    if (diagnostic) list.append(diagnostic);
  };

  const renderFolder = (node: ProfileFolderNode, parent: HTMLElement): void => {
    const section = document.createElement("section");
    section.className = "server-group";
    section.classList.toggle("collapsed", collapsedGroups.has(node.path));
    const defaults = folderDefaults.find((item) => item.path === node.path);
    const folder = document.createElement("button");
    folder.className = "folder-header";
    folder.type = "button";
    folder.style.setProperty("--node-color", defaults?.indicatorColor ?? "var(--accent)");
    folder.setAttribute("aria-expanded", String(!collapsedGroups.has(node.path)));
    folder.append(
      createTextElement("span", "folder-chevron", collapsedGroups.has(node.path) ? ">" : "v"),
      createTextElement("span", "folder-name", `${defaults?.icon ? `${DEVICE_ICON_LABELS[defaults.icon]} · ` : ""}${node.name}`),
      createTextElement("span", "folder-count", String(count(node))),
    );
    folder.addEventListener("click", () => {
      if (collapsedGroups.has(node.path)) collapsedGroups.delete(node.path); else collapsedGroups.add(node.path);
      renderProfiles();
    });
    folder.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      serverContextMenu.replaceChildren();
      appendContextAction("Edit inherited properties...", () => { closeServerContextMenu(); openFolderDefaultsModal(node.path); });
      appendContextAction("Clear inherited properties", () => {
        closeServerContextMenu();
        void window.cybergrid.vault.deleteFolderDefaults(node.path).then(refreshEnterpriseData)
          .catch((error: unknown) => window.alert(errorMessage(error)));
      }, !defaults);
      positionContextMenu(event.clientX, event.clientY, 90);
    });
    const list = document.createElement("div");
    list.className = "server-list";
    for (const profile of [...node.profiles].sort((left, right) => left.name.localeCompare(right.name))) renderProfile(profile, list);
    for (const child of [...node.children.values()].sort((left, right) => left.name.localeCompare(right.name))) renderFolder(child, list);
    section.append(folder, list);
    parent.append(section);
  };
  for (const node of [...root.children.values()].sort((left, right) => left.name.localeCompare(right.name))) renderFolder(node, profileTree);
}

async function refreshProfiles(): Promise<void> {
  savedProfiles = await window.cybergrid.vault.listProfiles();
  renderProfiles();
  scheduleIpamRender();
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
  if (open) {
    renderSnippets();
    renderNodeWorkspace();
  }
  requestAnimationFrame(() => tabs.get(activeTabId ?? "")?.fitAddon?.fit());
}

function selectedProfile(): ServerProfileSummary | undefined {
  return savedProfiles.find((profile) => profile.id === selectedProfileId);
}

function selectOperationsPanel(panel: "commands" | "notes" | "backups"): void {
  for (const button of operationsTabButtons) {
    button.classList.toggle("active", button.dataset.operationsTab === panel);
  }
  for (const section of operationsPanels) {
    section.hidden = section.dataset.operationsPanel !== panel;
  }
  renderNodeWorkspace();
}

function openNodeWorkspace(profile: ServerProfileSummary, panel: "notes" | "backups" = "notes"): void {
  selectedProfileId = profile.id;
  setSnippetsDrawerOpen(true);
  selectOperationsPanel(panel);
}

function replaceSavedProfile(profile: ServerProfileSummary): void {
  savedProfiles = savedProfiles.map((candidate) => candidate.id === profile.id ? profile : candidate);
  renderProfiles();
  renderNodeWorkspace();
}

function renderNodeWorkspace(): void {
  const profile = selectedProfile();
  const hasProfile = Boolean(profile);
  profileNotesInput.disabled = !hasProfile;
  configBackupNameInput.disabled = !profile || profile.category !== "network";
  configBackupContentInput.disabled = !profile || profile.category !== "network";
  profileNotesInput.value = profile?.notes ?? "";
  notesNodeContext.innerHTML = "";
  backupsNodeContext.innerHTML = "";
  if (!profile) {
    notesNodeContext.textContent = "Select a server node to edit encrypted documentation.";
    backupsNodeContext.textContent = "Select a network device to manage configuration snapshots.";
    configBackupList.replaceChildren(createTextElement("div", "operations-empty", "No node selected."));
    return;
  }
  notesNodeContext.append("Encrypted notes for ", createTextElement("strong", "", profile.name));
  backupsNodeContext.append(
    profile.category === "network" ? "Configuration history for " : "Configuration snapshots are available for network devices. Selected: ",
    createTextElement("strong", "", profile.name),
  );
  configBackupList.replaceChildren();
  if (profile.category !== "network") {
    configBackupList.append(createTextElement("div", "operations-empty", "Set the connection category to Network Device to enable show-run snapshots."));
    return;
  }
  if (profile.configBackups.length === 0) {
    configBackupList.append(createTextElement("div", "operations-empty", "No saved configuration snapshots."));
    return;
  }
  for (const backup of profile.configBackups) {
    const card = document.createElement("article");
    card.className = "backup-card";
    const header = document.createElement("header");
    const title = document.createElement("strong");
    title.textContent = backup.name;
    const date = createTextElement("span", "server-host", new Date(backup.createdAt).toLocaleString());
    const remove = document.createElement("button");
    remove.className = "server-delete";
    remove.type = "button";
    remove.title = "Delete snapshot";
    remove.textContent = "\u00d7";
    remove.addEventListener("click", () => {
      if (!window.confirm(`Delete configuration snapshot "${backup.name}"?`)) return;
      void window.cybergrid.vault.deleteConfigBackup(profile.id, backup.id)
        .then(replaceSavedProfile)
        .catch((error: unknown) => { configBackupStatus.textContent = errorMessage(error); });
    });
    const body = document.createElement("pre");
    body.textContent = backup.content;
    header.append(title, date, remove);
    card.append(header, body);
    configBackupList.append(card);
  }
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
  vaultUnlocked = false;
  vaultMode = shouldExist ? "unlock" : "create";
  const usesMasterPassword = currentSettings.masterPasswordEnabled || !shouldExist;
  vaultTitle.textContent = shouldExist ? "Unlock CyberGrid" : "Create your credential vault";
  vaultSubtitle.textContent = shouldExist
    ? usesMasterPassword
      ? "Enter your master password to decrypt saved servers and credentials."
      : "Unlock the credential vault with your signed-in operating-system account."
    : "Choose a master password. It cannot be recovered if you lose it.";
  masterPasswordField.hidden = !usesMasterPassword;
  masterPasswordInput.required = usesMasterPassword;
  confirmPasswordField.hidden = shouldExist || !usesMasterPassword;
  confirmPasswordInput.required = !shouldExist && usesMasterPassword;
  vaultSubmit.textContent = shouldExist
    ? usesMasterPassword ? "Unlock vault" : "Unlock with OS account"
    : "Create vault";
  vaultError.textContent = "";
  vaultOverlay.hidden = false;
  appShell.inert = true;
  requestAnimationFrame(() => usesMasterPassword ? masterPasswordInput.focus() : vaultSubmit.focus());
}

function hideVaultPrompt(): void {
  masterPasswordInput.value = "";
  confirmPasswordInput.value = "";
  vaultError.textContent = "";
  vaultOverlay.hidden = true;
  appShell.inert = false;
  vaultUnlocked = true;
}

function applyLockedRendererState(reason?: string): void {
  if (serverModal.open) serverModal.close();
  if (settingsModal.open) settingsModal.close();
  if (scanModal.open) scanModal.close();
  if (assetModal.open) assetModal.close();
  if (migrationModal.open) migrationModal.close();
  if (broadcastTargetsModal.open) broadcastTargetsModal.close();
  if (commandPalette.open) commandPalette.close();
  if (enterpriseModal.open) enterpriseModal.close();
  if (folderDefaultsModal.open) folderDefaultsModal.close();
  closeServerContextMenu();
  setSftpDrawerOpen(false);
  setSnippetsDrawerOpen(false);
  broadcastMode = false;
  layoutMode = "single";
  activeScanId = null;
  setScanRunning(false);
  scanDevices.clear();
  savedProfiles = [];
  savedAssets = [];
  savedSnippets = [];
  folderDefaults = [];
  externalTools = [];
  connectionTasks = [];
  syncSources = [];
  selectedProfileId = null;
  healthStatuses.clear();
  diagnosticResults.clear();
  renderProfiles();
  renderAssets();
  renderSnippets();
  renderNodeWorkspace();
  renderWorkspaceLayout();
  updateBroadcastControls();
  setVaultPrompt(true);
  if (reason) vaultError.textContent = reason;
}

async function initializeVault(): Promise<void> {
  try {
    const status = await window.cybergrid.vault.status();
    if (status.unlocked) {
      await refreshVaultContent();
      hideVaultPrompt();
      void restoreWorkspace();
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

const CATEGORY_PROTOCOLS: Record<ConnectionCategory, ConnectionProtocol[]> = {
  server: ["rdp", "ssh"],
  network: ["ssh", "telnet", "raw", "serial"],
  web: ["https", "http"],
  desktop: ["vnc", "rdp"],
};

const CATEGORY_DEFAULT_PROTOCOL: Record<ConnectionCategory, ConnectionProtocol> = {
  server: "rdp",
  network: "ssh",
  web: "https",
  desktop: "vnc",
};

function selectConnectionCategory(category: ConnectionCategory, resetProtocol = true): void {
  connectionCategory = category;
  for (const button of categoryButtons) {
    button.classList.toggle("active", button.dataset.connectionCategory === category);
    button.setAttribute("aria-pressed", String(button.dataset.connectionCategory === category));
  }
  const allowed = new Set(CATEGORY_PROTOCOLS[category]);
  for (const option of serverProtocolInput.options) {
    option.hidden = !allowed.has(option.value as ConnectionProtocol);
    option.disabled = !allowed.has(option.value as ConnectionProtocol);
  }
  if (resetProtocol || !allowed.has(serverProtocolInput.value as ConnectionProtocol)) {
    serverProtocolInput.value = CATEGORY_DEFAULT_PROTOCOL[category];
  }
  updateProfileFields(true);
}

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
  serverDomainInput.closest<HTMLElement>(".field")?.toggleAttribute("hidden", protocol !== "rdp");
  serverUsernameInput.required = usesUsername && !serverInheritFolderInput.checked;
  serverAuthField.hidden = !usesAuthentication;
  privateKeyOption?.toggleAttribute("disabled", protocol !== "ssh");

  if (resetDefaults) {
    if (!serial) serverPortInput.value = String(DEFAULT_PROTOCOL_PORTS[protocol]);
    authTypeInput.value = usesAuthentication && !serverInheritFolderInput.checked ? "password" : "none";
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
  serverKeepaliveInput.disabled = !serverKeepaliveEnabledInput.checked || protocol !== "ssh";
}

function openServerModal(): void {
  serverForm.reset();
  serverProtocolInput.value = "ssh";
  serverBaudRateInput.value = "9600";
  serverInheritFolderInput.checked = true;
  serverKeepaliveEnabledInput.checked = true;
  serverIndicatorColorInput.value = currentSettings.accent;
  renderTaskOptions();
  serverFormError.textContent = "";
  selectConnectionCategory("server");
  if (!serverModal.open) {
    serverModal.showModal();
  }
  requestAnimationFrame(() => serverNameInput.focus());
}

function updateProxyFields(): void {
  proxyManualFields.hidden = proxyModeInput.value !== "manual";
  proxyUrlInput.required = proxyModeInput.value === "manual";
}

function updateMasterPasswordFields(): void {
  const enabling = masterPasswordEnabledInput.checked && !currentSettings.masterPasswordEnabled;
  newMasterPasswordFields.hidden = !enabling;
  newMasterPasswordInput.required = enabling;
  newMasterPasswordConfirmInput.required = enabling;
  autoLockInput.disabled = !masterPasswordEnabledInput.checked;
  if (!masterPasswordEnabledInput.checked) autoLockInput.value = "0";
}

function selectSettingsPanel(panel: string): void {
  for (const button of settingsModal.querySelectorAll<HTMLButtonElement>("[data-settings-tab]")) {
    button.classList.toggle("active", button.dataset.settingsTab === panel);
  }
  for (const section of settingsModal.querySelectorAll<HTMLElement>("[data-settings-panel]")) {
    section.hidden = section.dataset.settingsPanel !== panel;
  }
}

function populateSettingsForm(settings: AppPreferences): void {
  minimizeToTrayInput.checked = settings.minimizeToTray;
  startMinimizedInput.checked = settings.startMinimized;
  launchAtLoginInput.checked = settings.launchAtLogin;
  masterPasswordEnabledInput.checked = settings.masterPasswordEnabled;
  autoLockInput.value = String(settings.autoLockMinutes);
  clipboardClearInput.value = String(settings.clipboardClearSeconds);
  themeInput.value = settings.theme;
  fontFamilyInput.value = settings.fontFamily;
  fontSizeInput.value = String(settings.fontSize);
  cursorBlinkInput.checked = settings.cursorBlink;
  backgroundInput.value = settings.background;
  foregroundInput.value = settings.foreground;
  cursorInput.value = settings.cursor;
  accentInput.value = settings.accent;
  proxyModeInput.value = settings.proxyMode;
  proxyUrlInput.value = settings.proxyUrl;
  proxyBypassInput.value = settings.proxyBypassRules;
  healthCheckIntervalInput.value = String(settings.healthCheckIntervalSeconds);
  toolWiresharkPathInput.value = settings.externalToolPaths.wireshark;
  toolWinscpPathInput.value = settings.externalToolPaths.winscp;
  toolNmapPathInput.value = settings.externalToolPaths.nmap;
  toolPowershellPathInput.value = settings.externalToolPaths.powershell;
  customPaletteFields.hidden = settings.theme !== "custom";
  settingsError.textContent = "";
  newMasterPasswordInput.value = "";
  newMasterPasswordConfirmInput.value = "";
  drPassphraseInput.value = "";
  drPassphraseConfirmInput.value = "";
  drExportStatus.textContent = "";
  updateProxyFields();
  updateMasterPasswordFields();
}

function openSettingsModal(): void {
  populateSettingsForm(currentSettings);
  selectSettingsPanel("general");
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
for (const button of operationsTabButtons) {
  button.addEventListener("click", () => {
    const panel = button.dataset.operationsTab;
    if (panel === "commands" || panel === "notes" || panel === "backups") selectOperationsPanel(panel);
  });
}
profileNotesForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const profile = selectedProfile();
  if (!profile) return;
  profileNotesStatus.textContent = "Saving...";
  try {
    replaceSavedProfile(await window.cybergrid.vault.updateProfileNotes(profile.id, profileNotesInput.value));
    profileNotesStatus.textContent = "Notes saved in the encrypted vault.";
  } catch (error) {
    profileNotesStatus.textContent = errorMessage(error);
  }
});
configBackupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const profile = selectedProfile();
  if (!profile || profile.category !== "network") return;
  const input: ConfigBackupInput = {
    name: configBackupNameInput.value.trim() || `Snapshot ${new Date().toLocaleString()}`,
    content: configBackupContentInput.value,
  };
  configBackupStatus.textContent = "Saving...";
  try {
    replaceSavedProfile(await window.cybergrid.vault.addConfigBackup(profile.id, input));
    configBackupForm.reset();
    configBackupStatus.textContent = "Configuration snapshot encrypted and saved.";
  } catch (error) {
    configBackupStatus.textContent = errorMessage(error);
  }
});
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
    void restoreWorkspace();
  } catch (error) {
    vaultError.textContent = errorMessage(error);
    masterPasswordInput.select();
  } finally {
    vaultSubmit.disabled = false;
    vaultSubmit.textContent = vaultMode === "create" ? "Create vault" : "Unlock vault";
  }
});

addServerButton.addEventListener("click", openServerModal);
externalToolsButton.addEventListener("click", openExternalToolsMenu);
enterpriseButton.addEventListener("click", openEnterpriseModal);
enterpriseCloseButton.addEventListener("click", () => enterpriseModal.close());
enterpriseModal.addEventListener("click", (event) => {
  if (event.target === enterpriseModal) enterpriseModal.close();
});

externalToolResetButton.addEventListener("click", resetExternalToolForm);
externalToolForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  enterpriseError.textContent = "";
  const input: ExternalToolInput = {
    id: externalToolIdInput.value || undefined,
    name: externalToolNameInput.value.trim(),
    executablePath: externalToolExecutableInput.value.trim(),
    arguments: argumentsFromTextarea(externalToolArgumentsInput),
  };
  try {
    await window.cybergrid.vault.saveExternalTool(input);
    resetExternalToolForm();
    await refreshEnterpriseData();
  } catch (error) { enterpriseError.textContent = errorMessage(error); }
});

connectionTaskResetButton.addEventListener("click", resetConnectionTaskForm);
connectionTaskForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  enterpriseError.textContent = "";
  const input: ConnectionTaskInput = {
    id: connectionTaskIdInput.value || undefined,
    name: connectionTaskNameInput.value.trim(),
    kind: connectionTaskKindInput.value as ConnectionTaskInput["kind"],
    executablePath: connectionTaskExecutableInput.value.trim(),
    arguments: argumentsFromTextarea(connectionTaskArgumentsInput),
    waitForExit: connectionTaskWaitInput.checked,
    timeoutSeconds: Number(connectionTaskTimeoutInput.value),
  };
  try {
    await window.cybergrid.vault.saveConnectionTask(input);
    resetConnectionTaskForm();
    await refreshEnterpriseData();
  } catch (error) { enterpriseError.textContent = errorMessage(error); }
});

syncSourceProviderInput.addEventListener("change", updateSyncSourceFields);
syncSourceResetButton.addEventListener("click", resetSyncSourceForm);
syncSourceForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  enterpriseError.textContent = "";
  const input: InventorySyncSourceInput = {
    id: syncSourceIdInput.value || undefined,
    name: syncSourceNameInput.value.trim(),
    provider: syncSourceProviderInput.value as InventorySyncSourceInput["provider"],
    endpoint: syncSourceEndpointInput.value.trim(),
    baseDn: syncSourceBaseDnInput.value.trim() || undefined,
    username: syncSourceUsernameInput.value.trim() || undefined,
    password: syncSourcePasswordInput.value || undefined,
    filter: syncSourceFilterInput.value.trim() || undefined,
    group: syncSourceGroupInput.value.trim(),
    defaultProtocol: syncSourceProtocolInput.value as InventorySyncSourceInput["defaultProtocol"],
  };
  try {
    await window.cybergrid.vault.saveSyncSource(input);
    syncSourcePasswordInput.value = "";
    resetSyncSourceForm();
    await refreshEnterpriseData();
  } catch (error) { enterpriseError.textContent = errorMessage(error); }
});

folderDefaultsAuthInput.addEventListener("change", updateFolderDefaultsFields);
folderDefaultsCancelButton.addEventListener("click", () => folderDefaultsModal.close());
folderDefaultsDeleteButton.addEventListener("click", async () => {
  if (!window.confirm(`Clear inherited properties for "${folderDefaultsPathInput.value}"?`)) return;
  try {
    await window.cybergrid.vault.deleteFolderDefaults(folderDefaultsPathInput.value);
    folderDefaultsModal.close();
    await refreshEnterpriseData();
  } catch (error) { folderDefaultsError.textContent = errorMessage(error); }
});
folderDefaultsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  folderDefaultsError.textContent = "";
  const input: FolderDefaultsInput = {
    path: folderDefaultsPathInput.value,
    username: folderDefaultsUsernameInput.value.trim() || undefined,
    domain: folderDefaultsDomainInput.value.trim() || undefined,
    authType: folderDefaultsAuthInput.value as FolderDefaultsInput["authType"],
    password: folderDefaultsPasswordInput.value || undefined,
    privateKeyPath: folderDefaultsKeyInput.value.trim() || undefined,
    passphrase: folderDefaultsPassphraseInput.value || undefined,
    port: folderDefaultsPortInput.value ? Number(folderDefaultsPortInput.value) : undefined,
    readyTimeoutSeconds: folderDefaultsTimeoutInput.value ? Number(folderDefaultsTimeoutInput.value) : undefined,
    keepaliveSeconds: folderDefaultsKeepaliveInput.value ? Number(folderDefaultsKeepaliveInput.value) : undefined,
    keepAliveEnabled: folderDefaultsKeepaliveEnabledInput.checked,
    autoReconnect: folderDefaultsAutoReconnectInput.checked,
    icon: (folderDefaultsIconInput.value || undefined) as DeviceIcon | undefined,
    applicationBadge: folderDefaultsBadgeInput.value.trim() || undefined,
    indicatorColor: folderDefaultsColorInput.value,
    terminalOverrides: {
      theme: (folderDefaultsTerminalThemeInput.value || undefined) as TerminalAppearanceOverrides["theme"],
      fontFamily: folderDefaultsTerminalFontInput.value.trim() || undefined,
      fontSize: folderDefaultsTerminalSizeInput.value ? Number(folderDefaultsTerminalSizeInput.value) : undefined,
      lineHeight: folderDefaultsLineHeightInput.value ? Number(folderDefaultsLineHeightInput.value) : undefined,
    },
  };
  try {
    await window.cybergrid.vault.saveFolderDefaults(input);
    folderDefaultsPasswordInput.value = "";
    folderDefaultsPassphraseInput.value = "";
    folderDefaultsModal.close();
    await refreshEnterpriseData();
  } catch (error) { folderDefaultsError.textContent = errorMessage(error); }
});
folderDefaultsModal.addEventListener("click", (event) => {
  if (event.target === folderDefaultsModal) folderDefaultsModal.close();
});
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
scanListViewButton.addEventListener("click", () => setScanView("list"));
scanIpamViewButton.addEventListener("click", () => setScanView("ipam"));
scanTargetInput.addEventListener("input", scheduleIpamRender);

scanForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  scanError.textContent = "";
  scanDevices.clear();
  ipamHostStatuses.clear();
  renderScanResults();
  scheduleIpamRender();
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

ipamActionCancelButton.addEventListener("click", () => ipamActionModal.close());
ipamOpenSavedButton.addEventListener("click", () => {
  const profile = savedProfiles.find((candidate) => candidate.host === selectedIpamAddress);
  if (!profile) return;
  ipamActionModal.close();
  void connectSavedProfile(profile);
});
ipamOpenSshButton.addEventListener("click", () => {
  if (!selectedIpamAddress) return;
  const profile = savedProfiles.find((candidate) => candidate.host === selectedIpamAddress && candidate.protocol === "ssh");
  if (profile) {
    ipamActionModal.close();
    void connectSavedProfile(profile);
    return;
  }
  const username = ipamUsernameInput.value.trim();
  if (!username) {
    ipamActionError.textContent = "Enter an SSH username or add this address to the vault first.";
    ipamUsernameInput.focus();
    return;
  }
  const config: SshConnectionConfig = {
    host: selectedIpamAddress,
    port: 22,
    username,
    password: ipamPasswordInput.value || undefined,
  };
  ipamActionModal.close();
  void connectQuickSsh(config);
});
ipamOpenRdpButton.addEventListener("click", () => {
  if (!selectedIpamAddress) return;
  const profile = savedProfiles.find((candidate) => candidate.host === selectedIpamAddress && candidate.protocol === "rdp");
  if (profile) {
    ipamActionModal.close();
    void connectSavedProfile(profile);
    return;
  }
  const username = ipamUsernameInput.value.trim();
  if (!username) {
    ipamActionError.textContent = "Enter an RDP username or add this address to the vault first.";
    ipamUsernameInput.focus();
    return;
  }
  ipamActionModal.close();
  void connectQuickRdp({ host: selectedIpamAddress, port: 3389, username });
});
ipamAddServerButton.addEventListener("click", () => {
  if (!selectedIpamAddress) return;
  const address = selectedIpamAddress;
  const device = scanDevices.get(address);
  const username = ipamUsernameInput.value.trim();
  const password = ipamPasswordInput.value;
  const protocols = new Set(device?.openPorts.map((port) => port.protocol) ?? []);
  const protocol: ConnectionProtocol = protocols.has("ssh") ? "ssh"
    : protocols.has("rdp") ? "rdp" : protocols.has("https") ? "https"
      : protocols.has("http") ? "http" : protocols.has("telnet") ? "telnet" : "ssh";
  const category: ConnectionCategory = protocol === "https" || protocol === "http"
    ? "web" : device?.osFamily === "Network appliance" || protocol === "telnet" ? "network" : "server";
  ipamActionModal.close();
  openServerModal();
  selectConnectionCategory(category);
  serverProtocolInput.value = protocol;
  updateProfileFields(true);
  serverNameInput.value = device?.hostname ?? address;
  serverHostInput.value = address;
  serverGroupInput.value = `Discovered / ${address.split(".").slice(0, 3).join(".")}.0-24`;
  serverUsernameInput.value = username;
  if (password) {
    serverInheritFolderInput.checked = false;
    authTypeInput.value = "password";
    serverPasswordInput.value = password;
    updateProfileFields(false);
  }
  if (device) serverIconInput.value = device.suggestedIcon;
});
ipamActionModal.addEventListener("close", () => {
  ipamPasswordInput.value = "";
  ipamActionError.textContent = "";
  selectedIpamAddress = null;
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
    await window.cybergrid.vault.lock();
    applyLockedRendererState();
  } catch (error) {
    window.alert(errorMessage(error));
  }
});

serverProtocolInput.addEventListener("change", () => updateProfileFields(true));
for (const button of categoryButtons) {
  button.addEventListener("click", () => {
    const category = button.dataset.connectionCategory;
    if (category === "server" || category === "network" || category === "web" || category === "desktop") {
      selectConnectionCategory(category);
    }
  });
}
serverKeepaliveEnabledInput.addEventListener("change", () => updateProfileFields(false));
serverInheritFolderInput.addEventListener("change", () => updateProfileFields(false));
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
  const terminalOverrides: TerminalAppearanceOverrides = {
    theme: (serverTerminalThemeInput.value || undefined) as TerminalAppearanceOverrides["theme"],
    fontFamily: serverTerminalFontInput.value.trim() || undefined,
    fontSize: serverTerminalSizeInput.value ? Number(serverTerminalSizeInput.value) : undefined,
    lineHeight: serverTerminalLineHeightInput.value ? Number(serverTerminalLineHeightInput.value) : undefined,
    background: serverTerminalThemeInput.value === "custom" ? serverTerminalBackgroundInput.value : undefined,
    foreground: serverTerminalThemeInput.value === "custom" ? serverTerminalForegroundInput.value : undefined,
    cursor: serverTerminalThemeInput.value === "custom" ? serverTerminalCursorInput.value : undefined,
  };
  const profile: ServerProfileInput = {
    category: connectionCategory,
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
    tags: [...new Set(serverTagsInput.value.split(",").map((tag) => tag.trim()).filter(Boolean))],
    favorite: serverFavoriteInput.checked,
    inheritFolderDefaults: serverInheritFolderInput.checked,
    domain: serverDomainInput.value.trim() || undefined,
    readyTimeoutSeconds: serverTimeoutInput.value ? Number(serverTimeoutInput.value) : undefined,
    keepaliveSeconds: serverKeepaliveInput.value ? Number(serverKeepaliveInput.value) : undefined,
    keepAliveEnabled: serverKeepaliveEnabledInput.checked,
    persistUntilAppCloses: serverPersistInput.checked,
    autoReconnect: serverAutoReconnectInput.checked,
    jumpHost: serverJumpHostInput.value.trim() || undefined,
    proxyOverride: serverProxyOverrideInput.value.trim() || undefined,
    icon: (serverIconInput.value || undefined) as DeviceIcon | undefined,
    applicationBadge: serverApplicationBadgeInput.value.trim() || undefined,
    indicatorColor: serverIndicatorColorInput.value,
    terminalOverrides: Object.values(terminalOverrides).some((value) => value !== undefined)
      ? terminalOverrides : undefined,
    preConnectTaskIds: [...serverPreTasksInput.selectedOptions].map((option) => option.value),
    postConnectTaskIds: [...serverPostTasksInput.selectedOptions].map((option) => option.value),
    totpSecret: serverTotpSecretInput.value || undefined,
    totpDigits: serverTotpDigitsInput.value === "8" ? 8 : 6,
    totpPeriod: 30,
    totpAlgorithm: serverTotpAlgorithmInput.value as ServerProfileInput["totpAlgorithm"],
  };

  try {
    await window.cybergrid.vault.saveProfile(profile);
    serverPasswordInput.value = "";
    serverPassphraseInput.value = "";
    serverTotpSecretInput.value = "";
    serverModal.close();
    await refreshProfiles();
  } catch (error) {
    serverFormError.textContent = errorMessage(error);
  }
});

settingsButton.addEventListener("click", openSettingsModal);
for (const button of settingsModal.querySelectorAll<HTMLButtonElement>("[data-settings-tab]")) {
  button.addEventListener("click", () => selectSettingsPanel(button.dataset.settingsTab ?? "general"));
}
themeInput.addEventListener("change", () => {
  customPaletteFields.hidden = themeInput.value !== "custom";
});
proxyModeInput.addEventListener("change", updateProxyFields);
masterPasswordEnabledInput.addEventListener("change", updateMasterPasswordFields);
cancelSettingsButton.addEventListener("click", () => settingsModal.close());
resetSettingsButton.addEventListener("click", () => populateSettingsForm(DEFAULT_SETTINGS));
settingsModal.addEventListener("click", (event) => {
  if (event.target === settingsModal) {
    settingsModal.close();
  }
});
drExportButton.addEventListener("click", async () => {
  drExportStatus.textContent = "";
  if (drPassphraseInput.value.length < 12) {
    drExportStatus.textContent = "Use at least 12 characters for the export passphrase.";
    drPassphraseInput.focus();
    return;
  }
  if (drPassphraseInput.value !== drPassphraseConfirmInput.value) {
    drExportStatus.textContent = "Export passphrases do not match.";
    drPassphraseConfirmInput.focus();
    return;
  }
  drExportButton.disabled = true;
  drExportStatus.textContent = "Encrypting the offline runbook...";
  try {
    const result = await window.cybergrid.system.exportDisasterRecovery(drPassphraseInput.value);
    drExportStatus.textContent = result.path
      ? `Encrypted ${result.profileCount} connections and ${result.assetCount} assets to ${result.path}.`
      : "Export canceled.";
  } catch (error) {
    drExportStatus.textContent = errorMessage(error);
  } finally {
    drPassphraseInput.value = "";
    drPassphraseConfirmInput.value = "";
    drExportButton.disabled = false;
  }
});
settingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  settingsError.textContent = "";
  const enablingMasterPassword = masterPasswordEnabledInput.checked && !currentSettings.masterPasswordEnabled;
  if (enablingMasterPassword) {
    if (newMasterPasswordInput.value.length < 10) {
      settingsError.textContent = "New master password must contain at least 10 characters.";
      return;
    }
    if (newMasterPasswordInput.value !== newMasterPasswordConfirmInput.value) {
      settingsError.textContent = "New master passwords do not match.";
      return;
    }
  }
  if (currentSettings.masterPasswordEnabled && !masterPasswordEnabledInput.checked &&
      !window.confirm("Disable Master Password and protect the vault with your signed-in OS account instead?")) {
    return;
  }
  const settings: AppPreferences = {
    minimizeToTray: minimizeToTrayInput.checked,
    startMinimized: startMinimizedInput.checked,
    launchAtLogin: launchAtLoginInput.checked,
    masterPasswordEnabled: masterPasswordEnabledInput.checked,
    autoLockMinutes: masterPasswordEnabledInput.checked ? Number(autoLockInput.value) : 0,
    clipboardClearSeconds: Number(clipboardClearInput.value),
    theme: themeInput.value as AppPreferences["theme"],
    fontFamily: fontFamilyInput.value.trim() || DEFAULT_SETTINGS.fontFamily,
    fontSize: Math.min(28, Math.max(10, Math.round(Number(fontSizeInput.value)))),
    cursorBlink: cursorBlinkInput.checked,
    background: backgroundInput.value,
    foreground: foregroundInput.value,
    cursor: cursorInput.value,
    accent: accentInput.value,
    proxyMode: proxyModeInput.value as AppPreferences["proxyMode"],
    proxyUrl: proxyUrlInput.value.trim(),
    proxyBypassRules: proxyBypassInput.value.trim(),
    healthCheckIntervalSeconds: Math.min(600, Math.max(10, Math.round(Number(healthCheckIntervalInput.value)))),
    externalToolPaths: {
      wireshark: toolWiresharkPathInput.value.trim(),
      winscp: toolWinscpPathInput.value.trim(),
      nmap: toolNmapPathInput.value.trim(),
      powershell: toolPowershellPathInput.value.trim() || "powershell.exe",
    },
  };
  try {
    currentSettings = await window.cybergrid.preferences.update(
      settings,
      enablingMasterPassword ? newMasterPasswordInput.value : undefined,
    );
    newMasterPasswordInput.value = "";
    newMasterPasswordConfirmInput.value = "";
    applySettings(currentSettings);
    await configureHealthMonitor();
    settingsModal.close();
  } catch (error) {
    settingsError.textContent = errorMessage(error);
  }
});

layoutButton.addEventListener("click", () => {
  layoutMode = layoutMode === "grid" ? "single" : "grid";
  renderWorkspaceLayout();
  tabs.get(activeTabId ?? "")?.terminal?.focus();
  scheduleWorkspaceSave();
});

helpButton.addEventListener("click", openHelp);
helpCloseButton.addEventListener("click", () => helpModal.close());
for (const button of helpTopicButtons) {
  button.addEventListener("click", () => selectHelpTopic(button.dataset.helpTopic ?? "quick-start"));
}
openShortcutsButton.addEventListener("click", openShortcuts);
shortcutsCloseButton.addEventListener("click", () => shortcutsModal.close());
helpModal.addEventListener("click", (event) => { if (event.target === helpModal) helpModal.close(); });
shortcutsModal.addEventListener("click", (event) => { if (event.target === shortcutsModal) shortcutsModal.close(); });

commandPaletteButton.addEventListener("click", openCommandPalette);
commandPaletteInput.addEventListener("input", () => {
  paletteSelectionIndex = 0;
  renderCommandPalette();
});
commandPaletteInput.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    selectPaletteIndex(paletteSelectionIndex + 1);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    selectPaletteIndex(paletteSelectionIndex - 1);
  } else if (event.key === "Enter") {
    event.preventDefault();
    void runPaletteSelection();
  }
});
commandPalette.addEventListener("click", (event) => {
  if (event.target === commandPalette) commandPalette.close();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "F1") {
    event.preventDefault();
    if (helpModal.open) helpModal.close(); else openHelp();
  } else if (event.ctrlKey && !event.altKey && !event.shiftKey && event.key === "/") {
    event.preventDefault();
    if (shortcutsModal.open) shortcutsModal.close(); else openShortcuts();
  } else if (event.ctrlKey && !event.altKey && !event.shiftKey && event.key.toLocaleLowerCase() === "k") {
    event.preventDefault();
    if (commandPalette.open) commandPalette.close();
    else openCommandPalette();
  } else if (event.key === "Escape") {
    closeServerContextMenu();
  }
});
document.addEventListener("pointerdown", (event) => {
  if (!serverContextMenu.hidden && !serverContextMenu.contains(event.target as Node)) {
    closeServerContextMenu();
  }
});
window.addEventListener("blur", closeServerContextMenu);

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
window.cybergrid.system.onUpdateAvailable((event) => showUpdateToast("available", event));
window.cybergrid.system.onUpdateDownloaded((event) => showUpdateToast("downloaded", event));
window.cybergrid.system.onVaultLocked((reason) => applyLockedRendererState(reason));
window.cybergrid.system.onTrayQuickConnect((profileId) => {
  if (!vaultUnlocked) return;
  const connect = async (): Promise<void> => {
    let profile = savedProfiles.find((candidate) => candidate.id === profileId);
    if (!profile) {
      await refreshVaultContent();
      profile = savedProfiles.find((candidate) => candidate.id === profileId);
    }
    if (profile) await connectSavedProfile(profile);
  };
  void connect().catch((error: unknown) => {
    connectionState.textContent = errorMessage(error);
  });
});

let lastActivityNotification = 0;
const notifyActivity = (): void => {
  if (!vaultUnlocked) return;
  const now = Date.now();
  if (now - lastActivityNotification < 15_000) return;
  lastActivityNotification = now;
  window.cybergrid.preferences.activity();
};
document.addEventListener("keydown", notifyActivity, { capture: true });
document.addEventListener("pointerdown", notifyActivity, { capture: true });
document.addEventListener("wheel", notifyActivity, { capture: true, passive: true });

const resizeObserver = new ResizeObserver(() => {
  for (const tab of tabs.values()) {
    if (tab.paneElement.classList.contains("active")) tab.fitAddon?.fit();
  }
  const tab = activeTabId ? tabs.get(activeTabId) : undefined;
  if (tab) updateWebBounds(tab);
});
resizeObserver.observe(terminalStack);

async function initializeApplication(): Promise<void> {
  startupStatus.textContent = "Starting secure background services…";
  try {
    await window.cybergrid.system.whenReady();
  } catch (error) {
    startupSkeleton.classList.add("startup-failed");
    startupStatus.textContent = `Startup failed: ${errorMessage(error)}`;
    return;
  }

  startupStatus.textContent = "Preparing your workspace…";
  try {
    let preferences = await window.cybergrid.preferences.get();
    if (localStorage.getItem(SETTINGS_KEY)) {
      const legacy = loadLegacySettings();
      preferences = await window.cybergrid.preferences.update({
        ...preferences,
        theme: legacy.theme,
        fontFamily: legacy.fontFamily,
        fontSize: legacy.fontSize,
        cursorBlink: legacy.cursorBlink,
        background: legacy.background,
        foreground: legacy.foreground,
        cursor: legacy.cursor,
        accent: legacy.accent,
      });
      localStorage.removeItem(SETTINGS_KEY);
    }
    currentSettings = preferences;
  } catch (error) {
    console.warn("CyberGrid preferences could not be loaded:", error);
    currentSettings = { ...DEFAULT_SETTINGS };
  }
  applySettings(currentSettings);
  const welcomeTab = createTerminalTab("Welcome", "welcome");
  welcomeTab.terminal?.writeln("\x1b[36mCyberGrid\x1b[0m");
  welcomeTab.terminal?.writeln("SSH, SFTP, RDP, VNC, Telnet, RAW TCP, serial, and web management in one workspace.\r\n");
  welcomeTab.terminal?.writeln("Press Ctrl+K to search saved servers. Use Grid 2x2 to tile up to four terminal sessions.");
  welcomeTab.terminal?.writeln("Right-click a saved server for ping, traceroute, DNS, port checks, and tray favorites.");
  updateSftpAvailability();
  updateLayoutControls();
  await initializeVault();
  startupSkeleton.classList.add("startup-complete");
  window.setTimeout(() => {
    startupSkeleton.hidden = true;
  }, 180);
}

void initializeApplication();
