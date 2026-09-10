<!-- src/lib/components/NewPostBox.svelte -->
<!-- Compose new top-level post. Queues offline via service worker. -->
<script lang="ts">
  export let spaceId: string | undefined = undefined;
  export let parentId: string | undefined = undefined; // set for replies
  export let placeholder = 'Share a thought…';

  let body = '';
  let submitting = false;
  let error = '';
  let posted = false;

  // Queue the post via service worker if offline; otherwise POST directly.
  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    submitting = true;
    error = '';

    const payload = { body: body.trim(), spaceId, parentId };

    const doFetch = () =>
      fetch('/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });

    try {
      const res = await doFetch();
      if (!res.ok) {
        const json = await res.json();
        error = json.error ?? 'Post failed.';
        return;
      }
      body = '';
      posted = true;
      setTimeout(() => (posted = false), 3000);
    } catch {
      // Offline: queue via IndexedDB for background sync
      await queuePost(payload);
      body = '';
      posted = true;
      setTimeout(() => (posted = false), 3000);
    } finally {
      submitting = false;
    }
  }

  async function queuePost(payload: unknown) {
    const db: IDBDatabase = await new Promise((res) => {
      const req = indexedDB.open('izwi-huru-queue', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('post-queue', { keyPath: 'id', autoIncrement: true });
      req.onsuccess = () => res(req.result);
    });
    const tx = db.transaction('post-queue', 'readwrite');
    tx.objectStore('post-queue').add({
      url: '/posts',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    // Request background sync
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      await (reg as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } }).sync?.register('post-queue');
    }
  }
</script>

<div class="mb-6 bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 p-4">
  {#if posted}
    <p class="text-green-600 dark:text-green-400 text-sm py-2" role="status" aria-live="polite">
      Post submitted ✓
    </p>
  {:else}
    <form on:submit={submit} novalidate>
      {#if error}
        <p class="mb-2 text-red-600 dark:text-red-400 text-sm" role="alert">{error}</p>
      {/if}
      <label for="new-post-body" class="sr-only">New post</label>
      <textarea
        id="new-post-body"
        bind:value={body}
        rows="3"
        {placeholder}
        maxlength="10000"
        class="w-full bg-transparent resize-none text-sm focus:outline-none placeholder-surface-400"
        aria-label="Write a new post"
      ></textarea>
      <div class="flex items-center justify-between mt-2 pt-2 border-t border-surface-100 dark:border-surface-800">
        <span class="text-xs text-surface-400 tabular-nums">{body.length}/10 000</span>
        <button
          type="submit"
          disabled={submitting || !body.trim()}
          class="bg-brand-500 hover:bg-brand-600 disabled:opacity-40 text-white text-sm font-medium px-4 py-1.5 rounded-full transition-colors min-h-[36px]"
        >
          {submitting ? 'Posting…' : 'Post'}
        </button>
      </div>
    </form>
  {/if}
</div>
