// src/lib/i18n.ts
// Internationalisation setup using svelte-i18n.
// Starting languages: Swahili (sw) and English (en).
// Structured for easy expansion to Hausa, Amharic, Yoruba, Zulu, French, etc.

import { browser } from '$app/environment';
import { init, register, locale, _ } from 'svelte-i18n';

// Register translation loaders (lazy — only loaded when needed)
register('en', () => import('./locales/en.json'));
register('sw', () => import('./locales/sw.json'));

// Supported locale codes
export const SUPPORTED_LOCALES = ['en', 'sw'] as const;
export type SupportedLocale = typeof SUPPORTED_LOCALES[number];

export function setupI18n(preferredLocale?: string) {
  const fallback = 'en';
  const initial = preferredLocale
    ? (SUPPORTED_LOCALES.includes(preferredLocale as SupportedLocale)
        ? preferredLocale
        : fallback)
    : (browser
        ? navigator.language.split('-')[0] ?? fallback
        : fallback);

  init({
    fallbackLocale: fallback,
    initialLocale: initial,
  });
}

export { locale, _ };
