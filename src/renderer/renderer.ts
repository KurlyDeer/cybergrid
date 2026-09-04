import { Terminal, type ITheme } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { WebglAddon } from "xterm-addon-webgl";
import { parseConnectionTarget } from "../shared/connection";

type XtermTerminal = Terminal;
type XtermFitAddon = FitAddon;
type CyberGridApi = import("../shared/ipc").CyberGridApi;
type ConnectionProtocol = import("../shared/ipc").ConnectionProtocol;
type AssetInput = import("../shared/ipc").AssetInput;
type AssetRecord = import("../shared/ipc").AssetRecord;
type AppPreferences = import("../shared/ipc").AppPreferences;
type AppMenuCommand = import("../shared/ipc").AppMenuCommand;
type AppUpdateEvent = import("../shared/ipc").AppUpdateEvent;
type AppUpdateStatusEvent = import("../shared/ipc").AppUpdateStatusEvent;
type ConfigBackupInput = import("../shared/ipc").ConfigBackupInput;
type ConnectionCategory = import("../shared/ipc").ConnectionCategory;
type DeviceIcon = import("../shared/ipc").DeviceIcon;
type DiscoveredDevice = import("../shared/ipc").DiscoveredDevice;
type DiscoveryCompleteEvent = import("../shared/ipc").DiscoveryCompleteEvent;
type DiscoveryProgressEvent = import("../shared/ipc").DiscoveryProgressEvent;
type DiscoveryResultEvent = import("../shared/ipc").DiscoveryResultEvent;
type DiagnosticKind = import("../shared/ipc").DiagnosticKind;
type DiagnosticResult = import("../shared/ipc").DiagnosticResult;
type ExternalDiagnosticKind = import("../shared/ipc").ExternalDiagnosticKind;
type ConnectionTaskInput = import("../shared/ipc").ConnectionTaskInput;
type ConnectionTaskRecord = import("../shared/ipc").ConnectionTaskRecord;
type CredentialProfileInput = import("../shared/ipc").CredentialProfileInput;
type CredentialProfileSummary = import("../shared/ipc").CredentialProfileSummary;
type ExternalToolInput = import("../shared/ipc").ExternalToolInput;
type ExternalToolRecord = import("../shared/ipc").ExternalToolRecord;
type FolderDefaultsInput = import("../shared/ipc").FolderDefaultsInput;
type FolderDefaultsSummary = import("../shared/ipc").FolderDefaultsSummary;
type HealthStatusEvent = import("../shared/ipc").HealthStatusEvent;
type MigrationFormat = import("../shared/ipc").MigrationFormat;
type InventorySyncSourceInput = import("../shared/ipc").InventorySyncSourceInput;
type InventorySyncSourceSummary = import("../shared/ipc").InventorySyncSourceSummary;
type LocalShell = import("../shared/ipc").LocalShell;
type LocalTerminalConfig = import("../shared/ipc").LocalTerminalConfig;
type LocalTerminalDataEvent = import("../shared/ipc").LocalTerminalDataEvent;
type LocalTerminalStatusEvent = import("../shared/ipc").LocalTerminalStatusEvent;
type ProfileConnectionCredentials = import("../shared/ipc").ProfileConnectionCredentials;
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
type SwitchModelEvent = import("../shared/ipc").SwitchModelEvent;
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
type SwitchDeviceOs = "auto" | "cisco" | "fortinet" | "hp" | "generic";

interface WorkspaceTab {
  id: string;
  kind: WorkspaceTabKind;
  label: string;
  context: SessionVariableContext;
  connectionKey?: string;
  sessionId?: string;
  rdpSessionId?: string;
  streamSessionId?: string;
  serialSessionId?: string;
  localSessionId?: string;
  vncSessionId?: string;
  webSessionId?: string;
  vncClient?: NoVncRfbInstance;
  terminal?: XtermTerminal;
  fitAddon?: XtermFitAddon;
  terminalSurfaceElement?: HTMLDivElement;
  tabElement: HTMLButtonElement;
  statusElement: HTMLSpanElement;
  paneElement: HTMLDivElement;
  rdpMessageElement?: HTMLParagraphElement;
  rdpViewportElement?: HTMLDivElement;
  localInputHandler?: (data: string) => void;
  localPromptCancel?: () => void;
  status: WorkspaceStatus;
  sftp?: SftpDirectoryListing;
  duplicate?: () => Promise<void>;
  postConnectStarted?: boolean;
  policy?: SessionPolicy;
  reconnectTimer?: number;
  quickBackupButton?: HTMLButtonElement;
  quickBackupStatus?: HTMLSpanElement;
  switchCommandButtons?: HTMLButtonElement[];
  switchModelBadge?: HTMLSpanElement;
  switchToolsModel?: HTMLParagraphElement;
  sshPasswordRetry?: (password: string) => Promise<void>;
  sshAuthRetryPrompting?: boolean;
  sshAuthRetryCount?: number;
  detectedSwitchVendor?: SwitchDeviceOs;
  switchToolsSelect?: HTMLSelectElement;
  renderSwitchTools?: () => void;
  switchToolsOpen?: boolean;
  setSwitchToolsOpen?: (open: boolean) => void;
}

const DEFAULT_SETTINGS: AppPreferences = {
  minimizeToTray: false,
  startMinimized: false,
  launchAtLogin: false,
  confirmExitWithActiveSessions: true,
  compactTreeView: true,
  masterPasswordEnabled: false,
  autoLockMinutes: 15,
  clipboardClearSeconds: 30,
  theme: "dark",
  fontFamily: "Cascadia Mono, JetBrains Mono, Consolas, monospace",
  fontSize: 14,
  terminalLineHeight: 1.18,
  cursorBlink: true,
  background: "#080d14",
  foreground: "#d7e2ef",
  cursor: "#23d5ab",
  accent: "#23d5ab",
  sshKeepAliveSeconds: 10,
  sshMaxPasswordRetries: 0,
  rdpSmartSizing: true,
  rdpColorDepth: 32,
  rdpSoundMode: "local",
  proxyMode: "system",
  proxyUrl: "",
  proxyBypassRules: "<local>",
  healthCheckIntervalSeconds: 30,
  backupDirectory: "",
  externalToolPaths: { wireshark: "", winscp: "", nmap: "", powershell: "powershell.exe" },
};
const SETTINGS_KEY = "cybergrid:terminal-settings:v1";
const QUICK_SNIPPET_TOOLBAR_KEY = "cybergrid:quick-snippet-toolbar:v1";
const SIDEBAR_WIDTH_KEY = "cybergrid:sidebar-width:v1";
const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH = 600;

const tabs = new Map<string, WorkspaceTab>();
const sshSessions = new Map<string, WorkspaceTab>();
const rdpSessions = new Map<string, WorkspaceTab>();
const streamSessions = new Map<string, WorkspaceTab>();
const serialSessions = new Map<string, WorkspaceTab>();
const localSessions = new Map<string, WorkspaceTab>();
const vncSessions = new Map<string, WorkspaceTab>();
const webSessions = new Map<string, WorkspaceTab>();
const queuedSshData = new Map<string, string[]>();
const queuedSshStatus = new Map<string, SshStatusEvent>();
const queuedSwitchModels = new Map<string, SwitchModelEvent>();
const queuedRdpStatus = new Map<string, RdpStatusEvent>();
const queuedStreamData = new Map<string, string[]>();
const queuedStreamStatus = new Map<string, StreamStatusEvent>();
const queuedSerialData = new Map<string, string[]>();
const queuedSerialStatus = new Map<string, SerialStatusEvent>();
const queuedLocalData = new Map<string, string[]>();
const queuedLocalStatus = new Map<string, LocalTerminalStatusEvent>();
const queuedVncStatus = new Map<string, VncStatusEvent>();
const queuedWebStatus = new Map<string, WebStatusEvent>();
const healthStatuses = new Map<string, HealthStatusEvent>();
const diagnosticResults = new Map<string, DiagnosticResult | "running">();
const collapsedGroups = new Set<string>();
let savedProfiles: ServerProfileSummary[] = [];
let savedAssets: AssetRecord[] = [];
let savedSnippets: SnippetRecord[] = [];
let credentialProfiles: CredentialProfileSummary[] = [];
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
const selectedTreeKeys = new Set<string>();
let treeSelectionAnchor: string | null = null;
let treeSelectionOrder: string[] = [];
let editingProfileId: string | null = null;
let connectionCategory: ConnectionCategory = "server";
let editingProfileSnapshot: ServerProfileSummary | null = null;
let broadcastMode = false;
let layoutMode: "single" | "grid" = "single";
let recentTerminalTabIds: string[] = [];
const closedTabActions: Array<() => Promise<void>> = [];
let paletteSelectionIndex = 0;
let paletteMatches: ServerProfileSummary[] = [];
let vaultUnlocked = false;
let workspacePersistenceReady = false;
let workspaceRestoreStarted = false;
let restoringWorkspace = false;
let workspaceSaveTimer: number | null = null;
const excludedBroadcastGroups = new Set<string>();
let currentSettings: AppPreferences = { ...DEFAULT_SETTINGS };
let quickSnippetToolbarVisible = localStorage.getItem(QUICK_SNIPPET_TOOLBAR_KEY) === "true";
let draggedProfileId: string | null = null;
let copiedProfileId: string | null = null;

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
const diagnosticNotificationRegion = elementById<HTMLElement>("diagnostic-notification-region");
const quickConnectForm = elementById<HTMLFormElement>("quick-connect-form");
const quickConnectInput = elementById<HTMLInputElement>("quick-connect-uri");
const quickPasswordInput = elementById<HTMLInputElement>("quick-connect-password");
const tabsElement = elementById<HTMLDivElement>("tabs");
const contentArea = elementById<HTMLDivElement>("content-area");
const terminalStack = elementById<HTMLDivElement>("terminal-stack");
const connectionState = elementById<HTMLDivElement>("connection-state");
const profileTree = elementById<HTMLDivElement>("profile-tree");
const sidebarScroll = elementById<HTMLDivElement>("sidebar-container");
const sidebarResizer = elementById<HTMLDivElement>("sidebar-resizer");
const assetList = elementById<HTMLDivElement>("asset-list");
const assetCount = elementById<HTMLSpanElement>("asset-count");
const scanButton = elementById<HTMLButtonElement>("scan-button");
const addServerButton = elementById<HTMLButtonElement>("add-server-button");
const lockButton = elementById<HTMLButtonElement>("lock-button");

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
const snippetPinnedInput = elementById<HTMLInputElement>("snippet-pinned");
const snippetBodyInput = elementById<HTMLTextAreaElement>("snippet-body");
const snippetCancelButton = elementById<HTMLButtonElement>("snippet-cancel-button");
const snippetFormError = elementById<HTMLDivElement>("snippet-form-error");
const quickSnippetToolbar = elementById<HTMLElement>("quick-snippet-toolbar");
const quickSnippetButtons = elementById<HTMLDivElement>("quick-snippet-buttons");
const quickSnippetCloseButton = elementById<HTMLButtonElement>("quick-snippet-close");
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
const serverModalTitle = elementById<HTMLHeadingElement>("server-modal-title");
const serverForm = elementById<HTMLFormElement>("server-form");
const serverNameInput = elementById<HTMLInputElement>("server-name");
const serverProtocolInput = elementById<HTMLSelectElement>("server-protocol");
const serverHostField = elementById<HTMLDivElement>("server-host-field");
const serverHostInput = elementById<HTMLInputElement>("server-host");
const serverHostLabel = elementById<HTMLLabelElement>("server-host-label");
const serverSerialPortField = elementById<HTMLDivElement>("server-serial-port-field");
const serverSerialPortInput = elementById<HTMLSelectElement>("server-serial-port");
const refreshSerialPortsButton = elementById<HTMLButtonElement>("refresh-serial-ports");
const serverSerialPortStatus = elementById<HTMLSpanElement>("server-serial-port-status");
const serverLocalShellField = elementById<HTMLDivElement>("server-local-shell-field");
const serverLocalShellInput = elementById<HTMLSelectElement>("server-local-shell");
const serverPortInput = elementById<HTMLInputElement>("server-port");
const serverCredentialProfileField = elementById<HTMLDivElement>("server-credential-profile-field");
const serverCredentialProfileInput = elementById<HTMLSelectElement>("server-credential-profile");
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
const serverLegacySshInput = elementById<HTMLInputElement>("server-legacy-ssh");
const serverForwardLocalPortInput = elementById<HTMLInputElement>("server-forward-local-port");
const serverForwardRemoteHostInput = elementById<HTMLInputElement>("server-forward-remote-host");
const serverForwardRemotePortInput = elementById<HTMLInputElement>("server-forward-remote-port");
const serverJumpHostInput = elementById<HTMLInputElement>("server-jump-host");
const serverProxyOverrideInput = elementById<HTMLInputElement>("server-proxy-override");
const serverIconInput = elementById<HTMLSelectElement>("server-icon");
const serverApplicationBadgeInput = elementById<HTMLInputElement>("server-application-badge");
const serverIndicatorColorInput = elementById<HTMLInputElement>("server-indicator-color");
const categoryButtons = [...serverModal.querySelectorAll<HTMLButtonElement>("[data-connection-category]")];
const serverPreTasksInput = elementById<HTMLSelectElement>("server-pre-tasks");
const serverPostTasksInput = elementById<HTMLSelectElement>("server-post-tasks");
const serverTotpSecretInput = elementById<HTMLInputElement>("server-totp-secret");
const serverTotpAlgorithmInput = elementById<HTMLSelectElement>("server-totp-algorithm");
const groupOptions = elementById<HTMLDataListElement>("group-options");
const authTypeInput = elementById<HTMLSelectElement>("auth-type");
const serverUsernameField = elementById<HTMLDivElement>("server-username-field");
const serverAuthField = elementById<HTMLDivElement>("server-auth-field");
const serverSerialSection = elementById<HTMLDivElement>("server-serial-section");
const serverBaudRateInput = elementById<HTMLSelectElement>("server-baud-rate");
const serverDataBitsInput = elementById<HTMLSelectElement>("server-data-bits");
const serverStopBitsInput = elementById<HTMLSelectElement>("server-stop-bits");
const serverParityInput = elementById<HTMLSelectElement>("server-parity");
const serverPasswordSection = elementById<HTMLDivElement>("server-password-section");
const serverPasswordInput = elementById<HTMLInputElement>("server-password");
const serverPasswordToggle = elementById<HTMLButtonElement>("server-password-toggle");
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
const credentialProfileCard = elementById<HTMLElement>("credential-profile-card");
const credentialProfileForm = elementById<HTMLFormElement>("credential-profile-form");
const credentialProfileIdInput = elementById<HTMLInputElement>("credential-profile-id");
const credentialProfileNameInput = elementById<HTMLInputElement>("credential-profile-name");
const credentialProfileAuthInput = elementById<HTMLSelectElement>("credential-profile-auth");
const credentialProfileUsernameInput = elementById<HTMLInputElement>("credential-profile-username");
const credentialProfileDomainInput = elementById<HTMLInputElement>("credential-profile-domain");
const credentialProfilePasswordField = elementById<HTMLDivElement>("credential-profile-password-field");
const credentialProfilePasswordInput = elementById<HTMLInputElement>("credential-profile-password");
const credentialProfileKeyField = elementById<HTMLDivElement>("credential-profile-key-field");
const credentialProfileKeyInput = elementById<HTMLInputElement>("credential-profile-key");
const credentialProfileKeyBrowseButton = elementById<HTMLButtonElement>("credential-profile-key-browse");
const credentialProfilePassphraseField = elementById<HTMLDivElement>("credential-profile-passphrase-field");
const credentialProfilePassphraseInput = elementById<HTMLInputElement>("credential-profile-passphrase");
const credentialProfileResetButton = elementById<HTMLButtonElement>("credential-profile-reset");
const credentialProfileList = elementById<HTMLDivElement>("credential-profile-list");
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
const confirmExitActiveSessionsInput = elementById<HTMLInputElement>("confirm-exit-active-sessions");
const compactTreeViewInput = elementById<HTMLInputElement>("compact-tree-view");
const masterPasswordEnabledInput = elementById<HTMLInputElement>("enable-master-password");
const newMasterPasswordFields = elementById<HTMLDivElement>("new-master-password-fields");
const newMasterPasswordInput = elementById<HTMLInputElement>("new-master-password");
const newMasterPasswordConfirmInput = elementById<HTMLInputElement>("new-master-password-confirm");
const autoLockInput = elementById<HTMLSelectElement>("auto-lock-minutes");
const clipboardClearInput = elementById<HTMLSelectElement>("clipboard-clear-seconds");
const themeInput = elementById<HTMLSelectElement>("theme-mode");
const fontFamilyInput = elementById<HTMLInputElement>("terminal-font-family");
const fontSizeInput = elementById<HTMLInputElement>("terminal-font-size");
const terminalLineHeightInput = elementById<HTMLInputElement>("terminal-line-height");
const sshKeepAliveSecondsInput = elementById<HTMLInputElement>("ssh-keepalive-seconds");
const sshMaxPasswordRetriesInput = elementById<HTMLInputElement>("ssh-max-password-retries");
const cursorBlinkInput = elementById<HTMLInputElement>("terminal-cursor-blink");
const backgroundInput = elementById<HTMLInputElement>("terminal-background");
const foregroundInput = elementById<HTMLInputElement>("terminal-foreground");
const cursorInput = elementById<HTMLInputElement>("terminal-cursor");
const accentInput = elementById<HTMLInputElement>("ui-accent");
const rdpSmartSizingInput = elementById<HTMLInputElement>("rdp-smart-sizing");
const rdpColorDepthInput = elementById<HTMLSelectElement>("rdp-color-depth");
const rdpSoundModeInput = elementById<HTMLSelectElement>("rdp-sound-mode");
const customPaletteFields = elementById<HTMLDivElement>("custom-palette-fields");
const proxyModeInput = elementById<HTMLSelectElement>("proxy-mode");
const proxyUrlInput = elementById<HTMLInputElement>("proxy-url");
const proxyBypassInput = elementById<HTMLInputElement>("proxy-bypass-rules");
const proxyManualFields = elementById<HTMLDivElement>("proxy-manual-fields");
const healthCheckIntervalInput = elementById<HTMLInputElement>("health-check-interval");
const backupDirectoryInput = elementById<HTMLInputElement>("backup-directory");
const browseBackupDirectoryButton = elementById<HTMLButtonElement>("browse-backup-directory");
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

