export const IPC_CHANNELS = {
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

export type ServerAuthType = "password" | "privateKey";

export interface ServerProfileInput {
  name: string;
  host: string;
  port: number;
  username: string;
  group: string;
  authType: ServerAuthType;
  password?: string;
  privateKeyPath?: string;
  passphrase?: string;
}

export interface ServerProfileSummary {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  group: string;
  authType: ServerAuthType;
}

export interface VaultStatus {
  exists: boolean;
  unlocked: boolean;
}

export type Unsubscribe = () => void;

export interface CyberGridApi {
  ssh: {
    connect(config: SshConnectionConfig): Promise<string>;
    connectProfile(profileId: string): Promise<string>;
    disconnect(sessionId: string): Promise<void>;
    write(sessionId: string, data: string): void;
    resize(sessionId: string, cols: number, rows: number): void;
    onData(listener: (event: SshDataEvent) => void): Unsubscribe;
    onStatus(listener: (event: SshStatusEvent) => void): Unsubscribe;
  };
  vault: {
    status(): Promise<VaultStatus>;
    create(masterPassword: string): Promise<void>;
    unlock(masterPassword: string): Promise<void>;
    lock(): Promise<void>;
    listProfiles(): Promise<ServerProfileSummary[]>;
    saveProfile(profile: ServerProfileInput): Promise<ServerProfileSummary>;
    deleteProfile(profileId: string): Promise<void>;
  };
  system: {
    selectPrivateKey(): Promise<string | null>;
  };
}
