<!-- src/routes/charter/+page.svelte -->
<!-- The Charter is always publicly accessible, cached offline by the service worker. -->
<!-- It is server-side rendered so it works even with JavaScript disabled. -->
<script lang="ts">
  import { _ } from '$lib/i18n';
  import type { PageData } from './$types';
  export let data: PageData;
</script>

<svelte:head>
  <title>{$_('charter.title')} — Izwi Huru</title>
  <meta name="description" content="The public charter governing all content and moderation on Izwi Huru." />
  <!-- Charter page IS indexed — it should be findable -->
  <meta name="robots" content="index, follow" />
</svelte:head>

<article class="prose dark:prose-invert max-w-3xl mx-auto">
  <!-- The charter content is rendered from the markdown file served by the backend.
       For now we render it statically; in production it is loaded at build time. -->
  {@html data.charterHtml}
</article>

<aside class="mt-12 p-4 bg-surface-100 dark:bg-surface-900 rounded-xl text-sm text-surface-600 dark:text-surface-300">
  <p>
    This Charter is also available on our
    <a class="text-brand-600 dark:text-brand-400 underline" href="/.onion" rel="noopener">Tor hidden service</a>
    and all mirror domains. It cannot be removed or paywalled.
  </p>
  <p class="mt-2">
    Published under <a class="text-brand-600 dark:text-brand-400 underline" href="https://creativecommons.org/publicdomain/zero/1.0/" rel="noopener">CC0</a>
    — free to copy and adapt without attribution.
  </p>
</aside>
