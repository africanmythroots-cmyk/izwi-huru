// src/screens/ThreadScreen.tsx
// Thread view for mobile: root post, reply box with offline queue, and reply list.

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { apiFetch } from '../lib/api';
import { queueDraft } from '../lib/cache';

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

interface ThreadScreenProps {
  postId: string;
  onBack: () => void;
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#f8f7f4' },
  header:       {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eeede8',
    backgroundColor: '#fff',
  },
  backBtn:      { minWidth: 44, minHeight: 44, justifyContent: 'center' },
  backBtnText:  { color: '#f28210', fontSize: 16, fontWeight: '600' },
  headerTitle:  { fontSize: 17, fontWeight: '700', color: '#1a1714', marginLeft: 12 },
  rootPost:     {
    backgroundColor: '#fff', padding: 16, borderBottomWidth: 1,
    borderBottomColor: '#eeede8',
  },
  metaRow:      { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 6 },
  handle:       { fontWeight: '700', fontSize: 14, color: '#1a1714' },
  badge:        { fontSize: 11, color: '#78716c', backgroundColor: '#f0ede8', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 100 },
  time:         { fontSize: 12, color: '#a8a39d', marginLeft: 'auto' },
  bodyText:     { fontSize: 15, lineHeight: 24, color: '#292520', marginBottom: 14 },
  actionsRow:   { flexDirection: 'row', alignItems: 'center', gap: 16 },
  actionBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, minWidth: 44 },
  actionText:   { fontSize: 13, color: '#78716c' },
  repliesHeader:{ paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#f0ede8' },
  repliesTitle: { fontSize: 12, fontWeight: '700', color: '#78716c', textTransform: 'uppercase' },
  replyItem:    {
    backgroundColor: '#fff', padding: 14, borderBottomWidth: 1,
    borderBottomColor: '#eeede8',
  },
  replyHandle:  { fontWeight: '600', fontSize: 13, color: '#292520' },
  replyBody:    { fontSize: 14, lineHeight: 20, color: '#292520', marginTop: 4 },
  emptyReplies: { padding: 32, alignItems: 'center' },
  emptyText:    { color: '#a8a39d', fontSize: 14 },
  inputContainer:{
    padding: 12, backgroundColor: '#fff', borderTopWidth: 1,
    borderTopColor: '#eeede8', flexDirection: 'row', alignItems: 'flex-end', gap: 8,
  },
  textInput:    {
    flex: 1, minHeight: 44, maxHeight: 120, borderWidth: 1,
    borderColor: '#dedad0', borderRadius: 20, paddingHorizontal: 14,
    paddingVertical: 10, fontSize: 14, backgroundColor: '#f8f7f4',
  },
  sendBtn:      {
    backgroundColor: '#f28210', borderRadius: 100, minWidth: 44,
    minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 14,
  },
  sendBtnText:  { color: '#fff', fontWeight: '700', fontSize: 14 },
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

export default function ThreadScreen({ postId, onBack }: ThreadScreenProps) {
  const [rootPost, setRootPost] = useState<Post | null>(null);
  const [replies, setReplies] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyBody, setReplyBody] = useState('');
  const [sending, setSending] = useState(false);

  const fetchThread = useCallback(async () => {
    const [postRes, repliesRes] = await Promise.all([
      apiFetch<{ post: Post }>(`/posts/${postId}`, { requireAuth: true }),
      apiFetch<{ replies: Post[] }>(`/posts/${postId}/replies`, { requireAuth: true }),
    ]);

    if (postRes.data?.post) setRootPost(postRes.data.post);
    if (repliesRes.data?.replies) setReplies(repliesRes.data.replies);
  }, [postId]);

  useEffect(() => {
    fetchThread().finally(() => setLoading(false));
  }, [fetchThread]);

  async function handleSendReply() {
    const text = replyBody.trim();
    if (!text || sending) return;
    setSending(true);

    try {
      const { data, error } = await apiFetch<{ post: Post }>('/posts', {
        method: 'POST',
        body: { body: text, parentId: postId },
        requireAuth: true,
      });

      if (error || !data) {
        // Queue draft offline
        await queueDraft({ parentId: postId, body: text });
        Alert.alert('Queued', 'You are offline. Your reply will send when reconnected.');
      } else {
        setReplies((prev) => [...prev, data.post]);
        if (rootPost) setRootPost({ ...rootPost, replyCount: rootPost.replyCount + 1 });
      }
      setReplyBody('');
    } catch {
      await queueDraft({ parentId: postId, body: text });
      Alert.alert('Queued', 'Reply saved to send when connectivity returns.');
      setReplyBody('');
    } finally {
      setSending(false);
    }
  }

  async function voteRoot(value: 1 | -1) {
    if (!rootPost) return;
    await apiFetch(`/posts/${rootPost.id}/vote`, { method: 'POST', body: { value }, requireAuth: true });
    setRootPost({ ...rootPost, voteScore: rootPost.voteScore + value });
  }

  async function amplifyRoot() {
    if (!rootPost) return;
    await apiFetch(`/posts/${rootPost.id}/amplify`, { method: 'POST', requireAuth: true });
    setRootPost({ ...rootPost, amplifyCount: rootPost.amplifyCount + 1 });
  }

  if (loading) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#f28210" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={onBack} accessibilityLabel="Back to feed">
          <Text style={s.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Thread</Text>
      </View>

      <FlatList
        data={replies}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          rootPost ? (
            <View>
              <View style={s.rootPost}>
                <View style={s.metaRow}>
                  <Text style={s.handle}>@{rootPost.author.handle}</Text>
                  {rootPost.spaceSlug && <Text style={s.badge}>#{rootPost.spaceSlug}</Text>}
                  <Text style={s.time}>{relTime(rootPost.createdAt)}</Text>
                </View>

                <Text style={s.bodyText}>{rootPost.body}</Text>

                <View style={s.actionsRow}>
                  <TouchableOpacity style={s.actionBtn} onPress={() => voteRoot(1)} accessibilityLabel="Upvote">
                    <Text style={s.actionText}>▲ {rootPost.voteScore}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.actionBtn} onPress={() => voteRoot(-1)} accessibilityLabel="Downvote">
                    <Text style={s.actionText}>▼</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.actionBtn} onPress={amplifyRoot} accessibilityLabel="Amplify">
                    <Text style={s.actionText}>⟳ {rootPost.amplifyCount}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={s.repliesHeader}>
                <Text style={s.repliesTitle}>Replies ({replies.length})</Text>
              </View>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={s.replyItem}>
            <View style={s.metaRow}>
              <Text style={s.replyHandle}>@{item.author.handle}</Text>
              <Text style={s.time}>{relTime(item.createdAt)}</Text>
            </View>
            <Text style={s.replyBody}>{item.body}</Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={s.emptyReplies}>
            <Text style={s.emptyText}>No replies yet. Be the first to speak.</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 24 }}
      />

      <View style={s.inputContainer}>
        <TextInput
          style={s.textInput}
          value={replyBody}
          onChangeText={setReplyBody}
          placeholder="Reply freely…"
          placeholderTextColor="#a8a39d"
          multiline
          maxLength={5000}
        />
        <TouchableOpacity
          style={[s.sendBtn, (!replyBody.trim() || sending) && { opacity: 0.5 }]}
          onPress={handleSendReply}
          disabled={!replyBody.trim() || sending}
          accessibilityLabel="Send reply"
        >
          {sending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={s.sendBtnText}>Reply</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
