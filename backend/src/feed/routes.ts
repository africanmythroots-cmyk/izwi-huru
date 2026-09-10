// src/feed/routes.ts
// Feed endpoints: chronological (default) and trust-weighted trending (opt-in).
// Phase 6: Feed & Reputation Engine

import type { FastifyInstance } from 'fastify';
import { sql } from '../db.js';
import { decryptBody } from '../crypto.js';
import { requireAuth } from '../middleware/session.js';

const PAGE_SIZE = 30;

// ─── Trending score constants ─────────────────────────────────────────────────
// trending_score = Σ(vote_value × voter_reputation_weight) / (hours_since_post + 2)^GRAVITY
// GRAVITY controls how fast older posts decay. 1.5 = moderate decay.
const GRAVITY = 1.5;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPost(row: Record<string, unknown>) {
  return {
    id:           row['id'],
    spaceId:      row['spaceId'],
    spaceSlug:    row['spaceSlug'],
    author:       { id: row['authorId'], handle: row['authorHandle'] },
    body:         decryptBody(row['bodyEncrypted'] as Buffer),
    bodyLength:   row['bodyLength'],
    replyCount:   row['replyCount'],
    voteScore:    row['voteScore'],
    amplifyCount: row['amplifyCount'],
    createdAt:    row['createdAt'],
  };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function feedRoutes(app: FastifyInstance): Promise<void> {

  /**
   * GET /feed — chronological feed of posts in followed spaces.
   * For unauthenticated users: shows all public spaces, no personalisation.
   * Query params:
   *   - cursor: ISO timestamp for pagination (createdAt < cursor)
   *   - spaceSlug: optionally filter to a single space
   */
  app.get('/', async (request, reply) => {
    const { cursor, spaceSlug } = request.query as {
      cursor?: string;
      spaceSlug?: string;
    };

    const userId = request.user?.id ?? null;
    const cursorDate = cursor ? new Date(cursor) : null;

    // Build space filter: followed spaces (auth) or all public spaces (anon)
    const posts = await sql`
      SELECT
        p.id, p.space_id, s.slug AS space_slug,
        p.author_id, u.handle AS author_handle,
        p.body_encrypted, p.body_length,
        p.reply_count, p.vote_score, p.amplify_count,
        p.created_at
      FROM posts p
      JOIN spaces s ON s.id = p.space_id
      JOIN users u  ON u.id = p.author_id
      WHERE p.visibility = 'public'
        AND p.deleted_at IS NULL
        AND p.parent_id IS NULL
        ${spaceSlug ? sql`AND s.slug = ${spaceSlug}` : sql``}
        ${
          userId && !spaceSlug
            ? sql`AND (
                NOT EXISTS (SELECT 1 FROM space_memberships WHERE user_id = ${userId})
                OR p.space_id IN (
                  SELECT space_id FROM space_memberships WHERE user_id = ${userId}
                )
              )`
            : sql``
        }
        ${cursorDate ? sql`AND p.created_at < ${cursorDate}` : sql``}
      ORDER BY p.created_at DESC
      LIMIT ${PAGE_SIZE}
    `;

    const lastPost = posts[posts.length - 1] as { createdAt?: Date; created_at?: Date } | undefined;
    const nextCursor =
      posts.length === PAGE_SIZE
        ? (lastPost?.createdAt ?? lastPost?.created_at)?.toISOString() ?? null
        : null;

    return reply.send({
      feed: posts.map(formatPost),
      nextCursor,
    });
  });

  /**
   * GET /feed/trending — trust-weighted trending posts.
   * Opt-in only — never the default surface.
   * Excludes posts flagged for incitement/hate regardless of score.
   * Posts from accounts with reputation < 0.1 are excluded from trending.
   */
  app.get('/trending', async (request, reply) => {
    const { spaceSlug, window = '24' } = request.query as {
      spaceSlug?: string;
      window?: string; // hours to look back, default 24
    };

    const windowHours = Math.min(Math.max(parseInt(window, 10) || 24, 1), 168); // 1h–7d
    const since = new Date(Date.now() - windowHours * 3_600_000);

    // Trending score computed in SQL using reputation-weighted votes
    // and time decay. Posts pending review or flagged for serious violations
    // are excluded entirely.
    const posts = await sql`
      WITH weighted_scores AS (
        SELECT
          v.post_id,
          SUM(v.value * GREATEST(u.reputation, 0.1)) AS weighted_score
        FROM votes v
        JOIN users u ON u.id = v.voter_id
        GROUP BY v.post_id
      )
      SELECT
        p.id, p.space_id, s.slug AS space_slug,
        p.author_id, au.handle AS author_handle,
        p.body_encrypted, p.body_length,
        p.reply_count, p.vote_score, p.amplify_count,
        p.created_at,
        COALESCE(ws.weighted_score, 0)
          / POWER(
              EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600.0 + 2,
              ${GRAVITY}
            ) AS trending_score
      FROM posts p
      JOIN spaces s  ON s.id = p.space_id
      JOIN users au  ON au.id = p.author_id
      LEFT JOIN weighted_scores ws ON ws.post_id = p.id
      WHERE p.visibility = 'public'
        AND p.deleted_at IS NULL
        AND p.parent_id IS NULL
        AND p.created_at >= ${since}
        AND au.reputation >= 0.1
        -- Exclude posts with any unresolved serious flag
        AND NOT EXISTS (
          SELECT 1 FROM flags f
          WHERE f.post_id = p.id
            AND f.reason IN ('incitement', 'hate_speech', 'threat')
            AND f.resolved_at IS NULL
        )
        ${spaceSlug ? sql`AND s.slug = ${spaceSlug}` : sql``}
      ORDER BY trending_score DESC
      LIMIT ${PAGE_SIZE}
    `;

    return reply.send({ trending: posts.map(formatPost) });
  });
}
