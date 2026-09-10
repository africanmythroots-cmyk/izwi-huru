// App.tsx
// Main entry point for the Izwi Huru mobile application.

import React, { useState, useEffect, useCallback } from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import AuthScreen from './src/screens/AuthScreen';
import FeedScreen from './src/screens/FeedScreen';
import ThreadScreen from './src/screens/ThreadScreen';
import { getSessionToken, clearSessionToken, apiFetch } from './src/lib/api';
import { getPendingDrafts, markDraftSent } from './src/lib/cache';

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f7f4' },
  topNav: {
    height: 52, backgroundColor: '#fff', flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#eeede8',
  },
  brand: { fontSize: 18, fontWeight: '800', color: '#f28210' },
  navActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  handleText: { fontSize: 13, fontWeight: '600', color: '#6b6660' },
  logoutBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, backgroundColor: '#f0ede8' },
  logoutText: { fontSize: 12, color: '#dc2626', fontWeight: '600' },
});

export default function App() {
  const [sessionUser, setSessionUser] = useState<string | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Check existing session
  useEffect(() => {
    async function initAuth() {
      try {
        const token = await getSessionToken();
        if (token) {
          // Verify with a lightweight check
          const { data } = await apiFetch<{ handle: string }>('/users/me', { requireAuth: true });
          if (data?.handle) {
            setSessionUser(data.handle);
          }
        }
      } catch {
        // Fallback: stay on auth or allow offline access
      } finally {
        setCheckingAuth(false);
      }
    }
    initAuth();
  }, []);

  // Background queue flusher when online
  const flushDraftQueue = useCallback(async () => {
    try {
      const drafts = await getPendingDrafts();
      for (const draft of drafts) {
        const { error } = await apiFetch('/posts', {
          method: 'POST',
          body: {
            body: draft.body,
            spaceId: draft.spaceId ?? undefined,
            parentId: draft.parentId ?? undefined,
          },
          requireAuth: true,
        });
        if (!error) {
          await markDraftSent(draft.id);
        }
      }
    } catch {
      // Retried on next trigger
    }
  }, []);

  useEffect(() => {
    if (sessionUser) {
      flushDraftQueue();
      const interval = setInterval(flushDraftQueue, 30_000);
      return () => clearInterval(interval);
    }
  }, [sessionUser, flushDraftQueue]);

  async function handleLogout() {
    await apiFetch('/auth/logout', { method: 'POST' });
    await clearSessionToken();
    setSessionUser(null);
    setActiveThreadId(null);
  }

  if (checkingAuth) {
    return (
      <SafeAreaView style={s.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8f7f4" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f7f4" />

      {sessionUser && (
        <View style={s.topNav}>
          <Text style={s.brand}>Izwi Huru</Text>
          <View style={s.navActions}>
            <Text style={s.handleText}>@{sessionUser}</Text>
            <TouchableOpacity onPress={handleLogout} style={s.logoutBtn} accessibilityLabel="Log out">
              <Text style={s.logoutText}>Exit</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!sessionUser ? (
        <AuthScreen onSuccess={(handle) => setSessionUser(handle)} />
      ) : activeThreadId ? (
        <ThreadScreen
          postId={activeThreadId}
          onBack={() => setActiveThreadId(null)}
        />
      ) : (
        <FeedScreen
          onOpenThread={(postId) => setActiveThreadId(postId)}
        />
      )}
    </SafeAreaView>
  );
}
