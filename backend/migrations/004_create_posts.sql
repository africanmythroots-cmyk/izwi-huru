-- Migration: 004_create_posts.sql
-- Posts are threaded: parent_id NULL = top-level post; parent_id set = reply.
-- body is stored encrypted using pgcrypto symmetric encryption.
-- The encryption key is managed server-side (upgrade path: per-user client keys).

CREATE TYPE post_visibility AS ENUM ('public', 'space_only', 'removed', 'pending_review');

CREATE TABLE posts (
  id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id        UUID            NOT NULL REFERENCES spaces(id),
  author_id       UUID            NOT NULL REFERENCES users(id),
  -- Threaded structure: NULL = root post, set = reply
  parent_id       UUID            REFERENCES posts(id),
  -- Thread root denormalised for efficient thread fetching
  thread_root_id  UUID            REFERENCES posts(id),
  -- Body encrypted at rest. Decrypt at query layer using server key.
  body_encrypted  BYTEA           NOT NULL,
  -- Plain-text body length for display (no content exposure)
  body_length     INT             NOT NULL DEFAULT 0,
  visibility      post_visibility NOT NULL DEFAULT 'public',
  -- Cached counts (updated by triggers / background jobs)
  reply_count     INT             NOT NULL DEFAULT 0,
  vote_score      INT             NOT NULL DEFAULT 0,
  amplify_count   INT             NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  -- Soft-delete timestamp (content may be needed for audit trail)
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_posts_space_created   ON posts (space_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_posts_author          ON posts (author_id);
CREATE INDEX idx_posts_parent          ON posts (parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_posts_thread_root     ON posts (thread_root_id) WHERE thread_root_id IS NOT NULL;
CREATE INDEX idx_posts_visibility      ON posts (visibility);
-- Trending feed index: score + time for efficient ordering
CREATE INDEX idx_posts_trending        ON posts (space_id, vote_score DESC, created_at DESC)
  WHERE visibility = 'public' AND deleted_at IS NULL;
