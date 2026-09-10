<!-- src/routes/login/+page.svelte -->
<script lang="ts">
  import { _ } from '$lib/i18n';
  import { goto } from '$app/navigation';

  let handle = '';
  let passphrase = '';
  let loading = false;
  let error = '';

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    loading = true;
    error = '';
    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle, passphrase }),
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok) { error = json.error ?? 'Login failed.'; return; }
      await goto('/feed');
    } catch {
      error = 'Network error. Please try again.';
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Log in — Izwi Huru</title>
</svelte:head>

<div class="max-w-sm mx-auto">
  <h1 class="text-2xl font-bold mb-6">{$_('nav.login')}</h1>

  {#if error}
    <div class="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg text-sm text-red-700 dark:text-red-300" role="alert">
      {error}
    </div>
  {/if}

  <form on:submit={handleSubmit} novalidate>
    <div class="mb-4">
      <label for="handle" class="block text-sm font-medium mb-1">{$_('auth.handle')}</label>
      <input
        id="handle"
        type="text"
        autocomplete="username"
        autocapitalize="none"
        spellcheck="false"
        bind:value={handle}
        required
        class="w-full border border-surface-300 dark:border-surface-700 rounded-lg px-3 py-2 bg-white dark:bg-surface-900 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
    </div>

    <div class="mb-6">
      <label for="passphrase" class="block text-sm font-medium mb-1">{$_('auth.passphrase')}</label>
      <input
        id="passphrase"
        type="password"
        autocomplete="current-password"
        bind:value={passphrase}
        required
        class="w-full border border-surface-300 dark:border-surface-700 rounded-lg px-3 py-2 bg-white dark:bg-surface-900 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
    </div>

    <button
      type="submit"
      disabled={loading}
      class="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-semibold py-3 rounded-full transition-colors min-h-[44px]"
    >
      {loading ? 'Logging in…' : $_('nav.login')}
    </button>
  </form>

  <p class="mt-4 text-sm text-center text-surface-500">
    No account? <a href="/register" class="text-brand-600 dark:text-brand-400 hover:underline">{$_('nav.register')}</a>
  </p>

  <details class="mt-6 text-sm text-surface-500">
    <summary class="cursor-pointer hover:text-surface-700 dark:hover:text-surface-300">Forgot your passphrase?</summary>
    <div class="mt-3 p-4 bg-surface-100 dark:bg-surface-900 rounded-lg text-sm">
      <p>Use your 12-word recovery phrase.</p>
      <a href="/recover" class="mt-2 inline-block text-brand-600 dark:text-brand-400 hover:underline">
        Recover account →
      </a>
      <p class="mt-3 text-xs text-surface-400">
        If you don't have a recovery phrase, the account cannot be recovered.
        This is by design — we keep no copy.
      </p>
    </div>
  </details>
</div>
