// src/env.ts
// Single source of truth for environment variables.
// Fails loudly on startup if required vars are missing.

import { z } from 'zod';

const isTest = process.env['NODE_ENV'] === 'test';

const EnvSchema = z.object({
  NODE_ENV:         z.enum(['development', 'production', 'test']).default('development'),
  PORT:             z.coerce.number().default(3000),
  HOST:             z.string().default('0.0.0.0'),
  DATABASE_URL:     z.string().regex(/^postgres(ql)?:\/\/.+/, 'DATABASE_URL must be a postgresql:// connection string')
                      .default(isTest ? 'postgres://localhost:5432/izwihuru_test' : undefined as unknown as string),
  REDIS_URL:        z.string().regex(/^rediss?:\/\/.+/, 'REDIS_URL must be a redis:// connection string')
                      .default('redis://127.0.0.1:6379'),
  // Server-side encryption key for post bodies (hex-encoded 32 bytes)
  BODY_ENCRYPT_KEY: z.string().length(64)
                      .default(isTest ? '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' : undefined as unknown as string),
  // Altcha HMAC secret for PoW challenge signing
  ALTCHA_SECRET:    z.string().min(32)
                      .default(isTest ? 'test-altcha-secret-minimum-32-chars-long' : undefined as unknown as string),
  // Session token config
  SESSION_DAYS:     z.coerce.number().default(30),
  REG_RATE_LIMIT:   z.coerce.number().default(10),
});

export type Env = z.infer<typeof EnvSchema>;

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment variables:\n', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
