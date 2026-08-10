export const IPC_CHANNELS = {
  appReady: "cybergrid:app:ready",
  sshConnect: "cybergrid:ssh:connect",
  sshConnectProfile: "cybergrid:ssh:connect-profile",
  sshDisconnect: "cybergrid:ssh:disconnect",
  sshWrite: "cybergrid:ssh:write",
  sshResize: "cybergrid:ssh:resize",
  sshData: "cybergrid:ssh:data",
  sshStatus: "cybergrid:ssh:status",
  sftpList: "cybergrid:sftp:list",
  sftpUpload: "cybergrid:sftp:upload",
  sftpDownload: "cybergrid:sftp:download",
  sftpProgress: "cybergrid:sftp:progress",
  rdpIsSupported: "cybergrid:rdp:is-supported",
  rdpConnect: "cybergrid:rdp:connect",
  rdpDisconnect: "cybergrid:rdp:disconnect",
  rdpStatus: "cybergrid:rdp:status",
  vaultStatus: "cybergrid:vault:status",
  vaultCreate: "cybergrid:vault:create",
  vaultUnlock: "cybergrid:vault:unlock",
  vaultLock: "cybergrid:vault:lock",
  vaultListProfiles: "cybergrid:vault:list-profiles",
  vaultSaveProfile: "cybergrid:vault:save-profile",
  vaultDeleteProfile: "cybergrid:vault:delete-profile",
  vaultUpdateProfileNotes: "cybergrid:vault:update-profile-notes",
  vaultAddConfigBackup: "cybergrid:vault:add-config-backup",
  vaultDeleteConfigBackup: "cybergrid:vault:delete-config-backup",
  vaultListAssets: "cybergrid:vault:list-assets",
  vaultSaveAsset: "cybergrid:vault:save-asset",
  vaultDeleteAsset: "cybergrid:vault:delete-asset",
  vaultListSnippets: "cybergrid:vault:list-snippets",
  vaultSaveSnippet: "cybergrid:vault:save-snippet",
  vaultDeleteSnippet: "cybergrid:vault:delete-snippet",
  vaultListCredentialProfiles: "cybergrid:vault:list-credential-profiles",
  vaultSaveCredentialProfile: "cybergrid:vault:save-credential-profile",
  vaultDeleteCredentialProfile: "cybergrid:vault:delete-credential-profile",
  vaultSetFavorite: "cybergrid:vault:set-favorite",
  vaultListFolderDefaults: "cybergrid:vault:list-folder-defaults",
  vaultSaveFolderDefaults: "cybergrid:vault:save-folder-defaults",
  vaultDeleteFolderDefaults: "cybergrid:vault:delete-folder-defaults",
  vaultListExternalTools: "cybergrid:vault:list-external-tools",
  vaultSaveExternalTool: "cybergrid:vault:save-external-tool",
  vaultDeleteExternalTool: "cybergrid:vault:delete-external-tool",
  vaultListConnectionTasks: "cybergrid:vault:list-connection-tasks",
  vaultSaveConnectionTask: "cybergrid:vault:save-connection-task",
  vaultDeleteConnectionTask: "cybergrid:vault:delete-connection-task",
  vaultListSyncSources: "cybergrid:vault:list-sync-sources",
  vaultSaveSyncSource: "cybergrid:vault:save-sync-source",
  vaultDeleteSyncSource: "cybergrid:vault:delete-sync-source",
  vaultGenerateTotp: "cybergrid:vault:generate-totp",
  externalToolRun: "cybergrid:external-tool:run",
  inventorySyncRun: "cybergrid:inventory-sync:run",
  sessionCaptureScreenshot: "cybergrid:session:capture-screenshot",
  preferencesGet: "cybergrid:preferences:get",
  preferencesUpdate: "cybergrid:preferences:update",
  preferencesActivity: "cybergrid:preferences:activity",
  diagnosticsRun: "cybergrid:diagnostics:run",
  vaultLocked: "cybergrid:app:vault-locked",
  trayQuickConnect: "cybergrid:app:tray-quick-connect",
  discoveryStart: "cybergrid:discovery:start",
  discoveryCancel: "cybergrid:discovery:cancel",
  discoveryProgress: "cybergrid:discovery:progress",
  discoveryResult: "cybergrid:discovery:result",
  discoveryComplete: "cybergrid:discovery:complete",
  profileConnect: "cybergrid:profile:connect",
  profileRunPostConnect: "cybergrid:profile:run-post-connect",
  streamConnect: "cybergrid:stream:connect",
  streamDisconnect: "cybergrid:stream:disconnect",
  streamWrite: "cybergrid:stream:write",
  streamData: "cybergrid:stream:data",
  streamStatus: "cybergrid:stream:status",
  serialList: "cybergrid:serial:list",
  serialConnect: "cybergrid:serial:connect",
  serialDisconnect: "cybergrid:serial:disconnect",
  serialWrite: "cybergrid:serial:write",
  serialData: "cybergrid:serial:data",
  serialStatus: "cybergrid:serial:status",
  vncConnect: "cybergrid:vnc:connect",
  vncDisconnect: "cybergrid:vnc:disconnect",
  vncStatus: "cybergrid:vnc:status",
  webConnect: "cybergrid:web:connect",
  webDisconnect: "cybergrid:web:disconnect",
  webSetBounds: "cybergrid:web:set-bounds",
  webSetVisible: "cybergrid:web:set-visible",
  webStatus: "cybergrid:web:status",
  healthSetTargets: "cybergrid:health:set-targets",
  healthRefresh: "cybergrid:health:refresh",
  healthStatus: "cybergrid:health:status",
  migrationImport: "cybergrid:migration:import",
  migrationExport: "cybergrid:migration:export",
  selectPrivateKey: "cybergrid:dialog:select-private-key",
  workspaceLoad: "cybergrid:workspace:load",
  workspaceSave: "cybergrid:workspace:save",
  disasterRecoveryExport: "cybergrid:disaster-recovery:export",
  quickLauncherLaunchProfile: "cybergrid:quick-launcher:launch-profile",
  quickLauncherShowMain: "cybergrid:quick-launcher:show-main",
  quickLauncherHide: "cybergrid:quick-launcher:hide",
  appUpdateAvailable: "cybergrid:update:available",
  appUpdateDownloaded: "cybergrid:update:downloaded",
  appUpdateInstall: "cybergrid:update:install",
  appMenuCommand: "cybergrid:app:menu-command",
} as const;

