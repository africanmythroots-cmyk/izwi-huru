-- Migration: 006_create_moderation.sql
-- Moderation actions, escalations, and government request log.

-- MODERATION ACTIONS: every action must cite a Charter clause
CREATE TYPE mod_action_type AS ENUM (
  'content_warning',     -- Adds a content warning label
  'queue_for_review',    -- Moves post to pending_review visibility
  'lock_thread',         -- Prevents new replies to a thread
  'remove_post',         -- Panel-only: sets visibility=removed
  'suspend_user',        -- Panel-only
  'unsuspend_user',      -- Panel-only
  'dismiss_flag',        -- Flag was reviewed and dismissed
  'overturn_action'      -- Appeal upheld, previous action reversed
);

CREATE TABLE mod_actions (
  id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  moderator_id    UUID            NOT NULL REFERENCES users(id),
  -- The post or user acted on (one must be set)
  post_id         UUID            REFERENCES posts(id),
  target_user_id  UUID            REFERENCES users(id),
  action          mod_action_type NOT NULL,
  -- Must cite the Charter clause justifying this action
  charter_clause  TEXT            NOT NULL,  -- e.g. "§3.1 Doxxing"
  -- Free-text rationale (internal, not shown publicly without redaction)
  rationale       TEXT,
  -- Was this a Tier 1 (local) or Tier 2 (panel) action?
  tier            SMALLINT        NOT NULL CHECK (tier IN (1, 2)),
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mod_actions_post      ON mod_actions (post_id) WHERE post_id IS NOT NULL;
CREATE INDEX idx_mod_actions_user      ON mod_actions (target_user_id) WHERE target_user_id IS NOT NULL;
CREATE INDEX idx_mod_actions_moderator ON mod_actions (moderator_id);

-- ESCALATIONS: Tier 1 actions escalated to the panel (by user appeal or moderator)
CREATE TYPE escalation_status AS ENUM ('pending', 'under_review', 'resolved');

CREATE TABLE escalations (
  id              UUID               PRIMARY KEY DEFAULT uuid_generate_v4(),
  mod_action_id   UUID               NOT NULL REFERENCES mod_actions(id),
  -- Who raised this escalation (user appeal or mod self-escalation)
  raised_by       UUID               NOT NULL REFERENCES users(id),
  -- Reason for escalation (user-provided appeal text, anonymised in log)
  reason          TEXT,
  status          escalation_status  NOT NULL DEFAULT 'pending',
  -- Panel members assigned to this escalation
  panel_member_ids UUID[]            NOT NULL DEFAULT '{}',
  resolution      TEXT,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_escalations_status ON escalations (status);
CREATE INDEX idx_escalations_action ON escalations (mod_action_id);

-- GOVERNMENT REQUEST LOG: all requests logged regardless of outcome
CREATE TYPE gov_request_type AS ENUM (
  'content_removal',
  'user_data_disclosure',
  'identity_disclosure',
  'account_suspension',
  'other'
);

CREATE TYPE gov_request_outcome AS ENUM (
  'refused',           -- Refused in full
  'partial_comply',    -- Complied with part (must explain in notes)
  'complied',          -- Complied (only if content also violates Charter)
  'pending'
);

CREATE TABLE government_requests (
  id               UUID                 PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- ISO 3166-1 alpha-2 requesting country
  requesting_country CHAR(2)            NOT NULL,
  request_type     gov_request_type     NOT NULL,
  received_at      TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
  -- Reference to the post or user targeted (nullable — may be vague)
  target_post_id   UUID                 REFERENCES posts(id),
  target_user_id   UUID                 REFERENCES users(id),
  outcome          gov_request_outcome  NOT NULL DEFAULT 'pending',
  -- Legal basis for refusal or rationale for compliance
  notes            TEXT,
  -- Was the user notified? Was notification withheld by court order?
  user_notified    BOOLEAN,
  notification_withheld_reason TEXT,
  resolved_at      TIMESTAMPTZ
);

CREATE INDEX idx_gov_requests_country ON government_requests (requesting_country);
CREATE INDEX idx_gov_requests_outcome ON government_requests (outcome);
