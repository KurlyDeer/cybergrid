import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type {
  CyberGridApi,
  SshDataEvent,
  SshResizeRequest,
  SshStatusEvent,
  SshWriteRequest,
} from "../shared/ipc";

// Sandboxed Electron preloads cannot require arbitrary local modules at runtime.
// Keep channel names self-contained here while sharing their TypeScript contract.
const IPC_CHANNELS: typeof import("../shared/ipc").IPC_CHANNELS = {
  sshConnect: "cybergrid:ssh:connect",
  sshDisconnect: "cybergrid:ssh:disconnect",
  sshWrite: "cybergrid:ssh:write",
  sshResize: "cybergrid:ssh:resize",
  sshData: "cybergrid:ssh:data",
  sshStatus: "cybergrid:ssh:status",
};

const api: CyberGridApi = {
  ssh: {
    connect: (config) => ipcRenderer.invoke(IPC_CHANNELS.sshConnect, config),
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
};

contextBridge.exposeInMainWorld("cybergrid", api);