export interface SshConnectionConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
  readyTimeout?: number;
  keepaliveInterval?: number;
  totpCode?: string;
}

export interface SshDataEvent {
  sessionId: string;
  data: string;
}

export type SshConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export interface SshStatusEvent {
  sessionId: string;
  status: SshConnectionStatus;
  message?: string;
}

export interface SshWriteRequest {
  sessionId: string;
  data: string;
}

export interface SshResizeRequest {
  sessionId: string;
  cols: number;
  rows: number;
}

export type SftpEntryType = "directory" | "file" | "symlink" | "other";

export interface SftpEntry {
  name: string;
  path: string;
  type: SftpEntryType;
  size: number;
  modifiedAt: number;
  permissions: number;
}

export interface SftpDirectoryListing {
  path: string;
  entries: SftpEntry[];
}

export interface SftpProgressEvent {
  sessionId: string;
  direction: "upload" | "download";
  fileName: string;
  transferred: number;
  total: number;
}

export interface RdpConnectionConfig {
  host: string;
  port: number;
  username: string;
}

export type RdpConnectionStatus = "launching" | "running" | "closed" | "error";

export interface RdpStatusEvent {
  sessionId: string;
  status: RdpConnectionStatus;
  message?: string;
}

export type ConnectionProtocol =
  | "ssh"
  | "rdp"
  | "telnet"
  | "raw"
  | "vnc"
  | "http"
  | "https"
  | "serial";

export type ServerAuthType = "none" | "password" | "privateKey";
export type CredentialProfileAuthType = Exclude<ServerAuthType, "none">;

export type AppMenuCommand =
  | "new-connection"
  | "focus-quick-connect"
  | "lock-vault"
  | "import-export"
  | "command-palette"
  | "clear-terminal"
  | "toggle-sidebar"
  | "toggle-grid"
  | "toggle-broadcast"
  | "broadcast-targets"
  | "toggle-sftp"
  | "node-workspace"
  | "external-tools"
  | "enterprise"
  | "credential-profiles"
  | "subnet-scanner"
  | "toggle-quick-snippets"
  | "settings"
  | "close-tab"
  | "reopen-tab"
  | "next-tab"
  | "help"
  | "shortcuts";
