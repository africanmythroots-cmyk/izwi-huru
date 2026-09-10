<!-- src/routes/feed/+page.svelte -->
<script lang="ts">
  import { _ } from '$lib/i18n';
  import { goto } from '$app/navigation';
  import type { PageData } from './$types';
  import PostCard from '$lib/components/PostCard.svelte';
  import NewPostBox from '$lib/components/NewPostBox.svelte';

  export let data: PageData;

  let posts = data.posts;
  let nextCursor = data.nextCursor;
  let loadingMore = false;
  let tab: 'latest' | 'trending' = 'latest';

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    loadingMore = true;
    const res = await fetch(`/feed?cursor=${nextCursor}`, { credentials: 'include' });
    if (res.ok) {
      const d = await res.json();
      posts = [...posts, ...d.feed];
      nextCursor = d.nextCursor;
    }
    loadingMore = false;
  }

  async function switchTab(t: 'latest' | 'trending') {
    tab = t;
    if (t === 'trending') {
      await goto('/feed/trending');
    }
  }
</script>

<svelte:head>
  <title>{$_('feed.title')} — Izwi Huru</title>
</svelte:head>

<!-- Tab switcher -->
<div class="flex gap-1 mb-6 border-b border-surface-200 dark:border-surface-800" role="tablist">
  <button
    role="tab"
    aria-selected={tab === 'latest'}
    on:click={() => switchTab('latest')}
    class="px-4 py-2 text-sm font-medium border-b-2 transition-colors
      {tab === 'latest'
        ? 'border-brand-500 text-brand-600 dark:text-brand-400'
        : 'border-transparent text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'}"
  >
    {$_('feed.chronological')}
  </button>
  <button
    role="tab"
    aria-selected={tab === 'trending'}
    on:click={() => switchTab('trending')}
    class="px-4 py-2 text-sm font-medium border-b-2 transition-colors
      {tab === 'trending'
        ? 'border-brand-500 text-brand-600 dark:text-brand-400'
        : 'border-transparent text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'}"
  >
    {$_('feed.trending')}
  </button>
</div>

<!-- New post box -->
<NewPostBox />

<!-- Post list -->
{#if posts.length === 0}
  <p class="text-center text-surface-400 py-16">{$_('feed.empty')}</p>
{:else}
  <ul class="divide-y divide-surface-100 dark:divide-surface-800" aria-label="Post feed">
    {#each posts as post (post.id)}
      <li><PostCard {post} /></li>
    {/each}
  </ul>

  {#if nextCursor}
    <div class="mt-6 text-center">
      <button
        on:click={loadMore}
        disabled={loadingMore}
        class="px-6 py-2 border border-brand-500 text-brand-600 dark:text-brand-400 rounded-full text-sm hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors disabled:opacity-50 min-h-[44px]"
      >
        {loadingMore ? 'Loading…' : $_('feed.loadMore')}
      </button>
    </div>
  {/if}
{/if}
