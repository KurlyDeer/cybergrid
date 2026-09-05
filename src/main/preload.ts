import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type {
  AssetInput,
  AppMenuCommand,
  AppPreferences,
  AppUpdateEvent,
  AppUpdateStatusEvent,
  ConfigBackupInput,
  CredentialProfileInput,
  CyberGridApi,
  DiscoveryCompleteEvent,
  DiscoveryProgressEvent,
  DiscoveryResultEvent,
  ConnectionTaskInput,
  ExternalDiagnosticKind,
  ExternalToolInput,
  FolderDefaultsInput,
  HealthStatusEvent,
  HealthTarget,
  DiagnosticKind,
  MigrationRequest,
  InventorySyncSourceInput,
  LocalTerminalConfig,
  LocalTerminalDataEvent,
  LocalTerminalStatusEvent,
  ProfileConnectionCredentials,
  RdpBounds,
  RdpStatusEvent,
  SerialConnectionConfig,
  SerialDataEvent,
  SerialStatusEvent,
  ServerProfileInput,
  ScreenshotRequest,
  SnippetInput,
  SftpProgressEvent,
  SshDataEvent,
  SshResizeRequest,
  SshStatusEvent,
  SshWriteRequest,
  StreamConnectionConfig,
  StreamDataEvent,
  StreamStatusEvent,
  TrayStateSnapshot,
  VncConnectionConfig,
  VncStatusEvent,
  WebBounds,
  WebConnectionConfig,
  WebStatusEvent,
  WorkspaceSnapshot,
} from "../shared/ipc";

// Sandboxed Electron preloads cannot require arbitrary local modules at runtime.
// Keep channel names self-contained here while sharing their TypeScript contract.
const IPC_CHANNELS: typeof import("../shared/ipc").IPC_CHANNELS = {
  appReady: "cybergrid:app:ready",
  sshConnect: "cybergrid:ssh:connect",
  sshConnectProfile: "cybergrid:ssh:connect-profile",
  sshDisconnect: "cybergrid:ssh:disconnect",
  sshWrite: "cybergrid:ssh:write",
  sshResize: "cybergrid:ssh:resize",
  sshQuickBackup: "cybergrid:ssh:quick-backup",
  sshData: "cybergrid:ssh:data",
  sshStatus: "cybergrid:ssh:status",
  sshModelDetected: "cybergrid:ssh:model-detected",
  sshSetLogging: "cybergrid:ssh:set-logging",
  sshLogStatus: "cybergrid:ssh:log-status",
  openProjectLink: "cybergrid:system:open-project-link",
  sftpList: "cybergrid:sftp:list",
  sftpUpload: "cybergrid:sftp:upload",
  sftpDownload: "cybergrid:sftp:download",
  sftpProgress: "cybergrid:sftp:progress",
  rdpIsSupported: "cybergrid:rdp:is-supported",
  rdpConnect: "cybergrid:rdp:connect",
  rdpDisconnect: "cybergrid:rdp:disconnect",
  rdpKill: "kill-rdp",
  rdpSetBounds: "cybergrid:rdp:set-bounds",
  rdpSetVisible: "cybergrid:rdp:set-visible",
  rdpStatus: "cybergrid:rdp:status",
  vaultStatus: "cybergrid:vault:status",
  vaultCreate: "cybergrid:vault:create",
  vaultUnlock: "cybergrid:vault:unlock",
  vaultLock: "cybergrid:vault:lock",
  vaultListProfiles: "cybergrid:vault:list-profiles",
  vaultSaveProfile: "cybergrid:vault:save-profile",
  vaultDeleteProfile: "cybergrid:vault:delete-profile",
  vaultDeleteProfiles: "cybergrid:vault:delete-profiles",
  vaultDuplicateProfile: "cybergrid:vault:duplicate-profile",
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
  vaultMoveProfile: "cybergrid:vault:move-profile",
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
  selectBackupDirectory: "cybergrid:dialog:select-backup-directory",
  diagnosticsRun: "cybergrid:diagnostics:run",
  diagnosticsLaunch: "cybergrid:diagnostics:launch",
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
  localConnect: "cybergrid:local:connect",
  localDisconnect: "cybergrid:local:disconnect",
  localWrite: "cybergrid:local:write",
  localResize: "cybergrid:local:resize",
  localData: "cybergrid:local:data",
  localStatus: "cybergrid:local:status",
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
  appUpdateStatus: "cybergrid:update:status",
  appUpdateDownload: "cybergrid:update:download",
  appUpdateInstall: "cybergrid:update:install",
  trayStateUpdate: "cybergrid:tray:state-update",
  appMenuCommand: "cybergrid:app:menu-command",
  sessionDetach: "cybergrid:session:detach",
  sessionDetached: "cybergrid:session:detached",
};

