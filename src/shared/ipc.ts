export const IPC_CHANNELS = {
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
