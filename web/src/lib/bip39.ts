// src/lib/bip39.ts
// Pure browser-compatible BIP39 implementation using Web Crypto API.
// Avoids Node.js `Buffer` runtime issues in the browser and builds cleanly on any platform.

import wordlist from 'bip39/src/wordlists/english.json';

/**
 * Generate a 12-word BIP39 mnemonic using cryptographically secure random bytes.
 */
export async function generateRecoveryMnemonic(): Promise<string> {
  const entropy = new Uint8Array(16); // 128 bits = 12 words
  crypto.getRandomValues(entropy);

  const hashBuffer = await crypto.subtle.digest('SHA-256', entropy);
  const hashByte = new Uint8Array(hashBuffer)[0] ?? 0;

  // 128 bits entropy + 4 bits checksum = 132 bits = 12 * 11 bits
  let bits = '';
  for (let i = 0; i < 16; i++) {
    bits += (entropy[i] ?? 0).toString(2).padStart(8, '0');
  }
  bits += hashByte.toString(2).padStart(8, '0').slice(0, 4);

  const words: string[] = [];
  for (let i = 0; i < 12; i++) {
    const idx = parseInt(bits.slice(i * 11, (i + 1) * 11), 2);
    words.push(wordlist[idx] ?? '');
  }
  return words.join(' ');
}

/**
 * Client-side: derive the recovery token from the mnemonic.
 * Mirrors the server-side logic in crypto.ts: SHA-256(first 32 bytes of BIP39 seed) base64url encoded.
 */
export async function deriveRecoveryToken(mnemonic: string, passphrase = ''): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(mnemonic.trim().toLowerCase().normalize('NFKD')),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: enc.encode('mnemonic' + passphrase),
      iterations: 2048,
      hash: 'SHA-512',
    },
    keyMaterial,
    512,
  );

  const seedSlice = new Uint8Array(bits).slice(0, 32);
  const hashBuffer = await crypto.subtle.digest('SHA-256', seedSlice);
  const bytes = new Uint8Array(hashBuffer);

  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }

  // Base64url encode without padding
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Derive the recovery token hash to register with the server (/users/me/recovery).
 * Server stores SHA-256(recoveryToken) in users.recovery_token_hash as hex.
 */
export async function deriveRecoveryTokenHash(recoveryToken: string): Promise<string> {
  const enc = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(recoveryToken));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