function setSidebarWidth(width: number, persist = false): void {
  const clamped = Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(width)));
  document.documentElement.style.setProperty("--sidebar-width", `${clamped}px`);
  sidebarResizer.setAttribute("aria-valuenow", String(clamped));
  if (persist) localStorage.setItem(SIDEBAR_WIDTH_KEY, String(clamped));
}

const storedSidebarWidth = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
if (Number.isFinite(storedSidebarWidth)) setSidebarWidth(storedSidebarWidth);

let resizingSidebar = false;
sidebarResizer.addEventListener("mousedown", (event) => {
  if (event.button !== 0 || appShell.classList.contains("sidebar-hidden")) return;
  resizingSidebar = true;
  sidebarResizer.classList.add("resizing");
  document.body.classList.add("sidebar-resizing");
  event.preventDefault();
});
window.addEventListener("mousemove", (event) => {
  if (!resizingSidebar) return;
  setSidebarWidth(event.clientX - appShell.getBoundingClientRect().left);
});
window.addEventListener("mouseup", () => {
  if (!resizingSidebar) return;
  resizingSidebar = false;
  sidebarResizer.classList.remove("resizing");
  document.body.classList.remove("sidebar-resizing");
  const width = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sidebar-width"));
  if (Number.isFinite(width)) setSidebarWidth(width, true);
});
sidebarResizer.addEventListener("dblclick", () => setSidebarWidth(238, true));
sidebarResizer.addEventListener("keydown", (event) => {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  const current = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sidebar-width"));
  setSidebarWidth(current + (event.key === "ArrowRight" ? 16 : -16), true);
  event.preventDefault();
});

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
    const theme = parsed.theme === "light" || parsed.theme === "monochrome" || parsed.theme === "dracula" ||
      parsed.theme === "solarized-dark" || parsed.theme === "monokai" || parsed.theme === "custom"
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

  if (settings.theme === "dracula") {
    return {
      background: "#282a36", foreground: "#f8f8f2", cursor: "#f8f8f2", cursorAccent: "#282a36",
      selectionBackground: "#44475a", black: "#21222c", red: "#ff5555", green: "#50fa7b",
      yellow: "#f1fa8c", blue: "#6272a4", magenta: "#ff79c6", cyan: "#8be9fd", white: "#f8f8f2",
      brightBlack: "#6272a4", brightRed: "#ff6e6e", brightGreen: "#69ff94", brightYellow: "#ffffa5",
      brightBlue: "#d6acff", brightMagenta: "#ff92df", brightCyan: "#a4ffff", brightWhite: "#ffffff",
    };
  }

  if (settings.theme === "solarized-dark") {
    return {
      background: "#002b36", foreground: "#839496", cursor: "#93a1a1", cursorAccent: "#002b36",
      selectionBackground: "#073642", black: "#073642", red: "#dc322f", green: "#859900",
      yellow: "#b58900", blue: "#268bd2", magenta: "#d33682", cyan: "#2aa198", white: "#eee8d5",
      brightBlack: "#586e75", brightRed: "#cb4b16", brightGreen: "#586e75", brightYellow: "#657b83",
      brightBlue: "#839496", brightMagenta: "#6c71c4", brightCyan: "#93a1a1", brightWhite: "#fdf6e3",
    };
  }

  if (settings.theme === "monokai") {
    return {
      background: "#272822", foreground: "#f8f8f2", cursor: "#f8f8f0", cursorAccent: "#272822",
      selectionBackground: "#49483e", black: "#272822", red: "#f92672", green: "#a6e22e",
      yellow: "#f4bf75", blue: "#66d9ef", magenta: "#ae81ff", cyan: "#a1efe4", white: "#f8f8f2",
      brightBlack: "#75715e", brightRed: "#f92672", brightGreen: "#a6e22e", brightYellow: "#e6db74",
      brightBlue: "#66d9ef", brightMagenta: "#ae81ff", brightCyan: "#a1efe4", brightWhite: "#f9f8f5",
    };
  }

  if (settings.theme === "light") {
    return {
      background: "#ffffff",
      foreground: "#172437",
      cursor: "#087f6a",
      cursorAccent: "#ffffff",
      selectionBackground: "#9bd8cc88",
      black: "#172437",
      red: "#c7354a",
      green: "#087f6a",
      yellow: "#8a6500",
      blue: "#1769aa",
      magenta: "#7b3fb2",
      cyan: "#08798a",
      white: "#e8eef5",
      brightBlack: "#68798e",
      brightRed: "#e0495e",
      brightGreen: "#0a987d",
      brightYellow: "#a77c00",
      brightBlue: "#2682c9",
      brightMagenta: "#9658ca",
      brightCyan: "#1696a7",
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
  tab.terminal.options.lineHeight = overrides?.lineHeight ?? settings.terminalLineHeight;
  tab.terminal.options.cursorBlink = settings.cursorBlink;
  tab.terminal.options.theme = terminalTheme(settings);
  tab.fitAddon?.fit();
}

function applySettings(settings: AppPreferences): void {
  currentSettings = settings;
  document.documentElement.dataset.theme = settings.theme;
  document.documentElement.dataset.compactTree = settings.compactTreeView ? "true" : "false";
  if (settings.theme === "custom") document.documentElement.style.setProperty("--accent", settings.accent);
  else document.documentElement.style.removeProperty("--accent");
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
    ? "A new version of CyberGrid is available."
    : "Update downloaded. Restart CyberGrid to apply update?";
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

  if (stage === "available") {
    const download = document.createElement("button");
    download.className = "primary-button";
    download.type = "button";
    download.textContent = "Download & Install";
    download.addEventListener("click", async () => {
      download.disabled = true;
      download.textContent = "Starting...";
      try {
        await window.cybergrid.system.downloadUpdate();
      } catch (error) {
        message.textContent = errorMessage(error);
        download.disabled = false;
        download.textContent = "Download & Install";
      }
    });
    actions.append(download);
  } else {
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

function showActionToast(title: string, message: string): void {
  const toast = document.createElement("article");
  toast.className = "update-toast";
  toast.setAttribute("role", "status");
  const content = document.createElement("div");
  content.className = "update-toast-content";
  content.append(
    createTextElement("span", "update-toast-mark", "OK"),
    createTextElement("div", "update-toast-copy", ""),
  );
  const copy = content.lastElementChild as HTMLDivElement;
  copy.append(createTextElement("strong", "", title), createTextElement("p", "", message));
  toast.append(content);
  updateToastRegion.append(toast);
  window.setTimeout(() => toast.remove(), 5_000);
}

let updateStatusToastTimer: number | null = null;

function showUpdateStatusToast(event: AppUpdateStatusEvent): void {
  if (updateStatusToastTimer !== null) window.clearTimeout(updateStatusToastTimer);
  updateStatusToastTimer = null;
  updateToastRegion.replaceChildren();
  const toast = document.createElement("article");
  toast.className = "update-toast";
  toast.setAttribute("role", event.stage === "error" ? "alert" : "status");
  const content = document.createElement("div");
  content.className = "update-toast-content";
  const mark = createTextElement("span", "update-toast-mark", event.stage === "error" ? "!" : "UP");
  const copy = document.createElement("div");
  copy.className = "update-toast-copy";
  const title = document.createElement("strong");
  title.textContent = event.stage === "checking"
    ? "Checking for updates"
    : event.stage === "download-progress"
      ? "Downloading update"
      : "Update check failed";
  const message = document.createElement("p");
  message.textContent = event.message;
  copy.append(title, message);
  if (event.stage === "download-progress") {
    const progress = document.createElement("progress");
    progress.className = "update-download-progress";
    progress.max = 100;
    progress.value = event.percent ?? 0;
    progress.setAttribute("aria-label", `Update download ${Math.round(event.percent ?? 0)} percent`);
    copy.append(progress);
  }
  content.append(mark, copy);
  toast.append(content);
  updateToastRegion.append(toast);
  if (event.stage !== "download-progress") {
    updateStatusToastTimer = window.setTimeout(() => {
      toast.remove();
      updateStatusToastTimer = null;
    }, event.stage === "checking" ? 3_000 : event.stage === "error" ? 10_000 : 8_000);
  }
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
  http: "WEB", https: "WEB", serial: "COM", local: "LOC", welcome: "CG",
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
  tabElement.draggable = kind !== "welcome";
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
  tabElement.addEventListener("dragstart", (event) => {
    if (!detachedSessionReference(tab) || !event.dataTransfer) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-cybergrid-session", tab.id);
    tabElement.classList.add("dragging");
  });
  tabElement.addEventListener("dragend", (event) => {
    tabElement.classList.remove("dragging");
    if (event.screenX === 0 && event.screenY === 0) return;
    void detachWorkspaceTab(tab, event.screenX, event.screenY);
  });
  activateTab(id);
  return tab;
}

function detachedSessionReference(tab: WorkspaceTab): { protocol: import("../shared/ipc").DetachableProtocol; sessionId: string } | undefined {
  if (tab.kind === "ssh" && tab.sessionId) return { protocol: "ssh", sessionId: tab.sessionId };
  if (tab.kind === "rdp" && tab.rdpSessionId) return { protocol: "rdp", sessionId: tab.rdpSessionId };
  if ((tab.kind === "telnet" || tab.kind === "raw") && tab.streamSessionId) return { protocol: tab.kind, sessionId: tab.streamSessionId };
  if (tab.kind === "serial" && tab.serialSessionId) return { protocol: "serial", sessionId: tab.serialSessionId };
  if (tab.kind === "local" && tab.localSessionId) return { protocol: "local", sessionId: tab.localSessionId };
  return undefined;
}

async function detachWorkspaceTab(tab: WorkspaceTab, screenX: number, screenY: number): Promise<void> {
  const session = detachedSessionReference(tab);
  if (!session || !tabs.has(tab.id)) return;
  try {
    const detached = await window.cybergrid.system.detachSession({
      ...session,
      label: tab.label,
      context: tab.context,
      screenX,
      screenY,
    });
    if (detached) removeDetachedTabView(tab);
  } catch (error) {
    connectionState.textContent = `Could not detach tab: ${errorMessage(error)}`;
  }
}

function removeDetachedTabView(tab: WorkspaceTab): void {
  const order = [...tabs.keys()];
  const index = order.indexOf(tab.id);
  tabs.delete(tab.id);
  recentTerminalTabIds = recentTerminalTabIds.filter((id) => id !== tab.id);
  if (tab.sessionId) sshSessions.delete(tab.sessionId);
  if (tab.rdpSessionId) rdpSessions.delete(tab.rdpSessionId);
  if (tab.streamSessionId) streamSessions.delete(tab.streamSessionId);
  if (tab.serialSessionId) serialSessions.delete(tab.serialSessionId);
  if (tab.localSessionId) localSessions.delete(tab.localSessionId);
  tab.terminal?.dispose();
  tab.tabElement.remove();
  tab.paneElement.remove();
  if (activeTabId === tab.id) {
    const ids = [...tabs.keys()];
    const next = ids[Math.min(index, ids.length - 1)];
    activeTabId = null;
    if (next) activateTab(next);
  }
  connectionState.textContent = `${tab.label} moved to a detached window`;
  updateBroadcastControls();
  renderWorkspaceLayout();
  scheduleWorkspaceSave();
}

function createTerminalTab(
  label: string,
  kind: "ssh" | "telnet" | "raw" | "serial" | "local" | "welcome" = "ssh",
  context?: Partial<SessionVariableContext>,
  appearance?: TerminalAppearanceOverrides,
  profile?: ServerProfileSummary,
): WorkspaceTab {
  const requestedLayout = layoutMode;
  const tab = createWorkspaceTab(kind, label, context);
  tab.paneElement.classList.add("terminal-pane");
  const terminalSurface = document.createElement("div");
  terminalSurface.className = "terminal-surface";
  tab.terminalSurfaceElement = terminalSurface;
  tab.paneElement.append(terminalSurface);
  const terminalSettings = terminalSettingsWithOverrides(appearance);
  const terminal = new Terminal({
    cursorBlink: terminalSettings.cursorBlink,
    cursorStyle: "bar",
    fontFamily: terminalSettings.fontFamily,
    fontSize: terminalSettings.fontSize,
    lineHeight: appearance?.lineHeight ?? terminalSettings.terminalLineHeight,
    scrollback: 10_000,
    scrollOnUserInput: true,
    smoothScrollDuration: 0,
    fastScrollSensitivity: 5,
    allowTransparency: true,
    theme: terminalTheme(terminalSettings),
  });
  const fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);
  terminal.open(terminalSurface);
  try {
    const webglAddon = new WebglAddon();
    terminal.loadAddon(webglAddon);
    webglAddon.onContextLoss(() => webglAddon.dispose());
  } catch {
    // Canvas rendering remains available when WebGL is unsupported or blocked.
  }
  tab.terminal = terminal;
  tab.fitAddon = fitAddon;
  terminal.onData((data) => {
    if (tab.localInputHandler) {
      tab.localInputHandler(data);
      return;
    }
    if (broadcastMode && activeTabId === tab.id && isBroadcastCapable(tab)) {
      for (const target of selectedBroadcastTabs()) writeTerminalInput(target, data);
      return;
    }
    writeTerminalInput(tab, data);
  });
  terminal.onResize(({ cols, rows }) => {
    if (tab.kind === "ssh" && tab.sessionId) window.cybergrid.ssh.resize(tab.sessionId, cols, rows);
    if (tab.kind === "local" && tab.localSessionId) window.cybergrid.local.resize(tab.localSessionId, cols, rows);
  });
  const pasteClipboard = async (): Promise<void> => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      if (tab.localInputHandler) tab.localInputHandler(text);
      else writeTerminalInput(tab, text);
      terminal.focus();
    } catch (error) {
      connectionState.textContent = `Clipboard paste failed: ${errorMessage(error)}`;
    }
  };
  terminal.attachCustomKeyEventHandler((event) => {
    if (event.type === "keydown" && event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "v") {
      void pasteClipboard();
      return false;
    }
    return true;
  });
  tab.paneElement.addEventListener("contextmenu", (event) => {
    if (!(event.target as HTMLElement).closest(".xterm")) return;
    event.preventDefault();
    void pasteClipboard();
  });
  layoutMode = requestedLayout;
  rememberTerminalTab(tab);
  installSwitchToolsDrawer(tab, profile);
  renderWorkspaceLayout();
  return tab;
}

