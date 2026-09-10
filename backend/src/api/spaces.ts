// src/api/spaces.ts
// Space (community) endpoints.

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { sql } from '../db.js';
import { requireAuth } from '../middleware/session.js';

const CreateSpaceSchema = z.object({
  slug:         z.string().min(2).max(20).regex(/^[a-z0-9-]+$/),
  name:         z.string().min(3).max(60),
  description:  z.string().max(500).optional(),
  languageCode: z.string().min(2).max(10),
  countryScope: z.string().length(2).optional().nullable(),
});

export async function spacesRoutes(app: FastifyInstance): Promise<void> {

  // GET /spaces — list all active spaces
  app.get('/', async (_request, reply) => {
    const spaces = await sql`
      SELECT id, slug, name, description, language_code, country_scope, created_at
      FROM spaces
      WHERE is_archived = FALSE
      ORDER BY name ASC
    `;
    return reply.send({ spaces });
  });

  // GET /spaces/:slug — single space info
  app.get('/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const [space] = await sql`
      SELECT id, slug, name, description, language_code, country_scope, created_at
      FROM spaces
      WHERE slug = ${slug} AND is_archived = FALSE
      LIMIT 1
    `;
    if (!space) return reply.status(404).send({ error: 'Space not found' });
    return reply.send({ space });
  });

  // POST /spaces — create a new space (authenticated; panel moderators only in prod)
  app.post('/', { preHandler: requireAuth }, async (request, reply) => {
    const body = CreateSpaceSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid input', details: body.error.flatten() });
    }
    const { slug, name, description, languageCode, countryScope } = body.data;

    const [existing] = await sql`SELECT id FROM spaces WHERE slug = ${slug} LIMIT 1`;
    if (existing) return reply.status(409).send({ error: 'Slug already taken' });

    const [space] = await sql`
      INSERT INTO spaces (slug, name, description, language_code, country_scope)
      VALUES (${slug}, ${name}, ${description ?? null}, ${languageCode}, ${countryScope ?? null})
      RETURNING id, slug, name
    `;
    return reply.status(201).send({ space });
  });

  // POST /spaces/:slug/join — follow a space
  app.post('/:slug/join', { preHandler: requireAuth }, async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const userId = request.user!.id;

    const [space] = await sql`SELECT id FROM spaces WHERE slug = ${slug} AND is_archived = FALSE LIMIT 1`;
    if (!space) return reply.status(404).send({ error: 'Space not found' });

    await sql`
      INSERT INTO space_memberships (user_id, space_id)
      VALUES (${userId}, ${space.id})
      ON CONFLICT DO NOTHING
    `;
    return reply.send({ ok: true });
  });

  // DELETE /spaces/:slug/join — leave a space
  app.delete('/:slug/join', { preHandler: requireAuth }, async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const userId = request.user!.id;

    const [space] = await sql`SELECT id FROM spaces WHERE slug = ${slug} LIMIT 1`;
    if (!space) return reply.status(404).send({ error: 'Space not found' });

    await sql`
      DELETE FROM space_memberships
      WHERE user_id = ${userId} AND space_id = ${space.id}
    `;
    return reply.send({ ok: true });
  });
}
