# Deploying ANON

ANON ships as a **single container**: one Node/Express process serves the built
React SPA, the JSON API, uploaded images, and the realtime WebSocket — all on one
origin. Put a TLS-terminating reverse proxy in front of it and you're done.

---

## 1. Configuration

Copy `.env.example` → `.env` and set, at minimum:

```bash
NODE_ENV=production
PORT=5000
JWT_SECRET=$(openssl rand -hex 48)      # REQUIRED — server refuses to boot in prod without a strong one
CORS_ORIGINS=https://anon.yourcampus.edu
TRUST_PROXY=1                            # behind nginx/Caddy/LB
DB_FILE=/app/data/anon.db
UPLOAD_DIR=/app/uploads
```

The server **fails fast** in production if `JWT_SECRET` is missing or still the
default — this is intentional.

---

## 2. Run it

### Option A — Docker Compose (recommended)
```bash
export JWT_SECRET=$(openssl rand -hex 48)
export CORS_ORIGINS=https://anon.yourcampus.edu
docker compose up -d --build
```
Data and uploads live in named volumes (`anon-data`, `anon-uploads`) and survive
restarts/redeploys. A container `HEALTHCHECK` polls `/api/health`.

### Option B — Bare Node
```bash
npm ci
npm run build           # produces dist/
NODE_ENV=production node server/server.js
```
Use a process manager (`pm2`, systemd) with auto-restart.

---

## 3. HTTPS / TLS

The app speaks HTTP; terminate TLS at the proxy. **Caddy** is the least-effort
option (automatic Let's Encrypt issuance *and* renewal):

```caddy
anon.yourcampus.edu {
    reverse_proxy localhost:5000
}
```

**nginx + certbot** equivalent:

```nginx
server {
    listen 443 ssl http2;
    server_name anon.yourcampus.edu;

    ssl_certificate     /etc/letsencrypt/live/anon.yourcampus.edu/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/anon.yourcampus.edu/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket upgrade for /ws realtime
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
# Redirect 80 -> 443 omitted for brevity.
```

**Certificate rotation:** `certbot renew` runs via its systemd timer/cron and
reloads nginx; Caddy renews automatically. Set `TRUST_PROXY=1` so HSTS and client
IPs are correct.

---

## 4. Backups, RTO & RPO

Everything stateful is two paths: the SQLite file (`DB_FILE`) and the uploads dir
(`UPLOAD_DIR`).

```bash
# Nightly backup (cron). sqlite3 .backup is safe during writes (WAL).
sqlite3 /app/data/anon.db ".backup '/backups/anon-$(date +%F).db'"
tar czf /backups/uploads-$(date +%F).tgz -C /app uploads
```

- **RPO ≤ 24h** with nightly snapshots; ≤ 5 min if you ship the WAL continuously.
- **RTO ≤ 30 min:** `docker compose up -d --build`, then restore the latest DB and
  uploads into the volumes.

**Restore drill (run quarterly):**
```bash
docker compose down
# copy backup files into the anon-data / anon-uploads volumes, then:
docker compose up -d
curl -fsS https://anon.yourcampus.edu/api/health
curl -fsS https://anon.yourcampus.edu/api/audit/verify   # expect {"ok":true,...}
```

---

## 5. Operational hardening checklist

- [ ] `JWT_SECRET` set from a secret manager (not committed).
- [ ] `CORS_ORIGINS` pinned to the real frontend origin.
- [ ] Reverse proxy enforces HTTPS + HSTS; HTTP→HTTPS redirect on.
- [ ] Container runs as non-root (`USER node`, already set in the Dockerfile).
- [ ] Dependabot/Renovate enabled; CI `dependency-audit` green.
- [ ] Audit-log retention cron (purge rows older than 90 days) scheduled.
- [ ] Off-host backups + a tested restore.
- [ ] Resource limits + auto-restart on the container/orchestrator.

---

## 6. Scaling & resilience notes

- **SQLite single-writer** is the throughput ceiling. WAL mode (on by default)
  keeps reads concurrent. For multi-instance/high-write loads, migrate to
  Postgres: the data layer is isolated in `server/db.js` + the prepared statements
  in `server/app.js`, so swapping the driver is localized.
- **Realtime fallback:** if the WS is unavailable the client polls on each action,
  so a proxy that drops upgrades degrades gracefully rather than breaking.
- **Chaos drills:** kill the container mid-write (WAL auto-recovers on restart);
  fill the uploads volume (uploads 4xx, posts without images still work); inject
  proxy 502s (client shows toast, retries on next action).
- **Recommended next steps for production-grade E2E/resilience:** a Playwright E2E
  suite in CI, an `opossum` circuit breaker once object storage/Postgres are
  introduced, and a Redis read-through cache for the feed (TTL + WS push
  invalidation).
