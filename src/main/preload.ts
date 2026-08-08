import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type {
  AssetInput,
  CyberGridApi,
  DiscoveryCompleteEvent,
  DiscoveryProgressEvent,
  DiscoveryResultEvent,
  RdpStatusEvent,
  ServerProfileInput,
  SftpProgressEvent,
  SshDataEvent,
  SshResizeRequest,
  SshStatusEvent,
  SshWriteRequest,
} from "../shared/ipc";

// Sandboxed Electron preloads cannot require arbitrary local modules at runtime.
// Keep channel names self-contained here while sharing their TypeScript contract.
const IPC_CHANNELS: typeof import("../shared/ipc").IPC_CHANNELS = {
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
  vaultListAssets: "cybergrid:vault:list-assets",
  vaultSaveAsset: "cybergrid:vault:save-asset",
  vaultDeleteAsset: "cybergrid:vault:delete-asset",
  discoveryStart: "cybergrid:discovery:start",
  discoveryCancel: "cybergrid:discovery:cancel",
  discoveryProgress: "cybergrid:discovery:progress",
  discoveryResult: "cybergrid:discovery:result",
  discoveryComplete: "cybergrid:discovery:complete",
  selectPrivateKey: "cybergrid:dialog:select-private-key",
};

const api: CyberGridApi = {
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
    listAssets: () => ipcRenderer.invoke(IPC_CHANNELS.vaultListAssets),
    saveAsset: (asset: AssetInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.vaultSaveAsset, asset),
    deleteAsset: (assetId) =>
      ipcRenderer.invoke(IPC_CHANNELS.vaultDeleteAsset, assetId),
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
  system: {
    selectPrivateKey: () => ipcRenderer.invoke(IPC_CHANNELS.selectPrivateKey),
  },
};

contextBridge.exposeInMainWorld("cybergrid", api);
