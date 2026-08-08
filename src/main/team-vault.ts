import { createCipheriv, createDecipheriv, randomBytes, scrypt } from "node:crypto";
import type { AssetRecord, ServerProfileInput } from "../shared/ipc";

const VERSION = 1 as const;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const SCRYPT_COST = 32_768;
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024;

export interface TeamVaultBundle {
  version: typeof VERSION;
  exportedAt: string;
  profiles: ServerProfileInput[];
  assets: AssetRecord[];
}

interface TeamVaultEnvelope {
  format: "CyberGridTeamVault";
  version: typeof VERSION;
  kdf: {
    algorithm: "scrypt";
    salt: string;
    cost: number;
    blockSize: 8;
    parallelization: 1;
  };
  cipher: {
    algorithm: "aes-256-gcm";
    iv: string;
    authTag: string;
    ciphertext: string;
  };
}

function deriveKey(passphrase: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      passphrase,
      salt,
      KEY_LENGTH,
      { N: SCRYPT_COST, r: 8, p: 1, maxmem: SCRYPT_MAX_MEMORY },
      (error, key) => error ? reject(error) : resolve(key),
    );
  });
}

function aad(envelope: Pick<TeamVaultEnvelope, "format" | "version" | "kdf">): Buffer {
  return Buffer.from(
    `${envelope.format}:${envelope.version}:${envelope.kdf.algorithm}:${envelope.kdf.salt}:${envelope.kdf.cost}:8:1`,
    "utf8",
  );
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    throw new Error("Team vault payload is invalid.");
  }
  return value as Record<string, unknown>;
}

export async function encryptTeamVault(
  profiles: ServerProfileInput[],
  assets: AssetRecord[],
  passphrase: string,
): Promise<string> {
  if (passphrase.length < 10 || passphrase.length > 1_024) {
    throw new Error("Team vault passphrase must contain between 10 and 1,024 characters.");
  }
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const kdf: TeamVaultEnvelope["kdf"] = {
    algorithm: "scrypt",
    salt: salt.toString("base64"),
    cost: SCRYPT_COST,
    blockSize: 8,
    parallelization: 1,
  };
  const key = await deriveKey(passphrase, salt);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const header = { format: "CyberGridTeamVault" as const, version: VERSION, kdf };
  cipher.setAAD(aad(header));
  const plaintext = Buffer.from(JSON.stringify({
    version: VERSION,
    exportedAt: new Date().toISOString(),
    profiles,
    assets,
  } satisfies TeamVaultBundle), "utf8");
  try {
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const envelope: TeamVaultEnvelope = {
      ...header,
      cipher: {
        algorithm: "aes-256-gcm",
        iv: iv.toString("base64"),
        authTag: cipher.getAuthTag().toString("base64"),
        ciphertext: ciphertext.toString("base64"),
      },
    };
    return `${JSON.stringify(envelope, null, 2)}\n`;
  } finally {
    key.fill(0);
    plaintext.fill(0);
  }
}

export async function decryptTeamVault(serialized: string, passphrase: string): Promise<TeamVaultBundle> {
  if (passphrase.length < 10 || passphrase.length > 1_024) {
    throw new Error("Enter the team vault passphrase (minimum 10 characters).");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized) as unknown;
  } catch {
    throw new Error("Team vault contains invalid JSON.");
  }
  const envelope = requireRecord(parsed);
  const kdf = requireRecord(envelope.kdf);
  const cipher = requireRecord(envelope.cipher);
  if (
    envelope.format !== "CyberGridTeamVault" || envelope.version !== VERSION ||
    kdf.algorithm !== "scrypt" || kdf.cost !== SCRYPT_COST || kdf.blockSize !== 8 ||
    kdf.parallelization !== 1 || cipher.algorithm !== "aes-256-gcm"
  ) {
    throw new Error("Unsupported CyberGrid team vault format.");
  }
  const salt = Buffer.from(String(kdf.salt), "base64");
  const iv = Buffer.from(String(cipher.iv), "base64");
  const authTag = Buffer.from(String(cipher.authTag), "base64");
  if (salt.length !== SALT_LENGTH || iv.length !== IV_LENGTH || authTag.length !== 16) {
    throw new Error("Team vault cryptographic parameters are invalid.");
  }
  const typedKdf = kdf as unknown as TeamVaultEnvelope["kdf"];
  const key = await deriveKey(passphrase, salt);
  let plaintext: Buffer | undefined;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(aad({ format: "CyberGridTeamVault", version: VERSION, kdf: typedKdf }));
    decipher.setAuthTag(authTag);
    plaintext = Buffer.concat([
      decipher.update(Buffer.from(String(cipher.ciphertext), "base64")),
      decipher.final(),
    ]);
    const bundle = requireRecord(JSON.parse(plaintext.toString("utf8")) as unknown);
    if (bundle.version !== VERSION || !Array.isArray(bundle.profiles) || !Array.isArray(bundle.assets)) {
      throw new Error("Team vault payload is invalid.");
    }
    return {
      version: VERSION,
      exportedAt: String(bundle.exportedAt ?? ""),
      profiles: bundle.profiles as ServerProfileInput[],
      assets: bundle.assets as AssetRecord[],
    };
  } catch {
    throw new Error("Invalid team passphrase or corrupted CyberGrid team vault.");
  } finally {
    key.fill(0);
    plaintext?.fill(0);
  }
}
