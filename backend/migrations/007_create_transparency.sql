-- Migration: 007_create_transparency.sql
-- Transparency events feed the quarterly public report.

CREATE TYPE transparency_event_type AS ENUM (
  'gov_request_received',
  'gov_request_resolved',
  'mod_action_tier1',
  'mod_action_tier2',
  'escalation_opened',
  'escalation_resolved',
  'appeal_upheld',
  'appeal_denied',
  'charter_amendment_proposed',
  'charter_amendment_passed',
  'infrastructure_incident',  -- Domain blocked, server pressure, etc.
  'funding_disclosure'
);

CREATE TABLE transparency_events (
  id           UUID                      PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type   transparency_event_type   NOT NULL,
  -- Reference to the underlying record (gov request, mod action, etc.)
  reference_id UUID,
  -- Quarter this event will appear in (YYYY-QN, e.g. "2026-Q4")
  quarter      TEXT                      NOT NULL,
  -- Public-safe summary (no identifying info about users)
  summary      TEXT                      NOT NULL,
  -- Country code if relevant (for aggregation in reports)
  country_code CHAR(2),
  created_at   TIMESTAMPTZ               NOT NULL DEFAULT NOW(),
  -- When the event was included in a published report
  published_at TIMESTAMPTZ
);

CREATE INDEX idx_transparency_quarter    ON transparency_events (quarter);
CREATE INDEX idx_transparency_type       ON transparency_events (event_type);
CREATE INDEX idx_transparency_published  ON transparency_events (published_at) WHERE published_at IS NOT NULL;

-- Transparency reports (the published quarterly documents)
CREATE TABLE transparency_reports (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  quarter       TEXT        NOT NULL UNIQUE,   -- e.g. "2026-Q4"
  -- The generated report stored as static text (also written to filesystem)
  report_text   TEXT        NOT NULL,
  report_html   TEXT,
  -- PGP signature of the report text
  pgp_signature TEXT,
  published_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
