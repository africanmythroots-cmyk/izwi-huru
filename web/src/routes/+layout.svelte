<!-- src/routes/+layout.svelte -->
<!-- Root layout: nav bar, theme, i18n, PWA service worker registration -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { setupI18n, _ } from '$lib/i18n';
  import '../app.css';

  // Initialise i18n on mount (browser locale detection)
  onMount(() => {
    setupI18n();
    // Register the service worker for offline PWA
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // SW registration failure is non-fatal — app works without it
      });
    }
  });

  let mobileMenuOpen = false;
</script>

<svelte:head>
  <title>{$_('app.name')}</title>
</svelte:head>

<!-- Skip-to-content link for keyboard and screen-reader users -->
<a
  href="#main-content"
  class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-brand-500 focus:text-white focus:px-4 focus:py-2 focus:rounded"
>
  Skip to content
</a>

<header class="sticky top-0 z-40 bg-white/90 dark:bg-surface-900/90 backdrop-blur border-b border-surface-200 dark:border-surface-800">
  <nav class="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between" aria-label="Main navigation">
    <a href="/" class="font-bold text-lg text-brand-600 dark:text-brand-400 tracking-tight">
      {$_('app.name')}
    </a>

    <!-- Desktop nav -->
    <ul class="hidden sm:flex items-center gap-6 text-sm font-medium" role="list">
      <li><a href="/feed" class="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">{$_('nav.feed')}</a></li>
      <li><a href="/spaces" class="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">{$_('nav.spaces')}</a></li>
      <li><a href="/charter" class="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">{$_('nav.charter')}</a></li>
      <li><a href="/transparency" class="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">{$_('nav.transparency')}</a></li>
    </ul>

    <div class="hidden sm:flex items-center gap-3">
      <a href="/login" class="text-sm font-medium hover:text-brand-600 dark:hover:text-brand-400">{$_('nav.login')}</a>
      <a
        href="/register"
        class="text-sm font-medium bg-brand-500 hover:bg-brand-600 text-white px-4 py-1.5 rounded-full transition-colors min-h-[44px] flex items-center"
      >
        {$_('nav.register')}
      </a>
    </div>

    <!-- Mobile hamburger -->
    <button
      class="sm:hidden p-2 rounded min-w-[44px] min-h-[44px] flex items-center justify-center"
      aria-expanded={mobileMenuOpen}
      aria-label="Open menu"
      on:click={() => (mobileMenuOpen = !mobileMenuOpen)}
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        {#if mobileMenuOpen}
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        {:else}
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
        {/if}
      </svg>
    </button>
  </nav>

  <!-- Mobile menu -->
  {#if mobileMenuOpen}
    <div class="sm:hidden border-t border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 px-4 py-3">
      <ul class="flex flex-col gap-3 text-sm font-medium" role="list">
        <li><a href="/feed" on:click={() => (mobileMenuOpen = false)}>{$_('nav.feed')}</a></li>
        <li><a href="/spaces" on:click={() => (mobileMenuOpen = false)}>{$_('nav.spaces')}</a></li>
        <li><a href="/charter" on:click={() => (mobileMenuOpen = false)}>{$_('nav.charter')}</a></li>
        <li><a href="/transparency" on:click={() => (mobileMenuOpen = false)}>{$_('nav.transparency')}</a></li>
        <li class="pt-2 border-t border-surface-100 dark:border-surface-800">
          <a href="/login" on:click={() => (mobileMenuOpen = false)}>{$_('nav.login')}</a>
        </li>
        <li>
          <a
            href="/register"
            class="inline-block bg-brand-500 text-white px-4 py-2 rounded-full text-sm"
            on:click={() => (mobileMenuOpen = false)}
          >
            {$_('nav.register')}
          </a>
        </li>
      </ul>
    </div>
  {/if}
</header>

<main id="main-content" class="max-w-4xl mx-auto px-4 py-6">
  <slot />
</main>

<footer class="mt-16 border-t border-surface-200 dark:border-surface-800 py-8 text-center text-sm text-surface-500 dark:text-surface-400">
  <p>
    <a href="/charter" class="hover:underline">{$_('nav.charter')}</a> ·
    <a href="/transparency" class="hover:underline">{$_('nav.transparency')}</a>
  </p>
  <p class="mt-2">
    <em>izwi</em> = voice (Zulu) · <em>huru</em> = free (Swahili)
  </p>
</footer>
