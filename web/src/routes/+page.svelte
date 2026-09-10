<!-- src/routes/+page.svelte -->
<!-- Landing page — mission statement, call to action, no tracking -->
<script lang="ts">
  import { _ } from '$lib/i18n';
</script>

<svelte:head>
  <title>Izwi Huru — {$_('app.tagline')}</title>
  <meta name="description" content="A pan-African discussion platform for free, safe, and pseudonymous speech." />
</svelte:head>

<!-- Hero -->
<section class="text-center py-16 px-4">
  <h1 class="text-4xl sm:text-5xl font-bold tracking-tight text-brand-600 dark:text-brand-400">
    Izwi Huru
  </h1>
  <p class="mt-4 text-xl text-surface-600 dark:text-surface-300 max-w-xl mx-auto">
    {$_('app.tagline')}
  </p>
  <p class="mt-3 text-surface-500 dark:text-surface-400 max-w-xl mx-auto">
    A pan-African platform to ask questions, share ideas, and respond — without fear of what comes after you speak.
  </p>
  <div class="mt-8 flex flex-wrap justify-center gap-4">
    <a
      href="/register"
      class="bg-brand-500 hover:bg-brand-600 text-white font-semibold px-6 py-3 rounded-full transition-colors min-h-[44px] flex items-center"
    >
      Join — it's free
    </a>
    <a
      href="/charter"
      class="border border-brand-500 text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 font-semibold px-6 py-3 rounded-full transition-colors min-h-[44px] flex items-center"
    >
      Read the Charter
    </a>
  </div>
</section>

<!-- Mission points -->
<section class="grid sm:grid-cols-3 gap-6 mt-4" aria-label="Platform principles">
  {#each [
    {
      title: 'Pseudonymous by design',
      body: 'No phone number. No email. No national ID. Pick a handle, choose a passphrase, and that is all we know about you.',
    },
    {
      title: 'Pan-African from day one',
      body: 'Not limited to one country, one government, or one language. 54 countries. Hundreds of languages. One platform.',
    },
    {
      title: 'Governed by a public Charter',
      body: 'Every moderation decision is made against a public document. No moderator can silently remove political speech. Every government request is logged.',
    },
  ] as card}
    <article class="bg-white dark:bg-surface-900 rounded-xl p-6 border border-surface-200 dark:border-surface-800">
      <h2 class="font-semibold text-lg mb-2">{card.title}</h2>
      <p class="text-surface-600 dark:text-surface-300 text-sm leading-relaxed">{card.body}</p>
    </article>
  {/each}
</section>

<!-- Offline-safe Charter teaser -->
<section class="mt-16 bg-surface-100 dark:bg-surface-900 rounded-xl p-8 text-center">
  <p class="text-surface-600 dark:text-surface-300">
    The <a href="/charter" class="text-brand-600 dark:text-brand-400 underline underline-offset-2">Pan-African Charter</a>
    is always publicly accessible — on this site, every mirror, and our Tor hidden service.
    It cannot be paywalled, login-gated, or removed.
  </p>
</section>
