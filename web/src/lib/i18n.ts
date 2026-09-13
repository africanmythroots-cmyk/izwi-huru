// src/lib/i18n.ts
// Internationalisation setup using svelte-i18n.
// Synchronous message loading ensures SSR and client never fail with uninitialised locale errors.

import { browser } from '$app/environment';
import { init, addMessages, locale, _ } from 'svelte-i18n';
import en from './locales/en.json';
import sw from './locales/sw.json';

addMessages('en', en);
addMessages('sw', sw);

// Supported locale codes
export const SUPPORTED_LOCALES = ['en', 'sw'] as const;
export type SupportedLocale = typeof SUPPORTED_LOCALES[number];

export function setupI18n(preferredLocale?: string) {
  const fallback = 'en';
  let initial = fallback;

  if (preferredLocale && SUPPORTED_LOCALES.includes(preferredLocale as SupportedLocale)) {
    initial = preferredLocale;
  } else if (browser) {
    const lang = navigator.language?.split('-')[0] ?? fallback;
    initial = SUPPORTED_LOCALES.includes(lang as SupportedLocale) ? lang : fallback;
  }

  init({
    fallbackLocale: fallback,
    initialLocale: initial,
  });
}

setupI18n('en');

export { locale, _ };