export type SerialParity = "none" | "even" | "odd" | "mark" | "space";

export type ConnectionCategory = "server" | "network" | "web" | "desktop";

export interface TerminalAppearanceOverrides {
  theme?: TerminalThemeName;
  fontFamily?: string;
  fontSize?: number;
  lineHeight?: number;
  background?: string;
  foreground?: string;
  cursor?: string;
}

export interface ConfigBackupInput {
  name: string;
  content: string;
}

export interface ConfigBackupRecord extends ConfigBackupInput {
  id: string;
  createdAt: string;
}

export interface ServerProfileInput {
  id?: string;
  category?: ConnectionCategory;
  protocol: ConnectionProtocol;
  name: string;
  host: string;
  port: number;
  username: string;
  group: string;
  authType: ServerAuthType;
  credentialProfileId?: string;
  password?: string;
  privateKeyPath?: string;
  passphrase?: string;
  baudRate?: number;
  dataBits?: 5 | 6 | 7 | 8;
  stopBits?: 1 | 2;
  parity?: SerialParity;
  tags?: string[];
  favorite?: boolean;
  inheritFolderDefaults?: boolean;
  domain?: string;
  readyTimeoutSeconds?: number;
  keepaliveSeconds?: number;
  keepAliveEnabled?: boolean;
  persistUntilAppCloses?: boolean;
  autoReconnect?: boolean;
  jumpHost?: string;
  proxyOverride?: string;
  icon?: DeviceIcon;
  applicationBadge?: string;
  indicatorColor?: string;
  terminalOverrides?: TerminalAppearanceOverrides;
  notes?: string;
  configBackups?: ConfigBackupRecord[];
  preConnectTaskIds?: string[];
  postConnectTaskIds?: string[];
  totpSecret?: string;
  totpDigits?: 6 | 8;
  totpPeriod?: 30 | 60;
  totpAlgorithm?: "sha1" | "sha256" | "sha512";
  managedBySyncId?: string;
  managedObjectId?: string;
}

export interface ServerProfileSummary {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  group: string;
  authType: ServerAuthType;
  credentialProfileId?: string;
  hasPassword: boolean;
  privateKeyPath?: string;
  hasPassphrase: boolean;
  protocol: ConnectionProtocol;
  baudRate?: number;
  dataBits?: 5 | 6 | 7 | 8;
  stopBits?: 1 | 2;
  parity?: SerialParity;
  tags: string[];
  favorite: boolean;
  inheritFolderDefaults: boolean;
  domain?: string;
  readyTimeoutSeconds?: number;
  keepaliveSeconds?: number;
  keepAliveEnabled: boolean;
  persistUntilAppCloses: boolean;
  autoReconnect: boolean;
  category: ConnectionCategory;
  jumpHost?: string;
  proxyOverride?: string;
  icon: DeviceIcon;
  applicationBadge?: string;
  indicatorColor?: string;
  terminalOverrides?: TerminalAppearanceOverrides;
  notes: string;
  configBackups: ConfigBackupRecord[];
  preConnectTaskIds: string[];
  postConnectTaskIds: string[];
  hasTotp: boolean;
  managedBySyncId?: string;
}

export interface StreamConnectionConfig {
  protocol: "telnet" | "raw";
  host: string;
  port: number;
}

export interface StreamDataEvent {
  sessionId: string;
  data: string;
}

export interface StreamStatusEvent {
  sessionId: string;
  status: "connecting" | "connected" | "disconnected" | "error";
  message?: string;
}

export interface SerialConnectionConfig {
  path: string;
  baudRate: number;
  dataBits: 5 | 6 | 7 | 8;
  stopBits: 1 | 2;
  parity: SerialParity;
}

export interface SerialPortInfo {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  vendorId?: string;
  productId?: string;
}

export interface SerialDataEvent {
  sessionId: string;
  data: string;
}

export interface SerialStatusEvent {
  sessionId: string;
  status: "opening" | "connected" | "disconnected" | "error";
  message?: string;
}

