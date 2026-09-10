-- Migration: 008_alter_users_add_auth_columns.sql
-- Adds columns referenced in auth/routes.ts and moderation/routes.ts
-- that were missing from the initial migration.

ALTER TABLE users
  -- SHA-256 hash of the recovery token derived from the user's BIP39 mnemonic.
  -- NULL if user chose not to generate a recovery phrase.
  -- The mnemonic itself is NEVER stored server-side.
  ADD COLUMN IF NOT EXISTS recovery_token_hash TEXT,

  -- Panel moderator flag. Tier 2 moderators are set TRUE here by an admin.
  -- Future: move to a separate roles table with term-limit tracking.
  ADD COLUMN IF NOT EXISTS is_panel_mod BOOLEAN NOT NULL DEFAULT FALSE,

  -- Suspension expiry (nullable — permanent suspension has no expiry)
  -- Already referenced in migration 001 as suspension_until; confirmed consistent.
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

-- Index for efficient panel mod lookup
CREATE INDEX IF NOT EXISTS idx_users_panel_mod ON users (is_panel_mod) WHERE is_panel_mod = TRUE;