function readTerminalPrompt(tab: WorkspaceTab, prompt: string, secret = false): Promise<string> {
  const terminal = tab.terminal;
  if (!terminal) return Promise.reject(new Error("Interactive SSH terminal is unavailable."));
  terminal.write(prompt);
  return new Promise<string>((resolve, reject) => {
    let value = "";
    let settled = false;
    const finish = (result?: string, error?: Error): void => {
      if (settled) return;
      settled = true;
      tab.localInputHandler = undefined;
      tab.localPromptCancel = undefined;
      terminal.write("\r\n");
      if (error) reject(error); else resolve(result ?? "");
    };
    tab.localPromptCancel = () => finish(undefined, new Error("Interactive SSH login was cancelled."));
    tab.localInputHandler = (data) => {
      for (const character of data) {
        if (character === "\u0003" || character === "\u001b") {
          finish(undefined, new Error("Interactive SSH login was cancelled."));
          return;
        }
        if (character === "\r" || character === "\n") {
          finish(value);
          return;
        }
        if (character === "\u007f" || character === "\b") {
          if (value.length > 0) {
            value = value.slice(0, -1);
            if (!secret) terminal.write("\b \b");
          }
          continue;
        }
        if (character >= " " && character !== "\u007f") {
          value += character;
          if (!secret) terminal.write(character);
        }
      }
    };
    terminal.focus();
  });
}

async function promptForSshCredentials(
  tab: WorkspaceTab,
  initialUsername: string,
  needsPassword: boolean,
): Promise<ProfileConnectionCredentials> {
  const terminal = tab.terminal;
  if (!terminal) throw new Error("Interactive SSH terminal is unavailable.");
  terminal.writeln("\x1b[1;36mCyberGrid interactive SSH login\x1b[0m");
  terminal.writeln("Credentials are used for this session only and are not saved.");
  const username = initialUsername || (await readTerminalPrompt(tab, "login as: ")).trim();
  if (!username) throw new Error("SSH login requires a username.");
  const password = needsPassword
    ? await readTerminalPrompt(tab, `${username}@${tab.context.host || tab.label}'s password: `, true)
    : undefined;
  return password === undefined ? { username } : { username, password };
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
  } else if (tab.kind === "local" && tab.localSessionId) {
    window.cybergrid.local.write(tab.localSessionId, data);
  }
}

let trayStateFrame: number | null = null;

function scheduleTrayStateSync(): void {
  if (trayStateFrame !== null) return;
  trayStateFrame = window.requestAnimationFrame(() => {
    trayStateFrame = null;
    const inactive = new Set<WorkspaceStatus>(["idle", "disconnected", "closed", "error"]);
    const sessions = [...tabs.values()]
      .filter((tab) => tab.kind !== "welcome" && !inactive.has(tab.status) && Boolean(
        tab.sessionId || tab.rdpSessionId || tab.streamSessionId || tab.serialSessionId || tab.localSessionId ||
        tab.vncSessionId || tab.webSessionId,
      ))
      .map((tab) => ({
        id: tab.id,
        label: tab.label,
        protocol: tab.kind as ConnectionProtocol,
        status: tab.status,
      }));
    const openTabCount = [...tabs.values()].filter((tab) => tab.kind !== "welcome").length;
    window.cybergrid.system.updateTrayState({ sessions, openTabCount, broadcastMode });
  });
}

function updateBroadcastControls(): void {
  const available = activeBroadcastTabs();
  if (available.length === 0) broadcastMode = false;
  renderQuickSnippetToolbar();
  scheduleTrayStateSync();
}

