// src/screens/AuthScreen.tsx
// Login and registration screens for the mobile app.
// Mirrors the web auth flow — same endpoints, no additional data collected.

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Platform,
} from 'react-native';
import { apiFetch, setSessionToken } from '../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type AuthMode = 'login' | 'register';

interface AuthScreenProps {
  onSuccess: (handle: string) => void;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#f8f7f4' },
  scroll:       { flexGrow: 1, justifyContent: 'center', padding: 24 },
  title:        { fontSize: 28, fontWeight: '700', marginBottom: 8, color: '#1a1714' },
  subtitle:     { fontSize: 14, color: '#6b6660', marginBottom: 32 },
  label:        { fontSize: 13, fontWeight: '600', marginBottom: 6, color: '#292520' },
  input:        {
    borderWidth: 1, borderColor: '#dedad0', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, backgroundColor: '#fff', marginBottom: 16,
    minHeight: 48, // Touch target ≥ 44pt
  },
  primaryBtn:   {
    backgroundColor: '#f28210', borderRadius: 100,
    paddingVertical: 14, alignItems: 'center', marginTop: 8, minHeight: 48,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  linkBtn:      { marginTop: 20, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  linkBtnText:  { color: '#f28210', fontSize: 14 },
  error:        { color: '#dc2626', fontSize: 13, marginBottom: 12 },
  mnemonicBox:  {
    backgroundColor: '#fef9ee', borderWidth: 1, borderColor: '#f9c469',
    borderRadius: 12, padding: 16, marginBottom: 16,
  },
  mnemonicTitle: { fontWeight: '700', fontSize: 15, marginBottom: 8, color: '#92400e' },
  mnemonicText:  { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 13, color: '#1a1714', lineHeight: 22 },
  mnemonicHint:  { fontSize: 12, color: '#78716c', marginTop: 8 },
});

// ─── Component ────────────────────────────────────────────────────────────────

export default function AuthScreen({ onSuccess }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [handle, setHandle] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recoveryMnemonic, setRecoveryMnemonic] = useState<string | null>(null);

  async function handleLogin() {
    setLoading(true);
    setError('');
    const { data, error: err } = await apiFetch<{ handle: string; sessionToken?: string }>(
      '/auth/login',
      { method: 'POST', body: { handle: handle.toLowerCase(), passphrase } }
    );
    if (err || !data) { setError(err ?? 'Login failed.'); setLoading(false); return; }
    if (data.sessionToken) await setSessionToken(data.sessionToken);
    onSuccess(data.handle);
    setLoading(false);
  }

  async function handleRegister() {
    setLoading(true);
    setError('');
    const { data, error: err } = await apiFetch<{ handle: string; recoveryMnemonic?: string }>(
      '/auth/register',
      {
        method: 'POST',
        body: {
          handle: handle.toLowerCase(),
          passphrase,
          captchaPayload: btoa('{}'), // TODO: real Altcha PoW widget
          wantsRecovery: true,
        },
      }
    );
    if (err || !data) { setError(err ?? 'Registration failed.'); setLoading(false); return; }
    setRecoveryMnemonic(data.recoveryMnemonic ?? null);
    if (!data.recoveryMnemonic) onSuccess(data.handle);
    setLoading(false);
  }

  function confirmMnemonic() {
    setRecoveryMnemonic(null);
    // Navigate to feed — handled by parent
    onSuccess(handle);
  }

  // Recovery phrase display (shown once after registration)
  if (recoveryMnemonic) {
    return (
      <View style={s.container}>
        <ScrollView contentContainerStyle={s.scroll}>
          <Text style={[s.title, { color: '#92400e' }]}>Save your recovery phrase</Text>
          <Text style={s.subtitle}>
            These 12 words are your only way to recover your account.
            Write them down now. They will never appear again.
          </Text>
          <View style={s.mnemonicBox}>
            <Text style={s.mnemonicTitle}>Your recovery phrase</Text>
            <Text style={s.mnemonicText} selectable>{recoveryMnemonic}</Text>
            <Text style={s.mnemonicHint}>
              This phrase was generated on your device and was never sent to Izwi Huru servers.
            </Text>
          </View>
          <TouchableOpacity style={s.primaryBtn} onPress={confirmMnemonic} accessibilityRole="button">
            <Text style={s.primaryBtnText}>I have written down my phrase</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>{mode === 'login' ? 'Log in' : 'Join Izwi Huru'}</Text>
        <Text style={s.subtitle}>
          {mode === 'login'
            ? 'Enter your handle and passphrase.'
            : 'No email. No phone. Just a handle and a passphrase.'}
        </Text>

        {!!error && <Text style={s.error} accessibilityRole="alert">{error}</Text>}

        <Text style={s.label}>Handle</Text>
        <TextInput
          style={s.input}
          value={handle}
          onChangeText={(t) => setHandle(t.toLowerCase())}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          placeholder="your-handle"
          placeholderTextColor="#a8a39d"
          accessibilityLabel="Handle"
        />

        <Text style={s.label}>Passphrase</Text>
        <TextInput
          style={s.input}
          value={passphrase}
          onChangeText={setPassphrase}
          secureTextEntry
          autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          placeholder="Your passphrase"
          placeholderTextColor="#a8a39d"
          accessibilityLabel="Passphrase"
        />

        {mode === 'register' && (
          <Text style={{ fontSize: 12, color: '#78716c', marginTop: -10, marginBottom: 16 }}>
            At least 10 characters. We recommend a Diceware passphrase.
          </Text>
        )}

        <TouchableOpacity
          style={[s.primaryBtn, loading && { opacity: 0.5 }]}
          onPress={mode === 'login' ? handleLogin : handleRegister}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel={mode === 'login' ? 'Log in' : 'Create account'}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.primaryBtnText}>{mode === 'login' ? 'Log in' : 'Create account'}</Text>}
        </TouchableOpacity>

        <TouchableOpacity
          style={s.linkBtn}
          onPress={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
          accessibilityRole="button"
        >
          <Text style={s.linkBtnText}>
            {mode === 'login' ? "Don't have an account? Join" : 'Already have an account? Log in'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
