import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    port: 4173,
    strictPort: false,
    proxy: {
      '/auth': 'http://127.0.0.1:3000',
      '/posts': 'http://127.0.0.1:3000',
      '/feed': 'http://127.0.0.1:3000',
      '/spaces': 'http://127.0.0.1:3000',
      '/users': 'http://127.0.0.1:3000',
      '/mod': 'http://127.0.0.1:3000',
      '/transparency': 'http://127.0.0.1:3000',
    },
  },
});
