// src/screens/FeedScreen.tsx
// Chronological feed: loads from API, caches to SQLite, shows offline if needed.

import React, { useEffect, useState, useCallback } from 'react';
import {
  FlatList, View, Text, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { apiFetch } from '../lib/api';
import { cacheFeed, getCachedFeed } from '../lib/cache';

interface Post {
  id: string;
  spaceSlug?: string;
  author: { handle: string };
  body: string;
  replyCount: number;
  voteScore: number;
  amplifyCount: number;
  createdAt: string;
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#f8f7f4' },
  header:      { padding: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#eeede8' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1a1714' },
  offline:     { fontSize: 12, color: '#f28210', marginTop: 2 },
  postCard:    {
    backgroundColor: '#fff', marginHorizontal: 12, marginTop: 10,
    borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#eeede8',
  },
  postMeta:    { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 },
  handle:      { fontWeight: '600', fontSize: 13, color: '#292520' },
  spaceBadge:  { fontSize: 11, color: '#78716c', backgroundColor: '#f0ede8', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 100 },
  time:        { fontSize: 11, color: '#a8a39d', marginLeft: 'auto' },
  body:        { fontSize: 14, lineHeight: 22, color: '#292520' },
  actions:     { flexDirection: 'row', marginTop: 12, gap: 16 },
  actionBtn:   { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, minWidth: 44, paddingRight: 8 },
  actionText:  { fontSize: 13, color: '#78716c' },
  loadMore:    { margin: 16, padding: 14, alignItems: 'center', borderRadius: 100, borderWidth: 1, borderColor: '#f28210', minHeight: 48 },
  loadMoreText:{ color: '#f28210', fontWeight: '600' },
  empty:       { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyText:   { color: '#a8a39d', fontSize: 15 },
});

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

interface PostCardProps { post: Post; onPress: () => void }

function PostCard({ post, onPress }: PostCardProps) {
  const [score, setScore] = useState(post.voteScore);
  const [amplified, setAmplified] = useState(post.amplifyCount);

  async function vote(value: 1 | -1) {
    await apiFetch(`/posts/${post.id}/vote`, { method: 'POST', body: { value }, requireAuth: true });
    setScore((s) => s + value);
  }

  async function amplify() {
    await apiFetch(`/posts/${post.id}/amplify`, { method: 'POST', requireAuth: true });
    setAmplified((a) => a + 1);
  }

  return (
    <View style={s.postCard} accessibilityRole="article" accessibilityLabel={`Post by ${post.author.handle}`}>
      <View style={s.postMeta}>
        <Text style={s.handle}>@{post.author.handle}</Text>
        {post.spaceSlug && <Text style={s.spaceBadge}>{post.spaceSlug}</Text>}
        <Text style={s.time}>{relTime(post.createdAt)}</Text>
      </View>

      <TouchableOpacity onPress={onPress} accessibilityRole="link" accessibilityLabel="Open thread">
        <Text style={s.body}>{post.body}</Text>
      </TouchableOpacity>

      <View style={s.actions}>
        {/* Vote */}
        <TouchableOpacity style={s.actionBtn} onPress={() => vote(1)} accessibilityLabel="Upvote">
          <Text style={s.actionText}>▲ {score}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.actionBtn} onPress={() => vote(-1)} accessibilityLabel="Downvote">
          <Text style={s.actionText}>▼</Text>
        </TouchableOpacity>

        {/* Replies */}
        <TouchableOpacity style={s.actionBtn} onPress={onPress} accessibilityLabel={`${post.replyCount} replies`}>
          <Text style={s.actionText}>💬 {post.replyCount}</Text>
        </TouchableOpacity>

        {/* Amplify */}
        <TouchableOpacity style={s.actionBtn} onPress={amplify} accessibilityLabel={`Amplify, ${amplified} times`}>
          <Text style={s.actionText}>⟳ {amplified}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

interface Props { onOpenThread: (postId: string) => void }

export default function FeedScreen({ onOpenThread }: Props) {
  const [posts, setPosts]         = useState<Post[]>([]);
  const [nextCursor, setNext]     = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offline, setOffline]     = useState(false);

  const load = useCallback(async (cursor?: string) => {
    const path = cursor ? `/feed?cursor=${cursor}` : '/feed';
    const { data, error } = await apiFetch<{ feed: Post[]; nextCursor: string | null }>(path, { requireAuth: true });

    if (error || !data) {
      // Fall back to SQLite cache
      const cached = await getCachedFeed();
      if (cached.length > 0) { setPosts(cached); setOffline(true); }
      return;
    }

    setOffline(false);
    if (cursor) {
      setPosts((prev) => [...prev, ...data.feed]);
    } else {
      setPosts(data.feed);
      await cacheFeed(data.feed); // persist to SQLite
    }
    setNext(data.nextCursor);
  }, []);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    await load(nextCursor);
    setLoadingMore(false);
  }

  if (loading) {
    return <View style={[s.container, s.empty]}><ActivityIndicator size="large" color="#f28210" /></View>;
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Feed</Text>
        {offline && <Text style={s.offline}>Showing cached content — you're offline</Text>}
      </View>

      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <PostCard post={item} onPress={() => onOpenThread(item.id)} />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#f28210" />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyText}>Follow some spaces to see posts here.</Text>
          </View>
        }
        ListFooterComponent={
          nextCursor ? (
            <TouchableOpacity style={s.loadMore} onPress={loadMore} disabled={loadingMore} accessibilityRole="button">
              {loadingMore
                ? <ActivityIndicator color="#f28210" />
                : <Text style={s.loadMoreText}>Load more</Text>}
            </TouchableOpacity>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: 32 }}
        removeClippedSubviews
        maxToRenderPerBatch={10}
        windowSize={5}
      />
    </View>
  );
}
