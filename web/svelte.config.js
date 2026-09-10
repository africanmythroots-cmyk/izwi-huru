import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter(),
    // Content-Security-Policy enforced server-side via Fastify (backend),
    // and mirrored here for the SvelteKit layer.
    csp: {
      mode: 'auto',
      directives: {
        'default-src':  ['self'],
        'script-src':   ['self'],
        'style-src':    ['self', 'unsafe-inline'], // Tailwind inline styles
        'img-src':      ['self', 'data:'],
        'font-src':     ['self'],
        'connect-src':  ['self'],
        'frame-src':    ['none'],
        'object-src':   ['none'],
        'base-uri':     ['self'],
      },
    },
  },
};

export default config;
