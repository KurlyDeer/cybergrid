import { safeStorage } from "electron";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const MAX_KEY_FILE_BYTES = 64 * 1024;

export class AutoUnlockController {
  constructor(private readonly keyPath: string) {}

  async isAvailable(): Promise<boolean> {
    if (!(await safeStorage.isAsyncEncryptionAvailable())) return false;
    return process.platform !== "linux" || safeStorage.getSelectedStorageBackend() !== "basic_text";
  }

  async hasStoredSecret(): Promise<boolean> {
    try {
      const info = await stat(this.keyPath);
      return info.isFile() && info.size > 0 && info.size <= MAX_KEY_FILE_BYTES;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    }
  }

  async readSecret(): Promise<string | undefined> {
    if (!(await this.hasStoredSecret())) return undefined;
    if (!(await this.isAvailable())) {
      throw new Error("Automatic vault unlock is unavailable because the operating-system credential store is not secure or accessible.");
    }
    const encrypted = await readFile(this.keyPath);
    if (encrypted.length === 0 || encrypted.length > MAX_KEY_FILE_BYTES) {
      throw new Error("Automatic vault key file is invalid.");
    }
    try {
      const decrypted = await safeStorage.decryptStringAsync(encrypted);
      if (!/^[A-Za-z0-9_-]{40,256}$/.test(decrypted.result)) {
        throw new Error("Automatic vault key has an invalid format.");
      }
      if (decrypted.shouldReEncrypt) await this.writeSecret(decrypted.result);
      return decrypted.result;
    } catch (error) {
      throw new Error(
        `Automatic vault key could not be decrypted for the signed-in OS user: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async createAndStoreSecret(): Promise<string> {
    if (!(await this.isAvailable())) {
      throw new Error("Enable Master Password cannot be turned off because a secure operating-system credential store is unavailable.");
    }
    const secret = randomBytes(48).toString("base64url");
    await this.writeSecret(secret);
    return secret;
  }

  async removeSecret(): Promise<void> {
    await rm(this.keyPath, { force: true });
  }

  private async writeSecret(secret: string): Promise<void> {
    const encrypted = await safeStorage.encryptStringAsync(secret);
    await mkdir(dirname(this.keyPath), { recursive: true, mode: 0o700 });
    const temporaryPath = `${this.keyPath}.${process.pid}.tmp`;
    try {
      await writeFile(temporaryPath, encrypted, { mode: 0o600 });
      await rename(temporaryPath, this.keyPath);
    } catch (error) {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
      throw error;
    }
  }
}
