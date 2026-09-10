<!-- src/routes/settings/+page.svelte -->
<script lang="ts">
  import { _ } from '$lib/i18n';
  import { locale } from '$lib/i18n';

  let currentPassphrase = '';
  let newPassphrase = '';
  let confirmPassphrase = '';
  let changingPass = false;
  let passError = '';
  let passSuccess = false;

  let generatingRecovery = false;
  let newMnemonic: string | null = null;
  let mnemonicConfirmed = false;

  let theme: 'light' | 'dark' | 'system' = 'system';
  let selectedLocale = $locale ?? 'en';

  async function changePassphrase(e: SubmitEvent) {
    e.preventDefault();
    if (newPassphrase !== confirmPassphrase) {
      passError = 'New passphrases do not match.';
      return;
    }
    changingPass = true;
    passError = '';

    // Call PATCH /users/me with { currentPassphrase, newPassphrase }
    const res = await fetch('/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassphrase, newPassphrase }),
      credentials: 'include',
    });

    if (res.ok) {
      passSuccess = true;
      currentPassphrase = '';
      newPassphrase = '';
      confirmPassphrase = '';
      setTimeout(() => (passSuccess = false), 4000);
    } else {
      const j = await res.json();
      passError = j.error ?? 'Failed to change passphrase.';
    }
    changingPass = false;
  }

  async function generateNewRecovery() {
    generatingRecovery = true;
    // Recovery mnemonic is generated client-side; server stores only the hash
    const { generateMnemonic } = await import('bip39');
    newMnemonic = generateMnemonic(128);
    generatingRecovery = false;
  }

  async function confirmNewRecovery() {
    if (!newMnemonic) return;
    // Derive the token and register it with the server
    const { mnemonicToSeedSync } = await import('bip39');
    const seed = mnemonicToSeedSync(newMnemonic);
    const hashBuffer = await crypto.subtle.digest('SHA-256', seed.slice(0, 32));
    const hashArr = Array.from(new Uint8Array(hashBuffer));
    const hex = hashArr.map((b) => b.toString(16).padStart(2, '0')).join('');

    await fetch('/users/me/recovery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recoveryTokenHash: hex }),
      credentials: 'include',
    });
    mnemonicConfirmed = true;
    newMnemonic = null;
  }

  function applyTheme(t: 'light' | 'dark' | 'system') {
    theme = t;
    const root = document.documentElement;
    if (t === 'dark') root.classList.add('dark');
    else if (t === 'light') root.classList.remove('dark');
    else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
    }
    localStorage.setItem('theme', t);
  }

  function changeLocale(l: string) {
    selectedLocale = l;
    locale.set(l);
    localStorage.setItem('locale', l);
  }
</script>

<svelte:head>
  <title>{$_('settings.title')} — Izwi Huru</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<h1 class="text-2xl font-bold mb-8">{$_('settings.title')}</h1>

