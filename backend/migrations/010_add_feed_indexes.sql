-- Migration: 010_add_feed_indexes.sql
-- Optimizes chronological feed and trust-weighted trending queries.

-- 1. Index for root posts in the global feed (when not filtering by space)
CREATE INDEX IF NOT EXISTS idx_posts_global_feed
  ON posts (created_at DESC)
  WHERE visibility = 'public' AND parent_id IS NULL AND deleted_at IS NULL;

-- 2. Index for fast lookup of unresolved serious flags during trending feed calculation
CREATE INDEX IF NOT EXISTS idx_flags_serious_unresolved
  ON flags (post_id, reason)
  WHERE resolved_at IS NULL;
