// src/api/users.ts
// User profile and account settings endpoints.
// Strict privacy: no real name, no email, no IP, no phone number stored or exposed.

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { sql } from '../db.js';
import { requireAuth } from '../middleware/session.js';
import { hashPassphrase, verifyPassphrase } from '../crypto.js';

const ChangePassphraseSchema = z.object({
  currentPassphrase: z.string().min(1),
  newPassphrase:     z.string().min(10).max(256),
});

const RecoveryTokenSchema = z.object({
  recoveryTokenHash: z.string().min(32).max(128),
});

export async function usersRoutes(app: FastifyInstance): Promise<void> {

  // GET /users/me — current authenticated user details
  app.get('/me', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.user!;
    return reply.send({
      id: user.id,
      handle: user.handle,
      reputation: user.reputation,
      isSuspended: user.isSuspended,
    });
  });

  // PATCH /users/me — change passphrase
  app.patch('/me', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = ChangePassphraseSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    const { currentPassphrase, newPassphrase } = parsed.data;
    const userId = request.user!.id;

    const [user] = await sql<[{ passphraseHash: string } | undefined]>`
      SELECT passphrase_hash FROM users WHERE id = ${userId} LIMIT 1
    `;

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    const valid = await verifyPassphrase(currentPassphrase, user.passphraseHash);
    if (!valid) {
      return reply.status(401).send({ error: 'Incorrect current passphrase' });
    }

    const newHash = await hashPassphrase(newPassphrase);
    await sql`
      UPDATE users
      SET passphrase_hash = ${newHash}, updated_at = NOW()
      WHERE id = ${userId}
    `;

    return reply.send({ ok: true, message: 'Passphrase updated successfully' });
  });

  // POST /users/me/recovery — register new recovery token hash (derived client-side)
  app.post('/me/recovery', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = RecoveryTokenSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid recovery token hash' });
    }

    const { recoveryTokenHash } = parsed.data;
    const userId = request.user!.id;

    await sql`
      UPDATE users
      SET recovery_token_hash = ${recoveryTokenHash}, updated_at = NOW()
      WHERE id = ${userId}
    `;

    return reply.send({ ok: true, message: 'Recovery token hash updated' });
  });

  // GET /users/:handle — public pseudonymous profile
  app.get('/:handle', async (request, reply) => {
    const { handle } = request.params as { handle: string };

    const [user] = await sql<[{
      id: string;
      handle: string;
      reputation: string;
      isSuspended: boolean;
      createdAt: Date;
    } | undefined]>`
      SELECT id, handle, reputation, is_suspended, created_at
      FROM users
      WHERE handle = ${handle.toLowerCase()}
      LIMIT 1
    `;

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return reply.send({
      user: {
        id: user.id,
        handle: user.handle,
        reputation: parseFloat(user.reputation),
        isSuspended: user.isSuspended,
        createdAt: user.createdAt,
      },
    });
  });
}
