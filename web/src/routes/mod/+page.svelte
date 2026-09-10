<!-- src/routes/mod/+page.svelte -->
<!-- Moderator dashboard: review queue + government request log -->
<script lang="ts">
  import type { PageData } from './$types';
  export let data: PageData;

  type QueueItem = {
    id: string; spaceSlug: string; authorHandle: string;
    bodyLength: number; flagCount: number; createdAt: string;
  };
  type GovRequest = {
    id: string; requestingCountry: string; requestType: string;
    outcome: string; receivedAt: string;
  };

  let queue: QueueItem[]       = data.queue;
  let govRequests: GovRequest[] = data.govRequests;
  let activeTab: 'queue' | 'gov' = 'queue';

  const CHARTER_CLAUSES = [
    '§3.1 Doxxing', '§3.2 Incitement to Violence', '§3.3 Targeted Harassment',
    '§3.4 Hate Speech', '§3.5 Threats', '§3.6 Non-Consensual Intimate Content',
    '§3.7 Coordinated Inauthenticity',
  ];

  let taking: string | null = null;
  let actionType = 'dismiss_flag';
  let charterClause = CHARTER_CLAUSES[0] ?? '';
  let rationale = '';
  let error = '';

  async function takeAction(postId: string) {
    if (!charterClause) { error = 'Select a Charter clause.'; return; }
    taking = postId;
    error = '';
    const res = await fetch('/mod/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId, action: actionType, charterClause, rationale }),
      credentials: 'include',
    });
    if (res.ok) {
      queue = queue.filter((q) => q.id !== postId);
    } else {
      const j = await res.json();
      error = j.error ?? 'Action failed.';
    }
    taking = null;
    rationale = '';
  }

  function selectTab(val: string) {
    activeTab = val as 'queue' | 'gov';
  }
</script>

<svelte:head>
  <title>Moderator Dashboard — Izwi Huru</title>
  <!-- Never index mod pages -->
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="flex items-center justify-between mb-6">
  <h1 class="text-2xl font-bold">Moderator Dashboard</h1>
</div>

<!-- Tab bar -->
<div class="flex gap-1 mb-6 border-b border-surface-200 dark:border-surface-800" role="tablist">
  {#each [['queue', `Review queue (${queue.length})`], ['gov', `Government requests (${govRequests.length})`]] as [val, label]}
    <button
      role="tab"
      aria-selected={activeTab === val}
      on:click={() => selectTab(val)}
      class="px-4 py-2 text-sm font-medium border-b-2 transition-colors
        {activeTab === val
          ? 'border-brand-500 text-brand-600 dark:text-brand-400'
          : 'border-transparent text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'}"
    >
      {label}
    </button>
  {/each}
</div>

{#if error}
  <div class="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg text-sm text-red-700 dark:text-red-300" role="alert">{error}</div>
{/if}

<!-- Review queue tab -->
{#if activeTab === 'queue'}
  {#if queue.length === 0}
    <p class="text-center text-surface-400 py-16">Queue is clear.</p>
  {:else}
    <ul class="divide-y divide-surface-200 dark:divide-surface-800" aria-label="Review queue">
      {#each queue as item (item.id)}
        <li class="py-6">
          <div class="flex items-start gap-4">
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-1 text-sm">
                <a href="/posts/{item.id}" class="font-semibold hover:underline text-brand-600 dark:text-brand-400"
                  target="_blank" rel="noopener">View post ↗</a>
                <span class="text-surface-400">·</span>
                <span class="text-surface-500">@{item.authorHandle}</span>
                <span class="text-surface-400">·</span>
                <span class="text-surface-500">#{item.spaceSlug}</span>
              </div>
              <p class="text-xs text-surface-400">
                {item.flagCount} flag{item.flagCount !== 1 ? 's' : ''} ·
                {item.bodyLength} chars ·
                {new Date(item.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          <!-- Action panel — every action requires a Charter clause -->
          <div class="mt-4 grid sm:grid-cols-3 gap-3">
            <div>
              <label class="block text-xs text-surface-500 mb-1" for="action-{item.id}">Action</label>
              <select id="action-{item.id}" bind:value={actionType}
                class="w-full border border-surface-300 dark:border-surface-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-surface-900 min-h-[36px]">
                <option value="dismiss_flag">Dismiss flags (restore)</option>
                <option value="content_warning">Add content warning</option>
                <option value="lock_thread">Lock thread</option>
                <option value="remove_post">Remove post (panel only)</option>
              </select>
            </div>

            <div>
              <label class="block text-xs text-surface-500 mb-1" for="clause-{item.id}">Charter clause (required)</label>
              <select id="clause-{item.id}" bind:value={charterClause}
                class="w-full border border-surface-300 dark:border-surface-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-surface-900 min-h-[36px]">
                {#each CHARTER_CLAUSES as clause}
                  <option value={clause}>{clause}</option>
                {/each}
              </select>
            </div>

            <div>
              <label class="block text-xs text-surface-500 mb-1" for="rationale-{item.id}">Rationale (optional)</label>
              <input id="rationale-{item.id}" type="text" bind:value={rationale} maxlength="500"
                class="w-full border border-surface-300 dark:border-surface-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-surface-900 min-h-[36px]" />
            </div>
          </div>

          <div class="mt-3 flex gap-3">
            <button
              on:click={() => takeAction(item.id)}
              disabled={taking === item.id}
              class="text-sm bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white px-4 py-2 rounded-full transition-colors min-h-[40px]"
            >
              {taking === item.id ? 'Submitting…' : 'Submit action'}
            </button>
            <a href="/posts/{item.id}/escalate" class="text-sm border border-surface-300 dark:border-surface-700 px-4 py-2 rounded-full hover:border-brand-400 transition-colors min-h-[40px] flex items-center">
              Escalate to panel
            </a>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
{/if}

<!-- Government requests tab -->
{#if activeTab === 'gov'}
  <div class="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg text-sm text-amber-800 dark:text-amber-300">
    All requests below are publicly logged in transparency reports per Charter §5.1.
    Requests are evaluated against the Charter, not the requesting country's domestic law.
  </div>

  {#if govRequests.length === 0}
    <p class="text-center text-surface-400 py-16">No government requests received.</p>
  {:else}
    <div class="overflow-x-auto">
      <table class="w-full text-sm" aria-label="Government requests log">
        <thead>
          <tr class="text-left text-xs text-surface-500 uppercase tracking-wide border-b border-surface-200 dark:border-surface-800">
            <th class="pb-2 pr-4">Country</th>
            <th class="pb-2 pr-4">Type</th>
            <th class="pb-2 pr-4">Received</th>
            <th class="pb-2">Outcome</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-surface-100 dark:divide-surface-800">
          {#each govRequests as req (req.id)}
            <tr>
              <td class="py-3 pr-4 font-semibold uppercase">{req.requestingCountry}</td>
              <td class="py-3 pr-4 text-surface-600 dark:text-surface-300">{req.requestType.replace(/_/g, ' ')}</td>
              <td class="py-3 pr-4 text-surface-500">{new Date(req.receivedAt).toLocaleDateString()}</td>
              <td class="py-3">
                <span class="px-2 py-0.5 rounded-full text-xs font-medium
                  {req.outcome === 'refused' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                   req.outcome === 'pending'  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' :
                                               'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'}">
                  {req.outcome}
                </span>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
{/if}
