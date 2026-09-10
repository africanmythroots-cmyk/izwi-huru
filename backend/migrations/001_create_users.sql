-- Migration: 001_create_users.sql
-- Privacy design: No email, no phone, no IP, no device_id.
-- Only a pseudonym and a hashed passphrase.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  handle           TEXT        NOT NULL UNIQUE,
  -- Diceware passphrase stored as bcrypt hash (cost factor 12+)
  passphrase_hash  TEXT        NOT NULL,
  -- Trust-weighted reputation; starts at 1.0
  reputation       NUMERIC(8,4) NOT NULL DEFAULT 1.0,
  -- Soft-delete: suspended accounts are not deleted (audit trail)
  is_suspended     BOOLEAN     NOT NULL DEFAULT FALSE,
  suspension_until TIMESTAMPTZ,
  -- Timestamps. No IP, no email, no phone, no country, no location.
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Handle lookup is the primary query path
CREATE UNIQUE INDEX idx_users_handle ON users (handle);

-- Comment: handle is case-insensitively unique in practice.
-- Enforce at application layer: store handles in lowercase only.
