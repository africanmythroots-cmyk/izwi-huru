// src/transparency/routes.ts
// Public transparency endpoints — no authentication required.
// These are always accessible: on the main site, all mirrors, and the onion address.

import type { FastifyInstance } from 'fastify';
import { sql } from '../db.js';

export async function transparencyRoutes(app: FastifyInstance): Promise<void> {

  /**
   * GET /transparency/reports — list all published quarterly reports.
   */
  app.get('/reports', async (_request, reply) => {
    const reports = await sql`
      SELECT quarter, published_at, created_at
      FROM transparency_reports
      WHERE published_at IS NOT NULL
      ORDER BY quarter DESC
    `;
    return reply.send({ reports });
  });

  /**
   * GET /transparency/reports/:quarter — full report for a given quarter.
   * Also returns the PGP signature so readers can verify authenticity.
   */
  app.get('/reports/:quarter', async (request, reply) => {
    const { quarter } = request.params as { quarter: string };
    const [report] = await sql`
      SELECT quarter, report_text, report_html, pgp_signature, published_at
      FROM transparency_reports
      WHERE quarter = ${quarter} AND published_at IS NOT NULL
      LIMIT 1
    `;
    if (!report) return reply.status(404).send({ error: 'Report not found' });
    return reply.send({ report });
  });

  /**
   * GET /transparency/requests — public summary of government requests.
   * Aggregated by country and type — no individual request detail exposed.
   */
  app.get('/requests', async (_request, reply) => {
    const summary = await sql`
      SELECT
        requesting_country,
        request_type,
        outcome,
        COUNT(*) AS count
      FROM government_requests
      WHERE resolved_at IS NOT NULL
      GROUP BY requesting_country, request_type, outcome
      ORDER BY requesting_country, request_type
    `;
    return reply.send({ summary });
  });

  /**
   * GET /transparency/events — recent transparency events feed.
   * Shows what has happened on the platform: mod actions, escalations, etc.
   * No user-identifying information included.
   */
  app.get('/events', async (request, reply) => {
    const { quarter } = request.query as { quarter?: string };

    const events = await sql`
      SELECT event_type, quarter, summary, country_code, created_at
      FROM transparency_events
      WHERE published_at IS NOT NULL
        ${quarter ? sql`AND quarter = ${quarter}` : sql``}
      ORDER BY created_at DESC
      LIMIT 100
    `;

    return reply.send({ events });
  });
}
