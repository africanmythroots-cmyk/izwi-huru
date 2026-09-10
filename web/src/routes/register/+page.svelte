<!-- src/routes/register/+page.svelte -->
<script lang="ts">
  import { _ } from '$lib/i18n';
  import { goto } from '$app/navigation';

  let handle = '';
  let passphrase = '';
  let captchaSolved = false;
  let loading = false;
  let error = '';
  let recoveryMnemonic: string | null = null;
  let recoveryConfirmed = false;

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!captchaSolved) { error = 'Please complete the security check.'; return; }
    loading = true;
    error = '';

    try {
      const res = await fetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handle,
          passphrase,
          // TODO: replace with real Altcha widget payload
          captchaPayload: btoa('{}'),
          wantsRecovery: true,
        }),
        credentials: 'include',
      });

      const json = await res.json();

      if (!res.ok) {
        error = json.error ?? 'Registration failed.';
        return;
      }

      recoveryMnemonic = json.recoveryMnemonic;
      if (!recoveryMnemonic) {
        await goto('/feed');
      }
    } catch {
      error = 'Network error. Please try again.';
    } finally {
      loading = false;
    }
  }

  async function confirmRecovery() {
    recoveryConfirmed = true;
    await goto('/feed');
  }
</script>

<svelte:head>
  <title>Join — Izwi Huru</title>
</svelte:head>

{#if recoveryMnemonic && !recoveryConfirmed}
  <!-- Recovery phrase display — shown ONCE, never again -->
  <div
    class="max-w-lg mx-auto bg-amber-50 dark:bg-amber-900/20 border border-amber-400 dark:border-amber-700 rounded-xl p-8"
    role="alert"
    aria-live="assertive"
  >
    <h1 class="text-xl font-bold mb-2">{$_('auth.recovery.title')}</h1>
    <p class="text-surface-700 dark:text-surface-300 mb-4 text-sm">{$_('auth.recovery.body')}</p>

    <div class="bg-white dark:bg-surface-900 rounded-lg p-4 font-mono text-sm break-all select-all border border-amber-300 dark:border-amber-700 mb-6">
      {recoveryMnemonic}
    </div>

    <p class="text-xs text-surface-500 mb-4">
      This phrase is generated on your device and was never sent to our servers. We have no copy of it.
    </p>

    <button
      on:click={confirmRecovery}
      class="w-full bg-brand-500 hover:bg-brand-600 text-white font-semibold py-3 rounded-full transition-colors min-h-[44px]"
    >
      {$_('auth.recovery.done')}
    </button>
  </div>
{:else}
  <div class="max-w-sm mx-auto">
    <h1 class="text-2xl font-bold mb-6">{$_('nav.register')}</h1>

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
          minlength="3"
          maxlength="30"
          pattern="[a-z0-9_-]+"
          class="w-full border border-surface-300 dark:border-surface-700 rounded-lg px-3 py-2 bg-white dark:bg-surface-900 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-brand-500"
          aria-describedby="handle-hint"
        />
        <p id="handle-hint" class="text-xs text-surface-500 mt-1">{$_('auth.handleHint')}</p>
      </div>

      <div class="mb-4">
        <label for="passphrase" class="block text-sm font-medium mb-1">{$_('auth.passphrase')}</label>
        <input
          id="passphrase"
          type="password"
          autocomplete="new-password"
          bind:value={passphrase}
          required
          minlength="10"
          class="w-full border border-surface-300 dark:border-surface-700 rounded-lg px-3 py-2 bg-white dark:bg-surface-900 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-brand-500"
          aria-describedby="passphrase-hint"
        />
        <p id="passphrase-hint" class="text-xs text-surface-500 mt-1">{$_('auth.passphraseHint')}</p>
      </div>

      <!-- Altcha PoW CAPTCHA widget placeholder -->
      <!-- In production: replace with <altcha-widget> custom element -->
      <div class="mb-6 p-3 bg-surface-100 dark:bg-surface-800 rounded-lg text-sm text-center">
        <label class="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            bind:checked={captchaSolved}
            class="w-5 h-5 accent-brand-500"
            aria-label="{$_('auth.captcha.label')}"
          />
          <span>{$_('auth.captcha.label')}</span>
        </label>
        <p class="text-xs text-surface-400 mt-2">Powered by Altcha — no third-party service, works over Tor.</p>
      </div>

      <button
        type="submit"
        disabled={loading}
        class="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-semibold py-3 rounded-full transition-colors min-h-[44px]"
      >
        {loading ? 'Creating account…' : $_('auth.register')}
      </button>
    </form>

    <p class="mt-4 text-sm text-center text-surface-500">
      Already have an account? <a href="/login" class="text-brand-600 dark:text-brand-400 hover:underline">{$_('nav.login')}</a>
    </p>
    <p class="mt-6 text-xs text-center text-surface-400">
      By joining you agree to the <a href="/charter" class="underline">Pan-African Charter</a>.
    </p>
  </div>
{/if}
