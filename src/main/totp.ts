import { createHmac } from "node:crypto";
import type { TotpCodeResult } from "../shared/ipc";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function normalizeSecret(value: string): string {
  let secret = value.trim();
  if (secret.toLowerCase().startsWith("otpauth://")) {
    const parsed = new URL(secret);
    if (parsed.protocol !== "otpauth:" || parsed.hostname.toLowerCase() !== "totp") {
      throw new Error("Only otpauth TOTP URIs are supported.");
    }
    secret = parsed.searchParams.get("secret") ?? "";
  }
  const normalized = secret.toUpperCase().replace(/[\s=-]/g, "");
  if (normalized.length < 16 || normalized.length > 256 || /[^A-Z2-7]/.test(normalized)) {
    throw new Error("TOTP secret must be a valid Base32 value between 16 and 256 characters.");
  }
  return normalized;
}

export function validateTotpSecret(value: string): string {
  return normalizeSecret(value);
}

function decodeBase32(secret: string): Buffer {
  let bits = 0;
  let bitCount = 0;
  const bytes: number[] = [];
  for (const character of normalizeSecret(secret)) {
    bits = (bits << 5) | BASE32_ALPHABET.indexOf(character);
    bitCount += 5;
    if (bitCount >= 8) {
      bitCount -= 8;
      bytes.push((bits >>> bitCount) & 0xff);
      bits &= (1 << bitCount) - 1;
    }
  }
  return Buffer.from(bytes);
}

export function generateTotp(
  secret: string,
  options: {
    digits?: 6 | 8;
    period?: 30 | 60;
    algorithm?: "sha1" | "sha256" | "sha512";
    now?: number;
  } = {},
): TotpCodeResult {
  const digits = options.digits ?? 6;
  const period = options.period ?? 30;
  const algorithm = options.algorithm ?? "sha1";
  const now = options.now ?? Date.now();
  const counter = Math.floor(now / 1_000 / period);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const key = decodeBase32(secret);
  try {
    const digest = createHmac(algorithm, key).update(counterBuffer).digest();
    const offset = (digest[digest.length - 1] ?? 0) & 0x0f;
    const binary = ((digest[offset] ?? 0) & 0x7f) << 24 |
      ((digest[offset + 1] ?? 0) & 0xff) << 16 |
      ((digest[offset + 2] ?? 0) & 0xff) << 8 |
      ((digest[offset + 3] ?? 0) & 0xff);
    const code = String(binary % (10 ** digits)).padStart(digits, "0");
    const expiresAtMs = (counter + 1) * period * 1_000;
    return {
      code,
      expiresAt: new Date(expiresAtMs).toISOString(),
      remainingSeconds: Math.max(1, Math.ceil((expiresAtMs - now) / 1_000)),
    };
  } finally {
    key.fill(0);
  }
}
