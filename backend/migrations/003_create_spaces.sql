-- Migration: 003_create_spaces.sql
-- Spaces are country/language communities (e.g., "Kenya — Swahili",
-- "Nigeria — Igbo", "Pan-African — English").
-- country_scope is nullable: NULL means pan-African (no single country scope).

CREATE TABLE spaces (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug           TEXT        NOT NULL UNIQUE,        -- e.g. "ke-sw", "pan-en"
  name           TEXT        NOT NULL,               -- e.g. "Kenya · Kiswahili"
  description    TEXT,
  language_code  TEXT        NOT NULL,               -- BCP-47, e.g. "sw", "en", "ha"
  -- NULL = pan-African scope; ISO 3166-1 alpha-2 if country-specific
  country_scope  CHAR(2),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_archived    BOOLEAN     NOT NULL DEFAULT FALSE
);

-- Space membership (following)
CREATE TABLE space_memberships (
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  space_id   UUID        NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, space_id)
);

CREATE INDEX idx_space_memberships_user  ON space_memberships (user_id);
CREATE INDEX idx_space_memberships_space ON space_memberships (space_id);

-- Moderator assignments: local mods are space-scoped
CREATE TABLE space_moderators (
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  space_id   UUID        NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by UUID        REFERENCES users(id),
  PRIMARY KEY (user_id, space_id)
);
