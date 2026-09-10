<!-- src/routes/recover/+page.svelte -->
<!-- Account recovery via BIP39 mnemonic. The mnemonic never leaves the browser —
     the client derives the recovery token, which is what gets sent to the server. -->
<script lang="ts">
  import { goto } from '$app/navigation';

  let handle = '';
  let mnemonic = '';
  let newPassphrase = '';
  let loading = false;
  let error = '';
  let success = false;

  // Client-side: derive the recovery token from the mnemonic.
  // Mirrors the server-side logic in crypto.ts: SHA-256(first 32 bytes of BIP39 seed)
  async function deriveRecoveryToken(mnemonic: string): Promise<string> {
    const { mnemonicToSeedSync } = await import('bip39');
    const seed = mnemonicToSeedSync(mnemonic.trim().toLowerCase());
    const slice = seed.slice(0, 32);
    const hashBuffer = await crypto.subtle.digest('SHA-256', slice);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    // Base64url encode to match server-side output
    return btoa(String.fromCharCode(...new Uint8Array(hashBuffer)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    loading = true;
    error = '';

    try {
      const recoveryToken = await deriveRecoveryToken(mnemonic);

      const res = await fetch('/auth/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle, recoveryToken, newPassphrase }),
        credentials: 'include',
      });

      const json = await res.json();
      if (!res.ok) { error = json.error ?? 'Recovery failed.'; return; }
      success = true;
    } catch {
      error = 'Recovery failed. Check your recovery phrase and try again.';
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Recover account — Izwi Huru</title>
</svelte:head>

<div class="max-w-sm mx-auto">
  <h1 class="text-2xl font-bold mb-2">Recover your account</h1>
  <p class="text-sm text-surface-500 mb-6">
    Enter your 12-word recovery phrase and a new passphrase.
    Your recovery phrase never leaves your device.
  </p>

  {#if success}
    <div class="p-4 bg-green-50 dark:bg-green-900/20 border border-green-400 dark:border-green-700 rounded-xl" role="status">
      <p class="font-semibold text-green-700 dark:text-green-300">Passphrase reset successfully.</p>
      <p class="text-sm mt-1 text-green-600 dark:text-green-400">All previous sessions have been invalidated.</p>
      <a href="/login" class="mt-3 inline-block text-brand-600 dark:text-brand-400 hover:underline text-sm">Log in with your new passphrase →</a>
    </div>
  {:else}
    {#if error}
      <div class="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg text-sm text-red-700 dark:text-red-300" role="alert">{error}</div>
    {/if}

    <form on:submit={handleSubmit} novalidate>
      <div class="mb-4">
        <label for="handle" class="block text-sm font-medium mb-1">Your handle</label>
        <input id="handle" type="text" autocapitalize="none" autocomplete="username" bind:value={handle} required
          class="w-full border border-surface-300 dark:border-surface-700 rounded-lg px-3 py-2 bg-white dark:bg-surface-900 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-brand-500" />
      </div>

      <div class="mb-4">
        <label for="mnemonic" class="block text-sm font-medium mb-1">12-word recovery phrase</label>
        <textarea id="mnemonic" bind:value={mnemonic} required rows="3" spellcheck="false" autocapitalize="none"
          placeholder="word1 word2 word3 … word12"
          class="w-full border border-surface-300 dark:border-surface-700 rounded-lg px-3 py-2 bg-white dark:bg-surface-900 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          aria-describedby="mnemonic-hint" />
        <p id="mnemonic-hint" class="text-xs text-surface-400 mt-1">Enter the words separated by spaces, exactly as shown when you registered.</p>
      </div>

      <div class="mb-6">
        <label for="newPassphrase" class="block text-sm font-medium mb-1">New passphrase</label>
        <input id="newPassphrase" type="password" autocomplete="new-password" bind:value={newPassphrase} required minlength="10"
          class="w-full border border-surface-300 dark:border-surface-700 rounded-lg px-3 py-2 bg-white dark:bg-surface-900 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-brand-500" />
      </div>

      <button type="submit" disabled={loading}
        class="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-semibold py-3 rounded-full transition-colors min-h-[44px]">
        {loading ? 'Recovering…' : 'Reset passphrase'}
      </button>
    </form>
  {/if}
</div>
