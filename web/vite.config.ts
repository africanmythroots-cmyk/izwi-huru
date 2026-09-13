import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      '/auth': 'http://127.0.0.1:3000',
      '/posts': {
        target: 'http://127.0.0.1:3000',
        bypass: (req) => (req.headers.accept?.includes('text/html') ? req.url : undefined),
      },
      '/feed': {
        target: 'http://127.0.0.1:3000',
        bypass: (req) => (req.headers.accept?.includes('text/html') ? req.url : undefined),
      },
      '/spaces': {
        target: 'http://127.0.0.1:3000',
        bypass: (req) => (req.headers.accept?.includes('text/html') ? req.url : undefined),
      },
      '/users': {
        target: 'http://127.0.0.1:3000',
        bypass: (req) => (req.headers.accept?.includes('text/html') ? req.url : undefined),
      },
      '/mod': {
        target: 'http://127.0.0.1:3000',
        bypass: (req) => (req.headers.accept?.includes('text/html') ? req.url : undefined),
      },
      '/transparency': {
        target: 'http://127.0.0.1:3000',
        bypass: (req) => (req.headers.accept?.includes('text/html') ? req.url : undefined),
      },
    },
  },
});
