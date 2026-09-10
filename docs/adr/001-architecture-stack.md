# ADR-001 — Architecture & Stack Decision

**Status**: Accepted
**Date**: September 2026
**Deciders**: Project founder (approved)

---

## Context

Izwi Huru requires a technology stack that satisfies a specific threat model:
- Users must be safe from government deanonymisation
- Platform must remain reachable even if one or more countries block it
- Must work on low-bandwidth, low-storage Android devices
- Must work over Tor and VPNs without degradation
- Must be fully self-hostable with no third-party service dependencies
  that could be compelled or shut down

## Decision

### Backend
- **Runtime**: Node.js (LTS) with TypeScript
- **Framework**: Fastify (performance, schema validation, low overhead)
- **API style**: REST with Zod validation; WebSocket for live feed updates
- **Auth**: Custom session tokens (bcrypt hash stored server-side; raw token
  never stored); no OAuth; no third-party identity providers
- **Task queue**: BullMQ backed by Redis (Valkey)
- **Search**: Meilisearch (self-hosted, no telemetry)
- **Monitoring**: Grafana + Prometheus (self-hosted, no data leaves server)

### Database
- **Primary**: PostgreSQL 16 with pgcrypto for at-rest encryption
- **Cache/sessions**: Redis (Valkey fork)
- **No IP addresses stored anywhere** — not in logs, not in DB, not in cache

### Web Frontend
- **Framework**: SvelteKit (smallest production bundle; SSR compatible with Tor)
- **Styling**: Tailwind CSS (no runtime; purges unused CSS)
- **i18n**: svelte-i18n (Swahili + English v1; RTL-ready for Arabic/Amharic)
- **PWA**: Workbox service worker (offline charter/thread cache; post queue)
- **Analytics**: None

### Mobile
- **Framework**: React Native with Expo managed workflow
- **Target APK size**: < 15 MB (split ABI builds via EAS Build)
- **Offline**: op-sqlite (SQLite) for feed/thread cache; MMKV for settings
- **Notifications**: Self-hosted ntfy.sh (opt-in; no Firebase)

### Infrastructure
- **Hosting**: 1984 Hosting or Njord (Iceland) — IMMI framework, no-log policy
- **Legal entity**: Swiss nonprofit association (Verein / Association)
- **DNS**: Primary via Porkbun; secondary privacy-preserving via Njalla
- **CDN**: None by default; BunnyCDN for static assets only if needed
  (never proxy the main application — blocks Tor)
- **Onion**: v3 Tor hidden service (first-class, always-on)
- **Mirror domains**: ≥ 2 additional domains on separate registrars
- **TLS**: Let's Encrypt + HSTS preload
- **Backups**: Restic → Backblaze B2 (encrypted before upload)
- **CI/CD**: Self-hosted Forgejo (Gitea fork) — no GitHub dependency
- **Containers**: Docker Compose (development); Nomad or bare Docker (production)

## Consequences

- **TypeScript across backend and web** means shared type definitions and
  a single language for most contributors
- **No phone/email auth** means account recovery is handled differently
  (BIP39 mnemonic, client-side; server never sees it)
- **No CDN proxy** means origin server must be scaled appropriately; Iceland
  hosting capacity is adequate for initial launch
- **Self-hosted everything** means higher operational burden; mitigated by
  Docker Compose + detailed runbooks
- **Forgejo over GitHub** means contributors must register on the self-hosted
  instance; this is acceptable for the threat model

## Alternatives Considered and Rejected

| Alternative | Rejected Because |
|-------------|-----------------|
| Adapt Lemmy | Rust + ActivityPub federation leaks metadata; identity model incompatible |
| Next.js instead of SvelteKit | Larger bundle; React overhead; SvelteKit SSR is cleaner for Tor |
| Flutter instead of React Native | Larger baseline APK; JS team reuse favours RN |
| Google Firebase | Third-party; compellable; deanonymisation risk |
| Cloudflare proxy | Blocks Tor exit nodes; MITM on TLS |
| Netherlands hosting | More integrated into EU legal cooperation frameworks |
