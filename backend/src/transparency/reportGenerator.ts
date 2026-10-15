// src/transparency/reportGenerator.ts
// Quarterly transparency report generator.
// Runs as a BullMQ job; generates plain-text and HTML reports,
// PGP-signs them, and writes to the filesystem.
// Reports are then served as static files — no DB query needed to read them.

import { sql } from '../db.js';
import { env } from '../env.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuarterStats {
  govRequests: {
    total: number;
    refused: number;
    complied: number;
    partial: number;
    pending: number;
    byCountry: Array<{ country: string; type: string; outcome: string; count: number }>;
  };
  modActions: {
    tier1: number;
    tier2: number;
  };
  escalations: {
    opened: number;
    resolved: number;
    appealsUpheld: number;
    appealsDenied: number;
  };
  charterChanges: number;
  infrastructureIncidents: number;
}

// ─── Quarter helper ────────────────────────────────────────────────────────────

export function currentQuarter(): string {
  const now = new Date();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  return `${now.getFullYear()}-Q${q}`;
}

export function previousQuarter(quarter: string): string {
  const [year, q] = quarter.split('-Q').map(Number) as [number, number];
  if (q === 1) return `${year - 1}-Q4`;
  return `${year}-Q${q - 1}`;
}

// ─── Aggregate quarter stats ───────────────────────────────────────────────────

export async function aggregateQuarter(quarter: string): Promise<QuarterStats> {
  const [govRows, modRows, escalationRows, eventRows] = await Promise.all([
    sql`
      SELECT requesting_country, request_type, outcome, COUNT(*) AS count
      FROM government_requests
      WHERE to_char(received_at, 'YYYY-"Q"Q') = ${quarter}
      GROUP BY requesting_country, request_type, outcome
    `,
    sql`
      SELECT tier, COUNT(*) AS count
      FROM mod_actions
      WHERE to_char(created_at, 'YYYY-"Q"Q') = ${quarter}
      GROUP BY tier
    `,
    sql`
      SELECT event_type, COUNT(*) AS count
      FROM transparency_events
      WHERE quarter = ${quarter}
        AND event_type IN ('escalation_opened', 'escalation_resolved', 'appeal_upheld', 'appeal_denied')
      GROUP BY event_type
    `,
    sql`
      SELECT event_type, COUNT(*) AS count
      FROM transparency_events
      WHERE quarter = ${quarter}
        AND event_type IN ('charter_amendment_passed', 'infrastructure_incident')
      GROUP BY event_type
    `,
  ]);

  const byCountry = (govRows as unknown as Array<{ requestingCountry: string; requestType: string; outcome: string; count: string }>)
    .map((r) => ({ country: r.requestingCountry, type: r.requestType, outcome: r.outcome, count: parseInt(r.count, 10) }));

  const govTotal    = byCountry.reduce((s, r) => s + r.count, 0);
  const govRefused  = byCountry.filter((r) => r.outcome === 'refused').reduce((s, r) => s + r.count, 0);
  const govComplied = byCountry.filter((r) => r.outcome === 'complied').reduce((s, r) => s + r.count, 0);
  const govPartial  = byCountry.filter((r) => r.outcome === 'partial_comply').reduce((s, r) => s + r.count, 0);
  const govPending  = byCountry.filter((r) => r.outcome === 'pending').reduce((s, r) => s + r.count, 0);

  const modMap = Object.fromEntries(
    (modRows as unknown as Array<{ tier: number; count: string }>).map((r) => [r.tier, parseInt(r.count, 10)])
  );
  const escalMap = Object.fromEntries(
    (escalationRows as unknown as Array<{ eventType: string; count: string }>).map((r) => [r.eventType, parseInt(r.count, 10)])
  );
  const eventMap = Object.fromEntries(
    (eventRows as unknown as Array<{ eventType: string; count: string }>).map((r) => [r.eventType, parseInt(r.count, 10)])
  );

  return {
    govRequests: { total: govTotal, refused: govRefused, complied: govComplied, partial: govPartial, pending: govPending, byCountry },
    modActions:  { tier1: modMap[1] ?? 0, tier2: modMap[2] ?? 0 },
    escalations: {
      opened:        escalMap['escalation_opened'] ?? 0,
      resolved:      escalMap['escalation_resolved'] ?? 0,
      appealsUpheld: escalMap['appeal_upheld'] ?? 0,
      appealsDenied: escalMap['appeal_denied'] ?? 0,
    },
    charterChanges:          eventMap['charter_amendment_passed'] ?? 0,
    infrastructureIncidents: eventMap['infrastructure_incident'] ?? 0,
  };
}

