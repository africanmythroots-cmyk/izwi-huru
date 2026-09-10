// src/lib/cache.ts
// SQLite offline cache for the mobile feed and thread views.
// Uses expo-sqlite (op-sqlite compatible API).

import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync('izwihuru.db');
    db.execSync(`
      CREATE TABLE IF NOT EXISTS feed_cache (
        id          TEXT PRIMARY KEY,
        space_slug  TEXT,
        author_handle TEXT NOT NULL,
        body        TEXT NOT NULL,
        reply_count INTEGER DEFAULT 0,
        vote_score  INTEGER DEFAULT 0,
        amplify_count INTEGER DEFAULT 0,
        created_at  TEXT NOT NULL,
        cached_at   TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS post_draft_queue (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        space_id    TEXT,
        parent_id   TEXT,
        body        TEXT NOT NULL,
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        sent        INTEGER DEFAULT 0
      );

      -- Keep cache lean: no more than 200 posts
      CREATE INDEX IF NOT EXISTS idx_feed_created ON feed_cache (created_at DESC);
    `);
  }
  return db;
}

export interface CachedPost {
  id: string;
  spaceSlug?: string;
  author: { handle: string };
  body: string;
  replyCount: number;
  voteScore: number;
  amplifyCount: number;
  createdAt: string;
}

/** Persist feed posts to SQLite. Keeps the 200 most recent. */
export async function cacheFeed(posts: CachedPost[]): Promise<void> {
  const d = getDb();
  d.withTransactionSync(() => {
    for (const p of posts) {
      d.runSync(
        `INSERT OR REPLACE INTO feed_cache
          (id, space_slug, author_handle, body, reply_count, vote_score, amplify_count, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [p.id, p.spaceSlug ?? null, p.author.handle, p.body,
         p.replyCount, p.voteScore, p.amplifyCount, p.createdAt]
      );
    }
    // Trim to 200 newest
    d.runSync(
      `DELETE FROM feed_cache WHERE id NOT IN (
         SELECT id FROM feed_cache ORDER BY created_at DESC LIMIT 200
       )`
    );
  });
}

/** Return cached feed posts when offline. */
export async function getCachedFeed(): Promise<CachedPost[]> {
  const d = getDb();
  const rows = d.getAllSync(
    `SELECT * FROM feed_cache ORDER BY created_at DESC LIMIT 50`
  ) as {
    id: string; space_slug: string | null; author_handle: string;
    body: string; reply_count: number; vote_score: number;
    amplify_count: number; created_at: string;
  }[];

  return rows.map((r) => ({
    id:           r.id,
    spaceSlug:    r.space_slug ?? undefined,
    author:       { handle: r.author_handle },
    body:         r.body,
    replyCount:   r.reply_count,
    voteScore:    r.vote_score,
    amplifyCount: r.amplify_count,
    createdAt:    r.created_at,
  }));
}

/** Queue a post draft for sending when connectivity returns. */
export async function queueDraft(draft: {
  spaceId?: string;
  parentId?: string;
  body: string;
}): Promise<void> {
  const d = getDb();
  d.runSync(
    `INSERT INTO post_draft_queue (space_id, parent_id, body) VALUES (?, ?, ?)`,
    [draft.spaceId ?? null, draft.parentId ?? null, draft.body]
  );
}

/** Retrieve unsent draft posts. */
export async function getPendingDrafts(): Promise<Array<{
  id: number; spaceId: string | null; parentId: string | null; body: string;
}>> {
  const d = getDb();
  const rows = d.getAllSync(
    `SELECT id, space_id, parent_id, body FROM post_draft_queue WHERE sent = 0`
  ) as { id: number; space_id: string | null; parent_id: string | null; body: string }[];
  return rows.map((r) => ({ id: r.id, spaceId: r.space_id, parentId: r.parent_id, body: r.body }));
}

/** Mark a draft as sent. */
export async function markDraftSent(id: number): Promise<void> {
  const d = getDb();
  d.runSync(`UPDATE post_draft_queue SET sent = 1 WHERE id = ?`, [id]);
}
