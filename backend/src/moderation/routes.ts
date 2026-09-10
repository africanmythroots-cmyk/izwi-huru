// src/moderation/routes.ts
// Moderation system: two-tier (local mods + escalation panel).
// Every action must cite a Charter clause. No silent removals.
// Government request logging is also handled here.

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { sql } from '../db.js';
import { requireAuth } from '../middleware/session.js';

// ─── Schemas ─────────────────────────────────────────────────────────────────

const ModActionSchema = z.object({
  postId:        z.string().uuid().optional(),
  targetUserId:  z.string().uuid().optional(),
  action: z.enum([
    'content_warning', 'queue_for_review', 'lock_thread',
    'remove_post', 'suspend_user', 'unsuspend_user',
    'dismiss_flag', 'overturn_action',
  ]),
  charterClause: z.string().min(3).max(100),
  rationale:     z.string().max(2000).optional(),
});

const EscalateSchema = z.object({
  modActionId: z.string().uuid(),
  reason:      z.string().max(2000).optional(),
});

const GovRequestSchema = z.object({
  requestingCountry: z.string().length(2),
  requestType: z.enum([
    'content_removal', 'user_data_disclosure',
    'identity_disclosure', 'account_suspension', 'other',
  ]),
  targetPostId:   z.string().uuid().optional().nullable(),
  targetUserId:   z.string().uuid().optional().nullable(),
  notes:          z.string().max(5000).optional(),
});

// ─── Moderator role check ──────────────────────────────────────────────────────