function createRdpTab(label: string, config: RdpConnectionConfig): WorkspaceTab {
  const tab = createWorkspaceTab("rdp", label);
  tab.paneElement.classList.add("rdp-pane");
  const viewport = document.createElement("div");
  viewport.className = "rdp-viewport";
  viewport.tabIndex = 0;
  tab.rdpViewportElement = viewport;
  const canvas = document.createElement("div");
  canvas.className = "rdp-canvas rdp-loading-card";
  const mark = createTextElement("div", "rdp-mark", "RDP");
  const title = document.createElement("h2");
  title.textContent = `${config.username}@${config.host}:${config.port}`;
  const message = document.createElement("p");
  message.textContent = "Preparing the native Windows Remote Desktop client...";
  tab.rdpMessageElement = message;
  const note = createTextElement("div", "rdp-native-note", "The native Windows RDP surface is being docked into this tab.");
  const disconnectButton = document.createElement("button");
  disconnectButton.className = "secondary-button";
  disconnectButton.type = "button";
  disconnectButton.textContent = "Close RDP session";
  disconnectButton.addEventListener("click", () => {
    if (tab.rdpSessionId) void window.cybergrid.rdp.disconnect(tab.rdpSessionId);
  });
  canvas.append(mark, title, message, note, disconnectButton);
  viewport.append(canvas);
  tab.paneElement.append(viewport);
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

function updateRdpBounds(tab: WorkspaceTab): void {
  if (!tab.rdpSessionId || !tab.rdpViewportElement || activeTabId !== tab.id) return;
  const rect = tab.rdpViewportElement.getBoundingClientRect();
  window.cybergrid.rdp.setBounds(tab.rdpSessionId, {
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
    if (candidate.rdpSessionId) {
      window.cybergrid.rdp.setVisible(candidate.rdpSessionId, layoutMode === "single" && isActive);
    }
  }
  requestAnimationFrame(() => {
    for (const candidate of tabs.values()) {
      if (candidate.paneElement.classList.contains("active")) candidate.fitAddon?.fit();
    }
    if (active) {
      updateWebBounds(active);
      updateRdpBounds(active);
    }
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
    updateRdpBounds(tab);
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
  if (tab.duplicate) {
    closedTabActions.push(tab.duplicate);
    if (closedTabActions.length > 12) closedTabActions.shift();
  }
  const tabOrder = [...tabs.keys()];
  const closedIndex = tabOrder.indexOf(id);
  if (tab.reconnectTimer !== undefined) window.clearTimeout(tab.reconnectTimer);
  tab.localPromptCancel?.();
  tabs.delete(id);
  recentTerminalTabIds = recentTerminalTabIds.filter((tabId) => tabId !== id);
  if (tab.sessionId) {
    sshSessions.delete(tab.sessionId);
    await window.cybergrid.ssh.disconnect(tab.sessionId).catch(() => undefined);
    queuedSshData.delete(tab.sessionId);
    queuedSshStatus.delete(tab.sessionId);
    queuedSwitchModels.delete(tab.sessionId);
  }
  if (tab.rdpSessionId) {
    rdpSessions.delete(tab.rdpSessionId);
    window.cybergrid.rdp.setVisible(tab.rdpSessionId, false);
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
  if (tab.localSessionId) {
    localSessions.delete(tab.localSessionId);
    await window.cybergrid.local.disconnect(tab.localSessionId).catch(() => undefined);
    queuedLocalData.delete(tab.localSessionId);
    queuedLocalStatus.delete(tab.localSessionId);
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

async function reopenClosedTab(): Promise<void> {
  const reopen = closedTabActions.pop();
  if (!reopen) {
    connectionState.textContent = "No recently closed connection tab is available.";
    return;
  }
  await reopen();
}

function activateNextTab(): void {
  const ids = [...tabs.keys()];
  if (ids.length < 2) return;
  const currentIndex = activeTabId ? ids.indexOf(activeTabId) : -1;
  activateTab(ids[(currentIndex + 1) % ids.length] as string);
}

function toggleGridLayout(): void {
  if (terminalTabsForGrid().length < 2) {
    connectionState.textContent = "Open at least two terminal sessions to use the 2x2 grid.";
    return;
  }
  layoutMode = layoutMode === "grid" ? "single" : "grid";
  renderWorkspaceLayout();
  tabs.get(activeTabId ?? "")?.terminal?.focus();
  scheduleWorkspaceSave();
}

function clearActiveTerminal(): void {
  const terminal = tabs.get(activeTabId ?? "")?.terminal;
  if (!terminal) {
    connectionState.textContent = "The active tab does not contain a terminal.";
    return;
  }
  terminal.clear();
  terminal.focus();
}

function toggleSidebar(): void {
  appShell.classList.toggle("sidebar-hidden");
  requestAnimationFrame(() => {
    tabs.get(activeTabId ?? "")?.fitAddon?.fit();
    const tab = activeTabId ? tabs.get(activeTabId) : undefined;
    if (tab) {
      updateWebBounds(tab);
      updateRdpBounds(tab);
    }
  });
}

function updateTabStatus(tab: WorkspaceTab, status: WorkspaceStatus, message?: string): void {
  tab.status = status;
  tab.statusElement.classList.toggle("connected", status === "connected" || status === "running" || status === "ready");
  tab.statusElement.classList.toggle("error", status === "error");
  if (tab.quickBackupButton) tab.quickBackupButton.disabled = status !== "connected";
  for (const button of tab.switchCommandButtons ?? []) {
    button.disabled = status !== "connected" && status !== "running" && status !== "ready";
  }
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
  if (event.status === "connected") tab.sshAuthRetryCount = 0;
  updateTabStatus(tab, event.status, event.message);
}

function updateRdpTabStatus(tab: WorkspaceTab, event: RdpStatusEvent): void {
  updateTabStatus(tab, event.status, event.message);
  if (tab.rdpMessageElement) tab.rdpMessageElement.textContent = event.message ?? event.status;
  tab.rdpViewportElement?.classList.toggle("embedded", event.status === "running");
  if (tab.rdpSessionId && (event.status === "closed" || event.status === "error")) {
    window.cybergrid.rdp.setVisible(tab.rdpSessionId, false);
  }
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
  if (tab.sessionId && tab.sessionId !== sessionId) sshSessions.delete(tab.sessionId);
  tab.sessionId = sessionId;
  sshSessions.set(sessionId, tab);
  replayBufferedData(tab, sessionId, queuedSshData);
  const status = queuedSshStatus.get(sessionId);
  if (status) updateSshTabStatus(tab, status);
  queuedSshStatus.delete(sessionId);
  const model = queuedSwitchModels.get(sessionId);
  if (model) applySwitchModel(tab, model);
  queuedSwitchModels.delete(sessionId);
  tab.fitAddon?.fit();
  if (tab.terminal) window.cybergrid.ssh.resize(sessionId, tab.terminal.cols, tab.terminal.rows);
  if (tab.quickBackupButton) tab.quickBackupButton.disabled = false;
  updateBroadcastControls();
}

function attachRdpSession(tab: WorkspaceTab, sessionId: string): void {
  tab.rdpSessionId = sessionId;
  rdpSessions.set(sessionId, tab);
  const status = queuedRdpStatus.get(sessionId);
  if (status) updateRdpTabStatus(tab, status);
  queuedRdpStatus.delete(sessionId);
  window.cybergrid.rdp.setVisible(sessionId, activeTabId === tab.id);
  requestAnimationFrame(() => updateRdpBounds(tab));
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

function attachLocalSession(tab: WorkspaceTab, sessionId: string): void {
  tab.localSessionId = sessionId;
  localSessions.set(sessionId, tab);
  replayBufferedData(tab, sessionId, queuedLocalData);
  const status = queuedLocalStatus.get(sessionId);
  if (status) updateTabStatus(tab, status.status, status.message);
  queuedLocalStatus.delete(sessionId);
  tab.fitAddon?.fit();
  if (tab.terminal) window.cybergrid.local.resize(sessionId, tab.terminal.cols, tab.terminal.rows);
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
function handleLocalData(event: LocalTerminalDataEvent): void { queueData(event, localSessions, queuedLocalData); }

function handleSshStatus(event: SshStatusEvent): void {
  const tab = sshSessions.get(event.sessionId);
  if (!tab) {
    queuedSshStatus.set(event.sessionId, event);
    return;
  }
  if (event.status === "error" && isSshAuthenticationFailure(event.message) && tab.sshPasswordRetry) {
    void retrySshPassword(tab, event);
    return;
  }
  updateSshTabStatus(tab, event);
}

function isSshAuthenticationFailure(message?: string): boolean {
  return /(?:all configured authentication methods failed|authentication failed|permission denied|access denied)/i.test(message ?? "");
}

async function retrySshPassword(tab: WorkspaceTab, event: SshStatusEvent): Promise<void> {
  if (tab.sshAuthRetryPrompting || !tab.sshPasswordRetry || !tabs.has(tab.id)) return;
  const maximum = currentSettings.sshMaxPasswordRetries;
  const attempts = tab.sshAuthRetryCount ?? 0;
  if (maximum > 0 && attempts >= maximum) {
    updateTabStatus(tab, "error", `SSH authentication failed after ${maximum} password retries.`);
    return;
  }
  sshSessions.delete(event.sessionId);
  if (tab.sessionId === event.sessionId) tab.sessionId = undefined;
  tab.sshAuthRetryPrompting = true;
  tab.sshAuthRetryCount = attempts + 1;
  tab.terminal?.writeln("\r\n\x1b[31mAccess denied. Please try again.\x1b[0m");
  try {
    let password = "";
    while (!password && tabs.has(tab.id)) {
      password = await readTerminalPrompt(
        tab,
        `${tab.context.username || "SSH user"}'s password (${maximum === 0 ? "unlimited retries" : `retry ${attempts + 1}/${maximum}`}; Esc to cancel): `,
        true,
      );
      if (!password) tab.terminal?.writeln("\x1b[33mPassword cannot be empty. Please try again.\x1b[0m");
    }
    if (!tabs.has(tab.id)) return;
    setTabConnecting(tab, "retrying SSH authentication...");
    await tab.sshPasswordRetry(password);
  } catch (error) {
    handleConnectionFailure(tab, error);
  } finally {
    tab.sshAuthRetryPrompting = false;
  }
}

function applySwitchModel(tab: WorkspaceTab, event: SwitchModelEvent): void {
  const label = `Model: ${event.model}`;
  if (tab.switchModelBadge) {
    tab.switchModelBadge.textContent = label;
    tab.switchModelBadge.hidden = false;
    tab.switchModelBadge.title = `${event.vendor.toUpperCase()} hardware detected automatically`;
  }
  if (tab.switchToolsModel) {
    tab.switchToolsModel.textContent = label;
    tab.switchToolsModel.title = `${event.vendor.toUpperCase()} hardware detected automatically`;
  }
  tab.detectedSwitchVendor = event.vendor === "unknown" ? "generic" : event.vendor;
  tab.renderSwitchTools?.();
}

function handleSwitchModel(event: SwitchModelEvent): void {
  const tab = sshSessions.get(event.sessionId);
  if (tab) applySwitchModel(tab, event); else queuedSwitchModels.set(event.sessionId, event);
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
function handleLocalStatus(event: LocalTerminalStatusEvent): void {
  const tab = localSessions.get(event.sessionId);
  if (tab) updateTabStatus(tab, event.status, event.message); else queuedLocalStatus.set(event.sessionId, event);
}
function handleVncStatus(event: VncStatusEvent): void {
  const tab = vncSessions.get(event.sessionId);
  if (tab) updateTabStatus(tab, event.status, event.message); else queuedVncStatus.set(event.sessionId, event);
}
function handleWebStatus(event: WebStatusEvent): void {
  const tab = webSessions.get(event.sessionId);
  if (tab) updateTabStatus(tab, event.status, event.message); else queuedWebStatus.set(event.sessionId, event);
}

function installSwitchToolsDrawer(tab: WorkspaceTab, profile?: ServerProfileSummary): void {
  if (!tab.terminal || tab.kind === "welcome") return;
  const supportedTerminal = tab.kind === "ssh" || tab.kind === "telnet" || tab.kind === "raw" || tab.kind === "serial";
  if (!supportedTerminal) return;

  if (tab.kind === "ssh") {
    const modelBadge = createTextElement("span", "switch-model-badge", "Model: Detecting...") as HTMLSpanElement;
    modelBadge.hidden = true;
    modelBadge.title = "Switch model is detected automatically after SSH connects";
    tab.switchModelBadge = modelBadge;
    (tab.terminalSurfaceElement ?? tab.paneElement).append(modelBadge);
  }

  const toggle = document.createElement("button");
  toggle.className = "switch-tools-toggle";
  toggle.type = "button";
  toggle.textContent = ">";
  toggle.setAttribute("aria-expanded", "false");
  toggle.title = "Open tools drawer";
  toggle.setAttribute("aria-label", "Open tools drawer");

  const drawer = document.createElement("aside");
  drawer.className = "switch-tools-drawer";
  drawer.setAttribute("aria-label", "Session Tools");
  drawer.setAttribute("aria-hidden", "true");
  drawer.inert = true;
  const header = createTextElement("header", "switch-tools-header", "");
  const title = createTextElement("strong", "", "Session Tools");
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = ">";
  close.title = "Collapse tools drawer";
  close.setAttribute("aria-label", "Collapse tools drawer");
  header.append(title, close);
  const body = createTextElement("div", "switch-tools-body", "");
  const model = createTextElement(
    "p",
    "switch-tools-model",
    tab.kind === "ssh" ? "Model: Detecting..." : `Terminal: ${tab.kind.toUpperCase()}`,
  ) as HTMLParagraphElement;
  tab.switchToolsModel = model;
  const osField = createTextElement("div", "switch-tools-device-os", "") as HTMLDivElement;
  const osLabel = document.createElement("label");
  osLabel.textContent = "Device OS";
  const osSelect = document.createElement("select");
  osSelect.title = "Select the command dialect, or use the SSH fingerprint result";
  for (const [value, label] of [
    ["auto", "Auto-Detect"],
    ["cisco", "Cisco IOS"],
    ["fortinet", "FortiOS"],
    ["generic", "Linux / Generic"],
  ] as const) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    osSelect.append(option);
  }
  osField.append(osLabel, osSelect);
  tab.switchToolsSelect = osSelect;
  const status = createTextElement("p", "switch-tools-status", profile
    ? `Target: ${profile.host}`
    : "Save this connection to enable backup snapshots and diagnostics.") as HTMLParagraphElement;

  const accordion = (label: string, open = false): { section: HTMLDetailsElement; content: HTMLDivElement } => {
    const section = document.createElement("details");
    section.className = "switch-tools-accordion";
    section.open = open;
    const summary = document.createElement("summary");
    summary.textContent = label;
    const content = createTextElement("div", "switch-tools-accordion-content", "") as HTMLDivElement;
    section.append(summary, content);
    return { section, content };
  };

  let commandButtons: HTMLButtonElement[] = [];
  const addCommandButtons = (
    content: HTMLElement,
    commands: ReadonlyArray<{ command: string; tooltip: string }>,
  ): void => {
    const grid = createTextElement("div", "switch-tools-command-grid", "");
    for (const item of commands) {
      const button = document.createElement("button");
      button.type = "button";
      button.disabled = true;
      button.textContent = item.command;
      button.title = item.tooltip;
      button.addEventListener("click", () => {
        writeTerminalInput(tab, commandForTerminal(item.command));
        status.textContent = `Sent: ${item.command}`;
        tab.terminal?.focus();
      });
      commandButtons.push(button);
      grid.append(button);
    }
    content.append(grid);
  };

  const setOpen = (open: boolean): void => {
    tab.switchToolsOpen = open;
    drawer.classList.toggle("open", open);
    drawer.inert = !open;
    drawer.setAttribute("aria-hidden", String(!open));
    toggle.hidden = open;
    toggle.setAttribute("aria-expanded", String(open));
    requestAnimationFrame(() => {
      tab.fitAddon?.fit();
      tab.terminal?.focus();
    });
    window.setTimeout(() => tab.fitAddon?.fit(), 180);
  };
  tab.setSwitchToolsOpen = setOpen;
  toggle.addEventListener("click", () => setOpen(true));
  close.addEventListener("click", () => setOpen(false));

  body.append(model, osField);
  const backupSection = accordion("📁 Backups", true);
  if (profile?.protocol === "ssh" && profile.category === "network") {
    const backupButton = document.createElement("button");
    backupButton.type = "button";
    backupButton.disabled = true;
    backupButton.textContent = "One-Click Backup Snapshot";
    backupButton.title = "Detect the vendor and save the running configuration as a timestamped .cfg file";
    backupButton.addEventListener("click", async () => {
      if (!tab.sessionId) return;
      backupButton.disabled = true;
      status.textContent = "Detecting vendor and capturing the running configuration...";
      try {
        const result = await window.cybergrid.ssh.quickBackup(tab.sessionId, profile.id);
        status.textContent = `${result.vendor.toUpperCase()} backup saved:\n${result.path}`;
        showActionToast("Configuration backup saved", result.path);
      } catch (error) {
        status.textContent = errorMessage(error);
      } finally {
        backupButton.disabled = !tab.sessionId || tab.status !== "connected";
      }
    });
    backupSection.content.append(backupButton);
    tab.quickBackupButton = backupButton;
    tab.quickBackupStatus = status;
  } else {
    const unavailable = document.createElement("button");
    unavailable.type = "button";
    unavailable.disabled = true;
    unavailable.textContent = "One-Click Backup Snapshot";
    unavailable.title = "Save this as an SSH Network Device profile to enable timestamped configuration backups";
    backupSection.content.append(unavailable);
  }
  body.append(backupSection.section);

  const toolsHost = createTextElement("div", "switch-tools-dynamic", "") as HTMLDivElement;
  const vendorCommands: Record<Exclude<SwitchDeviceOs, "auto" | "generic">, ReadonlyArray<{ command: string; tooltip: string }>> = {
    cisco: [
      { command: "show ip int brief", tooltip: "Summarize Cisco interface addresses and state" },
      { command: "show running-config", tooltip: "Display the active Cisco IOS configuration" },
      { command: "show vlan", tooltip: "List Cisco VLANs and port membership" },
      { command: "show log", tooltip: "Display Cisco IOS log entries" },
      { command: "show mac address-table", tooltip: "Display learned MAC addresses and switch ports" },
    ],
    fortinet: [
      { command: "get system status", tooltip: "Display FortiOS version, serial number, and system status" },
      { command: "show full-configuration", tooltip: "Display the complete FortiOS configuration" },
      { command: "get hardware status", tooltip: "Display Fortinet hardware and sensor information" },
      { command: "diagnose sys top", tooltip: "Display live FortiOS process and resource usage" },
    ],
    hp: [
      { command: "show interfaces brief", tooltip: "Summarize HP ProCurve interface state" },
      { command: "show running-config", tooltip: "Display the active ProCurve configuration" },
      { command: "show vlans", tooltip: "List HP ProCurve VLANs" },
      { command: "show log", tooltip: "Display HP ProCurve event logs" },
      { command: "show mac-address", tooltip: "Display learned MAC addresses" },
    ],
  };

  const renderVendorTools = (): void => {
    toolsHost.replaceChildren();
    commandButtons = [];
    const selected = osSelect.value as SwitchDeviceOs;
    const deviceOs = selected === "auto" ? tab.detectedSwitchVendor ?? "generic" : selected;
    if (deviceOs !== "generic" && deviceOs !== "auto") {
      const commands = accordion(deviceOs === "cisco" ? "Cisco IOS Commands" : deviceOs === "fortinet" ? "FortiOS Commands" : "HP ProCurve Commands", true);
      addCommandButtons(commands.content, vendorCommands[deviceOs]);
      toolsHost.append(commands.section);
    } else {
      const diagnostics = accordion("Linux / Generic Diagnostics", true);
      const grid = createTextElement("div", "switch-tools-command-grid", "");
      for (const [label, kind, terminalCommand] of [
        ["Ping", "ping", `ping ${tab.context.host}`],
        ["Traceroute", "traceroute", `traceroute ${tab.context.host}`],
        ["Port Scan", "port", `nmap -Pn ${tab.context.host}`],
      ] as const) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.title = `${label} the active endpoint using CyberGrid diagnostics or the current shell`;
        button.addEventListener("click", async () => {
          if (!profile) {
            writeTerminalInput(tab, commandForTerminal(terminalCommand));
            status.textContent = `Sent: ${terminalCommand}`;
            return;
          }
          button.disabled = true;
          status.textContent = `${label} running against ${profile.host}...`;
          try {
            const result = await window.cybergrid.diagnostics.run(profile.id, kind);
            status.textContent = `${result.summary}\n${result.output}`;
          } catch (error) {
            status.textContent = errorMessage(error);
          } finally {
            button.disabled = false;
          }
        });
        grid.append(button);
      }
      diagnostics.content.append(grid);
      toolsHost.append(diagnostics.section);
    }
    tab.switchCommandButtons = commandButtons;
    for (const button of commandButtons) {
      button.disabled = tab.status !== "connected" && tab.status !== "running" && tab.status !== "ready";
    }
  };
  tab.renderSwitchTools = renderVendorTools;
  osSelect.addEventListener("change", renderVendorTools);
  body.append(toolsHost);
  renderVendorTools();

  body.append(status);
  drawer.append(header, body);
  tab.paneElement.append(toggle, drawer);
}

function createTabForProfile(profile: ServerProfileSummary): WorkspaceTab {
  let tab: WorkspaceTab;
  if (profile.protocol === "rdp") tab = createRdpTab(profile.name, {
    host: profile.host, port: profile.port, username: profile.username, domain: profile.domain,
  });
  else if (profile.protocol === "vnc") tab = createVncTab(profile.name);
  else if (profile.protocol === "http" || profile.protocol === "https") tab = createWebTab(profile.name, profile.protocol);
  else tab = createTerminalTab(profile.name, profile.protocol, {
    displayName: profile.name, host: profile.host, ip: profile.host, username: profile.username,
    group: profile.group, port: profile.port, profileId: profile.id,
  }, profile.terminalOverrides, profile);
  tab.context = tabContext(profile.name, {
    displayName: profile.name, host: profile.host, ip: profile.host, username: profile.username,
    group: profile.group, port: profile.port, profileId: profile.id,
  });
  tab.duplicate = () => connectSavedProfile(profile, true);
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
  else if (result.protocol === "local") attachLocalSession(tab, result.sessionId);
  else if (result.protocol === "vnc") await attachVncSession(tab, result);
  else attachWebSession(tab, result.sessionId);
}

function handleConnectionFailure(tab: WorkspaceTab, error: unknown): void {
  updateTabStatus(tab, "error", errorMessage(error));
  if (tab.rdpMessageElement) tab.rdpMessageElement.textContent = errorMessage(error);
}

function connectionEndpointKey(protocol: ConnectionProtocol, host: string, port?: number): string {
  const normalizedHost = host.trim().replace(/^\[|\]$/g, "").toLowerCase();
  return port === undefined ? `${protocol}:${normalizedHost}` : `${protocol}:${normalizedHost}:${port}`;
}

function profileEndpointKey(profile: ServerProfileSummary): string {
  if (profile.protocol === "serial") return connectionEndpointKey("serial", profile.host);
  if (profile.protocol === "local") return connectionEndpointKey("local", profile.localShell ?? profile.host);
  return connectionEndpointKey(profile.protocol, profile.host, profile.port);
}

function focusOpenConnectionTab(connectionId?: string, endpointKey?: string): boolean {
  const existing = [...tabs.values()].find((tab) => (
    (connectionId !== undefined && tab.context.profileId === connectionId) ||
    (endpointKey !== undefined && tab.connectionKey === endpointKey)
  ));
  if (!existing) return false;
  activateTab(existing.id);
  existing.tabElement.focus();
  connectionState.textContent = `${existing.label} is already open.`;
  return true;
}

async function connectSavedProfile(profile: ServerProfileSummary, allowDuplicate = false): Promise<void> {
  const endpointKey = profileEndpointKey(profile);
  if (!allowDuplicate && focusOpenConnectionTab(profile.id, endpointKey)) return;
  const tab = createTabForProfile(profile);
  tab.connectionKey = endpointKey;
  if (profile.protocol === "ssh") {
    tab.sshPasswordRetry = async (password) => {
      const username = tab.context.username || profile.username;
      await attachProfileResult(tab, await window.cybergrid.profiles.connect(profile.id, { username, password }));
    };
  }
  setTabConnecting(tab, `opening ${profile.protocol.toUpperCase()} profile ${profile.name} from the encrypted vault...`);
  try {
    const credentials = profile.protocol === "ssh" && (
      !profile.username || (!profile.hasPassword && !profile.privateKeyPath)
    )
      ? await promptForSshCredentials(tab, profile.username, !profile.hasPassword && !profile.privateKeyPath)
      : undefined;
    await attachProfileResult(tab, await window.cybergrid.profiles.connect(profile.id, credentials));
  } catch (error) {
    handleConnectionFailure(tab, error);
  }
}

async function connectQuickSsh(config: SshConnectionConfig, allowDuplicate = false): Promise<void> {
  const endpointKey = connectionEndpointKey("ssh", config.host, config.port);
  if (!allowDuplicate && focusOpenConnectionTab(undefined, endpointKey)) return;
  const tab = createTerminalTab(config.host, "ssh", {
    host: config.host, ip: config.host, username: config.username, group: "Quick Connect", port: config.port,
  });
  tab.connectionKey = endpointKey;
  tab.duplicate = () => connectQuickSsh({ ...config }, true);
  tab.sshPasswordRetry = async (password) => {
    config.password = password;
    attachSshSession(tab, await window.cybergrid.ssh.connect({ ...config, password }));
  };
  setTabConnecting(tab, `connecting to ${config.username}@${config.host}:${config.port}...`);
  try {
    const credentials = !config.username || (config.password === undefined && !config.privateKey)
      ? await promptForSshCredentials(tab, config.username, config.password === undefined && !config.privateKey)
      : undefined;
    if (credentials?.username) {
      config.username = credentials.username;
      tab.context.username = credentials.username;
    }
    if (credentials?.password !== undefined) config.password = credentials.password;
    attachSshSession(tab, await window.cybergrid.ssh.connect({ ...config }));
  }
  catch (error) { handleConnectionFailure(tab, error); }
}

async function connectQuickRdp(config: RdpConnectionConfig, allowDuplicate = false): Promise<void> {
  const endpointKey = connectionEndpointKey("rdp", config.host, config.port);
  if (!allowDuplicate && focusOpenConnectionTab(undefined, endpointKey)) return;
  const tab = createRdpTab(config.host, config);
  tab.connectionKey = endpointKey;
  tab.context = tabContext(config.host, { host: config.host, ip: config.host, username: config.username, port: config.port });
  tab.duplicate = () => connectQuickRdp({ ...config }, true);
  tab.status = "launching";
  updateConnectionState(tab);
  try { attachRdpSession(tab, await window.cybergrid.rdp.connect(config)); }
  catch (error) { handleConnectionFailure(tab, error); }
}

async function connectQuickStream(config: StreamConnectionConfig, allowDuplicate = false): Promise<void> {
  const endpointKey = connectionEndpointKey(config.protocol, config.host, config.port);
  if (!allowDuplicate && focusOpenConnectionTab(undefined, endpointKey)) return;
  const tab = createTerminalTab(config.host, config.protocol, {
    host: config.host, ip: config.host, group: "Quick Connect", port: config.port,
  });
  tab.connectionKey = endpointKey;
  tab.duplicate = () => connectQuickStream({ ...config }, true);
  setTabConnecting(tab, `connecting to ${config.host}:${config.port}...`);
  try { attachStreamSession(tab, await window.cybergrid.stream.connect(config)); }
  catch (error) { handleConnectionFailure(tab, error); }
}

async function connectQuickSerial(config: SerialConnectionConfig, allowDuplicate = false): Promise<void> {
  const endpointKey = connectionEndpointKey("serial", config.path);
  if (!allowDuplicate && focusOpenConnectionTab(undefined, endpointKey)) return;
  const tab = createTerminalTab(config.path, "serial", {
    host: config.path, ip: config.path, group: "Quick Connect",
  });
  tab.connectionKey = endpointKey;
  tab.duplicate = () => connectQuickSerial({ ...config }, true);
  setTabConnecting(tab, `opening ${config.path} at ${config.baudRate} baud...`);
  try { attachSerialSession(tab, await window.cybergrid.serial.connect(config)); }
  catch (error) { handleConnectionFailure(tab, error); }
}

async function connectQuickLocal(config: LocalTerminalConfig, allowDuplicate = false): Promise<void> {
  const endpointKey = connectionEndpointKey("local", config.shell);
  if (!allowDuplicate && focusOpenConnectionTab(undefined, endpointKey)) return;
  const tab = createTerminalTab(config.shell, "local", {
    host: config.shell, ip: "127.0.0.1", group: "Local",
  });
  tab.connectionKey = endpointKey;
  tab.duplicate = () => connectQuickLocal({ ...config }, true);
  setTabConnecting(tab, `starting local ${config.shell} shell...`);
  try {
    attachLocalSession(tab, await window.cybergrid.local.connect({
      ...config,
      cols: tab.terminal?.cols,
      rows: tab.terminal?.rows,
    }));
  } catch (error) { handleConnectionFailure(tab, error); }
}

async function connectQuickVnc(config: VncConnectionConfig, allowDuplicate = false): Promise<void> {
  const endpointKey = connectionEndpointKey("vnc", config.host, config.port);
  if (!allowDuplicate && focusOpenConnectionTab(undefined, endpointKey)) return;
  const tab = createVncTab(config.host);
  tab.connectionKey = endpointKey;
  tab.context = tabContext(config.host, { host: config.host, ip: config.host, port: config.port });
  tab.duplicate = () => connectQuickVnc({ ...config }, true);
  setTabConnecting(tab, `connecting to VNC ${config.host}:${config.port}...`);
  try { await attachVncSession(tab, await window.cybergrid.vnc.connect(config)); }
  catch (error) { handleConnectionFailure(tab, error); }
}

async function connectQuickWeb(url: string, allowDuplicate = false): Promise<void> {
  const parsed = new URL(url);
  const protocol = parsed.protocol === "https:" ? "https" : "http";
  const port = Number(parsed.port || (protocol === "https" ? 443 : 80));
  const endpointKey = connectionEndpointKey(protocol, parsed.hostname, port);
  if (!allowDuplicate && focusOpenConnectionTab(undefined, endpointKey)) return;
  const tab = createWebTab(parsed.hostname, protocol);
  tab.connectionKey = endpointKey;
  tab.context = tabContext(parsed.hostname, { host: parsed.hostname, ip: parsed.hostname, port });
  tab.duplicate = () => connectQuickWeb(url, true);
  updateTabStatus(tab, "loading");
  const username = decodeURIComponent(parsed.username);
  const password = decodeURIComponent(parsed.password);
  parsed.username = "";
  parsed.password = "";
  try {
    attachWebSession(tab, await window.cybergrid.web.connect({
      url: parsed.toString(),
      username: username || undefined,
      password: password || undefined,
    }));
  }
  catch (error) { handleConnectionFailure(tab, error); }
}

type QuickConnection =
  | { protocol: "ssh"; config: SshConnectionConfig }
  | { protocol: "rdp"; config: RdpConnectionConfig }
  | { protocol: "telnet" | "raw"; config: StreamConnectionConfig }
  | { protocol: "serial"; config: SerialConnectionConfig }
  | { protocol: "local"; config: LocalTerminalConfig }
  | { protocol: "vnc"; config: VncConnectionConfig }
  | { protocol: "http" | "https"; url: string };

function parseQuickConnect(value: string): QuickConnection {
  const raw = value.trim();
  let url: URL;
  try { url = new URL(raw); }
  catch { throw new Error("Use protocol://user@host:port, serial://COM3?baud=9600, local://powershell, or an HTTP(S) URL."); }
  const protocol = url.protocol.replace(":", "") as ConnectionProtocol;
  if (!(["ssh", "rdp", "telnet", "raw", "vnc", "http", "https", "serial", "local"] as string[]).includes(protocol)) {
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
  if (protocol === "local") {
    const shell = (url.hostname || "powershell").toLowerCase();
    if (shell !== "powershell" && shell !== "cmd" && shell !== "wsl") {
      throw new Error("Local Quick Connect supports powershell, cmd, or wsl.");
    }
    return { protocol, config: { shell } };
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!host) throw new Error("Quick Connect requires a host.");
  const username = decodeURIComponent(url.username);
  if (protocol === "ssh") {
    return { protocol, config: { host, port: Number(url.port || 22), username, password: decodeURIComponent(url.password) || quickPasswordInput.value || undefined } };
  }
  if (protocol === "rdp") {
    if (!username) throw new Error("RDP Quick Connect requires a username.");
    return { protocol, config: { host, port: Number(url.port || 3389), username } };
  }
  if (protocol === "vnc") return { protocol, config: { host, port: Number(url.port || 5900), password: decodeURIComponent(url.password) || quickPasswordInput.value || undefined } };
  return { protocol, config: { protocol, host, port: Number(url.port || 23) } };
}

function createTextElement(
  tag: "span" | "div" | "strong" | "p" | "header" | "section",
  className: string,
  text: string,
): HTMLElement {
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

function updateCredentialProfileFields(): void {
  const privateKey = credentialProfileAuthInput.value === "privateKey";
  credentialProfilePasswordField.hidden = privateKey;
  credentialProfileKeyField.hidden = !privateKey;
  credentialProfilePassphraseField.hidden = !privateKey;
  credentialProfilePasswordInput.required = !privateKey && !credentialProfilePasswordInput.placeholder.startsWith("Stored");
  credentialProfileKeyInput.required = privateKey && !credentialProfileKeyInput.placeholder.startsWith("Stored");
}

function resetCredentialProfileForm(): void {
  credentialProfileForm.reset();
  credentialProfileIdInput.value = "";
  credentialProfileAuthInput.value = "password";
  credentialProfilePasswordInput.value = "";
  credentialProfilePasswordInput.placeholder = "Password";
  credentialProfileKeyInput.value = "";
  credentialProfileKeyInput.placeholder = "Private key path";
  credentialProfilePassphraseInput.value = "";
  credentialProfilePassphraseInput.placeholder = "Optional passphrase";
  updateCredentialProfileFields();
}

function renderCredentialProfileOptions(): void {
  const selectedId = serverCredentialProfileInput.value;
  const protocol = serverProtocolInput.value as ConnectionProtocol;
  serverCredentialProfileInput.replaceChildren(new Option("Connection-specific / inherited", ""));
  for (const credential of credentialProfiles) {
    const option = new Option(
      `${credential.name} · ${credential.username || "password only"}`,
      credential.id,
    );
    option.disabled = credential.authType === "privateKey" && protocol !== "ssh";
    serverCredentialProfileInput.append(option);
  }
  serverCredentialProfileInput.value = [...serverCredentialProfileInput.options]
    .some((option) => option.value === selectedId && !option.disabled) ? selectedId : "";
}

function renderCredentialProfiles(): void {
  credentialProfileList.replaceChildren();
  if (credentialProfiles.length === 0) {
    credentialProfileList.append(createTextElement("div", "sidebar-empty", "No reusable credential profiles saved."));
  }
  for (const credential of credentialProfiles) {
    const row = createTextElement("div", "enterprise-record", "");
    const identity = credential.domain && credential.username
      ? `${credential.domain}\\${credential.username}`
      : credential.username || "Password-only identity";
    row.append(createTextElement(
      "span",
      "",
      `${credential.name} · ${identity} · ${credential.authType === "privateKey" ? "SSH key" : "Password"}`,
    ));
    row.append(
      recordButton("Edit", () => {
        credentialProfileIdInput.value = credential.id;
        credentialProfileNameInput.value = credential.name;
        credentialProfileUsernameInput.value = credential.username;
        credentialProfileDomainInput.value = credential.domain ?? "";
        credentialProfileAuthInput.value = credential.authType;
        credentialProfilePasswordInput.value = "";
        credentialProfilePasswordInput.placeholder = credential.hasPassword
          ? "Stored password (leave blank to keep)" : "Password";
        credentialProfileKeyInput.value = credential.privateKeyPath ?? "";
        credentialProfileKeyInput.placeholder = credential.privateKeyPath
          ? "Stored private key path" : "Private key path";
        credentialProfilePassphraseInput.value = "";
        credentialProfilePassphraseInput.placeholder = credential.hasPassphrase
          ? "Stored passphrase (leave blank to keep)" : "Optional passphrase";
        updateCredentialProfileFields();
        credentialProfileCard.scrollIntoView({ block: "start", behavior: "smooth" });
      }),
      recordButton("Delete", () => {
        if (!window.confirm(`Delete credential profile "${credential.name}"?`)) return;
        void window.cybergrid.vault.deleteCredentialProfile(credential.id).then(refreshVaultContent)
          .catch((error: unknown) => { enterpriseError.textContent = errorMessage(error); });
      }),
    );
    credentialProfileList.append(row);
  }
  renderCredentialProfileOptions();
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
  renderCredentialProfiles();
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
  [credentialProfiles, folderDefaults, externalTools, connectionTasks, syncSources] = await Promise.all([
    window.cybergrid.vault.listCredentialProfiles(),
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
  updateCredentialProfileFields();
  if (!enterpriseModal.open) enterpriseModal.showModal();
}

function openCredentialProfiles(): void {
  openEnterpriseModal();
  requestAnimationFrame(() => {
    credentialProfileCard.scrollIntoView({ block: "start" });
    credentialProfileNameInput.focus();
  });
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
  const [profiles, assets, snippets, credentials, defaults, tools, tasks, sources] = await Promise.all([
    window.cybergrid.vault.listProfiles(),
    window.cybergrid.vault.listAssets(),
    window.cybergrid.vault.listSnippets(),
    window.cybergrid.vault.listCredentialProfiles(),
    window.cybergrid.vault.listFolderDefaults(),
    window.cybergrid.vault.listExternalTools(),
    window.cybergrid.vault.listConnectionTasks(),
    window.cybergrid.vault.listSyncSources(),
  ]);
  savedProfiles = profiles;
  savedAssets = assets;
  savedSnippets = snippets;
  credentialProfiles = credentials;
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
  } else if (profile.protocol === "local") {
    quickConnectInput.value = `local://${profile.localShell ?? profile.host}`;
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

function openExternalToolsMenu(): void {
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
  positionContextMenu(window.innerWidth - 278, 48, Math.min(420, 48 + externalTools.length * 34));
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
  renderDiagnosticNotifications();
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
  renderDiagnosticNotifications();
}

async function launchProfileExternalDiagnostic(
  profile: ServerProfileSummary,
  action: ExternalDiagnosticKind,
): Promise<void> {
  closeServerContextMenu();
  connectionState.textContent = action === "wireshark"
    ? `Starting Wireshark capture for ${profile.host}...`
    : `Launching ${action === "continuous-ping" ? "continuous ping" : "traceroute"}...`;
  try {
    const result = await window.cybergrid.diagnostics.launch(profile.id, action);
    connectionState.textContent = result.message;
  } catch (error) {
    connectionState.textContent = "External diagnostic failed";
    window.alert(errorMessage(error));
  }
}

function profileTreeKey(profileId: string): string {
  return `profile:${profileId}`;
}

function folderTreeKey(path: string): string {
  return `folder:${path}`;
}

function selectedProfileIdsForTree(): string[] {
  const profileIds = new Set<string>();
  const folderPaths = [...selectedTreeKeys]
    .filter((key) => key.startsWith("folder:"))
    .map((key) => key.slice("folder:".length));
  for (const key of selectedTreeKeys) {
    if (key.startsWith("profile:")) profileIds.add(key.slice("profile:".length));
  }
  for (const profile of savedProfiles) {
    if (folderPaths.some((path) => profile.group === path || profile.group.startsWith(`${path}/`))) {
      profileIds.add(profile.id);
    }
  }
  return [...profileIds];
}

function applyTreeSelectionVisuals(): void {
  for (const element of profileTree.querySelectorAll<HTMLElement>("[data-tree-key]")) {
    element.classList.toggle("selected", selectedTreeKeys.has(element.dataset.treeKey ?? ""));
  }
}

function updatePrimaryProfileSelection(key: string): void {
  if (key.startsWith("profile:") && selectedTreeKeys.has(key)) {
    const profileId = key.slice("profile:".length);
    const profile = savedProfiles.find((candidate) => candidate.id === profileId);
    selectedProfileId = profile?.id ?? null;
    if (profile) populateQuickConnect(profile);
  } else {
    const fallbackKey = [...selectedTreeKeys].reverse().find((candidate) => candidate.startsWith("profile:"));
    selectedProfileId = fallbackKey?.slice("profile:".length) ?? null;
  }
  if (snippetsDrawerOpen) renderNodeWorkspace();
}

function selectTreeItem(key: string, event: Pick<MouseEvent, "ctrlKey" | "metaKey" | "shiftKey">): void {
  if (event.shiftKey && treeSelectionAnchor) {
    const anchorIndex = treeSelectionOrder.indexOf(treeSelectionAnchor);
    const targetIndex = treeSelectionOrder.indexOf(key);
    if (anchorIndex >= 0 && targetIndex >= 0) {
      if (!event.ctrlKey && !event.metaKey) selectedTreeKeys.clear();
      const start = Math.min(anchorIndex, targetIndex);
      const end = Math.max(anchorIndex, targetIndex);
      for (const selectedKey of treeSelectionOrder.slice(start, end + 1)) selectedTreeKeys.add(selectedKey);
    }
  } else if (event.ctrlKey || event.metaKey) {
    if (selectedTreeKeys.has(key)) selectedTreeKeys.delete(key); else selectedTreeKeys.add(key);
    treeSelectionAnchor = key;
  } else {
    selectedTreeKeys.clear();
    selectedTreeKeys.add(key);
    treeSelectionAnchor = key;
  }
  updatePrimaryProfileSelection(key);
  applyTreeSelectionVisuals();
}

function ensureTreeContextSelection(key: string): void {
  if (selectedTreeKeys.has(key)) return;
  selectedTreeKeys.clear();
  selectedTreeKeys.add(key);
  treeSelectionAnchor = key;
  updatePrimaryProfileSelection(key);
  applyTreeSelectionVisuals();
}

async function deleteSelectedTreeItems(): Promise<void> {
  const profileIds = selectedProfileIdsForTree();
  if (profileIds.length === 0) {
    window.alert("The selection does not contain any saved connections.");
    return;
  }
  const folderPaths = [...selectedTreeKeys]
    .filter((key) => key.startsWith("folder:"))
    .map((key) => key.slice("folder:".length));
  const folderCount = folderPaths.length;
  const description = folderCount > 0
    ? `${profileIds.length} connection${profileIds.length === 1 ? "" : "s"} in the selected tree items`
    : `${profileIds.length} selected connection${profileIds.length === 1 ? "" : "s"}`;
  if (!window.confirm(`Delete ${description}? This cannot be undone.`)) return;

  try {
    const deletedCount = await window.cybergrid.vault.deleteProfiles(profileIds, folderPaths);
    selectedTreeKeys.clear();
    treeSelectionAnchor = null;
    selectedProfileId = null;
    closeServerContextMenu();
    await refreshProfiles();
    renderNodeWorkspace();
    connectionState.textContent = `Deleted ${deletedCount} saved connection${deletedCount === 1 ? "" : "s"}.`;
  } catch (error) {
    window.alert(errorMessage(error));
  }
}

function pasteDestinationGroup(): string | undefined {
  const selectedFolder = [...selectedTreeKeys].reverse().find((key) => key.startsWith("folder:"));
  if (selectedFolder) return selectedFolder.slice("folder:".length);
  const selectedProfileKey = [...selectedTreeKeys].reverse().find((key) => key.startsWith("profile:"));
  const selected = selectedProfileKey
    ? savedProfiles.find((profile) => profile.id === selectedProfileKey.slice("profile:".length))
    : undefined;
  return selected?.group;
}

async function duplicateConnection(profileId: string, group?: string): Promise<void> {
  try {
    const duplicate = await window.cybergrid.vault.duplicateProfile(profileId, group);
    await refreshProfiles();
    const treeKey = profileTreeKey(duplicate.id);
    selectedTreeKeys.clear();
    selectedTreeKeys.add(treeKey);
    treeSelectionAnchor = treeKey;
    selectedProfileId = duplicate.id;
    applyTreeSelectionVisuals();
    connectionState.textContent = `Created ${duplicate.name} in ${duplicate.group}.`;
  } catch (error) {
    window.alert(errorMessage(error));
  }
}

function openServerContextMenu(event: MouseEvent, profile: ServerProfileSummary): void {
  event.preventDefault();
  event.stopPropagation();
  ensureTreeContextSelection(profileTreeKey(profile.id));
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
  addAction("Connection properties...", () => {
    closeServerContextMenu();
    openServerModal(profile);
  });
  addAction("Duplicate Connection", () => {
    closeServerContextMenu();
    void duplicateConnection(profile.id, profile.group);
  });
  const selectedCount = selectedProfileIdsForTree().length;
  addAction(`Delete Selected (${selectedCount})`, () => void deleteSelectedTreeItems(), selectedCount === 0);
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
  const nonNetwork = profile.protocol === "serial" || profile.protocol === "local";
  addAction("Ping (Continuous)", () => void launchProfileExternalDiagnostic(profile, "continuous-ping"), nonNetwork);
  addAction("Traceroute", () => void launchProfileExternalDiagnostic(profile, "traceroute"), nonNetwork);
  addAction("Launch Wireshark (Capture IP)", () => void launchProfileExternalDiagnostic(profile, "wireshark"), nonNetwork);
  appendContextSeparator();
  addAction("Ping test (single)", () => void executeProfileDiagnostic(profile, "ping"), nonNetwork);
  addAction("DNS lookup", () => void executeProfileDiagnostic(profile, "dns"), nonNetwork);
  addAction(`Port check (${profile.port})`, () => void executeProfileDiagnostic(profile, "port"), nonNetwork);
  positionContextMenu(event.clientX, event.clientY, Math.min(620, 360 + externalTools.length * 34));
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
    renderDiagnosticNotifications();
  });
  header.append(closeButton);
  const output = document.createElement("pre");
  output.textContent = diagnostic.output;
  panel.append(header, output);
  return panel;
}

function renderDiagnosticNotifications(): void {
  diagnosticNotificationRegion.replaceChildren();
  for (const profileId of diagnosticResults.keys()) {
    const diagnostic = diagnosticElement(profileId);
    if (diagnostic) diagnosticNotificationRegion.append(diagnostic);
  }
}

interface ProfileFolderNode {
  name: string;
  path: string;
  profiles: ServerProfileSummary[];
  children: Map<string, ProfileFolderNode>;
}

function autoScrollSidebar(clientY: number): void {
  const bounds = sidebarScroll.getBoundingClientRect();
  const edge = 44;
  if (clientY < bounds.top + edge) sidebarScroll.scrollTop -= 18;
  else if (clientY > bounds.bottom - edge) sidebarScroll.scrollTop += 18;
}

async function moveProfileToGroup(profileId: string, group: string): Promise<void> {
  const profile = savedProfiles.find((candidate) => candidate.id === profileId);
  if (!profile || profile.group === group) return;
  connectionState.textContent = `Moving ${profile.name} to ${group}...`;
  try {
    await window.cybergrid.vault.moveProfile(profileId, group);
    await refreshProfiles();
    connectionState.textContent = `${profile.name} moved to ${group}.`;
  } catch (error) {
    connectionState.textContent = errorMessage(error);
  }
}

function renderProfiles(): void {
  const previousScrollTop = sidebarScroll.scrollTop;
  profileTree.replaceChildren();
  groupOptions.replaceChildren();
  treeSelectionOrder = [];
  if (selectedTreeKeys.size === 0 && selectedProfileId) selectedTreeKeys.add(profileTreeKey(selectedProfileId));
  profileTree.ondragover = (event) => {
    if (!draggedProfileId) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    autoScrollSidebar(event.clientY);
    if (!(event.target as HTMLElement).closest(".folder-header")) profileTree.classList.add("drop-target");
  };
  profileTree.ondragleave = (event) => {
    if (!profileTree.contains(event.relatedTarget as Node | null)) profileTree.classList.remove("drop-target");
  };
  profileTree.ondrop = (event) => {
    if ((event.target as HTMLElement).closest(".folder-header")) return;
    event.preventDefault();
    profileTree.classList.remove("drop-target");
    const profileId = event.dataTransfer?.getData("application/x-cybergrid-profile") || draggedProfileId;
    const targetGroup = (event.target as HTMLElement).closest<HTMLElement>(".server-item")?.dataset.profileGroup;
    if (profileId) void moveProfileToGroup(profileId, targetGroup || "Ungrouped");
  };
  if (savedProfiles.length === 0) {
    profileTree.append(createTextElement("div", "sidebar-empty", "No saved connections yet. Add one or import an existing connection tree."));
    sidebarScroll.scrollTop = previousScrollTop;
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
    const treeKey = profileTreeKey(profile.id);
    treeSelectionOrder.push(treeKey);
    button.className = "server-item";
    button.classList.toggle("selected", selectedTreeKeys.has(treeKey));
    button.type = "button";
    button.draggable = true;
    button.dataset.treeKey = treeKey;
    button.dataset.profileGroup = profile.group;
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
    button.addEventListener("click", (event) => selectTreeItem(treeKey, event));
    button.addEventListener("dragstart", (event) => {
      draggedProfileId = profile.id;
      row.classList.add("dragging");
      event.dataTransfer?.setData("application/x-cybergrid-profile", profile.id);
      event.dataTransfer?.setData("text/plain", profile.name);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    });
    button.addEventListener("dragend", () => {
      draggedProfileId = null;
      row.classList.remove("dragging");
      profileTree.classList.remove("drop-target");
      for (const item of profileTree.querySelectorAll(".folder-header.drop-target")) item.classList.remove("drop-target");
    });
    button.addEventListener("dblclick", () => void connectSavedProfile(profile));
    button.addEventListener("contextmenu", (event) => openServerContextMenu(event, profile));
    const remove = document.createElement("button");
    remove.className = "server-delete";
    remove.type = "button";
    remove.title = `Delete ${profile.name}`;
    remove.setAttribute("aria-label", `Delete ${profile.name}`);
    remove.textContent = "\u00d7";
    remove.addEventListener("click", (event) => {
      event.stopPropagation();
      selectedTreeKeys.clear();
      selectedTreeKeys.add(treeKey);
      treeSelectionAnchor = treeKey;
      updatePrimaryProfileSelection(treeKey);
      applyTreeSelectionVisuals();
      void deleteSelectedTreeItems();
    });
    row.append(button, remove);
    list.append(row);
  };

  const renderFolder = (node: ProfileFolderNode, parent: HTMLElement): void => {
    const section = document.createElement("section");
    section.className = "server-group";
    section.classList.toggle("collapsed", collapsedGroups.has(node.path));
    const defaults = folderDefaults.find((item) => item.path === node.path);
    const folder = document.createElement("button");
    const treeKey = folderTreeKey(node.path);
    treeSelectionOrder.push(treeKey);
    folder.className = "folder-header";
    folder.classList.toggle("selected", selectedTreeKeys.has(treeKey));
    folder.type = "button";
    folder.dataset.treeKey = treeKey;
    folder.style.setProperty("--node-color", defaults?.indicatorColor ?? "var(--accent)");
    folder.setAttribute("aria-expanded", String(!collapsedGroups.has(node.path)));
    folder.append(
      createTextElement("span", "folder-chevron", collapsedGroups.has(node.path) ? ">" : "v"),
      createTextElement("span", "folder-name", `${defaults?.icon ? `${DEVICE_ICON_LABELS[defaults.icon]} · ` : ""}${node.name}`),
      createTextElement("span", "folder-count", String(count(node))),
    );
    folder.addEventListener("click", (event) => selectTreeItem(treeKey, event));
    folder.addEventListener("dblclick", () => {
      if (collapsedGroups.has(node.path)) collapsedGroups.delete(node.path); else collapsedGroups.add(node.path);
      renderProfiles();
    });
    folder.addEventListener("dragover", (event) => {
      if (!draggedProfileId) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      folder.classList.add("drop-target");
      autoScrollSidebar(event.clientY);
    });
    folder.addEventListener("dragleave", (event) => {
      if (!folder.contains(event.relatedTarget as Node | null)) folder.classList.remove("drop-target");
    });
    folder.addEventListener("drop", (event) => {
      event.preventDefault();
      event.stopPropagation();
      folder.classList.remove("drop-target");
      const profileId = event.dataTransfer?.getData("application/x-cybergrid-profile") || draggedProfileId;
      if (profileId) void moveProfileToGroup(profileId, node.path);
    });
    folder.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      ensureTreeContextSelection(treeKey);
      serverContextMenu.replaceChildren();
      const selectedCount = selectedProfileIdsForTree().length;
      appendContextAction(`Delete Selected (${selectedCount})`, () => void deleteSelectedTreeItems(), selectedCount === 0);
      appendContextSeparator();
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
  const validKeys = new Set(treeSelectionOrder);
  for (const key of [...selectedTreeKeys]) if (!validKeys.has(key)) selectedTreeKeys.delete(key);
  applyTreeSelectionVisuals();
  sidebarScroll.scrollTop = previousScrollTop;
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
  if (!available && sftpDrawerOpen) {
    setSftpDrawerOpen(false);
  }
}

function setSftpDrawerOpen(open: boolean): void {
  if (open) setSnippetsDrawerOpen(false);
  sftpDrawerOpen = open;
  contentArea.classList.toggle("sftp-open", open);
  sftpDrawer.hidden = !open;
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
  selectedTreeKeys.clear();
  selectedTreeKeys.add(profileTreeKey(profile.id));
  treeSelectionAnchor = profileTreeKey(profile.id);
  applyTreeSelectionVisuals();
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
  snippetPinnedInput.checked = snippet?.pinned ?? false;
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
  if (tab.kind === "local" && tab.localSessionId) return tab;
  return undefined;
}

function executeSnippet(snippet: SnippetRecord): void {
  const targets = broadcastMode ? selectedBroadcastTabs() : [activeSnippetTab()].filter(
    (tab): tab is WorkspaceTab => Boolean(tab),
  );
  if (targets.length === 0) {
    snippetStatus.textContent = broadcastMode
      ? "No selected broadcast targets are connected."
      : "Select a connected SSH, Telnet, RAW, serial, or local terminal tab first.";
    return;
  }
  try {
    for (const tab of targets) {
      writeTerminalInput(tab, commandForTerminal(substituteSnippetTokens(snippet, tab)));
    }
    snippetStatus.textContent = `Executed "${snippet.name}" on ${targets.length} session${targets.length === 1 ? "" : "s"}.`;
    connectionState.textContent = `Ran ${snippet.name} on ${targets.length} session${targets.length === 1 ? "" : "s"}`;
  } catch (error) {
    snippetStatus.textContent = errorMessage(error);
    connectionState.textContent = errorMessage(error);
  }
}

function setQuickSnippetToolbarVisible(visible: boolean): void {
  quickSnippetToolbarVisible = visible;
  localStorage.setItem(QUICK_SNIPPET_TOOLBAR_KEY, String(visible));
  renderQuickSnippetToolbar();
  requestAnimationFrame(() => tabs.get(activeTabId ?? "")?.fitAddon?.fit());
}

function renderQuickSnippetToolbar(): void {
  quickSnippetToolbar.hidden = !quickSnippetToolbarVisible;
  quickSnippetButtons.replaceChildren();
  if (!quickSnippetToolbarVisible) return;
  const pinned = savedSnippets.filter((snippet) => snippet.pinned);
  if (pinned.length === 0) {
    quickSnippetButtons.append(createTextElement(
      "span",
      "quick-snippet-empty",
      "No pinned macros. Pin commands from Tools → Node Workspace.",
    ));
    return;
  }
  const hasTarget = broadcastMode ? selectedBroadcastTabs().length > 0 : Boolean(activeSnippetTab());
  for (const snippet of pinned) {
    const button = document.createElement("button");
    button.className = "quick-snippet-button";
    button.type = "button";
    button.textContent = snippet.name;
    button.title = `${snippet.language === "cisco" ? "Cisco CLI" : snippet.language} · ${snippet.body.split(/\r?\n/)[0] ?? ""}`;
    button.disabled = !hasTarget;
    button.addEventListener("click", () => executeSnippet(snippet));
    quickSnippetButtons.append(button);
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
    renderQuickSnippetToolbar();
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
    const pinButton = document.createElement("button");
    pinButton.className = "secondary-button compact-button";
    pinButton.type = "button";
    pinButton.textContent = snippet.pinned ? "Unpin" : "Pin";
    pinButton.addEventListener("click", async () => {
      try {
        await window.cybergrid.vault.saveSnippet({
          id: snippet.id,
          name: snippet.name,
          language: snippet.language,
          tags: [...snippet.tags],
          body: snippet.body,
          pinned: !snippet.pinned,
        });
        savedSnippets = await window.cybergrid.vault.listSnippets();
        renderSnippets();
      } catch (error) {
        snippetStatus.textContent = errorMessage(error);
      }
    });
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
    actions.append(runButton, pinButton, editButton, deleteButton);
    card.append(heading, tags, preview, actions);
    snippetList.append(card);
  }
  renderQuickSnippetToolbar();
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
  credentialProfiles = [];
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

const DEFAULT_PROTOCOL_PORTS: Record<Exclude<ConnectionProtocol, "serial" | "local">, number> = {
  ssh: 22,
  rdp: 3389,
  telnet: 23,
  raw: 23,
  vnc: 5900,
  http: 80,
  https: 443,
};

const CATEGORY_PROTOCOLS: Record<ConnectionCategory, ConnectionProtocol[]> = {
  server: ["rdp", "ssh", "vnc", "local"],
  network: ["ssh", "serial"],
  web: ["https"],
  desktop: ["vnc", "rdp"],
};

const CATEGORY_DEFAULT_PROTOCOL: Record<ConnectionCategory, ConnectionProtocol> = {
  server: "rdp",
  network: "ssh",
  web: "https",
  desktop: "vnc",
};

async function refreshSerialPortOptions(preferredPath = ""): Promise<void> {
  const preferred = preferredPath.trim() || serverSerialPortInput.value;
  refreshSerialPortsButton.disabled = true;
  serverSerialPortStatus.textContent = "Detecting local serial ports...";
  try {
    const ports = await window.cybergrid.serial.list();
    serverSerialPortInput.replaceChildren();
    if (preferred && !ports.some((port) => port.path.toLowerCase() === preferred.toLowerCase())) {
      const savedOption = document.createElement("option");
      savedOption.value = preferred;
      savedOption.textContent = `${preferred} (saved; currently unavailable)`;
      serverSerialPortInput.append(savedOption);
    }
    for (const port of ports) {
      const option = document.createElement("option");
      option.value = port.path;
      const descriptor = [port.manufacturer, port.vendorId && port.productId
        ? `${port.vendorId}:${port.productId}` : ""].filter(Boolean).join(" · ");
      option.textContent = descriptor ? `${port.path} — ${descriptor}` : port.path;
      serverSerialPortInput.append(option);
    }
    if (serverSerialPortInput.options.length === 0) {
      const emptyOption = document.createElement("option");
      emptyOption.value = "";
      emptyOption.textContent = "No serial ports detected";
      emptyOption.disabled = true;
      emptyOption.selected = true;
      serverSerialPortInput.append(emptyOption);
    } else if (preferred) {
      serverSerialPortInput.value = preferred;
    }
    serverSerialPortStatus.textContent = ports.length === 1
      ? "1 local serial port detected."
      : `${ports.length} local serial ports detected.`;
  } catch (error) {
    serverSerialPortInput.replaceChildren();
    if (preferred) {
      const option = document.createElement("option");
      option.value = preferred;
      option.textContent = `${preferred} (saved)`;
      serverSerialPortInput.append(option);
    }
    serverSerialPortStatus.textContent = `Port detection failed: ${errorMessage(error)}`;
  } finally {
    refreshSerialPortsButton.disabled = false;
  }
}

function applySmartEndpointFields(): void {
  if (serverProtocolInput.value === "serial" || serverProtocolInput.value === "local" || !serverHostInput.value.trim()) return;
  const target = parseConnectionTarget(serverHostInput.value);
  serverHostInput.value = target.host;
  if (target.port !== undefined) serverPortInput.value = String(target.port);
  if (target.username !== undefined) serverUsernameInput.value = target.username;
}

function selectConnectionCategory(category: ConnectionCategory, resetProtocol = true): void {
  const normalizedCategory: ConnectionCategory = category === "desktop" ? "server" : category;
  connectionCategory = normalizedCategory;
  for (const button of categoryButtons) {
    button.classList.toggle("active", button.dataset.connectionCategory === normalizedCategory);
    button.setAttribute("aria-pressed", String(button.dataset.connectionCategory === normalizedCategory));
  }
  const allowed = new Set(CATEGORY_PROTOCOLS[normalizedCategory]);
  for (const option of serverProtocolInput.options) {
    option.hidden = !allowed.has(option.value as ConnectionProtocol);
    option.disabled = !allowed.has(option.value as ConnectionProtocol);
  }
  if (resetProtocol || !allowed.has(serverProtocolInput.value as ConnectionProtocol)) {
    serverProtocolInput.value = CATEGORY_DEFAULT_PROTOCOL[normalizedCategory];
  }
  if (resetProtocol) serverLegacySshInput.checked = normalizedCategory === "network";
  updateProfileFields(true);
}

function updateProfileFields(resetDefaults = false): void {
  const protocol = serverProtocolInput.value as ConnectionProtocol;
  const serial = protocol === "serial";
  const local = protocol === "local";
  serverHostLabel.textContent = serial ? "COM port" : local ? "Local shell" : "IP / Hostname";
  serverHostInput.placeholder = serial ? "COM3" : local ? "powershell, cmd, or wsl" : "admin@server.example.net:22";
  serverHostField.hidden = false;
  serverHostInput.disabled = false;
  serverHostInput.required = true;
  serverSerialPortField.hidden = true;
  serverSerialPortInput.disabled = true;
  serverSerialPortInput.required = false;
  serverLocalShellField.hidden = true;
  serverLocalShellInput.disabled = true;
  serverLocalShellInput.required = false;
  serverPortInput.closest<HTMLElement>(".field")?.toggleAttribute("hidden", serial || local);
  serverPortInput.disabled = serial || local;
  serverPortInput.required = false;
  if (resetDefaults) serverPortInput.value = "";
  serverSerialSection.hidden = true;
  serverBaudRateInput.required = false;
  serverCredentialProfileField.hidden = true;
  serverUsernameField.hidden = false;
  serverDomainInput.closest<HTMLElement>(".field")?.toggleAttribute("hidden", protocol !== "rdp");
  serverUsernameInput.required = false;
  serverAuthField.hidden = true;
  serverPasswordSection.hidden = false;
  serverPasswordInput.required = false;
  serverKeySection.hidden = true;
  serverKeyPathInput.required = false;
}

function openServerModal(profile?: ServerProfileSummary): void {
  serverForm.reset();
  editingProfileId = profile?.id ?? null;
  editingProfileSnapshot = profile ?? null;
  serverModalTitle.textContent = profile ? "Connection Properties" : "Add Connection";
  serverProtocolInput.value = profile?.protocol ?? CATEGORY_DEFAULT_PROTOCOL.server;
  serverBaudRateInput.value = "9600";
  serverInheritFolderInput.checked = profile?.inheritFolderDefaults ?? true;
  serverKeepaliveEnabledInput.checked = profile?.keepAliveEnabled ?? true;
  serverIndicatorColorInput.value = profile?.indicatorColor ?? currentSettings.accent;
  renderTaskOptions();
  serverFormError.textContent = "";
  serverPasswordInput.type = "password";
  serverPasswordToggle.textContent = "👁";
  serverPasswordToggle.setAttribute("aria-label", "Show password");
  serverPasswordToggle.title = "Show password";
  selectConnectionCategory(profile?.category ?? "server", false);
  if (profile) {
    serverProtocolInput.value = profile.protocol;
    renderCredentialProfileOptions();
    serverCredentialProfileInput.value = profile.credentialProfileId ?? "";
    serverNameInput.value = profile.name;
    serverHostInput.value = profile.host;
    serverPortInput.value = String(profile.port);
    serverUsernameInput.value = profile.username
      .replace(profile.domain ? `${profile.domain}\\` : "", "")
      .replace(/^~+/, "");
    serverGroupInput.value = profile.group;
    serverTagsInput.value = profile.tags.join(", ");
    serverFavoriteInput.checked = profile.favorite;
    serverDomainInput.value = profile.domain ?? "";
    authTypeInput.value = profile.credentialProfileId ? "none" : profile.authType;
    serverPasswordInput.value = "";
    serverPasswordInput.placeholder = profile.hasPassword ? "Stored password (leave blank to keep)" : "";
    serverKeyPathInput.value = profile.privateKeyPath ?? "";
    serverPassphraseInput.value = "";
    serverPassphraseInput.placeholder = profile.hasPassphrase ? "Stored passphrase (leave blank to keep)" : "";
    serverBaudRateInput.value = String(profile.baudRate ?? 9_600);
    serverDataBitsInput.value = String(profile.dataBits ?? 8);
    serverStopBitsInput.value = String(profile.stopBits ?? 1);
    serverParityInput.value = profile.parity ?? "none";
    serverLocalShellInput.value = profile.localShell ?? "powershell";
    serverForwardLocalPortInput.value = profile.portForward ? String(profile.portForward.localPort) : "";
    serverForwardRemoteHostInput.value = profile.portForward?.remoteHost ?? "";
    serverForwardRemotePortInput.value = profile.portForward ? String(profile.portForward.remotePort) : "";
    serverTimeoutInput.value = profile.readyTimeoutSeconds ? String(profile.readyTimeoutSeconds) : "";
    serverKeepaliveInput.value = profile.keepaliveSeconds ? String(profile.keepaliveSeconds) : "";
    serverPersistInput.checked = profile.persistUntilAppCloses;
    serverAutoReconnectInput.checked = profile.autoReconnect;
    serverLegacySshInput.checked = profile.enableLegacySshAlgorithms;
    serverJumpHostInput.value = profile.jumpHost ?? "";
    serverProxyOverrideInput.value = profile.proxyOverride ?? "";
    serverIconInput.value = profile.icon;
    serverApplicationBadgeInput.value = profile.applicationBadge ?? "";
    for (const option of serverPreTasksInput.options) option.selected = profile.preConnectTaskIds.includes(option.value);
    for (const option of serverPostTasksInput.options) option.selected = profile.postConnectTaskIds.includes(option.value);
  } else {
    serverCredentialProfileInput.value = "";
    authTypeInput.value = "password";
    serverPasswordInput.placeholder = "";
    serverPassphraseInput.placeholder = "";
    serverLegacySshInput.checked = connectionCategory === "network";
    serverLocalShellInput.value = "powershell";
    serverForwardLocalPortInput.value = "";
    serverForwardRemoteHostInput.value = "";
    serverForwardRemotePortInput.value = "";
  }
  updateProfileFields(false);
  if (profile?.protocol === "serial" && serverSerialPortInput.options.length > 0) {
    void refreshSerialPortOptions(profile.host);
  }
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
  confirmExitActiveSessionsInput.checked = settings.confirmExitWithActiveSessions;
  compactTreeViewInput.checked = settings.compactTreeView;
  masterPasswordEnabledInput.checked = settings.masterPasswordEnabled;
  autoLockInput.value = String(settings.autoLockMinutes);
  clipboardClearInput.value = String(settings.clipboardClearSeconds);
  themeInput.value = settings.theme;
  fontFamilyInput.value = settings.fontFamily;
  fontSizeInput.value = String(settings.fontSize);
  terminalLineHeightInput.value = String(settings.terminalLineHeight);
  sshKeepAliveSecondsInput.value = String(settings.sshKeepAliveSeconds);
  sshMaxPasswordRetriesInput.value = String(settings.sshMaxPasswordRetries);
  cursorBlinkInput.checked = settings.cursorBlink;
  backgroundInput.value = settings.background;
  foregroundInput.value = settings.foreground;
  cursorInput.value = settings.cursor;
  accentInput.value = settings.accent;
  rdpSmartSizingInput.checked = settings.rdpSmartSizing;
  rdpColorDepthInput.value = String(settings.rdpColorDepth);
  rdpSoundModeInput.value = settings.rdpSoundMode;
  proxyModeInput.value = settings.proxyMode;
  proxyUrlInput.value = settings.proxyUrl;
  proxyBypassInput.value = settings.proxyBypassRules;
  healthCheckIntervalInput.value = String(settings.healthCheckIntervalSeconds);
  backupDirectoryInput.value = settings.backupDirectory;
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

function openMigrationModal(): void {
  migrationStatus.textContent = "";
  migrationError.textContent = "";
  migrationPassphrase.value = "";
  if (!migrationModal.open) migrationModal.showModal();
}

function openVaultBackupExport(): void {
  openMigrationModal();
  migrationExportFormat.value = "cgvault";
  migrationStatus.textContent = "Enter a team vault passphrase, then choose the export destination.";
  requestAnimationFrame(() => migrationPassphrase.focus());
}

function openScanModal(): void {
  scanError.textContent = "";
  if (!scanModal.open) scanModal.showModal();
  requestAnimationFrame(() => scanTargetInput.focus());
}

async function lockVaultFromUi(): Promise<void> {
  try {
    await window.cybergrid.vault.lock();
    applyLockedRendererState();
  } catch (error) {
    window.alert(errorMessage(error));
  }
}

function toggleBroadcastMode(): void {
  if (broadcastMode) {
    broadcastMode = false;
    connectionState.textContent = "Broadcast mode disabled";
  } else if (selectedBroadcastTabs().length === 0) {
    openBroadcastTargets();
  } else {
    broadcastMode = true;
    connectionState.textContent = `Broadcast mode enabled for ${selectedBroadcastTabs().length} session${selectedBroadcastTabs().length === 1 ? "" : "s"}`;
  }
  updateBroadcastControls();
  tabs.get(activeTabId ?? "")?.terminal?.focus();
}

async function disconnectAllSessions(): Promise<void> {
  const sessionTabIds = [...tabs.values()]
    .filter((tab) => tab.kind !== "welcome")
    .map((tab) => tab.id);
  broadcastMode = false;
  for (const tabId of sessionTabIds) await closeTab(tabId);
  connectionState.textContent = sessionTabIds.length > 0
    ? `Disconnected ${sessionTabIds.length} session${sessionTabIds.length === 1 ? "" : "s"}.`
    : "No active sessions to disconnect.";
  updateBroadcastControls();
}

function createFolderFromMenu(): void {
  const suggestedParent = pasteDestinationGroup();
  const path = window.prompt("New folder path", suggestedParent ? `${suggestedParent}/New Folder` : "New Folder")?.trim();
  if (!path) return;
  openFolderDefaultsModal(path.replace(/\\/g, "/").replace(/\s*>\s*/g, "/"));
}

function duplicateSelectedConnectionFromMenu(): void {
  const profileId = selectedProfileIdsForTree()[0];
  if (!profileId) {
    connectionState.textContent = "Select a saved connection to duplicate.";
    return;
  }
  void duplicateConnection(profileId, pasteDestinationGroup());
}

function toggleActiveToolsDrawer(): void {
  const tab = activeTabId ? tabs.get(activeTabId) : undefined;
  if (!tab?.setSwitchToolsOpen) {
    connectionState.textContent = "The active tab does not provide terminal tools.";
    return;
  }
  tab.setSwitchToolsOpen(!tab.switchToolsOpen);
}

function runSelectedPortScan(): void {
  const profile = selectedProfile();
  if (!profile) {
    connectionState.textContent = "Select a saved connection to run a port scan.";
    return;
  }
  void executeProfileDiagnostic(profile, "port");
}

async function handleAppMenuCommand(command: AppMenuCommand): Promise<void> {
  const requiresUnlockedVault = new Set<AppMenuCommand>([
    "new-connection", "new-folder", "duplicate-connection", "delete-selection", "lock-vault",
    "import-export", "command-palette", "external-tools", "enterprise", "credential-profiles",
    "subnet-scanner", "port-scan", "settings", "export-vault-backup",
  ]);
  if (requiresUnlockedVault.has(command) && !vaultUnlocked) {
    vaultError.textContent = "Unlock the credential vault to use this command.";
    return;
  }
  switch (command) {
    case "new-connection": openServerModal(); break;
    case "new-folder": createFolderFromMenu(); break;
    case "duplicate-connection": duplicateSelectedConnectionFromMenu(); break;
    case "delete-selection": await deleteSelectedTreeItems(); break;
    case "focus-quick-connect": quickConnectInput.focus(); quickConnectInput.select(); break;
    case "lock-vault": await lockVaultFromUi(); break;
    case "import-export": openMigrationModal(); break;
    case "export-vault-backup": openVaultBackupExport(); break;
    case "command-palette": openCommandPalette(); break;
    case "clear-terminal": clearActiveTerminal(); break;
    case "toggle-sidebar": toggleSidebar(); break;
    case "toggle-tools-drawer": toggleActiveToolsDrawer(); break;
    case "toggle-grid": toggleGridLayout(); break;
    case "toggle-broadcast": toggleBroadcastMode(); break;
    case "broadcast-targets": openBroadcastTargets(); break;
    case "toggle-sftp":
      if (!activeSshTab()) connectionState.textContent = "Select a connected SSH tab to open SFTP.";
      else setSftpDrawerOpen(!sftpDrawerOpen);
      break;
    case "node-workspace":
      setSnippetsDrawerOpen(!snippetsDrawerOpen);
      if (snippetsDrawerOpen) selectOperationsPanel("commands");
      break;
    case "toggle-quick-snippets": setQuickSnippetToolbarVisible(!quickSnippetToolbarVisible); break;
    case "external-tools": openExternalToolsMenu(); break;
    case "enterprise": openEnterpriseModal(); break;
    case "credential-profiles": openCredentialProfiles(); break;
    case "subnet-scanner": openScanModal(); break;
    case "port-scan": runSelectedPortScan(); break;
    case "settings": openSettingsModal(); break;
    case "close-tab": if (activeTabId) await closeTab(activeTabId); break;
    case "reopen-tab": await reopenClosedTab(); break;
    case "next-tab": activateNextTab(); break;
    case "help": if (helpModal.open) helpModal.close(); else openHelp(); break;
    case "shortcuts": if (shortcutsModal.open) shortcutsModal.close(); else openShortcuts(); break;
    case "disconnect-all-sessions": await disconnectAllSessions(); break;
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
    else if (parsed.protocol === "local") await connectQuickLocal(parsed.config);
    else if (parsed.protocol === "vnc") await connectQuickVnc(parsed.config);
    else if (parsed.protocol === "http" || parsed.protocol === "https") await connectQuickWeb(parsed.url);
  } catch (error) {
    connectionState.textContent = errorMessage(error);
  } finally {
    quickPasswordInput.value = "";
  }
});

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

sftpCloseButton.addEventListener("click", () => setSftpDrawerOpen(false));
snippetsCloseButton.addEventListener("click", () => setSnippetsDrawerOpen(false));
quickSnippetCloseButton.addEventListener("click", () => setQuickSnippetToolbarVisible(false));
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
    pinned: snippetPinnedInput.checked,
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

addServerButton.addEventListener("click", () => openServerModal());
enterpriseCloseButton.addEventListener("click", () => enterpriseModal.close());
enterpriseModal.addEventListener("click", (event) => {
  if (event.target === enterpriseModal) enterpriseModal.close();
});

credentialProfileAuthInput.addEventListener("change", updateCredentialProfileFields);
credentialProfileResetButton.addEventListener("click", resetCredentialProfileForm);
credentialProfileKeyBrowseButton.addEventListener("click", async () => {
  const selectedPath = await window.cybergrid.system.selectPrivateKey();
  if (selectedPath) credentialProfileKeyInput.value = selectedPath;
});
credentialProfileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  enterpriseError.textContent = "";
  const authType = credentialProfileAuthInput.value === "privateKey" ? "privateKey" : "password";
  const input: CredentialProfileInput = {
    id: credentialProfileIdInput.value || undefined,
    name: credentialProfileNameInput.value.trim(),
    username: credentialProfileUsernameInput.value.trim(),
    domain: credentialProfileDomainInput.value.trim() || undefined,
    authType,
    password: authType === "password" ? credentialProfilePasswordInput.value || undefined : undefined,
    privateKeyPath: authType === "privateKey" ? credentialProfileKeyInput.value.trim() || undefined : undefined,
    passphrase: authType === "privateKey" ? credentialProfilePassphraseInput.value || undefined : undefined,
  };
  try {
    await window.cybergrid.vault.saveCredentialProfile(input);
    resetCredentialProfileForm();
    await refreshVaultContent();
    enterpriseError.textContent = `Credential profile "${input.name}" saved in the encrypted vault.`;
  } catch (error) {
    enterpriseError.textContent = errorMessage(error);
  }
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
    const credentialText = result.credentialProfilesImported > 0
      ? ` Linked ${result.credentialProfilesImported} credential profile${result.credentialProfilesImported === 1 ? "" : "s"}.`
      : "";
    migrationStatus.textContent = `Imported ${result.imported} connection${result.imported === 1 ? "" : "s"} from ${result.path}.${credentialText}${warningText}`;
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

scanButton.addEventListener("click", openScanModal);
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

lockButton.addEventListener("click", () => void lockVaultFromUi());

serverProtocolInput.addEventListener("change", () => updateProfileFields(true));
refreshSerialPortsButton.addEventListener("click", () => {
  void refreshSerialPortOptions(serverSerialPortInput.value || serverHostInput.value);
});
serverHostInput.addEventListener("blur", () => {
  try {
    applySmartEndpointFields();
    serverFormError.textContent = "";
  } catch (error) {
    serverFormError.textContent = errorMessage(error);
  }
});
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
serverCredentialProfileInput.addEventListener("change", () => updateProfileFields(false));
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
serverModal.addEventListener("close", () => {
  editingProfileId = null;
  editingProfileSnapshot = null;
  serverPasswordInput.type = "password";
  serverPasswordInput.value = "";
});
serverPasswordToggle.addEventListener("click", () => {
  const reveal = serverPasswordInput.type === "password";
  serverPasswordInput.type = reveal ? "text" : "password";
  serverPasswordToggle.textContent = reveal ? "◉" : "👁";
  serverPasswordToggle.setAttribute("aria-label", reveal ? "Hide password" : "Show password");
  serverPasswordToggle.title = reveal ? "Hide password" : "Show password";
  serverPasswordInput.focus();
});
serverForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  serverFormError.textContent = "";
  const protocol = serverProtocolInput.value as ConnectionProtocol;
  const existing = editingProfileSnapshot;
  const passwordProvided = serverPasswordInput.value.length > 0;
  const credentialProfileId = passwordProvided ? undefined : existing?.credentialProfileId;
  const authType: ServerAuthType = passwordProvided ? "password" : existing?.authType ?? "none";
  let connectionTarget: ReturnType<typeof parseConnectionTarget>;
  try {
    if (protocol === "serial") {
      const path = serverHostInput.value.trim();
      if (!path) throw new Error("Enter a COM or serial port.");
      connectionTarget = { host: path };
    } else if (protocol === "local") {
      const shell = serverHostInput.value.trim().toLowerCase() as LocalShell;
      if (shell !== "powershell" && shell !== "cmd" && shell !== "wsl") throw new Error("Select a local shell.");
      connectionTarget = { host: shell };
    } else {
      connectionTarget = parseConnectionTarget(serverHostInput.value);
      serverHostInput.value = connectionTarget.host;
      if (connectionTarget.port !== undefined) serverPortInput.value = String(connectionTarget.port);
      if (connectionTarget.username !== undefined) serverUsernameInput.value = connectionTarget.username;
    }
  } catch (error) {
    serverFormError.textContent = errorMessage(error);
    return;
  }
  const profile: ServerProfileInput = {
    id: editingProfileId ?? undefined,
    category: connectionCategory,
    protocol,
    name: serverNameInput.value.trim() || connectionTarget.host,
    host: connectionTarget.host,
    port: protocol === "serial" || protocol === "local"
      ? 0
      : connectionTarget.port ?? (serverPortInput.value ? Number(serverPortInput.value) : DEFAULT_PROTOCOL_PORTS[protocol]),
    username: connectionTarget.username ?? serverUsernameInput.value.trim(),
    group: existing?.group ?? "Ungrouped",
    authType,
    credentialProfileId,
    password: authType === "password" ? serverPasswordInput.value : undefined,
    privateKeyPath: authType === "privateKey" ? existing?.privateKeyPath : undefined,
    baudRate: protocol === "serial" ? existing?.baudRate ?? 9_600 : undefined,
    dataBits: protocol === "serial" ? existing?.dataBits ?? 8 : undefined,
    stopBits: protocol === "serial" ? existing?.stopBits ?? 1 : undefined,
    parity: protocol === "serial" ? existing?.parity ?? "none" : undefined,
    localShell: protocol === "local" ? connectionTarget.host as LocalShell : undefined,
    portForward: protocol === "ssh" ? existing?.portForward : undefined,
    tags: existing?.tags ?? [],
    favorite: existing?.favorite ?? false,
    inheritFolderDefaults: existing?.inheritFolderDefaults ?? true,
    domain: serverDomainInput.value.trim() || undefined,
    readyTimeoutSeconds: existing?.readyTimeoutSeconds,
    keepaliveSeconds: undefined,
    keepAliveEnabled: true,
    persistUntilAppCloses: existing?.persistUntilAppCloses ?? false,
    autoReconnect: existing?.autoReconnect ?? false,
    enableLegacySshAlgorithms: protocol === "ssh" && (existing?.enableLegacySshAlgorithms ?? connectionCategory === "network"),
    jumpHost: protocol === "ssh" ? existing?.jumpHost : undefined,
    proxyOverride: existing?.proxyOverride,
    icon: existing?.icon,
    applicationBadge: existing?.applicationBadge,
    indicatorColor: existing?.indicatorColor,
    terminalOverrides: undefined,
    preConnectTaskIds: existing?.preConnectTaskIds ?? [],
    postConnectTaskIds: existing?.postConnectTaskIds ?? [],
    totpSecret: undefined,
    totpDigits: 6,
    totpPeriod: 30,
    totpAlgorithm: serverTotpAlgorithmInput.value as ServerProfileInput["totpAlgorithm"],
  };

  try {
    await window.cybergrid.vault.saveProfile(profile);
    editingProfileId = null;
    editingProfileSnapshot = null;
    serverPasswordInput.value = "";
    serverPassphraseInput.value = "";
    serverTotpSecretInput.value = "";
    serverModal.close();
    await refreshProfiles();
  } catch (error) {
    serverFormError.textContent = errorMessage(error);
  }
});

for (const button of settingsModal.querySelectorAll<HTMLButtonElement>("[data-settings-tab]")) {
  button.addEventListener("click", () => selectSettingsPanel(button.dataset.settingsTab ?? "general"));
}
themeInput.addEventListener("change", () => {
  customPaletteFields.hidden = themeInput.value !== "custom";
});
browseBackupDirectoryButton.addEventListener("click", async () => {
  const selected = await window.cybergrid.system.selectBackupDirectory(backupDirectoryInput.value.trim());
  if (selected) backupDirectoryInput.value = selected;
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
    confirmExitWithActiveSessions: confirmExitActiveSessionsInput.checked,
    compactTreeView: compactTreeViewInput.checked,
    masterPasswordEnabled: masterPasswordEnabledInput.checked,
    autoLockMinutes: masterPasswordEnabledInput.checked ? Number(autoLockInput.value) : 0,
    clipboardClearSeconds: Number(clipboardClearInput.value),
    theme: themeInput.value as AppPreferences["theme"],
    fontFamily: fontFamilyInput.value.trim() || DEFAULT_SETTINGS.fontFamily,
    fontSize: Math.min(28, Math.max(10, Math.round(Number(fontSizeInput.value)))),
    terminalLineHeight: Math.min(2, Math.max(1, Number(terminalLineHeightInput.value))),
    cursorBlink: cursorBlinkInput.checked,
    background: backgroundInput.value,
    foreground: foregroundInput.value,
    cursor: cursorInput.value,
    accent: accentInput.value,
    sshKeepAliveSeconds: Math.min(300, Math.max(0, Math.round(Number(sshKeepAliveSecondsInput.value)))),
    sshMaxPasswordRetries: Math.min(100, Math.max(0, Math.round(Number(sshMaxPasswordRetriesInput.value)))),
    rdpSmartSizing: rdpSmartSizingInput.checked,
    rdpColorDepth: Number(rdpColorDepthInput.value) as AppPreferences["rdpColorDepth"],
    rdpSoundMode: rdpSoundModeInput.value as AppPreferences["rdpSoundMode"],
    proxyMode: proxyModeInput.value as AppPreferences["proxyMode"],
    proxyUrl: proxyUrlInput.value.trim(),
    proxyBypassRules: proxyBypassInput.value.trim(),
    healthCheckIntervalSeconds: Math.min(600, Math.max(10, Math.round(Number(healthCheckIntervalInput.value)))),
    backupDirectory: backupDirectoryInput.value.trim() || currentSettings.backupDirectory,
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

helpCloseButton.addEventListener("click", () => helpModal.close());
for (const button of helpTopicButtons) {
  button.addEventListener("click", () => selectHelpTopic(button.dataset.helpTopic ?? "quick-start"));
}
openShortcutsButton.addEventListener("click", openShortcuts);
shortcutsCloseButton.addEventListener("click", () => shortcutsModal.close());
helpModal.addEventListener("click", (event) => { if (event.target === helpModal) helpModal.close(); });
shortcutsModal.addEventListener("click", (event) => { if (event.target === shortcutsModal) shortcutsModal.close(); });
for (const dialog of [helpModal, shortcutsModal]) {
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    dialog.close();
  });
}

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
  const target = event.target as HTMLElement | null;
  const editable = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement || Boolean(target?.isContentEditable);
  const sidebarFocused = profileTree.contains(document.activeElement);
  if (!editable && sidebarFocused && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c") {
    const profileIds = [...selectedTreeKeys]
      .filter((key) => key.startsWith("profile:"))
      .map((key) => key.slice("profile:".length));
    if (profileIds.length === 1) {
      event.preventDefault();
      copiedProfileId = profileIds[0] ?? null;
      const profile = savedProfiles.find((candidate) => candidate.id === copiedProfileId);
      connectionState.textContent = profile ? `Copied ${profile.name}. Press Ctrl+V to duplicate it.` : "Connection copied.";
    }
    return;
  }
  if (!editable && sidebarFocused && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v") {
    if (copiedProfileId) {
      event.preventDefault();
      void duplicateConnection(copiedProfileId, pasteDestinationGroup());
    }
    return;
  }
  if (event.key === "Escape") {
    closeServerContextMenu();
  } else if (event.key === "Delete" && selectedTreeKeys.size > 0 && profileTree.contains(document.activeElement)) {
    event.preventDefault();
    void deleteSelectedTreeItems();
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
window.cybergrid.ssh.onModelDetected(handleSwitchModel);
window.cybergrid.sftp.onProgress(handleSftpProgress);
window.cybergrid.rdp.onStatus(handleRdpStatus);
window.cybergrid.stream.onData(handleStreamData);
window.cybergrid.stream.onStatus(handleStreamStatus);
window.cybergrid.serial.onData(handleSerialData);
window.cybergrid.serial.onStatus(handleSerialStatus);
window.cybergrid.local.onData(handleLocalData);
window.cybergrid.local.onStatus(handleLocalStatus);
window.cybergrid.vnc.onStatus(handleVncStatus);
window.cybergrid.web.onStatus(handleWebStatus);
window.cybergrid.health.onStatus(handleHealthStatus);
window.cybergrid.discovery.onProgress(handleDiscoveryProgress);
window.cybergrid.discovery.onResult(handleDiscoveryResult);
window.cybergrid.discovery.onComplete(handleDiscoveryComplete);
window.cybergrid.system.onUpdateAvailable((event) => showUpdateToast("available", event));
window.cybergrid.system.onUpdateDownloaded((event) => showUpdateToast("downloaded", event));
window.cybergrid.system.onUpdateStatus(showUpdateStatusToast);
window.cybergrid.system.onMenuCommand((command) => {
  void handleAppMenuCommand(command).catch((error: unknown) => {
    connectionState.textContent = errorMessage(error);
  });
});
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
  if (tab) {
    updateWebBounds(tab);
    updateRdpBounds(tab);
  }
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
  welcomeTab.terminal?.writeln("SSH, SFTP, RDP, VNC, Telnet, RAW TCP, serial, local shells, and web management in one workspace.\r\n");
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
