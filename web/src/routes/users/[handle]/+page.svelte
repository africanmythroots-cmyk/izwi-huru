<!-- src/routes/users/[handle]/+page.svelte -->
<!-- Public profile: pseudonym, reputation, join date. Nothing else. -->
<script lang="ts">
  import { _ } from '$lib/i18n';
  import type { PageData } from './$types';
  export let data: PageData;

  $: profile = data.profile;
</script>

{#if !profile}
  <p class="text-center text-surface-400 py-16">{$_('error.notFound')}</p>
{:else}
  <svelte:head>
    <title>@{profile.handle} — Izwi Huru</title>
    <!-- Do not index user profiles — protect pseudonymous users from search engine exposure -->
    <meta name="robots" content="noindex, nofollow" />
  </svelte:head>

  <div class="max-w-lg mx-auto">
    <header class="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 p-6 mb-6">
      <!-- Handle — the only identity shown -->
      <h1 class="text-2xl font-bold mb-1">@{profile.handle}</h1>

      <dl class="flex gap-6 mt-4 text-sm">
        <div>
          <dt class="text-surface-400 dark:text-surface-500 text-xs uppercase tracking-wide">Reputation</dt>
          <dd class="font-semibold mt-0.5">{Number(profile.reputation).toFixed(1)}</dd>
        </div>
        <div>
          <dt class="text-surface-400 dark:text-surface-500 text-xs uppercase tracking-wide">Joined</dt>
          <dd class="font-semibold mt-0.5">
            {new Date(profile.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })}
          </dd>
        </div>
      </dl>

      {#if profile.isSuspended}
        <div class="mt-4 p-2 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg text-xs text-red-700 dark:text-red-300" role="status">
          Account suspended
        </div>
      {/if}
    </header>

    <!-- Privacy notice — visible to all visitors -->
    <p class="text-xs text-surface-400 dark:text-surface-500 text-center">
      Izwi Huru never links handles to real identities.
      No email, phone, or location is stored or displayed.
    </p>
  </div>
{/if}
