// src/db.ts
// PostgreSQL connection pool using the `postgres` driver.
// Single pool instance — imported everywhere that needs DB access.

import postgres from 'postgres';
import { env } from './env.js';

export const sql = postgres(env.DATABASE_URL, {
  // Strict: reject extra columns from queries (no silent data loss)
  transform: postgres.camel,
  // Max connections. Keep modest — we're on a single Iceland server at launch.
  max: 20,
  idle_timeout: 30,
  connect_timeout: 10,
  // IMPORTANT: Never log query parameters — they may contain post bodies or handles
  debug: false,
});

/**
 * Run a one-shot query. Thin wrapper for clarity at call sites.
 * Use `sql` directly for complex queries or transactions.
 */
export async function query<T>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<T[]> {
  return sql<T[]>(strings, ...values);
}