async function isModerator(userId: string, spaceId?: string): Promise<boolean> {
  if (spaceId) {
    const [row] = await sql`
      SELECT 1 FROM space_moderators
      WHERE user_id = ${userId} AND space_id = ${spaceId}
      LIMIT 1
    `;
    return !!row;
  }
  // Panel moderator check (stored in a separate table for v2; for now: check a role flag)
  const [row] = await sql`SELECT is_panel_mod FROM users WHERE id = ${userId} LIMIT 1`;
  return !!(row as { isPanelMod?: boolean } | undefined)?.isPanelMod;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function moderationRoutes(app: FastifyInstance): Promise<void> {

  /**
   * GET /mod/queue — posts pending moderation review.
   * Accessible to moderators of the relevant space or panel mods.
   */
  app.get('/queue', { preHandler: requireAuth }, async (request, reply) => {
    const { spaceSlug } = request.query as { spaceSlug?: string };
    const userId = request.user!.id;

    // Simple auth: user must be a mod of the space (or panel mod for all)
    const panelMod = await isModerator(userId);

    const queue = await sql`
      SELECT
        p.id, p.space_id, s.slug AS space_slug,
        p.author_id, u.handle AS author_handle,
        p.body_length, p.visibility, p.created_at,
        (SELECT COUNT(*) FROM flags f WHERE f.post_id = p.id AND f.resolved_at IS NULL) AS flag_count
      FROM posts p
      JOIN spaces s ON s.id = p.space_id
      JOIN users u  ON u.id = p.author_id
      WHERE p.visibility = 'pending_review'
        AND p.deleted_at IS NULL
        ${spaceSlug ? sql`AND s.slug = ${spaceSlug}` : sql``}
        ${
          !panelMod
            ? sql`AND p.space_id IN (
                SELECT space_id FROM space_moderators WHERE user_id = ${userId}
              )`
            : sql``
        }
      ORDER BY p.created_at ASC
      LIMIT 50
    `;

    return reply.send({ queue });
  });

  /**
   * POST /mod/actions — take a moderation action.
   * Tier determined by action type:
   *   - remove_post, suspend_user, unsuspend_user, overturn_action → panel only (Tier 2)
   *   - all others → local mod (Tier 1)
   */
  app.post('/actions', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = ModActionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    const { postId, targetUserId, action, charterClause, rationale } = parsed.data;
    const modId = request.user!.id;

    const PANEL_ONLY_ACTIONS = ['remove_post', 'suspend_user', 'unsuspend_user', 'overturn_action'];
    const tier = PANEL_ONLY_ACTIONS.includes(action) ? 2 : 1;

    // Verify the moderator has the right tier
    if (tier === 2) {
      const isPanel = await isModerator(modId);
      if (!isPanel) {
        return reply.status(403).send({ error: 'Panel moderator access required for this action' });
      }
    } else {
      // Tier 1: must be a mod of the post's space
      if (postId) {
        const [post] = await sql`SELECT space_id FROM posts WHERE id = ${postId} LIMIT 1`;
        if (!post) return reply.status(404).send({ error: 'Post not found' });
        const isSpaceMod = await isModerator(modId, (post as { spaceId: string }).spaceId);
        if (!isSpaceMod) {
          return reply.status(403).send({ error: 'Not a moderator of this space' });
        }
      }
    }

    // Execute the action
    await sql.begin(async (tx) => {
      // Record the mod action (charter clause is mandatory)
      const [modAction] = await tx`
        INSERT INTO mod_actions (moderator_id, post_id, target_user_id, action, charter_clause, rationale, tier)
        VALUES (${modId}, ${postId ?? null}, ${targetUserId ?? null}, ${action}, ${charterClause}, ${rationale ?? null}, ${tier})
        RETURNING id
      `;

      // Apply the action to the target
      if (postId) {
        if (action === 'remove_post') {
          await tx`UPDATE posts SET visibility = 'removed' WHERE id = ${postId}`;
        } else if (action === 'content_warning') {
          await tx`UPDATE posts SET visibility = 'public' WHERE id = ${postId}`; // stays public but flagged in meta
        } else if (action === 'queue_for_review') {
          await tx`UPDATE posts SET visibility = 'pending_review' WHERE id = ${postId}`;
        } else if (action === 'dismiss_flag') {
          await tx`
            UPDATE flags SET resolved_at = NOW(), resolved_by = ${modId}, resolution = 'dismissed'
            WHERE post_id = ${postId} AND resolved_at IS NULL
          `;
          await tx`UPDATE posts SET visibility = 'public' WHERE id = ${postId} AND visibility = 'pending_review'`;
        }
      }
      if (targetUserId && action === 'suspend_user') {
        await tx`UPDATE users SET is_suspended = TRUE WHERE id = ${targetUserId}`;
      }
      if (targetUserId && action === 'unsuspend_user') {
        await tx`UPDATE users SET is_suspended = FALSE WHERE id = ${targetUserId}`;
      }

      // Log to transparency events
      await tx`
        INSERT INTO transparency_events (event_type, reference_id, quarter, summary)
        VALUES (
          ${tier === 1 ? 'mod_action_tier1' : 'mod_action_tier2'},
          ${(modAction as { id: string }).id},
          to_char(NOW(), 'YYYY-"Q"Q'),
          ${`Action: ${action} | Charter clause: ${charterClause}`}
        )
      `;
    });

    return reply.status(201).send({ ok: true });
  });

  /**
   * POST /mod/escalate — escalate a Tier 1 action to the panel.
   * Can be called by the user (appeal) or a Tier 1 mod.
   */
  app.post('/escalate', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = EscalateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input' });
    }

    const { modActionId, reason } = parsed.data;
    const raisedBy = request.user!.id;

    const [action] = await sql`SELECT id, tier FROM mod_actions WHERE id = ${modActionId} LIMIT 1`;
    if (!action) return reply.status(404).send({ error: 'Moderation action not found' });

    await sql`
      INSERT INTO escalations (mod_action_id, raised_by, reason)
      VALUES (${modActionId}, ${raisedBy}, ${reason ?? null})
    `;

    // Log to transparency
    await sql`
      INSERT INTO transparency_events (event_type, reference_id, quarter, summary)
      VALUES (
        'escalation_opened',
        ${modActionId},
        to_char(NOW(), 'YYYY-"Q"Q'),
        'Escalation raised for review'
      )
    `;

    return reply.status(201).send({ ok: true });
  });

  /**
   * POST /mod/government-requests — log an incoming government request.
   * All requests logged regardless of outcome (Charter §5.1).
   * Only panel moderators can log (they receive the requests formally).
   */
  app.post('/government-requests', { preHandler: requireAuth }, async (request, reply) => {
    const isPanel = await isModerator(request.user!.id);
    if (!isPanel) return reply.status(403).send({ error: 'Panel moderator access required' });

    const parsed = GovRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    const { requestingCountry, requestType, targetPostId, targetUserId, notes } = parsed.data;

    const [req] = await sql`
      INSERT INTO government_requests (requesting_country, request_type, target_post_id, target_user_id, notes)
      VALUES (${requestingCountry}, ${requestType}, ${targetPostId ?? null}, ${targetUserId ?? null}, ${notes ?? null})
      RETURNING id
    `;

    // Immediately log to transparency events
    await sql`
      INSERT INTO transparency_events (event_type, reference_id, quarter, summary, country_code)
      VALUES (
        'gov_request_received',
        ${(req as { id: string }).id},
        to_char(NOW(), 'YYYY-"Q"Q'),
        ${`Government request received: ${requestType}`},
        ${requestingCountry}
      )
    `;

    return reply.status(201).send({ ok: true, requestId: (req as { id: string }).id });
  });

  /**
   * GET /mod/government-requests — list all government requests (panel only, public endpoint mirrors this via transparency).
   */
  app.get('/government-requests', { preHandler: requireAuth }, async (request, reply) => {
    const isPanel = await isModerator(request.user!.id);
    if (!isPanel) return reply.status(403).send({ error: 'Panel moderator access required' });

    const requests = await sql`
      SELECT id, requesting_country, request_type, received_at, outcome, resolved_at
      FROM government_requests
      ORDER BY received_at DESC
      LIMIT 100
    `;

    return reply.send({ requests });
  });
}
