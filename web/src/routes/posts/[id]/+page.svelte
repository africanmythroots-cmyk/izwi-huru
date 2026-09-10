<!-- src/routes/posts/[id]/+page.svelte -->
<!-- Thread view: root post + reply box + replies -->
<script lang="ts">
  import { _ } from '$lib/i18n';
  import PostCard from '$lib/components/PostCard.svelte';
  import NewPostBox from '$lib/components/NewPostBox.svelte';
  import type { PageData } from './$types';

  export let data: PageData;
  $: post    = data.post;
  $: replies = data.replies ?? [];
</script>

{#if !post}
  <p class="text-center text-surface-400 py-16">{$_('error.notFound')}</p>
{:else}
  <svelte:head>
    <title>Thread by @{post.author.handle} — Izwi Huru</title>
    <meta name="description" content="Thread on Izwi Huru — {post.body.slice(0, 120)}" />
  </svelte:head>

  <!-- Root post (full, not compact) -->
  <div class="mb-4 bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 px-4">
    <PostCard {post} />
  </div>

  <!-- Reply box -->
  <NewPostBox
    spaceId={post.spaceId}
    parentId={post.id}
    placeholder="Write a reply…"
  />

  <!-- Replies -->
  {#if replies.length > 0}
    <section aria-label="Replies">
      <h2 class="text-sm font-semibold text-surface-500 dark:text-surface-400 mb-2 uppercase tracking-wide">
        {$_('post.replies', { values: { count: replies.length } })}
      </h2>
      <ul class="divide-y divide-surface-100 dark:divide-surface-800 border border-surface-200 dark:border-surface-800 rounded-xl bg-white dark:bg-surface-900 px-4">
        {#each replies as reply (reply.id)}
          <li><PostCard post={reply} compact /></li>
        {/each}
      </ul>
    </section>
  {:else}
    <p class="text-sm text-surface-400 text-center py-8">No replies yet. Be the first.</p>
  {/if}
{/if}
