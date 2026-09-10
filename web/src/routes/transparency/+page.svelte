<!-- src/routes/transparency/+page.svelte -->
<!-- Always publicly accessible — cached offline, available on onion address and mirrors. -->
<script lang="ts">
  import type { PageData } from './$types';
  export let data: PageData;

  let activeTab: 'reports' | 'requests' | 'events' = 'reports';

  // Group request summary by country
  type SummaryRow = { requestingCountry: string; requestType: string; outcome: string; count: string };
  $: byCountry = data.requestSummary.reduce((acc: Record<string, SummaryRow[]>, row: SummaryRow) => {
    acc[row.requestingCountry] = [...(acc[row.requestingCountry] ?? []), row];
    return acc;
  }, {} as Record<string, SummaryRow[]>);
  function selectTab(val: string) {
    activeTab = val as typeof activeTab;
  }
</script>

<svelte:head>
  <title>Transparency — Izwi Huru</title>
  <!-- Transparency page IS indexed -->
  <meta name="robots" content="index, follow" />
  <meta name="description" content="Izwi Huru transparency reports: government requests, moderation actions, and platform governance." />
</svelte:head>

<h1 class="text-2xl font-bold mb-2">Transparency</h1>
<p class="text-surface-500 dark:text-surface-400 text-sm mb-6 max-w-xl">
  Per the <a href="/charter#part-vi" class="text-brand-600 dark:text-brand-400 hover:underline">Pan-African Charter §VI</a>,
  we publish quarterly transparency reports covering government requests, moderation actions, and any material platform changes.
  Reports are signed with our PGP key and archived on the Internet Archive.
</p>

<!-- Tab bar -->
<div class="flex gap-1 mb-6 border-b border-surface-200 dark:border-surface-800" role="tablist">
  {#each [['reports', 'Quarterly reports'], ['requests', 'Government requests'], ['events', 'Event log']] as [val, label]}
    <button role="tab" aria-selected={activeTab === val}
      on:click={() => selectTab(val)}
      class="px-4 py-2 text-sm font-medium border-b-2 transition-colors
        {activeTab === val
          ? 'border-brand-500 text-brand-600 dark:text-brand-400'
          : 'border-transparent text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'}">
      {label}
    </button>
  {/each}
</div>

<!-- Quarterly reports -->
{#if activeTab === 'reports'}
  {#if data.reports.length === 0}
    <p class="text-surface-400 py-8">No reports published yet.</p>
  {:else}
    <ul class="divide-y divide-surface-200 dark:divide-surface-800" aria-label="Quarterly reports">
      {#each data.reports as report}
        <li class="py-4 flex items-center justify-between">
          <div>
            <span class="font-semibold">{report.quarter}</span>
            <span class="ml-2 text-xs text-surface-500">
              Published {new Date(report.publishedAt).toLocaleDateString()}
            </span>
          </div>
          <a href="/transparency/reports/{report.quarter}"
            class="text-sm text-brand-600 dark:text-brand-400 hover:underline">
            Read report →
          </a>
        </li>
      {/each}
    </ul>
  {/if}
{/if}

<!-- Government requests -->
{#if activeTab === 'requests'}
  <div class="mb-4 p-3 bg-surface-100 dark:bg-surface-900 rounded-lg text-xs text-surface-500">
    Aggregated summary — no individual request details that could identify users.
    Full details are in the quarterly reports.
  </div>

  {#if data.requestSummary.length === 0}
    <p class="text-surface-400 py-8">No government requests received to date.</p>
  {:else}
    {#each Object.entries(byCountry) as [country, rows]}
      <section class="mb-6" aria-labelledby="country-{country}">
        <h2 id="country-{country}" class="font-semibold text-sm mb-2 uppercase">{country}</h2>
        <table class="w-full text-sm" aria-label="Requests from {country}">
          <thead>
            <tr class="text-left text-xs text-surface-400 uppercase border-b border-surface-200 dark:border-surface-800">
              <th class="pb-1 pr-4">Type</th>
              <th class="pb-1 pr-4">Outcome</th>
              <th class="pb-1">Count</th>
            </tr>
          </thead>
          <tbody>
            {#each rows as row}
              <tr class="border-b border-surface-100 dark:border-surface-800">
                <td class="py-2 pr-4">{row.requestType.replace(/_/g, ' ')}</td>
                <td class="py-2 pr-4">
                  <span class="px-2 py-0.5 rounded-full text-xs
                    {row.outcome === 'refused' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                     row.outcome === 'pending'  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' :
                                                 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'}">
                    {row.outcome}
                  </span>
                </td>
                <td class="py-2 font-semibold">{row.count}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </section>
    {/each}
  {/if}
{/if}

<!-- Event log -->
{#if activeTab === 'events'}
  {#if data.events.length === 0}
    <p class="text-surface-400 py-8">No published events yet.</p>
  {:else}
    <ul class="divide-y divide-surface-100 dark:divide-surface-800" aria-label="Transparency event log">
      {#each data.events as event}
        <li class="py-3 text-sm">
          <div class="flex items-center gap-2 mb-0.5">
            <span class="font-mono text-xs bg-surface-100 dark:bg-surface-800 px-2 py-0.5 rounded">{event.quarter}</span>
            <span class="text-surface-400 text-xs">{event.eventType.replace(/_/g, ' ')}</span>
            {#if event.countryCode}
              <span class="text-xs uppercase text-surface-400 font-semibold">{event.countryCode}</span>
            {/if}
          </div>
          <p class="text-surface-700 dark:text-surface-300">{event.summary}</p>
        </li>
      {/each}
    </ul>
  {/if}
{/if}
