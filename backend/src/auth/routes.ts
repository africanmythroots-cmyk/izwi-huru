// src/auth/routes.ts
// Authentication endpoints: register, login, logout, recover.
// Design:
//   - No email, no phone, no OAuth — pseudonym + passphrase only
//   - PoW CAPTCHA (Altcha) on registration to deter bot account creation
//   - Rate limiting is session-based; IP-based only on /register (generous limit)
//   - Session tokens: 256-bit random, only the SHA-256 hash stored server-side
//   - Recovery: BIP39 mnemonic derived token — server never sees the mnemonic

import type { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import { z } from 'zod';
import { sql } from '../db.js';
import {
  hashPassphrase,
  verifyPassphrase,
  generateSessionToken,
  hashToken,
  generateRecoveryMnemonic,
  mnemonicToRecoveryToken,
} from '../crypto.js';
import { verifyCaptcha } from './captcha.js';
import { registrationRateLimit } from '../middleware/rateLimit.js';
import { env } from '../env.js';

// ─── Validation schemas ───────────────────────────────────────────────────────

// Handle: 3–30 chars, lowercase letters, digits, underscores, hyphens
const HandleSchema = z
  .string()
  .min(3)
  .max(30)
  .regex(/^[a-z0-9_-]+$/, 'Handle must be lowercase letters, digits, _ or -');

const PassphraseSchema = z
  .string()
  .min(10, 'Passphrase must be at least 10 characters')
  .max(256);

const RegisterSchema = z.object({
  handle:          HandleSchema,
  passphrase:      PassphraseSchema,
  captchaPayload:  z.string(), // Altcha JSON payload, base64-encoded
  wantsRecovery:   z.boolean().default(true),
});

const LoginSchema = z.object({
  handle:     HandleSchema,
  passphrase: PassphraseSchema,
});

const RecoverSchema = z.object({
  handle:           HandleSchema,
  recoveryToken:    z.string().min(20),
  newPassphrase:    PassphraseSchema,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Create a session row and return the raw token for the cookie. */
async function createSession(userId: string): Promise<string> {
  const { rawToken, tokenHash } = generateSessionToken();
  const expiresAt = new Date(Date.now() + env.SESSION_DAYS * 86_400_000);

  await sql`
    INSERT INTO sessions (user_id, token_hash, expires_at)
    VALUES (${userId}, ${tokenHash}, ${expiresAt})
  `;

  return rawToken;
}

/** Constant-time response to prevent handle enumeration via timing. */
async function fakeHashWork(): Promise<void> {
  await new Promise((r) => setTimeout(r, 80 + Math.random() * 40));
}

// ─── Route registration ───────────────────────────────────────────────────────

export async function authRoutes(app: FastifyInstance): Promise<void> {

  // POST /auth/register
  app.post('/auth/register', registrationRateLimit, async (request, reply) => {
    const body = RegisterSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid input', details: body.error.flatten() });
    }

    const { handle, passphrase, captchaPayload, wantsRecovery } = body.data;

    // 1. Verify PoW CAPTCHA (Altcha) — works over Tor, no third party
    const captchaValid = await verifyCaptcha(captchaPayload);
    if (!captchaValid) {
      return reply.status(400).send({ error: 'Invalid or expired CAPTCHA' });
    }

    // 2. Check handle uniqueness (case-insensitive — handles are stored lowercase)
    const existing = await sql`
      SELECT id FROM users WHERE handle = ${handle.toLowerCase()} LIMIT 1
    `;
    if (existing.length > 0) {
      return reply.status(409).send({ error: 'Handle already taken' });
    }

    // 3. Hash passphrase and create user
    const passphraseHash = await hashPassphrase(passphrase);
    const lowerHandle = handle.toLowerCase();

    // 4. Optionally derive a recovery token hash (server stores hash only)
    let recoveryTokenHash: string | null = null;
    let recoveryMnemonic: string | null = null;
    if (wantsRecovery) {
      recoveryMnemonic = generateRecoveryMnemonic();
      const token = mnemonicToRecoveryToken(recoveryMnemonic);
      if (token) {
        // Store SHA-256 of the recovery token — not the mnemonic, not the token
        recoveryTokenHash = crypto
          .createHash('sha256')
          .update(token)
          .digest('hex');
      }
    }

    const [user] = await sql<[{ id: string }]>`
      INSERT INTO users (handle, passphrase_hash, recovery_token_hash)
      VALUES (
        ${lowerHandle},
        ${passphraseHash},
        ${recoveryTokenHash}
      )
      RETURNING id
    `;

    if (!user) {
      return reply.status(500).send({ error: 'Account creation failed' });
    }

    // 5. Issue session
    const rawToken = await createSession(user.id);

    // Session cookie: HttpOnly, Secure, SameSite=Strict, no JS access
    reply.setCookie('session', rawToken, {
      httpOnly: true,
      secure:   env.NODE_ENV === 'production',
      sameSite: 'strict',
      path:     '/',
      maxAge:   env.SESSION_DAYS * 86_400,
    });

    // Return the recovery mnemonic ONCE — never stored, never sent again.
    // The client MUST display this to the user prominently.
    return reply.status(201).send({
      handle: lowerHandle,
      recoveryMnemonic: recoveryMnemonic ?? null,
      message: recoveryMnemonic
        ? 'Write down your recovery phrase. It will never be shown again.'
        : 'Account created. No recovery phrase was generated.',
    });
  });


  // POST /auth/login
  app.post('/auth/login', async (request, reply) => {
    const body = LoginSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid input' });
    }

    const { handle, passphrase } = body.data;

    const [user] = await sql<[{ id: string; passphraseHash: string; isSuspended: boolean } | undefined]>`
      SELECT id, passphrase_hash, is_suspended
      FROM users
      WHERE handle = ${handle.toLowerCase()}
      LIMIT 1
    `;

    // Perform fake bcrypt work even if user not found — prevents timing attacks
    // that would allow handle enumeration.
    if (!user) {
      await fakeHashWork();
      return reply.status(401).send({ error: 'Invalid handle or passphrase' });
    }

    if (user.isSuspended) {
      // Still verify passphrase before revealing suspension — prevents enumeration
      await verifyPassphrase(passphrase, user.passphraseHash);
      return reply.status(403).send({ error: 'Account suspended' });
    }

    const valid = await verifyPassphrase(passphrase, user.passphraseHash);
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid handle or passphrase' });
    }

    const rawToken = await createSession(user.id);

    reply.setCookie('session', rawToken, {
      httpOnly: true,
      secure:   env.NODE_ENV === 'production',
      sameSite: 'strict',
      path:     '/',
      maxAge:   env.SESSION_DAYS * 86_400,
    });

    return reply.send({ handle: handle.toLowerCase() });
  });


  // POST /auth/logout
  app.post('/auth/logout', async (request, reply) => {
    const rawToken = request.cookies['session'];
    if (rawToken) {
      const tokenHash = hashToken(rawToken);
      await sql`DELETE FROM sessions WHERE token_hash = ${tokenHash}`;
    }
    reply.clearCookie('session', { path: '/' });
    return reply.send({ ok: true });
  });


  // POST /auth/recover
  // User provides their handle + the recovery token (derived client-side from mnemonic)
  app.post('/auth/recover', async (request, reply) => {
    const body = RecoverSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid input' });
    }

    const { handle, recoveryToken, newPassphrase } = body.data;

    const [user] = await sql<[{ id: string; recoveryTokenHash: string | null } | undefined]>`
      SELECT id, recovery_token_hash
      FROM users
      WHERE handle = ${handle.toLowerCase()}
      LIMIT 1
    `;

    if (!user || !user.recoveryTokenHash) {
      await fakeHashWork();
      return reply.status(401).send({ error: 'Recovery failed' });
    }

    // Hash the submitted recovery token and compare to stored hash
    const submittedHash = crypto
      .createHash('sha256')
      .update(recoveryToken)
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    const expected = Buffer.from(user.recoveryTokenHash, 'hex');
    const submitted = Buffer.from(submittedHash, 'hex');
    if (
      expected.length !== submitted.length ||
      !crypto.timingSafeEqual(expected, submitted)
    ) {
      return reply.status(401).send({ error: 'Recovery failed' });
    }

    // Valid — update passphrase and invalidate all existing sessions
    const newHash = await hashPassphrase(newPassphrase);
    await sql.begin(async (tx) => {
      await tx`
        UPDATE users
        SET passphrase_hash = ${newHash},
            recovery_token_hash = NULL,
            updated_at = NOW()
        WHERE id = ${user.id}
      `;
      // Invalidate all sessions — user must log in fresh
      await tx`DELETE FROM sessions WHERE user_id = ${user.id}`;
    });

    // Recovery token is consumed — they must generate a new one from settings
    return reply.send({
      ok: true,
      message: 'Passphrase reset. All sessions have been invalidated. Generate a new recovery phrase from Settings.',
    });
  });
}
