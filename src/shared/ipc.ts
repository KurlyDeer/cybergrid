export const IPC_CHANNELS = {
  sshConnect: "cybergrid:ssh:connect",
  sshDisconnect: "cybergrid:ssh:disconnect",
  sshWrite: "cybergrid:ssh:write",
  sshResize: "cybergrid:ssh:resize",
  sshData: "cybergrid:ssh:data",
  sshStatus: "cybergrid:ssh:status",
} as const;

export interface SshConnectionConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
  readyTimeout?: number;
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

export type Unsubscribe = () => void;

export interface CyberGridApi {
  ssh: {
    connect(config: SshConnectionConfig): Promise<string>;
    disconnect(sessionId: string): Promise<void>;
    write(sessionId: string, data: string): void;
    resize(sessionId: string, cols: number, rows: number): void;
    onData(listener: (event: SshDataEvent) => void): Unsubscribe;
    onStatus(listener: (event: SshStatusEvent) => void): Unsubscribe;
  };
}
