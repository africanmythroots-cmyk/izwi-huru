<!-- src/lib/components/PostCard.svelte -->
<!-- Reusable post card: used in feed, thread, spaces. -->
<script lang="ts">
  import { _ } from '$lib/i18n';

  export let post: {
    id: string;
    spaceId?: string;
    spaceSlug?: string;
    author: { id: string; handle: string };
    body: string;
    replyCount: number;
    voteScore: number;
    amplifyCount: number;
    createdAt: string | Date;
  };

  export let compact = false; // true in thread children

  let voting = false;
  let amplifying = false;

  function relativeTime(date: string | Date): string {
    const d = new Date(date);
    const diff = Date.now() - d.getTime();
    const m = Math.floor(diff / 60_000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  }

  async function vote(value: 1 | -1) {
    if (voting) return;
    voting = true;
    await fetch(`/posts/${post.id}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
      credentials: 'include',
    });
    post.voteScore += value;
    voting = false;
  }

  async function amplify() {
    if (amplifying) return;
    amplifying = true;
    await fetch(`/posts/${post.id}/amplify`, {
      method: 'POST',
      credentials: 'include',
    });
    post.amplifyCount += 1;
    amplifying = false;
  }

  async function flag() {
    const reason = window.prompt('Reason for reporting:\ndoxxing / incitement / hate_speech / threat / harassment / other');
    if (!reason) return;
    await fetch(`/posts/${post.id}/flag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason.trim() }),
      credentials: 'include',
    });
  }
</script>

<article
  class="py-4 {compact ? '' : 'hover:bg-surface-50 dark:hover:bg-surface-900/50 transition-colors'}"
  aria-label="Post by {post.author.handle}"
>
  <header class="flex items-center gap-2 mb-2">
    <!-- Author handle: the only identity shown — no avatar, no real name -->
    <a
      href="/users/{post.author.handle}"
      class="font-semibold text-sm hover:underline text-surface-800 dark:text-surface-200"
      aria-label="View profile of {post.author.handle}"
    >
      @{post.author.handle}
    </a>

    {#if post.spaceSlug}
      <span class="text-surface-400 text-xs" aria-hidden="true">·</span>
      <a
        href="/spaces/{post.spaceSlug}"
        class="text-xs text-surface-500 dark:text-surface-400 hover:underline"
      >
        {post.spaceSlug}
      </a>
    {/if}

    <span class="text-surface-400 text-xs ml-auto" aria-label="Posted {relativeTime(post.createdAt)} ago">
      {relativeTime(post.createdAt)}
    </span>
  </header>

  <!-- Post body -->
  <a href="/posts/{post.id}" class="block mb-3">
    <p class="text-sm leading-relaxed whitespace-pre-wrap break-words">
      {post.body}
    </p>
  </a>

  <!-- Actions row -->
  <footer class="flex items-center gap-4 text-xs text-surface-500 dark:text-surface-400">
    <!-- Vote -->
    <div class="flex items-center gap-1" role="group" aria-label="Vote">
      <button
        on:click={() => vote(1)}
        disabled={voting}
        class="min-h-[44px] min-w-[44px] flex items-center justify-center hover:text-brand-500 transition-colors"
        aria-label="Upvote"
      >▲</button>
      <span class="font-semibold tabular-nums" aria-live="polite" aria-label="{post.voteScore} points">
        {post.voteScore}
      </span>
      <button
        on:click={() => vote(-1)}
        disabled={voting}
        class="min-h-[44px] min-w-[44px] flex items-center justify-center hover:text-red-500 transition-colors"
        aria-label="Downvote"
      >▼</button>
    </div>

    <!-- Reply count -->
    <a href="/posts/{post.id}" class="min-h-[44px] flex items-center gap-1 hover:text-brand-500 transition-colors">
      <span aria-hidden="true">💬</span>
      <span>{$_('post.replies', { values: { count: post.replyCount } })}</span>
    </a>

    <!-- Amplify -->
    <button
      on:click={amplify}
      disabled={amplifying}
      class="min-h-[44px] flex items-center gap-1 hover:text-green-500 transition-colors"
      aria-label="{$_('post.amplify')} — {$_('post.amplified', { values: { count: post.amplifyCount } })}"
    >
      <span aria-hidden="true">⟳</span>
      <span>{post.amplifyCount}</span>
    </button>

    <!-- Flag -->
    <button
      on:click={flag}
      class="min-h-[44px] flex items-center hover:text-red-500 transition-colors ml-auto"
      aria-label="{$_('post.flag')}"
    >
      <span aria-hidden="true">⚑</span>
    </button>
  </footer>
</article>