export interface VncConnectionConfig {
  host: string;
  port: number;
  password?: string;
}

export interface VncConnectionResult {
  sessionId: string;
  proxyUrl: string;
  password?: string;
}

export interface VncStatusEvent {
  sessionId: string;
  status: "connecting" | "connected" | "disconnected" | "error";
  message?: string;
}

export interface WebConnectionConfig {
  url: string;
}

export interface WebBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WebStatusEvent {
  sessionId: string;
  status: "loading" | "ready" | "error" | "closed";
  message?: string;
}

export interface HealthTarget {
  profileId: string;
  host: string;
  protocol: ConnectionProtocol;
}

export interface HealthStatusEvent {
  profileId: string;
  status: "checking" | "online" | "offline" | "unsupported";
  latencyMs?: number;
  checkedAt: string;
}

export type MigrationFormat = "auto" | "mremoteng" | "putty" | "csv" | "cgvault";

export interface MigrationRequest {
  format: MigrationFormat;
  teamPassphrase?: string;
}

export interface MigrationResult {
  imported: number;
  warnings: string[];
  path: string;
}

export interface MigrationExportResult {
  exported: number;
  path: string | null;
}

export interface SessionVariableContext {
  displayName: string;
  host: string;
  ip: string;
  username: string;
  group: string;
  port: number;
  profileId?: string;
}

export interface FolderDefaultsInput {
  path: string;
  username?: string;
  domain?: string;
  authType: ServerAuthType;
  password?: string;
  privateKeyPath?: string;
  passphrase?: string;
  port?: number;
  readyTimeoutSeconds?: number;
  keepaliveSeconds?: number;
  keepAliveEnabled?: boolean;
  persistUntilAppCloses?: boolean;
  autoReconnect?: boolean;
  icon?: DeviceIcon;
  applicationBadge?: string;
  indicatorColor?: string;
  terminalOverrides?: TerminalAppearanceOverrides;
}

export interface FolderDefaultsSummary {
  path: string;
  username?: string;
  domain?: string;
  authType: ServerAuthType;
  hasPassword: boolean;
  privateKeyPath?: string;
  hasPassphrase: boolean;
  port?: number;
  readyTimeoutSeconds?: number;
  keepaliveSeconds?: number;
  keepAliveEnabled?: boolean;
  persistUntilAppCloses?: boolean;
  autoReconnect?: boolean;
  icon?: DeviceIcon;
  applicationBadge?: string;
  indicatorColor?: string;
  terminalOverrides?: TerminalAppearanceOverrides;
  updatedAt: string;
}

export interface ExternalToolInput {
  id?: string;
  name: string;
  executablePath: string;
  arguments: string[];
}

