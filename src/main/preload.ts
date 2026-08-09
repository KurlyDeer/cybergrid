import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type {
  AssetInput,
  AppPreferences,
  ConfigBackupInput,
  CyberGridApi,
  DiscoveryCompleteEvent,
  DiscoveryProgressEvent,
  DiscoveryResultEvent,
  ConnectionTaskInput,
  ExternalToolInput,
  FolderDefaultsInput,
  HealthStatusEvent,
  HealthTarget,
  DiagnosticKind,
  MigrationRequest,
  InventorySyncSourceInput,
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
  VncConnectionConfig,
  VncStatusEvent,
  WebBounds,
  WebConnectionConfig,
  WebStatusEvent,
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
};

const api: CyberGridApi = {
  profiles: {
    connect: (profileId) => ipcRenderer.invoke(IPC_CHANNELS.profileConnect, profileId),
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
    setFavorite: (profileId, favorite) =>
      ipcRenderer.invoke(IPC_CHANNELS.vaultSetFavorite, profileId, favorite),
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
    captureScreenshot: (request: ScreenshotRequest) => ipcRenderer.invoke(IPC_CHANNELS.sessionCaptureScreenshot, request),
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
