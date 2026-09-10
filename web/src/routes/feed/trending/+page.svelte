<!-- src/routes/feed/trending/+page.svelte -->
<script lang="ts">
  import { _ } from '$lib/i18n';
  import { goto } from '$app/navigation';
  import type { PageData } from './$types';
  import PostCard from '$lib/components/PostCard.svelte';

  export let data: PageData;

  let window = '24';

  async function changeWindow(w: string) {
    window = w;
    await goto(`/feed/trending?window=${w}`);
  }
</script>

<svelte:head>
  <title>{$_('feed.trending')} — Izwi Huru</title>
</svelte:head>

<!-- Tab switcher -->
<div class="flex gap-1 mb-4 border-b border-surface-200 dark:border-surface-800" role="tablist">
  <a href="/feed" role="tab" aria-selected="false"
    class="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-surface-500 hover:text-surface-700 dark:hover:text-surface-300">
    {$_('feed.chronological')}
  </a>
  <button role="tab" aria-selected="true"
    class="px-4 py-2 text-sm font-medium border-b-2 border-brand-500 text-brand-600 dark:text-brand-400">
    {$_('feed.trending')}
  </button>
</div>

<!-- Trust-weight explainer -->
<div class="mb-4 p-3 bg-surface-100 dark:bg-surface-900 rounded-lg text-xs text-surface-500 dark:text-surface-400">
  Trending is ranked by trust-weighted community response — not by raw engagement.
  Posts with unresolved incitement or hate-speech reports are excluded.
</div>

<!-- Window picker -->
<div class="flex gap-2 mb-6" role="group" aria-label="Time window">
  {#each [['24', '24 hours'], ['48', '48 hours'], ['168', '7 days']] as [val, label]}
    <button
      on:click={() => changeWindow(val)}
      class="text-xs px-3 py-1.5 rounded-full border transition-colors min-h-[36px]
        {window === val
          ? 'border-brand-500 bg-brand-500 text-white'
          : 'border-surface-300 dark:border-surface-700 text-surface-600 dark:text-surface-300 hover:border-brand-400'}"
    >
      {label}
    </button>
  {/each}
</div>

{#if data.posts.length === 0}
  <p class="text-center text-surface-400 py-16">Nothing trending yet in this window.</p>
{:else}
  <ol class="divide-y divide-surface-100 dark:divide-surface-800" aria-label="Trending posts">
    {#each data.posts as post, i (post.id)}
      <li class="flex gap-3 items-start py-1">
        <span class="text-2xl font-bold text-surface-200 dark:text-surface-700 w-8 shrink-0 text-right leading-none pt-4" aria-hidden="true">{i + 1}</span>
        <div class="flex-1"><PostCard {post} /></div>
      </li>
    {/each}
  </ol>
{/if}
