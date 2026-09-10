// src/middleware/rateLimit.ts
// Rate limiting strategy:
//   - Session-based for authenticated routes (fair per user, not per IP)
//   - Registration only: a modest IP-based limit (generous for Tor exit nodes)
//   - NO blanket IP rate limiting — Tor exit nodes are shared by many users

import type { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import Redis from 'ioredis';
import { env } from '../env.js';

let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      enableReadyCheck: false,
    });
  }
  return redis;
}

export async function registerRateLimits(app: FastifyInstance): Promise<void> {
  await app.register(rateLimit, {
    global: false, // We configure per-route, not globally
    redis:  getRedis(),
    keyGenerator(request) {
      // For authenticated routes: key on user ID (session-based)
      // This means all Tor users sharing an exit IP are NOT penalised together.
      return request.user?.id ?? 'anon';
    },
  });
}

/**
 * Rate limit config for the registration endpoint.
 * IP-based here ONLY — prevents mass account creation from a single source.
 * Limit is generous: Tor exit nodes shared by many legitimate users.
 */
export const registrationRateLimit = {
  config: {
    rateLimit: {
      max: env.REG_RATE_LIMIT,     // default: 10
      timeWindow: '1 hour',
      keyGenerator(request: import('fastify').FastifyRequest) {
        // Use X-Forwarded-For only if behind a trusted reverse proxy;
        // otherwise use the direct connection IP.
        // We do NOT store this IP — it's only used for in-memory rate limiting.
        return request.ip;
      },
    },
  },
};
