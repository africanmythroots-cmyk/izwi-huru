// src/api/posts.ts
// Post CRUD, replies, votes, amplifications, and flags.

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { sql } from '../db.js';
import { encryptBody, decryptBody } from '../crypto.js';
import { requireAuth } from '../middleware/session.js';

// ─── Schemas ─────────────────────────────────────────────────────────────────

const CreatePostSchema = z.object({
  spaceId:  z.string().uuid().optional().nullable(),
  body:     z.string().min(1).max(10_000),
  parentId: z.string().uuid().optional().nullable(),
});

const FlagSchema = z.object({
  reason: z.enum([
    'doxxing', 'incitement', 'hate_speech', 'threat',
    'harassment', 'non_consensual_intimate', 'coordinated_inauthenticity', 'other',
  ]),
  detail: z.string().max(500).optional(),
});

const PAGE_SIZE = 30;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function serializePost(row: {
  id: string;
  spaceId: string;
  authorId: string;
  authorHandle: string;
  parentId: string | null;
  threadRootId: string | null;
  bodyEncrypted: Buffer;
  bodyLength: number;
  visibility: string;
  replyCount: number;
  voteScore: number;
  amplifyCount: number;
  createdAt: Date;
}) {
  return {
    id:           row.id,
    spaceId:      row.spaceId,
    author:       { id: row.authorId, handle: row.authorHandle },
    parentId:     row.parentId,
    threadRootId: row.threadRootId,
    body:         decryptBody(row.bodyEncrypted),
    bodyLength:   row.bodyLength,
    visibility:   row.visibility,
    replyCount:   row.replyCount,
    voteScore:    row.voteScore,
    amplifyCount: row.amplifyCount,
    createdAt:    row.createdAt,
  };
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export async function postsRoutes(app: FastifyInstance): Promise<void> {

  // GET /posts/:id — single post
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const [row] = await sql`
      SELECT
        p.id, p.space_id, p.author_id, u.handle AS author_handle,
        p.parent_id, p.thread_root_id,
        p.body_encrypted, p.body_length,
        p.visibility, p.reply_count, p.vote_score, p.amplify_count,
        p.created_at
      FROM posts p
      JOIN users u ON u.id = p.author_id
      WHERE p.id = ${id}
        AND p.visibility = 'public'
        AND p.deleted_at IS NULL
      LIMIT 1
    `;

    if (!row) return reply.status(404).send({ error: 'Post not found' });
    return reply.send({ post: serializePost(row as Parameters<typeof serializePost>[0]) });
  });

  // GET /posts/:id/replies — thread replies (paginated)
  app.get('/:id/replies', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { cursor } = request.query as { cursor?: string };

    const replies = await sql`
      SELECT
        p.id, p.space_id, p.author_id, u.handle AS author_handle,
        p.parent_id, p.thread_root_id,
        p.body_encrypted, p.body_length,
        p.visibility, p.reply_count, p.vote_score, p.amplify_count,
        p.created_at
      FROM posts p
      JOIN users u ON u.id = p.author_id
      WHERE p.parent_id = ${id}
        AND p.visibility = 'public'
        AND p.deleted_at IS NULL
        ${cursor ? sql`AND p.created_at < ${new Date(cursor)}` : sql``}
      ORDER BY p.created_at ASC
      LIMIT ${PAGE_SIZE}
    `;

    const lastReply = replies[replies.length - 1] as { createdAt?: Date; created_at?: Date } | undefined;
    const nextCursor =
      replies.length === PAGE_SIZE
        ? (lastReply?.createdAt ?? lastReply?.created_at)?.toISOString() ?? null
        : null;

    return reply.send({
      replies: replies.map((r) => serializePost(r as Parameters<typeof serializePost>[0])),
      nextCursor,
    });
  });

  // POST /posts — create a new post or reply
  app.post('/', { preHandler: requireAuth }, async (request, reply) => {
    const body = CreatePostSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid input', details: body.error.flatten() });
    }

    const { spaceId, body: postBody, parentId } = body.data;
    const userId = request.user!.id;
    let finalSpaceId = spaceId;

    // If replying, find the thread root and inherit space if omitted
    let threadRootId: string | null = null;
    if (parentId) {
      const [parent] = await sql<[{ id: string; spaceId: string; threadRootId: string | null } | undefined]>`
        SELECT id, space_id, thread_root_id FROM posts WHERE id = ${parentId} AND deleted_at IS NULL LIMIT 1
      `;
      if (!parent) return reply.status(404).send({ error: 'Parent post not found' });
      threadRootId = parent.threadRootId ?? parentId;
      if (!finalSpaceId) {
        finalSpaceId = parent.spaceId;
      }
    }

    if (!finalSpaceId) {
      const [defaultSpace] = await sql<[{ id: string } | undefined]>`
        SELECT id FROM spaces WHERE slug = 'general' AND is_archived = FALSE LIMIT 1
      `;
      if (defaultSpace) {
        finalSpaceId = defaultSpace.id;
      } else {
        const [anySpace] = await sql<[{ id: string } | undefined]>`
          SELECT id FROM spaces WHERE is_archived = FALSE ORDER BY created_at ASC LIMIT 1
        `;
        if (!anySpace) return reply.status(500).send({ error: 'No active spaces available' });
        finalSpaceId = anySpace.id;
      }
    }

    // Verify space exists and is not archived
    const [space] = await sql`
      SELECT id FROM spaces WHERE id = ${finalSpaceId} AND is_archived = FALSE LIMIT 1
    `;
    if (!space) return reply.status(404).send({ error: 'Space not found' });

    const encrypted = encryptBody(postBody);

    const [post] = await sql`
      INSERT INTO posts (
        space_id, author_id, parent_id, thread_root_id,
        body_encrypted, body_length
      )
      VALUES (
        ${finalSpaceId}, ${userId}, ${parentId ?? null}, ${threadRootId},
        ${encrypted}, ${postBody.length}
      )
      RETURNING id, created_at
    `;

    // Update parent reply count
    if (parentId) {
      await sql`
        UPDATE posts SET reply_count = reply_count + 1
        WHERE id = ${parentId}
      `;
    }

    return reply.status(201).send({ post });
  });

  // DELETE /posts/:id — soft-delete own post
  app.delete('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user!.id;

    const result = await sql`
      UPDATE posts
      SET deleted_at = NOW(), visibility = 'removed'
      WHERE id = ${id} AND author_id = ${userId} AND deleted_at IS NULL
    `;

    if (result.count === 0) {
      return reply.status(404).send({ error: 'Post not found or not yours' });
    }
    return reply.send({ ok: true });
  });

  // POST /posts/:id/vote — upvote or downvote
  app.post('/:id/vote', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user!.id;
    const schema = z.object({ value: z.union([z.literal(1), z.literal(-1)]) });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'value must be 1 or -1' });

    const { value } = parsed.data;

    // Upsert vote, then recalculate post vote_score via trigger / explicit update
    await sql`
      INSERT INTO votes (post_id, voter_id, value)
      VALUES (${id}, ${userId}, ${value})
      ON CONFLICT (post_id, voter_id)
      DO UPDATE SET value = ${value}
    `;

    // Update denormalised score
    await sql`
      UPDATE posts
      SET vote_score = (
        SELECT COALESCE(SUM(value), 0) FROM votes WHERE post_id = ${id}
      )
      WHERE id = ${id}
    `;

    return reply.send({ ok: true });
  });

  // DELETE /posts/:id/vote — remove vote
  app.delete('/:id/vote', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user!.id;

    await sql`DELETE FROM votes WHERE post_id = ${id} AND voter_id = ${userId}`;
    await sql`
      UPDATE posts
      SET vote_score = (
        SELECT COALESCE(SUM(value), 0) FROM votes WHERE post_id = ${id}
      )
      WHERE id = ${id}
    `;
    return reply.send({ ok: true });
  });

  // POST /posts/:id/amplify — amplify without exposure
  app.post('/:id/amplify', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user!.id;

    await sql`
      INSERT INTO amplifications (post_id, amplifier_id)
      VALUES (${id}, ${userId})
      ON CONFLICT DO NOTHING
    `;
    await sql`
      UPDATE posts SET amplify_count = amplify_count + 1
      WHERE id = ${id}
    `;
    return reply.send({ ok: true });
  });

  // DELETE /posts/:id/amplify — un-amplify
  app.delete('/:id/amplify', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user!.id;

    const result = await sql`
      DELETE FROM amplifications WHERE post_id = ${id} AND amplifier_id = ${userId}
    `;
    if (result.count > 0) {
      await sql`UPDATE posts SET amplify_count = GREATEST(amplify_count - 1, 0) WHERE id = ${id}`;
    }
    return reply.send({ ok: true });
  });

  // POST /posts/:id/flag — report a post
  app.post('/:id/flag', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user!.id;
    const parsed = FlagSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid flag reason' });

    const [post] = await sql`SELECT id FROM posts WHERE id = ${id} AND deleted_at IS NULL LIMIT 1`;
    if (!post) return reply.status(404).send({ error: 'Post not found' });

    // Prevent duplicate flags from same user
    const [existing] = await sql`
      SELECT id FROM flags
      WHERE post_id = ${id} AND flagger_id = ${userId} AND resolved_at IS NULL
      LIMIT 1
    `;
    if (existing) return reply.status(409).send({ error: 'Already flagged' });

    await sql`
      INSERT INTO flags (post_id, flagger_id, reason, detail)
      VALUES (${id}, ${userId}, ${parsed.data.reason}, ${parsed.data.detail ?? null})
    `;

    // Auto-queue for review if flag threshold reached (5 independent flags)
    const [{ count }] = await sql<[{ count: string }]>`
      SELECT COUNT(*) AS count FROM flags
      WHERE post_id = ${id} AND resolved_at IS NULL
    `;
    if (parseInt(count, 10) >= 5) {
      await sql`
        UPDATE posts SET visibility = 'pending_review'
        WHERE id = ${id} AND visibility = 'public'
      `;
    }

    return reply.status(201).send({ ok: true });
  });
}
