-- Migration: 005_create_interactions.sql
-- Votes, amplifications, and flags.

-- VOTES: +1 or -1 per user per post
CREATE TABLE votes (
  post_id    UUID        NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  voter_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  value      SMALLINT    NOT NULL CHECK (value IN (1, -1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, voter_id)
);

CREATE INDEX idx_votes_post ON votes (post_id);
CREATE INDEX idx_votes_voter ON votes (voter_id);

-- AMPLIFICATIONS: "share without authorship" mechanic
-- Amplifying a post signals solidarity without attaching your handle to the content
CREATE TABLE amplifications (
  post_id       UUID        NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  amplifier_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, amplifier_id)
);

CREATE INDEX idx_amplifications_post     ON amplifications (post_id);
CREATE INDEX idx_amplifications_amplifier ON amplifications (amplifier_id);

-- FLAGS: user-reported content
CREATE TYPE flag_reason AS ENUM (
  'doxxing',
  'incitement',
  'hate_speech',
  'threat',
  'harassment',
  'non_consensual_intimate',
  'coordinated_inauthenticity',
  'other'
);

CREATE TABLE flags (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id     UUID        NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  flagger_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason      flag_reason NOT NULL,
  -- Optional short description (not required, never shown publicly)
  detail      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Resolved once a moderator has acted (or dismissed)
  resolved_at TIMESTAMPTZ,
  resolved_by UUID        REFERENCES users(id),
  -- Was the flag upheld or dismissed?
  resolution  TEXT
);

CREATE INDEX idx_flags_post       ON flags (post_id);
CREATE INDEX idx_flags_unresolved ON flags (post_id) WHERE resolved_at IS NULL;
