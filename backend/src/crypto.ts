// src/crypto.ts
// Cryptographic utilities used across the backend.
// Centralised here so every crypto operation goes through one audited file.

import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { generateMnemonic, validateMnemonic, mnemonicToSeedSync } from 'bip39';
import { env } from './env.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const BCRYPT_ROUNDS = 12;
const TOKEN_BYTES   = 32;   // 256-bit session token
const AES_ALGO      = 'aes-256-gcm';
const IV_BYTES      = 12;   // 96-bit IV for AES-GCM

// ─── Passphrase hashing ──────────────────────────────────────────────────────

export async function hashPassphrase(passphrase: string): Promise<string> {
  return bcrypt.hash(passphrase, BCRYPT_ROUNDS);
}

export async function verifyPassphrase(
  passphrase: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(passphrase, hash);
}

// ─── Session tokens ──────────────────────────────────────────────────────────

/**
 * Generate a cryptographically random session token.
 * Returns { rawToken, tokenHash } — only tokenHash is stored server-side.
 */
export function generateSessionToken(): { rawToken: string; tokenHash: string } {
  const rawBytes = crypto.randomBytes(TOKEN_BYTES);
  const rawToken = rawBytes.toString('base64url');
  const tokenHash = crypto
    .createHash('sha256')
    .update(rawToken)
    .digest('hex');
  return { rawToken, tokenHash };
}

export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

// ─── Post body encryption (server-side, symmetric AES-256-GCM) ───────────────

const BODY_KEY = Buffer.from(env.BODY_ENCRYPT_KEY, 'hex');

export function encryptBody(plaintext: string): Buffer {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(AES_ALGO, BODY_KEY, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  // Layout: [IV (12)] [authTag (16)] [ciphertext (variable)]
  return Buffer.concat([iv, authTag, encrypted]);
}

export function decryptBody(data: Buffer | Uint8Array | string): string {
  try {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as any);
    if (buf.length < IV_BYTES + 16) return '';
    const iv         = buf.subarray(0, IV_BYTES);
    const authTag    = buf.subarray(IV_BYTES, IV_BYTES + 16);
    const ciphertext = buf.subarray(IV_BYTES + 16);
    const decipher   = crypto.createDecipheriv(AES_ALGO, BODY_KEY, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8');
  } catch {
    return '[Encrypted content unavailable]';
  }
}

// ─── Recovery mnemonics (BIP39) ──────────────────────────────────────────────

/**
 * Generate a 12-word BIP39 mnemonic for account recovery.
 * NEVER sent to or stored on the server — displayed once to the user.
 */
export function generateRecoveryMnemonic(): string {
  return generateMnemonic(128); // 128 bits of entropy = 12 words
}

/**
 * Derive a deterministic recovery token from the mnemonic.
 * The user presents this token to reset their passphrase.
 * The token itself is the only thing the server verifies — not the mnemonic.
 *
 * Server stores: SHA-256(recovery_token) in users.recovery_token_hash
 * User has: the 12-word mnemonic (client derives token locally)
 */
export function mnemonicToRecoveryToken(mnemonic: string): string | null {
  if (!validateMnemonic(mnemonic)) return null;
  const seed = mnemonicToSeedSync(mnemonic);
  return crypto
    .createHash('sha256')
    .update(seed.subarray(0, 32))
    .digest('base64url');
}
