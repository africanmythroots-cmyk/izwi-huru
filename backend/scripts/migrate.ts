// scripts/migrate.ts
// Automated migration runner for Izwi Huru PostgreSQL database.
// Discovers .sql files in migrations/ in alphanumeric order,
// tracks applied migrations in schema_migrations table, and applies unapplied files.

import { readdirSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { env } from '../src/env.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const migrationsDir = resolve(__dirname, '../migrations');

async function runMigrations() {
  console.log('🔄 Connecting to database for migrations…');
  const sql = postgres(env.DATABASE_URL, { max: 1 });

  try {
    // 1. Create schema_migrations tracking table
    await sql`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name        TEXT PRIMARY KEY,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;

    // 2. Fetch already applied migrations
    const appliedRows = await sql<{ name: string }[]>`
      SELECT name FROM schema_migrations;
    `;
    const applied = new Set(appliedRows.map((r) => r.name));

    // 3. Read migration files in sorted order
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    console.log(`📂 Found ${files.length} migration file(s).`);

    let count = 0;
    for (const file of files) {
      if (applied.has(file)) {
        continue;
      }

      console.log(`➡️  Applying: ${file}`);
      const filePath = join(migrationsDir, file);
      const content = readFileSync(filePath, 'utf8');

      // Execute migration in transaction
      await sql.begin(async (tx) => {
        await tx.unsafe(content);
        await tx`
          INSERT INTO schema_migrations (name) VALUES (${file});
        `;
      });

      console.log(`✅ Applied:  ${file}`);
      count++;
    }

    if (count === 0) {
      console.log('✨ All migrations up to date.');
    } else {
      console.log(`🎉 Successfully applied ${count} migration(s).`);
    }
  } catch (err) {
    console.error('❌ Migration error:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigrations();
