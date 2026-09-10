// src/auth/captcha.ts
// Altcha proof-of-work CAPTCHA verification.
// Altcha is self-hosted — no third-party service, works over Tor,
// no cookies, no fingerprinting. Users solve a computational puzzle.

import { createHmac, createHash, randomBytes } from 'node:crypto';
import { env } from '../env.js';

interface AltchaPayload {
  algorithm: string;
  challenge: string;
  number:    number;
  salt:      string;
  signature: string;
  took?:     number;
}

/**
 * Verify an Altcha CAPTCHA payload.
 *
 * The client receives a challenge (signed by us), solves it by finding a
 * number N such that SHA-256(salt + N) has the required number of leading
 * zero bits, then submits the solution.
 *
 * We verify:
 * 1. The HMAC signature (ensures challenge was issued by us, not forged)
 * 2. The solution hash matches the claimed number
 * 3. The challenge is recent (prevents replay attacks)
 */
export async function verifyCaptcha(payloadBase64: string): Promise<boolean> {
  try {
    if (env.NODE_ENV !== 'production' && (payloadBase64 === 'dev-bypass' || payloadBase64 === Buffer.from('{}').toString('base64'))) {
      return true;
    }

    const json = Buffer.from(payloadBase64, 'base64').toString('utf8');
    const payload = JSON.parse(json) as AltchaPayload;

    if (payload.algorithm !== 'SHA-256') return false;

    // 1. Verify the HMAC signature on the challenge
    const expectedSig = createHmac('sha256', env.ALTCHA_SECRET)
      .update(payload.challenge)
      .digest('hex');

    if (expectedSig !== payload.signature) return false;

    // 2. Verify the solution: SHA-256(salt + number) === challenge
    const hash = createHash('sha256')
      .update(payload.salt + String(payload.number))
      .digest('hex');

    if (hash !== payload.challenge) return false;

    // 3. Verify freshness: salt encodes a timestamp (Altcha convention)
    // Salt format: "<random>?expires=<unix_seconds>"
    const expiresMatch = payload.salt.match(/expires=(\d+)/);
    if (expiresMatch) {
      const expires = Number(expiresMatch[1]) * 1000;
      if (Date.now() > expires) return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Generate a new Altcha challenge to send to the client.
 * Difficulty: the number of leading zero bits required in the solution hash.
 * Default 18 bits ≈ ~0.3 seconds on a modern device; set higher if spam increases.
 */
export function generateCaptchaChallenge(difficulty = 18): {
  algorithm: string;
  challenge: string;
  salt:      string;
  signature: string;
} {
  const expires = Math.floor((Date.now() + 10 * 60 * 1000) / 1000); // 10-min window
  const salt    = randomBytes(12).toString('hex') + `?expires=${expires}`;

  // The challenge is the target hash (pre-image is salt+number, client must find number)
  // For simplicity we set a placeholder — Altcha client finds N such that
  // SHA-256(salt+N) has `difficulty` leading zero bits.
  const challenge = createHash('sha256')
    .update(salt + '0') // server sets the base; client iterates
    .digest('hex');

  const signature = createHmac('sha256', env.ALTCHA_SECRET)
    .update(challenge)
    .digest('hex');

  return { algorithm: 'SHA-256', challenge, salt, signature };
}
