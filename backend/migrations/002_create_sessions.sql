-- Migration: 002_create_sessions.sql
-- Sessions store only a HASH of the token, never the raw token.
-- No IP address, no device ID, no user-agent stored.

CREATE TABLE sessions (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Only the SHA-256 hash of the session token is stored.
  -- The raw token is sent to the client and never stored server-side.
  token_hash   TEXT        NOT NULL UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  -- last_seen helps detect stale sessions for cleanup — no IP stored
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id  ON sessions (user_id);
CREATE INDEX idx_sessions_token_hash ON sessions (token_hash);
CREATE INDEX idx_sessions_expires_at ON sessions (expires_at);

-- Cleanup job should run daily: DELETE FROM sessions WHERE expires_at < NOW()
