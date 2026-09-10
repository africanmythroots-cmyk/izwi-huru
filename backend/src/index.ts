// src/index.ts
// Main Fastify server entry point.

import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';

import { env } from './env.js';
import { authRoutes } from './auth/routes.js';
import { sessionMiddleware } from './middleware/session.js';
import { registerRateLimits } from './middleware/rateLimit.js';
import { spacesRoutes } from './api/spaces.js';
import { postsRoutes } from './api/posts.js';
import { feedRoutes } from './feed/routes.js';
import { moderationRoutes } from './moderation/routes.js';
import { transparencyRoutes } from './transparency/routes.js';
import { usersRoutes } from './api/users.js';

async function build() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'warn' : 'info',
      // IMPORTANT: Redact any field that might carry user data in logs
      redact: ['req.headers.cookie', 'req.body.passphrase', 'req.body.recoveryToken'],
    },
    // Do not expose server version
    disableRequestLogging: false,
  });

  // ─── Security headers ─────────────────────────────────────────────────────
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc:  ["'self'"],
        scriptSrc:   ["'self'"],
        styleSrc:    ["'self'"],
        imgSrc:      ["'self'", 'data:'],
        fontSrc:     ["'self'"],
        connectSrc:  ["'self'"],
        frameSrc:    ["'none'"],
        objectSrc:   ["'none'"],
        baseUri:     ["'self'"],
        formAction:  ["'self'"],
      },
    },
    // Remove X-Powered-By (don't fingerprint the server)
    hidePoweredBy: true,
    // Prevent MIME type sniffing
    noSniff: true,
    // Referrer policy: no referrer outside origin
    referrerPolicy: { policy: 'same-origin' },
  });

  // ─── CORS: mirror domains, onion, and localhost only ─────────────────────────
  await app.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (like mobile apps, curl, server-side SSR)
      if (!origin) return cb(null, true);

      // In non-production: allow localhost
      if (env.NODE_ENV !== 'production' && /localhost|127\.0\.0\.1/.test(origin)) {
        return cb(null, true);
      }

      // Allow official Izwi Huru mirror domains and Tor onion addresses
      const trustedOriginPattern = /^(https?:\/\/)?([a-z0-9-]+\.)*(izwihuru\.org|izwi-huru\.net|izwihuru\.io|\.onion)(:\d+)?$/i;
      if (trustedOriginPattern.test(origin)) {
        return cb(null, true);
      }

      return cb(new Error('Blocked by CORS policy'), false);
    },
    credentials: true,
  });

  // ─── Cookies ─────────────────────────────────────────────────────────────
  await app.register(cookie);

  // ─── Rate limiting ────────────────────────────────────────────────────────
  await registerRateLimits(app);

  // ─── Session middleware ───────────────────────────────────────────────────
  await sessionMiddleware(app);

  // ─── Routes ──────────────────────────────────────────────────────────────
  await app.register(authRoutes,         { prefix: '' });
  await app.register(spacesRoutes,       { prefix: '/spaces' });
  await app.register(postsRoutes,        { prefix: '/posts' });
  await app.register(feedRoutes,         { prefix: '/feed' });
  await app.register(usersRoutes,        { prefix: '/users' });
  await app.register(moderationRoutes,   { prefix: '/mod' });
  await app.register(transparencyRoutes, { prefix: '/transparency' });

  // Health check (no auth, no data exposure)
  app.get('/health', async () => ({ ok: true }));

  return app;
}

async function start() {
  const app = await build();
  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    console.log(`🟢 Izwi Huru backend running on ${env.HOST}:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
