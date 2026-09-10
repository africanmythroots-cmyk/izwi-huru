// src/crypto.test.ts
// Unit tests for cryptographic primitives in Izwi Huru.

import { describe, it, expect } from 'vitest';
import {
  hashPassphrase,
  verifyPassphrase,
  generateSessionToken,
  hashToken,
  encryptBody,
  decryptBody,
  generateRecoveryMnemonic,
  validateRecoveryMnemonic,
  mnemonicToRecoveryToken,
} from './crypto.js';

describe('Passphrase Hashing (bcrypt)', () => {
  it('correctly hashes and verifies a passphrase', async () => {
    const passphrase = 'correct-horse-battery-staple-pan-africa';
    const hash = await hashPassphrase(passphrase);

    expect(hash).not.toBe(passphrase);
    expect(hash.startsWith('$2b$12$') || hash.startsWith('$2a$12$')).toBe(true);

    const match = await verifyPassphrase(passphrase, hash);
    expect(match).toBe(true);

    const wrong = await verifyPassphrase('wrong-passphrase-attempt', hash);
    expect(wrong).toBe(false);
  });
});

describe('Session Tokens', () => {
  it('generates a 256-bit token and returns its SHA-256 hash', () => {
    const { rawToken, tokenHash } = generateSessionToken();

    expect(typeof rawToken).toBe('string');
    expect(rawToken.length).toBeGreaterThanOrEqual(40);

    expect(tokenHash).toHaveLength(64); // 256-bit hex
    expect(tokenHash).toBe(hashToken(rawToken));
  });

  it('produces deterministic SHA-256 hash of token', () => {
    const raw = 'test-token-fixed-string-12345';
    const h1 = hashToken(raw);
    const h2 = hashToken(raw);
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64);
  });
});

describe('Post Body Symmetric Encryption (AES-256-GCM)', () => {
  it('encrypts and decrypts post bodies losslessly', () => {
    const originalText = 'Freedom of speech is protected in law, but freedom after speech is not. Izwi Huru gives power back to the people. 🌍';
    const encrypted = encryptBody(originalText);

    expect(Buffer.isBuffer(encrypted)).toBe(true);
    expect(encrypted.toString('utf8')).not.toContain(originalText);

    const decrypted = decryptBody(encrypted);
    expect(decrypted).toBe(originalText);
  });

  it('generates different ciphertexts for the same plaintext due to random IV', () => {
    const text = 'Sauti ya Afrika huru';
    const enc1 = encryptBody(text);
    const enc2 = encryptBody(text);

    expect(enc1.equals(enc2)).toBe(false);
    expect(decryptBody(enc1)).toBe(text);
    expect(decryptBody(enc2)).toBe(text);
  });
});

describe('BIP39 Recovery Phrase', () => {
  it('generates valid 12-word recovery mnemonic', () => {
    const mnemonic = generateRecoveryMnemonic();
    const words = mnemonic.trim().split(/\s+/);
    expect(words).toHaveLength(12);
    expect(validateRecoveryMnemonic(mnemonic)).toBe(true);
  });

  it('derives a consistent recovery token from valid mnemonic', () => {
    const mnemonic = generateRecoveryMnemonic();
    const token1 = mnemonicToRecoveryToken(mnemonic);
    const token2 = mnemonicToRecoveryToken(mnemonic);

    expect(token1).toBeTruthy();
    expect(token1).toBe(token2);
  });

  it('returns null for invalid mnemonic strings', () => {
    const invalid = 'not a valid mnemonic wordlist string here at all foo bar';
    const token = mnemonicToRecoveryToken(invalid);
    expect(token).toBeNull();
  });
});
