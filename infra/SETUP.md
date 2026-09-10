# Izwi Huru — Infrastructure & Censorship-Resistance Setup

## Phase 10: Making the platform unreachable to shut down

---

## 1. Server Setup (Iceland — 1984 Hosting)

```bash
# Install Docker and Docker Compose
apt-get update && apt-get install -y docker.io docker-compose-plugin

# Clone the Forgejo repository (self-hosted Git)
git clone https://your-forgejo-instance/izwi-huru izwi-huru
cd izwi-huru
```

---

## 2. Tor Hidden Service Configuration

### Install Tor

```bash
apt-get install -y tor
```

### /etc/tor/torrc additions

```
# Izwi Huru v3 onion service
HiddenServiceDir /var/lib/tor/izwihuru/
HiddenServicePort 80 127.0.0.1:3000   # Backend API
HiddenServicePort 443 127.0.0.1:3001  # SvelteKit web
HiddenServiceVersion 3
```

```bash
systemctl restart tor

# Get the onion address (generated automatically)
cat /var/lib/tor/izwihuru/hostname
# → e.g. xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.onion
```

### Nginx config for onion routing

```nginx
# /etc/nginx/sites-available/izwihuru-onion
server {
    listen 127.0.0.1:3001;
    server_name *.onion;

    # Disable referrer headers on the onion site
    add_header Referrer-Policy "no-referrer" always;
    # Disable caching of sensitive pages
    add_header Cache-Control "no-store" always;
    # Onion-Location: tell Tor Browser users about this onion address
    add_header Onion-Location "http://[ONION_ADDRESS].onion$request_uri" always;

    location / {
        proxy_pass http://127.0.0.1:4173;   # SvelteKit preview/production
        proxy_set_header Host $host;
        # CRITICAL: Do not forward X-Forwarded-For — we don't log IPs
        proxy_set_header X-Forwarded-For "";
        proxy_set_header X-Real-IP "";
    }
}
```

---

## 3. Mirror Domain Setup

Register ≥ 2 additional domains on different registrars:

| Domain | Registrar | DNS |
|--------|-----------|-----|
| `izwihuru.org` | Porkbun | A → Iceland server IP |
| `izwi-huru.net` | Njalla (privacy proxy) | A → Iceland server IP |
| `izwihuru.io` | Epik | A → Iceland server IP |

### DNS hardening

```
; All domains: CAA record — only Let's Encrypt may issue certificates
izwihuru.org. CAA 0 issue "letsencrypt.org"
izwihuru.org. CAA 0 issuewild ";"

; DNSSEC enabled on all domains
; TTL: 3600s (short enough to update quickly if IP changes)
```

---

## 4. TLS — Let's Encrypt with HSTS Preload

```bash
apt-get install -y certbot python3-certbot-nginx

certbot --nginx -d izwihuru.org -d www.izwihuru.org
certbot --nginx -d izwi-huru.net
certbot --nginx -d izwihuru.io

# Auto-renewal
systemctl enable certbot.timer
```

Add to nginx config:

```nginx
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
```

Submit all domains to the HSTS preload list at https://hstspreload.org.

---

## 5. Onion-Location Header

Adds a banner in Tor Browser pointing users to the .onion address (better privacy).
Add to the main site's nginx config:

```nginx
add_header Onion-Location "http://[ONION_ADDRESS].onion$request_uri" always;
```

---

## 6. Encrypted Backups (Restic → Backblaze B2)

```bash
apt-get install -y restic

export B2_ACCOUNT_ID=xxx
export B2_ACCOUNT_KEY=xxx
export RESTIC_REPOSITORY="b2:izwihuru-backups"
export RESTIC_PASSWORD="$(cat /etc/izwihuru/backup-key)"

# Initialize repository (first time)
restic init

# Daily backup: database dump + app config (NO logs — we don't have user logs)
cat > /etc/cron.daily/izwihuru-backup << 'EOF'
#!/bin/bash
pg_dump $DATABASE_URL | restic backup --stdin --stdin-filename db.sql
restic backup /etc/izwihuru/
restic forget --keep-daily 30 --keep-weekly 12 --keep-monthly 6 --prune
EOF
chmod +x /etc/cron.daily/izwihuru-backup
```

---

## 7. Expired Session Cleanup (Cron)

```bash
cat > /etc/cron.daily/izwihuru-cleanup << 'EOF'
#!/bin/bash
psql $DATABASE_URL -c "DELETE FROM sessions WHERE expires_at < NOW();"
# Never delete government_requests or transparency_events — they are the audit trail
EOF
chmod +x /etc/cron.daily/izwihuru-cleanup
```

---

## 8. Docker Compose (Production)

```yaml
# infra/docker-compose.prod.yml
version: '3.9'
services:
  postgres:
    image: postgres:16-alpine
    restart: always
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: izwihuru
      POSTGRES_USER: izwihuru
      POSTGRES_PASSWORD_FILE: /run/secrets/pg_password
    secrets:
      - pg_password
    # No ports exposed to host — only internal network
    networks:
      - internal

  redis:
    image: valkey/valkey:7-alpine
    restart: always
    command: ["valkey-server", "--save", "60", "1", "--loglevel", "warning"]
    volumes:
      - redisdata:/data
    networks:
      - internal

  backend:
    build: ../backend
    restart: always
    environment:
      NODE_ENV: production
      DATABASE_URL: postgres://izwihuru:${PG_PASSWORD}@postgres:5432/izwihuru
      REDIS_URL: redis://redis:6379
      PORT: 3000
      HOST: 0.0.0.0
    env_file:
      - .env.production
    depends_on:
      - postgres
      - redis
    networks:
      - internal
      - external
    ports:
      - "127.0.0.1:3000:3000"   # Only bind to localhost — Nginx proxies in

  web:
    build: ../web
    restart: always
    depends_on:
      - backend
    networks:
      - external
    ports:
      - "127.0.0.1:4173:4173"

volumes:
  pgdata:
  redisdata:

networks:
  internal:
  external:

secrets:
  pg_password:
    file: ./secrets/pg_password.txt
```

---

## 9. What We Explicitly Do NOT Use

| Rejected | Reason |
|----------|--------|
| Cloudflare proxy | Blocks Tor exit nodes; acts as TLS MITM |
| Google Analytics / any analytics | No tracking, period |
| Firebase | Google service; compellable; deanonymises |
| AWS/GCP/Azure | US-jurisdiction; CLOUD Act; compellable |
| Heroku, Render, Fly.io | US-jurisdiction; limited control over logging |
| Any CDN that logs IPs | Defeats the no-IP-logging policy |