<!-- Change passphrase -->
<section class="mb-10 bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 p-6" aria-labelledby="passphrase-heading">
  <h2 id="passphrase-heading" class="font-semibold mb-4">{$_('settings.changePassphrase')}</h2>

  {#if passSuccess}
    <p class="text-green-600 dark:text-green-400 text-sm mb-2" role="status">Passphrase updated. All other sessions have been invalidated.</p>
  {/if}
  {#if passError}
    <p class="text-red-600 dark:text-red-400 text-sm mb-2" role="alert">{passError}</p>
  {/if}

  <form on:submit={changePassphrase} novalidate class="space-y-4 max-w-sm">
    <div>
      <label for="current-pass" class="block text-sm font-medium mb-1">Current passphrase</label>
      <input id="current-pass" type="password" autocomplete="current-password" bind:value={currentPassphrase} required
        class="w-full border border-surface-300 dark:border-surface-700 rounded-lg px-3 py-2 bg-white dark:bg-surface-900 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-brand-500" />
    </div>
    <div>
      <label for="new-pass" class="block text-sm font-medium mb-1">New passphrase</label>
      <input id="new-pass" type="password" autocomplete="new-password" bind:value={newPassphrase} required minlength="10"
        class="w-full border border-surface-300 dark:border-surface-700 rounded-lg px-3 py-2 bg-white dark:bg-surface-900 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-brand-500" />
    </div>
    <div>
      <label for="confirm-pass" class="block text-sm font-medium mb-1">Confirm new passphrase</label>
      <input id="confirm-pass" type="password" autocomplete="new-password" bind:value={confirmPassphrase} required minlength="10"
        class="w-full border border-surface-300 dark:border-surface-700 rounded-lg px-3 py-2 bg-white dark:bg-surface-900 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-brand-500" />
    </div>
    <button type="submit" disabled={changingPass}
      class="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-semibold px-6 py-2 rounded-full transition-colors min-h-[44px]">
      {changingPass ? 'Updating…' : 'Update passphrase'}
    </button>
  </form>
</section>

<!-- Generate new recovery phrase -->
<section class="mb-10 bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 p-6" aria-labelledby="recovery-heading">
  <h2 id="recovery-heading" class="font-semibold mb-2">{$_('settings.generateRecovery')}</h2>
  <p class="text-sm text-surface-500 dark:text-surface-400 mb-4">
    Generates a new 12-word recovery phrase. Your old one will stop working.
    The phrase is generated in your browser and never sent to our servers.
  </p>

  {#if mnemonicConfirmed}
    <p class="text-green-600 dark:text-green-400 text-sm" role="status">New recovery phrase saved ✓</p>
  {:else if newMnemonic}
    <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-400 dark:border-amber-700 rounded-xl p-4 mb-4" role="alert">
      <p class="text-sm font-medium mb-2">Write these words down. They will not appear again.</p>
      <div class="font-mono text-sm break-all select-all bg-white dark:bg-surface-900 rounded-lg p-3 border border-amber-300 dark:border-amber-700">
        {newMnemonic}
      </div>
      <button on:click={confirmNewRecovery}
        class="mt-3 bg-brand-500 hover:bg-brand-600 text-white font-semibold px-4 py-2 rounded-full text-sm transition-colors min-h-[44px]">
        I have written down my phrase
      </button>
    </div>
  {:else}
    <button on:click={generateNewRecovery} disabled={generatingRecovery}
      class="border border-brand-500 text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 font-semibold px-4 py-2 rounded-full text-sm transition-colors min-h-[44px]">
      {generatingRecovery ? 'Generating…' : 'Generate new recovery phrase'}
    </button>
  {/if}
</section>

<!-- Appearance -->
<section class="mb-10 bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 p-6" aria-labelledby="appearance-heading">
  <h2 id="appearance-heading" class="font-semibold mb-4">Appearance</h2>

  <div class="mb-4">
    <p class="text-sm font-medium mb-2">{$_('settings.theme')}</p>
    <div class="flex gap-2" role="group" aria-label="Theme">
      {#each [['light', $_('settings.theme.light')], ['dark', $_('settings.theme.dark')], ['system', $_('settings.theme.system')]] as [val, label]}
        <button on:click={() => applyTheme(val as 'light' | 'dark' | 'system')}
          class="px-4 py-2 rounded-full text-sm border transition-colors min-h-[44px]
            {theme === val
              ? 'bg-brand-500 border-brand-500 text-white'
              : 'border-surface-300 dark:border-surface-700 hover:border-brand-400'}">
          {label}
        </button>
      {/each}
    </div>
  </div>

  <div>
    <label for="language-select" class="text-sm font-medium block mb-2">{$_('settings.language')}</label>
    <select id="language-select" bind:value={selectedLocale} on:change={() => changeLocale(selectedLocale)}
      class="border border-surface-300 dark:border-surface-700 rounded-lg px-3 py-2 bg-white dark:bg-surface-900 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm">
      <option value="en">English</option>
      <option value="sw">Kiswahili</option>
    </select>
  </div>
</section>