const api: CyberGridApi = {
  profiles: {
    connect: (profileId, credentials?: ProfileConnectionCredentials) =>
      ipcRenderer.invoke(IPC_CHANNELS.profileConnect, profileId, credentials),
    runPostConnect: (profileId) => ipcRenderer.invoke(IPC_CHANNELS.profileRunPostConnect, profileId),
  },
  ssh: {
    connect: (config) => ipcRenderer.invoke(IPC_CHANNELS.sshConnect, config),
    connectProfile: (profileId) =>
      ipcRenderer.invoke(IPC_CHANNELS.sshConnectProfile, profileId),
    disconnect: (sessionId) => ipcRenderer.invoke(IPC_CHANNELS.sshDisconnect, sessionId),
    write: (sessionId, data) => {
      const request: SshWriteRequest = { sessionId, data };
      ipcRenderer.send(IPC_CHANNELS.sshWrite, request);
    },
    resize: (sessionId, cols, rows) => {
      const request: SshResizeRequest = { sessionId, cols, rows };
      ipcRenderer.send(IPC_CHANNELS.sshResize, request);
    },
    quickBackup: (sessionId, profileId) =>
      ipcRenderer.invoke(IPC_CHANNELS.sshQuickBackup, sessionId, profileId),
    setLogging: (sessionId, enabled) => ipcRenderer.invoke(IPC_CHANNELS.sshSetLogging, sessionId, enabled),
    onLogStatus: (listener) => {
      const handler = (_event: IpcRendererEvent, payload: import("../shared/ipc").SessionLogStatus) => listener(payload);
      ipcRenderer.on(IPC_CHANNELS.sshLogStatus, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.sshLogStatus, handler);
    },
    onData: (listener) => {
      const handler = (_event: IpcRendererEvent, payload: SshDataEvent) => listener(payload);
      ipcRenderer.on(IPC_CHANNELS.sshData, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.sshData, handler);
    },
    onStatus: (listener) => {
      const handler = (_event: IpcRendererEvent, payload: SshStatusEvent) => listener(payload);
      ipcRenderer.on(IPC_CHANNELS.sshStatus, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.sshStatus, handler);
    },
    onModelDetected: (listener) => {
      const handler = (_event: IpcRendererEvent, payload: import("../shared/ipc").SwitchModelEvent) => listener(payload);
      ipcRenderer.on(IPC_CHANNELS.sshModelDetected, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.sshModelDetected, handler);
    },
  },
  sftp: {
    listDirectory: (sessionId, remotePath) =>
      ipcRenderer.invoke(IPC_CHANNELS.sftpList, sessionId, remotePath),
    uploadFiles: (sessionId, remoteDirectory) =>
      ipcRenderer.invoke(IPC_CHANNELS.sftpUpload, sessionId, remoteDirectory),
    downloadFile: (sessionId, remotePath) =>
      ipcRenderer.invoke(IPC_CHANNELS.sftpDownload, sessionId, remotePath),
    onProgress: (listener) => {
      const handler = (_event: IpcRendererEvent, payload: SftpProgressEvent) =>
        listener(payload);
      ipcRenderer.on(IPC_CHANNELS.sftpProgress, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.sftpProgress, handler);
    },
  },
  rdp: {
    isSupported: () => ipcRenderer.invoke(IPC_CHANNELS.rdpIsSupported),
    connect: (config) => ipcRenderer.invoke(IPC_CHANNELS.rdpConnect, config),
    disconnect: (sessionId) => ipcRenderer.invoke(IPC_CHANNELS.rdpDisconnect, sessionId),
    kill: (sessionId) => ipcRenderer.send(IPC_CHANNELS.rdpKill, sessionId),
    setBounds: (sessionId: string, bounds: RdpBounds) =>
      ipcRenderer.send(IPC_CHANNELS.rdpSetBounds, sessionId, bounds),
    setVisible: (sessionId: string, visible: boolean) =>
      ipcRenderer.send(IPC_CHANNELS.rdpSetVisible, sessionId, visible),
    onStatus: (listener) => {
      const handler = (_event: IpcRendererEvent, payload: RdpStatusEvent) => listener(payload);
      ipcRenderer.on(IPC_CHANNELS.rdpStatus, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.rdpStatus, handler);
    },
  },
  stream: {
    connect: (config: StreamConnectionConfig) => ipcRenderer.invoke(IPC_CHANNELS.streamConnect, config),
    disconnect: (sessionId) => ipcRenderer.invoke(IPC_CHANNELS.streamDisconnect, sessionId),
    write: (sessionId, data) => ipcRenderer.send(IPC_CHANNELS.streamWrite, { sessionId, data }),
    onData: (listener) => {
      const handler = (_event: IpcRendererEvent, payload: StreamDataEvent) => listener(payload);
      ipcRenderer.on(IPC_CHANNELS.streamData, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.streamData, handler);
    },
    onStatus: (listener) => {
      const handler = (_event: IpcRendererEvent, payload: StreamStatusEvent) => listener(payload);
      ipcRenderer.on(IPC_CHANNELS.streamStatus, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.streamStatus, handler);
    },
  },
  serial: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.serialList),
    connect: (config: SerialConnectionConfig) => ipcRenderer.invoke(IPC_CHANNELS.serialConnect, config),
    disconnect: (sessionId) => ipcRenderer.invoke(IPC_CHANNELS.serialDisconnect, sessionId),
    write: (sessionId, data) => ipcRenderer.send(IPC_CHANNELS.serialWrite, { sessionId, data }),
    onData: (listener) => {
      const handler = (_event: IpcRendererEvent, payload: SerialDataEvent) => listener(payload);
      ipcRenderer.on(IPC_CHANNELS.serialData, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.serialData, handler);
    },
    onStatus: (listener) => {
      const handler = (_event: IpcRendererEvent, payload: SerialStatusEvent) => listener(payload);
      ipcRenderer.on(IPC_CHANNELS.serialStatus, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.serialStatus, handler);
    },
  },
  local: {
    connect: (config: LocalTerminalConfig) => ipcRenderer.invoke(IPC_CHANNELS.localConnect, config),
    disconnect: (sessionId) => ipcRenderer.invoke(IPC_CHANNELS.localDisconnect, sessionId),
    write: (sessionId, data) => ipcRenderer.send(IPC_CHANNELS.localWrite, { sessionId, data }),
    resize: (sessionId, cols, rows) => ipcRenderer.send(IPC_CHANNELS.localResize, { sessionId, cols, rows }),
    onData: (listener) => {
      const handler = (_event: IpcRendererEvent, payload: LocalTerminalDataEvent) => listener(payload);
      ipcRenderer.on(IPC_CHANNELS.localData, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.localData, handler);
    },
    onStatus: (listener) => {
      const handler = (_event: IpcRendererEvent, payload: LocalTerminalStatusEvent) => listener(payload);
      ipcRenderer.on(IPC_CHANNELS.localStatus, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.localStatus, handler);
    },
  },
  vnc: {
    connect: (config: VncConnectionConfig) => ipcRenderer.invoke(IPC_CHANNELS.vncConnect, config),
    disconnect: (sessionId) => ipcRenderer.invoke(IPC_CHANNELS.vncDisconnect, sessionId),
    onStatus: (listener) => {
      const handler = (_event: IpcRendererEvent, payload: VncStatusEvent) => listener(payload);
      ipcRenderer.on(IPC_CHANNELS.vncStatus, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.vncStatus, handler);
    },
  },
  web: {
    connect: (config: WebConnectionConfig) => ipcRenderer.invoke(IPC_CHANNELS.webConnect, config),
    disconnect: (sessionId) => ipcRenderer.invoke(IPC_CHANNELS.webDisconnect, sessionId),
    setBounds: (sessionId: string, bounds: WebBounds) =>
      ipcRenderer.send(IPC_CHANNELS.webSetBounds, sessionId, bounds),
    setVisible: (sessionId: string, visible: boolean) =>
      ipcRenderer.send(IPC_CHANNELS.webSetVisible, sessionId, visible),
    onStatus: (listener) => {
      const handler = (_event: IpcRendererEvent, payload: WebStatusEvent) => listener(payload);
      ipcRenderer.on(IPC_CHANNELS.webStatus, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.webStatus, handler);
    },
  },
  vault: {
    status: () => ipcRenderer.invoke(IPC_CHANNELS.vaultStatus),
    create: (masterPassword) => ipcRenderer.invoke(IPC_CHANNELS.vaultCreate, masterPassword),
    unlock: (masterPassword) => ipcRenderer.invoke(IPC_CHANNELS.vaultUnlock, masterPassword),
    lock: () => ipcRenderer.invoke(IPC_CHANNELS.vaultLock),
    listProfiles: () => ipcRenderer.invoke(IPC_CHANNELS.vaultListProfiles),
    saveProfile: (profile: ServerProfileInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.vaultSaveProfile, profile),
    deleteProfile: (profileId) =>
      ipcRenderer.invoke(IPC_CHANNELS.vaultDeleteProfile, profileId),
    deleteProfiles: (profileIds, folderPaths) =>
      ipcRenderer.invoke(IPC_CHANNELS.vaultDeleteProfiles, profileIds, folderPaths),
    duplicateProfile: (profileId, group) =>
      ipcRenderer.invoke(IPC_CHANNELS.vaultDuplicateProfile, profileId, group),
    updateProfileNotes: (profileId, notes) =>
      ipcRenderer.invoke(IPC_CHANNELS.vaultUpdateProfileNotes, profileId, notes),
    addConfigBackup: (profileId, input: ConfigBackupInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.vaultAddConfigBackup, profileId, input),
    deleteConfigBackup: (profileId, backupId) =>
      ipcRenderer.invoke(IPC_CHANNELS.vaultDeleteConfigBackup, profileId, backupId),
    listAssets: () => ipcRenderer.invoke(IPC_CHANNELS.vaultListAssets),
    saveAsset: (asset: AssetInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.vaultSaveAsset, asset),
    deleteAsset: (assetId) =>
      ipcRenderer.invoke(IPC_CHANNELS.vaultDeleteAsset, assetId),
    listSnippets: () => ipcRenderer.invoke(IPC_CHANNELS.vaultListSnippets),
    saveSnippet: (snippet: SnippetInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.vaultSaveSnippet, snippet),
    deleteSnippet: (snippetId) =>
      ipcRenderer.invoke(IPC_CHANNELS.vaultDeleteSnippet, snippetId),
    listCredentialProfiles: () => ipcRenderer.invoke(IPC_CHANNELS.vaultListCredentialProfiles),
    saveCredentialProfile: (input: CredentialProfileInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.vaultSaveCredentialProfile, input),
    deleteCredentialProfile: (credentialProfileId) =>
      ipcRenderer.invoke(IPC_CHANNELS.vaultDeleteCredentialProfile, credentialProfileId),
    setFavorite: (profileId, favorite) =>
      ipcRenderer.invoke(IPC_CHANNELS.vaultSetFavorite, profileId, favorite),
    moveProfile: (profileId, group) =>
      ipcRenderer.invoke(IPC_CHANNELS.vaultMoveProfile, profileId, group),
    listFolderDefaults: () => ipcRenderer.invoke(IPC_CHANNELS.vaultListFolderDefaults),
    saveFolderDefaults: (input: FolderDefaultsInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.vaultSaveFolderDefaults, input),
    deleteFolderDefaults: (path) => ipcRenderer.invoke(IPC_CHANNELS.vaultDeleteFolderDefaults, path),
    listExternalTools: () => ipcRenderer.invoke(IPC_CHANNELS.vaultListExternalTools),
    saveExternalTool: (input: ExternalToolInput) => ipcRenderer.invoke(IPC_CHANNELS.vaultSaveExternalTool, input),
    deleteExternalTool: (toolId) => ipcRenderer.invoke(IPC_CHANNELS.vaultDeleteExternalTool, toolId),
    listConnectionTasks: () => ipcRenderer.invoke(IPC_CHANNELS.vaultListConnectionTasks),
    saveConnectionTask: (input: ConnectionTaskInput) => ipcRenderer.invoke(IPC_CHANNELS.vaultSaveConnectionTask, input),
    deleteConnectionTask: (taskId) => ipcRenderer.invoke(IPC_CHANNELS.vaultDeleteConnectionTask, taskId),
    listSyncSources: () => ipcRenderer.invoke(IPC_CHANNELS.vaultListSyncSources),
    saveSyncSource: (input: InventorySyncSourceInput) => ipcRenderer.invoke(IPC_CHANNELS.vaultSaveSyncSource, input),
    deleteSyncSource: (sourceId) => ipcRenderer.invoke(IPC_CHANNELS.vaultDeleteSyncSource, sourceId),
    generateTotp: (profileId) => ipcRenderer.invoke(IPC_CHANNELS.vaultGenerateTotp, profileId),
  },
  externalTools: {
    run: (toolId, profileId) => ipcRenderer.invoke(IPC_CHANNELS.externalToolRun, toolId, profileId),
  },
  inventorySync: {
    run: (sourceId) => ipcRenderer.invoke(IPC_CHANNELS.inventorySyncRun, sourceId),
  },
  preferences: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.preferencesGet),
    update: (preferences: AppPreferences, newMasterPassword?: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.preferencesUpdate, preferences, newMasterPassword),
    activity: () => ipcRenderer.send(IPC_CHANNELS.preferencesActivity),
  },
  diagnostics: {
    run: (profileId, kind: DiagnosticKind) =>
      ipcRenderer.invoke(IPC_CHANNELS.diagnosticsRun, profileId, kind),
    launch: (profileId, action: ExternalDiagnosticKind) =>
      ipcRenderer.invoke(IPC_CHANNELS.diagnosticsLaunch, profileId, action),
  },
  discovery: {
    start: (target) => ipcRenderer.invoke(IPC_CHANNELS.discoveryStart, target),
    cancel: (scanId) => ipcRenderer.invoke(IPC_CHANNELS.discoveryCancel, scanId),
    onProgress: (listener) => {
      const handler = (_event: IpcRendererEvent, payload: DiscoveryProgressEvent) =>
        listener(payload);
      ipcRenderer.on(IPC_CHANNELS.discoveryProgress, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.discoveryProgress, handler);
    },
    onResult: (listener) => {
      const handler = (_event: IpcRendererEvent, payload: DiscoveryResultEvent) =>
        listener(payload);
      ipcRenderer.on(IPC_CHANNELS.discoveryResult, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.discoveryResult, handler);
    },
    onComplete: (listener) => {
      const handler = (_event: IpcRendererEvent, payload: DiscoveryCompleteEvent) =>
        listener(payload);
      ipcRenderer.on(IPC_CHANNELS.discoveryComplete, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.discoveryComplete, handler);
    },
  },
  health: {
    setTargets: (targets: HealthTarget[]) => ipcRenderer.invoke(IPC_CHANNELS.healthSetTargets, targets),
    refresh: () => ipcRenderer.invoke(IPC_CHANNELS.healthRefresh),
    onStatus: (listener) => {
      const handler = (_event: IpcRendererEvent, payload: HealthStatusEvent) => listener(payload);
      ipcRenderer.on(IPC_CHANNELS.healthStatus, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.healthStatus, handler);
    },
  },
  migration: {
    importConnections: (request: MigrationRequest) =>
      ipcRenderer.invoke(IPC_CHANNELS.migrationImport, request),
    exportConnections: (request: MigrationRequest) =>
      ipcRenderer.invoke(IPC_CHANNELS.migrationExport, request),
  },
  system: {
    whenReady: () => ipcRenderer.invoke(IPC_CHANNELS.appReady),
    selectPrivateKey: () => ipcRenderer.invoke(IPC_CHANNELS.selectPrivateKey),
    selectBackupDirectory: (currentPath?: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.selectBackupDirectory, currentPath),
    openProjectLink: (destination) => ipcRenderer.invoke(IPC_CHANNELS.openProjectLink, destination),
    captureScreenshot: (request: ScreenshotRequest) => ipcRenderer.invoke(IPC_CHANNELS.sessionCaptureScreenshot, request),
    loadWorkspace: () => ipcRenderer.invoke(IPC_CHANNELS.workspaceLoad),
    saveWorkspace: (snapshot: WorkspaceSnapshot) => ipcRenderer.invoke(IPC_CHANNELS.workspaceSave, snapshot),
    exportDisasterRecovery: (passphrase: string) => ipcRenderer.invoke(IPC_CHANNELS.disasterRecoveryExport, passphrase),
    launchProfileFromQuickLauncher: (profileId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.quickLauncherLaunchProfile, profileId),
    showMainWindow: () => ipcRenderer.invoke(IPC_CHANNELS.quickLauncherShowMain),
    hideQuickLauncher: () => ipcRenderer.send(IPC_CHANNELS.quickLauncherHide),
    downloadUpdate: () => ipcRenderer.invoke(IPC_CHANNELS.appUpdateDownload),
    installUpdate: () => ipcRenderer.invoke(IPC_CHANNELS.appUpdateInstall),
    updateTrayState: (snapshot: TrayStateSnapshot) => ipcRenderer.send(IPC_CHANNELS.trayStateUpdate, snapshot),
    onUpdateAvailable: (listener) => {
      const handler = (_event: IpcRendererEvent, payload: AppUpdateEvent) => listener(payload);
      ipcRenderer.on(IPC_CHANNELS.appUpdateAvailable, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.appUpdateAvailable, handler);
    },
    onUpdateDownloaded: (listener) => {
      const handler = (_event: IpcRendererEvent, payload: AppUpdateEvent) => listener(payload);
      ipcRenderer.on(IPC_CHANNELS.appUpdateDownloaded, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.appUpdateDownloaded, handler);
    },
    onUpdateStatus: (listener) => {
      const handler = (_event: IpcRendererEvent, payload: AppUpdateStatusEvent) => listener(payload);
      ipcRenderer.on(IPC_CHANNELS.appUpdateStatus, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.appUpdateStatus, handler);
    },
    onMenuCommand: (listener) => {
      const handler = (_event: IpcRendererEvent, command: AppMenuCommand) => listener(command);
      ipcRenderer.on(IPC_CHANNELS.appMenuCommand, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.appMenuCommand, handler);
    },
    detachSession: (request) => ipcRenderer.invoke(IPC_CHANNELS.sessionDetach, request),
    onDetachedSession: (listener) => {
      const handler = (_event: IpcRendererEvent, descriptor: import("../shared/ipc").DetachedSessionDescriptor) => listener(descriptor);
      ipcRenderer.on(IPC_CHANNELS.sessionDetached, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.sessionDetached, handler);
    },
    onVaultLocked: (listener) => {
      const handler = (_event: IpcRendererEvent, reason: string) => listener(reason);
      ipcRenderer.on(IPC_CHANNELS.vaultLocked, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.vaultLocked, handler);
    },
    onTrayQuickConnect: (listener) => {
      const handler = (_event: IpcRendererEvent, profileId: string) => listener(profileId);
      ipcRenderer.on(IPC_CHANNELS.trayQuickConnect, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.trayQuickConnect, handler);
    },
  },
};

contextBridge.exposeInMainWorld("cybergrid", api);
