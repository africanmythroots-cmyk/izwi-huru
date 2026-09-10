// src/lib/api.ts
// API client for the mobile app.
// Handles:
//   - Session token storage (expo-secure-store, hardware-backed on Android)
//   - Mirror domain fallback if primary domain is unreachable
//   - Offline post queue (SQLite)

import * as SecureStore from 'expo-secure-store';

// ─── Mirror domain list ────────────────────────────────────────────────────────
// In priority order. App tries each in sequence if the previous fails.
// Updated via a signed manifest fetched from the onion address.
const MIRROR_DOMAINS = [
  'https://izwihuru.org',          // Primary
  'https://izwi-huru.net',         // Mirror 1
  'https://izwihuru.io',           // Mirror 2
  // Onion: requires Orbot/Tor on Android; handled separately
];

let activeDomain = MIRROR_DOMAINS[0]!;
let lastHealthCheck = 0;
const HEALTH_CACHE_MS = 5 * 60 * 1000; // 5 minutes

async function findWorkingDomain(): Promise<string> {
  for (const domain of MIRROR_DOMAINS) {
    try {
      const res = await fetch(`${domain}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        activeDomain = domain;
        lastHealthCheck = Date.now();
        return domain;
      }
    } catch {
      // Try next mirror
    }
  }
  return activeDomain; // Return last known, will fail gracefully
}

export async function getWorkingDomain(forceCheck = false): Promise<string> {
  if (!forceCheck && Date.now() - lastHealthCheck < HEALTH_CACHE_MS) {
    return activeDomain;
  }
  return findWorkingDomain();
}

// ─── Session management ────────────────────────────────────────────────────────

const SESSION_KEY = 'izwi_session_token';

export async function getSessionToken(): Promise<string | null> {
  return SecureStore.getItemAsync(SESSION_KEY);
}

export async function setSessionToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, token);
}

export async function clearSessionToken(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

// ─── Base fetch wrapper ────────────────────────────────────────────────────────

interface FetchOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  requireAuth?: boolean;
}

export async function apiFetch<T>(
  path: string,
  options: FetchOptions = {},
  isRetry = false,
): Promise<{ data: T | null; error: string | null }> {
  const domain = await getWorkingDomain();
  const token = options.requireAuth ? await getSessionToken() : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept':       'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${domain}${path}`, {
      method:  options.method ?? 'GET',
      headers,
      body:    options.body ? JSON.stringify(options.body) : undefined,
      signal:  AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const json = await res.json().catch(() => ({})) as { error?: string };
      return { data: null, error: json.error ?? `HTTP ${res.status}` };
    }

    const data = await res.json() as T;
    return { data, error: null };
  } catch (err) {
    // If network error occurred and we haven't retried yet, trigger failover
    if (!isRetry) {
      const prevDomain = domain;
      const nextDomain = await findWorkingDomain();
      if (nextDomain !== prevDomain) {
        return apiFetch<T>(path, options, true);
      }
    }
    const message = err instanceof Error ? err.message : 'Network error';
    return { data: null, error: message };
  }
}
