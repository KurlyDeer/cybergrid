import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type {
  CyberGridApi,
  ServerProfileInput,
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
  vaultStatus: "cybergrid:vault:status",
  vaultCreate: "cybergrid:vault:create",
  vaultUnlock: "cybergrid:vault:unlock",
  vaultLock: "cybergrid:vault:lock",
  vaultListProfiles: "cybergrid:vault:list-profiles",
  vaultSaveProfile: "cybergrid:vault:save-profile",
  vaultDeleteProfile: "cybergrid:vault:delete-profile",
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
  },
  system: {
    selectPrivateKey: () => ipcRenderer.invoke(IPC_CHANNELS.selectPrivateKey),
  },
};

contextBridge.exposeInMainWorld("cybergrid", api);
