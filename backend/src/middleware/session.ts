// src/middleware/session.ts
// Session authentication middleware for Fastify.
// Reads the session cookie, validates the token hash against the DB,
// and attaches the authenticated user to the request.
//
// No IP stored. No user-agent stored. No device ID.

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { sql } from '../db.js';
import { hashToken } from '../crypto.js';

export interface AuthUser {
  id:          string;
  handle:      string;
  reputation:  number;
  isSuspended: boolean;
}

// Extend Fastify's request type
declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

/**
 * Register the session middleware.
 * Attaches `request.user` if a valid session cookie is present.
 * Does NOT reject unauthenticated requests — use `requireAuth` for that.
 */
export async function sessionMiddleware(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', async (request) => {
    const authHeader = request.headers.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    const rawToken = request.cookies['session'] ?? bearerToken;
    if (!rawToken) return;

    const tokenHash = hashToken(rawToken);
    const now = new Date();

    const [row] = await sql<[{
      userId:      string;
      handle:      string;
      reputation:  string;
      isSuspended: boolean;
      expiresAt:   Date;
    } | undefined]>`
      SELECT
        s.user_id,
        u.handle,
        u.reputation,
        u.is_suspended,
        s.expires_at
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ${tokenHash}
      LIMIT 1
    `;

    if (!row || row.expiresAt < now) return;

    // Update last_seen without storing anything identifying
    await sql`
      UPDATE sessions
      SET last_seen_at = NOW()
      WHERE token_hash = ${tokenHash}
    `;

    request.user = {
      id:          row.userId,
      handle:      row.handle,
      reputation:  parseFloat(row.reputation),
      isSuspended: row.isSuspended,
    };
  });
}

/**
 * Route preHandler that rejects unauthenticated requests with 401.
 * Use as: `app.post('/route', { preHandler: requireAuth }, handler)`
 */
export async function requireAuth(
  request: FastifyRequest,
  reply: import('fastify').FastifyReply,
): Promise<void> {
  if (!request.user) {
    reply.status(401).send({ error: 'Authentication required' });
  }
}