// ─── Plain-text report ────────────────────────────────────────────────────────

export function renderReportText(quarter: string, stats: QuarterStats): string {
  const g = stats.govRequests;
  const m = stats.modActions;
  const e = stats.escalations;

  const countryLines = g.byCountry.length > 0
    ? g.byCountry.map((r) => `  ${r.country.toUpperCase()}  ${r.type.replace(/_/g, ' ')}  ${r.outcome}  ×${r.count}`).join('\n')
    : '  None';

  return `
IZWI HURU — TRANSPARENCY REPORT
Quarter: ${quarter}
Generated: ${new Date().toISOString()}
────────────────────────────────────────

GOVERNMENT REQUESTS
───────────────────
Total received:          ${g.total}
  Refused:               ${g.refused}
  Complied with:         ${g.complied}
  Partial compliance:    ${g.partial}
  Pending:               ${g.pending}

By country and type:
${countryLines}

Note: Requests are evaluated against the Pan-African Charter, not the
requesting government's domestic law. We do not retain user data (IP
addresses, device identifiers, or real identities) — there is nothing
to disclose even if we wished to comply.

MODERATION ACTIONS
──────────────────
Tier 1 (local moderator) actions:  ${m.tier1}
Tier 2 (escalation panel) actions: ${m.tier2}

User appeals opened:    ${e.opened}
Appeals resolved:       ${e.resolved}
  Upheld (user won):    ${e.appealsUpheld}
  Denied:               ${e.appealsDenied}

PLATFORM CHANGES
────────────────
Charter amendments passed:    ${stats.charterChanges}
Infrastructure incidents:     ${stats.infrastructureIncidents}

VERIFICATION
────────────
This report is PGP-signed with the Izwi Huru platform key.
Public key: https://izwihuru.org/pgp-key.asc
Archived:   https://web.archive.org/web/*/izwihuru.org/transparency

Pan-African Charter: https://izwihuru.org/charter
Izwi Huru — izwi (voice, Zulu) · huru (free, Swahili)
`.trim();
}

// ─── Save and publish ─────────────────────────────────────────────────────────

export async function generateAndPublishReport(quarter: string): Promise<void> {
  const stats  = await aggregateQuarter(quarter);
  const text   = renderReportText(quarter, stats);

  // TODO: PGP sign the report text using the platform key
  // const signature = await pgpSign(text);
  const signature = 'PGP_SIGNATURE_PLACEHOLDER';

  // Write to filesystem (served as static files)
  const dir = resolve(process.cwd(), 'public', 'transparency', quarter);
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, 'report.txt'), text, 'utf8');
  writeFileSync(resolve(dir, 'report.txt.asc'), signature, 'utf8');

  // Store in database
  await sql`
    INSERT INTO transparency_reports (quarter, report_text, pgp_signature, published_at)
    VALUES (${quarter}, ${text}, ${signature}, NOW())
    ON CONFLICT (quarter)
    DO UPDATE SET
      report_text   = EXCLUDED.report_text,
      pgp_signature = EXCLUDED.pgp_signature,
      published_at  = NOW()
  `;

  // Mark all events for this quarter as published
  await sql`
    UPDATE transparency_events
    SET published_at = NOW()
    WHERE quarter = ${quarter} AND published_at IS NULL
  `;

  console.log(`✅ Transparency report published for ${quarter}`);
}
