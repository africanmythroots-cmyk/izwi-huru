<!-- src/routes/spaces/+page.svelte -->
<script lang="ts">
  import type { PageData } from './$types';
  export let data: PageData;

  let search = '';
  $: filtered = data.spaces.filter((s: { name: string; languageCode: string; countryScope?: string }) =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.countryScope ?? '').toLowerCase().includes(search.toLowerCase()) ||
    s.languageCode.toLowerCase().includes(search.toLowerCase())
  );

  // Group by country (null = pan-African)
  $: panAfrican = filtered.filter((s: { countryScope?: string }) => !s.countryScope);
  $: byCountry  = filtered.filter((s: { countryScope?: string }) => !!s.countryScope);
</script>

<svelte:head>
  <title>Spaces — Izwi Huru</title>
</svelte:head>

<div class="flex items-center justify-between mb-6">
  <h1 class="text-2xl font-bold">Spaces</h1>
  <a href="/spaces/new"
    class="text-sm bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-full transition-colors min-h-[44px] flex items-center">
    + New space
  </a>
</div>

<!-- Search -->
<div class="mb-6">
  <label for="search-spaces" class="sr-only">Search spaces</label>
  <input
    id="search-spaces"
    type="search"
    placeholder="Search by name, country, or language…"
    bind:value={search}
    class="w-full border border-surface-300 dark:border-surface-700 rounded-lg px-3 py-2 bg-white dark:bg-surface-900 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
  />
</div>

<!-- Pan-African spaces -->
{#if panAfrican.length > 0}
  <section class="mb-8" aria-labelledby="pan-african-heading">
    <h2 id="pan-african-heading" class="text-sm font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400 mb-3">Pan-African</h2>
    <ul class="grid sm:grid-cols-2 gap-3" role="list">
      {#each panAfrican as space (space.id)}
        <li>
          <a
            href="/spaces/{space.slug}"
            class="block p-4 bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 hover:border-brand-400 dark:hover:border-brand-600 transition-colors"
          >
            <div class="font-semibold text-sm">{space.name}</div>
            {#if space.description}
              <p class="text-xs text-surface-500 dark:text-surface-400 mt-1 line-clamp-2">{space.description}</p>
            {/if}
            <div class="mt-2 flex gap-2 items-center">
              <span class="text-xs bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 px-2 py-0.5 rounded-full">{space.languageCode}</span>
              <span class="text-xs text-surface-400">🌍 Pan-African</span>
            </div>
          </a>
        </li>
      {/each}
    </ul>
  </section>
{/if}

<!-- Country-specific spaces -->
{#if byCountry.length > 0}
  <section aria-labelledby="country-spaces-heading">
    <h2 id="country-spaces-heading" class="text-sm font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400 mb-3">Country spaces</h2>
    <ul class="grid sm:grid-cols-2 gap-3" role="list">
      {#each byCountry as space (space.id)}
        <li>
          <a
            href="/spaces/{space.slug}"
            class="block p-4 bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 hover:border-brand-400 dark:hover:border-brand-600 transition-colors"
          >
            <div class="font-semibold text-sm">{space.name}</div>
            {#if space.description}
              <p class="text-xs text-surface-500 dark:text-surface-400 mt-1 line-clamp-2">{space.description}</p>
            {/if}
            <div class="mt-2 flex gap-2 items-center">
              <span class="text-xs bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 px-2 py-0.5 rounded-full">{space.languageCode}</span>
              <span class="text-xs text-surface-400 uppercase">{space.countryScope}</span>
            </div>
          </a>
        </li>
      {/each}
    </ul>
  </section>
{/if}

{#if filtered.length === 0}
  <p class="text-center text-surface-400 py-16">No spaces found{search ? ` matching "${search}"` : ''}.</p>
{/if}