export interface ExternalToolRecord extends Omit<ExternalToolInput, "id"> {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectionTaskInput {
  id?: string;
  name: string;
  kind: "script" | "vpn";
  executablePath: string;
  arguments: string[];
  waitForExit: boolean;
  timeoutSeconds: number;
}

export interface ConnectionTaskRecord extends Omit<ConnectionTaskInput, "id"> {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export type InventorySyncProvider = "ldap" | "vmware" | "hyperv";

export interface InventorySyncSourceInput {
  id?: string;
  name: string;
  provider: InventorySyncProvider;
  endpoint: string;
  baseDn?: string;
  username?: string;
  password?: string;
  filter?: string;
  group: string;
  defaultProtocol: "ssh" | "rdp" | "https";
}

export interface InventorySyncSourceSummary extends Omit<InventorySyncSourceInput, "password"> {
  id: string;
  hasPassword: boolean;
  createdAt: string;
  updatedAt: string;
  lastSyncedAt?: string;
}

export interface InventorySyncResult {
  sourceId: string;
  imported: number;
  updated: number;
  removed: number;
  warnings: string[];
  completedAt: string;
}

export interface ExternalToolRunResult {
  launched: boolean;
  toolName: string;
  commandPreview: string;
}

export interface TotpCodeResult {
  code: string;
  expiresAt: string;
  remainingSeconds: number;
}

export interface ScreenshotRequest {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

export interface ScreenshotResult {
  path: string | null;
}

export interface SessionPolicy {
  keepAliveEnabled: boolean;
  persistUntilAppCloses: boolean;
  autoReconnect: boolean;
  terminalAppearance?: TerminalAppearanceOverrides;
}

export type ProfileConnectionResult = { context: SessionVariableContext; policy: SessionPolicy } & (
  | { protocol: "ssh"; sessionId: string }
  | { protocol: "rdp"; sessionId: string }
  | { protocol: "telnet" | "raw"; sessionId: string }
  | { protocol: "serial"; sessionId: string }
  | ({ protocol: "vnc" } & VncConnectionResult)
  | { protocol: "http" | "https"; sessionId: string }
);

export interface VaultStatus {
  exists: boolean;
  unlocked: boolean;
}

export type AdministrationProtocol = "ssh" | "rdp" | "http" | "https" | "telnet" | "vnc";

export interface OpenPortInfo {
  port: number;
  protocol: AdministrationProtocol;
  banner?: string;
}

export type DeviceOsFamily = "Windows" | "Linux" | "Network appliance" | "Printer" | "Unknown";

export type DeviceIcon =
  | "windows"
  | "linux"
  | "ubuntu"
  | "redhat"
  | "macos"
  | "bare-metal"
  | "cisco"
  | "fortinet"
  | "vmware"
  | "hyperv"
  | "router"
  | "database"
  | "web-server"
  | "printer"
  | "network"
  | "server"
  | "unknown";

export interface DiscoveredDevice {
  ipAddress: string;
  hostname?: string;
  macAddress?: string;
  vendor?: string;
  osFamily: DeviceOsFamily;
  osVersion?: string;
  openPorts: OpenPortInfo[];
  suggestedIcon: DeviceIcon;
  confidence: number;
  lastSeenAt: string;
}

export interface DiscoveryProgressEvent {
  scanId: string;
  scanned: number;
  total: number;
  currentIp: string;
  hostStatus: "online" | "offline";
}

export interface DiscoveryResultEvent {
  scanId: string;
  device: DiscoveredDevice;
}

export interface DiscoveryCompleteEvent {
  scanId: string;
  scanned: number;
  total: number;
  discovered: number;
  canceled: boolean;
  error?: string;
}

export interface AssetMetadata {
  serialNumber: string;
  assetTag: string;
  rackPosition: string;
  site: string;
  osVersion: string;
  maintenanceSla: string;
}

export interface AssetInput {
  id?: string;
  name: string;
  ipAddress: string;
  hostname?: string;
  macAddress?: string;
  vendor?: string;
  osFamily: DeviceOsFamily;
  openPorts: OpenPortInfo[];
  suggestedIcon: DeviceIcon;
  iconOverride?: DeviceIcon;
  metadata: AssetMetadata;
  lastSeenAt: string;
}

export interface AssetRecord extends Omit<AssetInput, "id"> {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export type SnippetLanguage = "powershell" | "bash" | "cisco";

export interface SnippetInput {
  id?: string;
  name: string;
  language: SnippetLanguage;
  tags: string[];
  body: string;
  pinned?: boolean;
}

export interface SnippetRecord extends Omit<SnippetInput, "id" | "pinned"> {
  id: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CredentialProfileInput {
  id?: string;
  name: string;
  username: string;
  domain?: string;
  authType: CredentialProfileAuthType;
  password?: string;
  privateKeyPath?: string;
  passphrase?: string;
}

export interface CredentialProfileSummary {
  id: string;
  name: string;
  username: string;
  domain?: string;
  authType: CredentialProfileAuthType;
  hasPassword: boolean;
  privateKeyPath?: string;
  hasPassphrase: boolean;
  createdAt: string;
  updatedAt: string;
}

export type TerminalThemeName = "dark" | "monochrome" | "custom";
export type ProxyMode = "system" | "direct" | "manual";

export interface AppPreferences {
  minimizeToTray: boolean;
  startMinimized: boolean;
  launchAtLogin: boolean;
  masterPasswordEnabled: boolean;
  autoLockMinutes: number;
  clipboardClearSeconds: number;
  theme: TerminalThemeName;
  fontFamily: string;
  fontSize: number;
  cursorBlink: boolean;
  background: string;
  foreground: string;
  cursor: string;
  accent: string;
  proxyMode: ProxyMode;
  proxyUrl: string;
  proxyBypassRules: string;
  healthCheckIntervalSeconds: number;
  externalToolPaths: {
    wireshark: string;
    winscp: string;
    nmap: string;
    powershell: string;
  };
}

export interface WorkspaceSnapshot {
  profileIds: string[];
  activeProfileId?: string;
  activeIndex?: number;
  layout: "single" | "grid";
  updatedAt: string;
}

export interface DisasterRecoveryExportResult {
  path: string | null;
  profileCount: number;
  assetCount: number;
}

export interface AppUpdateEvent {
  version: string;
}

export type DiagnosticKind = "ping" | "traceroute" | "dns" | "port";

export interface DiagnosticResult {
  profileId: string;
  kind: DiagnosticKind;
  success: boolean;
  summary: string;
  output: string;
  durationMs: number;
  checkedAt: string;
}

export type Unsubscribe = () => void;

export interface CyberGridApi {
  profiles: {
    connect(profileId: string): Promise<ProfileConnectionResult>;
    runPostConnect(profileId: string): Promise<void>;
  };
  ssh: {
    connect(config: SshConnectionConfig): Promise<string>;
    connectProfile(profileId: string): Promise<string>;
    disconnect(sessionId: string): Promise<void>;
    write(sessionId: string, data: string): void;
    resize(sessionId: string, cols: number, rows: number): void;
    onData(listener: (event: SshDataEvent) => void): Unsubscribe;
    onStatus(listener: (event: SshStatusEvent) => void): Unsubscribe;
  };
  sftp: {
    listDirectory(sessionId: string, remotePath: string): Promise<SftpDirectoryListing>;
    uploadFiles(sessionId: string, remoteDirectory: string): Promise<string[]>;
    downloadFile(sessionId: string, remotePath: string): Promise<string | null>;
    onProgress(listener: (event: SftpProgressEvent) => void): Unsubscribe;
  };
  rdp: {
    isSupported(): Promise<boolean>;
    connect(config: RdpConnectionConfig): Promise<string>;
    disconnect(sessionId: string): Promise<void>;
    onStatus(listener: (event: RdpStatusEvent) => void): Unsubscribe;
  };
  stream: {
    connect(config: StreamConnectionConfig): Promise<string>;
    disconnect(sessionId: string): Promise<void>;
    write(sessionId: string, data: string): void;
    onData(listener: (event: StreamDataEvent) => void): Unsubscribe;
    onStatus(listener: (event: StreamStatusEvent) => void): Unsubscribe;
  };
  serial: {
    list(): Promise<SerialPortInfo[]>;
    connect(config: SerialConnectionConfig): Promise<string>;
    disconnect(sessionId: string): Promise<void>;
    write(sessionId: string, data: string): void;
    onData(listener: (event: SerialDataEvent) => void): Unsubscribe;
    onStatus(listener: (event: SerialStatusEvent) => void): Unsubscribe;
  };
  vnc: {
    connect(config: VncConnectionConfig): Promise<VncConnectionResult>;
    disconnect(sessionId: string): Promise<void>;
    onStatus(listener: (event: VncStatusEvent) => void): Unsubscribe;
  };
  web: {
    connect(config: WebConnectionConfig): Promise<string>;
    disconnect(sessionId: string): Promise<void>;
    setBounds(sessionId: string, bounds: WebBounds): void;
    setVisible(sessionId: string, visible: boolean): void;
    onStatus(listener: (event: WebStatusEvent) => void): Unsubscribe;
  };
  vault: {
    status(): Promise<VaultStatus>;
    create(masterPassword: string): Promise<void>;
    unlock(masterPassword: string): Promise<void>;
    lock(): Promise<void>;
    listProfiles(): Promise<ServerProfileSummary[]>;
    saveProfile(profile: ServerProfileInput): Promise<ServerProfileSummary>;
    deleteProfile(profileId: string): Promise<void>;
    updateProfileNotes(profileId: string, notes: string): Promise<ServerProfileSummary>;
    addConfigBackup(profileId: string, input: ConfigBackupInput): Promise<ServerProfileSummary>;
    deleteConfigBackup(profileId: string, backupId: string): Promise<ServerProfileSummary>;
    listAssets(): Promise<AssetRecord[]>;
    saveAsset(asset: AssetInput): Promise<AssetRecord>;
    deleteAsset(assetId: string): Promise<void>;
    listSnippets(): Promise<SnippetRecord[]>;
    saveSnippet(snippet: SnippetInput): Promise<SnippetRecord>;
    deleteSnippet(snippetId: string): Promise<void>;
    listCredentialProfiles(): Promise<CredentialProfileSummary[]>;
    saveCredentialProfile(input: CredentialProfileInput): Promise<CredentialProfileSummary>;
    deleteCredentialProfile(credentialProfileId: string): Promise<void>;
    setFavorite(profileId: string, favorite: boolean): Promise<ServerProfileSummary>;
    listFolderDefaults(): Promise<FolderDefaultsSummary[]>;
    saveFolderDefaults(input: FolderDefaultsInput): Promise<FolderDefaultsSummary>;
    deleteFolderDefaults(path: string): Promise<void>;
    listExternalTools(): Promise<ExternalToolRecord[]>;
    saveExternalTool(input: ExternalToolInput): Promise<ExternalToolRecord>;
    deleteExternalTool(toolId: string): Promise<void>;
    listConnectionTasks(): Promise<ConnectionTaskRecord[]>;
    saveConnectionTask(input: ConnectionTaskInput): Promise<ConnectionTaskRecord>;
    deleteConnectionTask(taskId: string): Promise<void>;
    listSyncSources(): Promise<InventorySyncSourceSummary[]>;
    saveSyncSource(input: InventorySyncSourceInput): Promise<InventorySyncSourceSummary>;
    deleteSyncSource(sourceId: string): Promise<void>;
    generateTotp(profileId: string): Promise<TotpCodeResult>;
  };
  externalTools: {
    run(toolId: string, profileId: string): Promise<ExternalToolRunResult>;
  };
  inventorySync: {
    run(sourceId: string): Promise<InventorySyncResult>;
  };
  preferences: {
    get(): Promise<AppPreferences>;
    update(preferences: AppPreferences, newMasterPassword?: string): Promise<AppPreferences>;
    activity(): void;
  };
  diagnostics: {
    run(profileId: string, kind: DiagnosticKind): Promise<DiagnosticResult>;
  };
  discovery: {
    start(target: string): Promise<string>;
    cancel(scanId: string): Promise<void>;
    onProgress(listener: (event: DiscoveryProgressEvent) => void): Unsubscribe;
    onResult(listener: (event: DiscoveryResultEvent) => void): Unsubscribe;
    onComplete(listener: (event: DiscoveryCompleteEvent) => void): Unsubscribe;
  };
  health: {
    setTargets(targets: HealthTarget[]): Promise<void>;
    refresh(): Promise<void>;
    onStatus(listener: (event: HealthStatusEvent) => void): Unsubscribe;
  };
  migration: {
    importConnections(request: MigrationRequest): Promise<MigrationResult | null>;
    exportConnections(request: MigrationRequest): Promise<MigrationExportResult>;
  };
  system: {
    whenReady(): Promise<void>;
    selectPrivateKey(): Promise<string | null>;
    onVaultLocked(listener: (reason: string) => void): Unsubscribe;
    onTrayQuickConnect(listener: (profileId: string) => void): Unsubscribe;
    captureScreenshot(request: ScreenshotRequest): Promise<ScreenshotResult>;
    loadWorkspace(): Promise<WorkspaceSnapshot>;
    saveWorkspace(snapshot: WorkspaceSnapshot): Promise<void>;
    exportDisasterRecovery(passphrase: string): Promise<DisasterRecoveryExportResult>;
    launchProfileFromQuickLauncher(profileId: string): Promise<void>;
    showMainWindow(): Promise<void>;
    hideQuickLauncher(): void;
    installUpdate(): Promise<void>;
    onUpdateAvailable(listener: (event: AppUpdateEvent) => void): Unsubscribe;
    onUpdateDownloaded(listener: (event: AppUpdateEvent) => void): Unsubscribe;
    onMenuCommand(listener: (command: AppMenuCommand) => void): Unsubscribe;
  };
}
