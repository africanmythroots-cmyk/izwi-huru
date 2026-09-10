# Izwi Huru

**"Free Voice"** — a pan-African discussion platform for pseudonymous, fearless speech.

> *izwi* = voice (Zulu) · *huru* = free (Swahili)

---

## Project Structure

```
izwi-huru/
├── docs/
│   ├── CHARTER.md          ← The Pan-African Charter (public, always accessible)
│   └── adr/
│       └── 001-architecture-stack.md
├── backend/                ← Fastify + TypeScript API
│   ├── src/
│   │   ├── index.ts
│   │   ├── env.ts
│   │   ├── db.ts
│   │   ├── crypto.ts
│   │   ├── auth/
│   │   ├── api/
│   │   ├── feed/
│   │   ├── moderation/
│   │   └── transparency/
│   └── migrations/         ← PostgreSQL SQL migrations (001–007)
├── web/                    ← SvelteKit + Tailwind frontend (PWA)
│   └── src/routes/
│       ├── +layout.svelte
│       ├── +page.svelte    ← Landing page
│       ├── register/
│       └── charter/
├── mobile/                 ← React Native + Expo app (< 15 MB APK target)
│   └── src/lib/api.ts      ← Mirror-fallback API client
└── infra/
    └── SETUP.md            ← Tor hidden service, mirrors, backups, Docker Compose
```

---

## Core Principles (build everything against these)

1. **No PII ever** — handle + passphrase hash only. No email, no phone, no IP logged.
2. **Tor/VPN-first** — rate limiting is session-based, not IP-based. Onion address is first-class.
3. **Censorship-resilient** — ≥ 3 domains on different registrars + v3 onion service.
4. **Charter-bound moderation** — every action must cite a Charter clause. No silent removals.
5. **Chronological by default** — trending is opt-in, trust-weighted, never engagement-optimised.
6. **No analytics, no ads, no third parties** — self-hosted everything.

---

## Quickstart (Development)

### Backend

```bash
cd backend
cp .env.example .env
# Fill in DATABASE_URL, BODY_ENCRYPT_KEY, ALTCHA_SECRET
npm install
npm run migrate
npm run dev
```

### Web

```bash
cd web
npm install
npm run dev
```

### Mobile

```bash
cd mobile
npm install
npx expo start
```

---

## Running Migrations

```bash
cd backend
# Run all migrations in order
for f in migrations/*.sql; do psql $DATABASE_URL -f "$f"; done
```

---

## Self-Review Loop

Every feature is checked against `izwi_huru_self_review_loop.md` before being marked complete.
The checklist is not optional. It runs after every unit of work.

---

## Contributing

Source is hosted on a self-hosted Forgejo instance (not GitHub).
Contact the project team via the platform itself for access.

---

## Legal

The Pan-African Charter is the governing document for all content decisions.
The platform is a Swiss nonprofit association. Hosted in Iceland.
See `docs/CHARTER.md` for full details.
