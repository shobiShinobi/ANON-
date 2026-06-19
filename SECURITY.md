# ANON — Security & Reliability Posture

This document maps every item on the project security/reliability checklist to its
status in this codebase: **Implemented** (in code, with the file that owns it),
**Configured** (operational setting / CI), or **Documented** (process or
infrastructure guidance for a production deployment). Prototype-honest: where
something is a deployment responsibility rather than app code, it says so.

> Report a vulnerability: open a private security advisory on the repository, or
> email the maintainer. Please do not file public issues for security bugs.

---

## Architecture in one paragraph

A single deployable Node/Express server backs a React (Vite) SPA. Identity is
**anonymous and self-custodial**: the browser generates a 12-word recovery seed
(CSPRNG), which acts like a wallet key and lives only in `localStorage`. The seed
is sent to the server only to authenticate; the server stores **only an scrypt
hash** of it and never any email or PII. Sessions are short-lived JWTs held in
memory. This keeps the "your identity lives on your device" peer-to-peer feel of
the original mesh prototype while being hostable as a normal web app.

---

## Checklist mapping

### 1. Input sanitization & injection prevention — ✅ Implemented
- All SQL uses **parameterized prepared statements** (`better-sqlite3`), never
  string interpolation — see [`server/app.js`](server/app.js) and
  [`server/db.js`](server/db.js). No SQL injection surface.
- All user text is passed through [`server/validate.js`](server/validate.js):
  HTML stripped (`sanitize-html`, no tags allowed), control characters removed,
  length-capped. Colors/emoji/IDs/seeds are allow-list validated by regex.
- React escapes on render; we additionally never store markup. JSON body size is
  capped at 16 kB; uploads are validated by **magic bytes**, not the client-sent
  MIME type ([`server/uploads.js`](server/uploads.js)).
- Tests: `tests/api.test.js` ("strips html from post text"), `tests/unit.test.js`.

### 2. Authentication, authorization, roles & permissions — ✅ Implemented
- **AuthN:** seed-based, scrypt-verified, constant-time compare
  ([`server/auth.js`](server/auth.js)). Login timing is equalized whether or not
  the account exists.
- **AuthZ:** every mutating route requires a valid Bearer token; the actor is
  taken from the **token subject (`req.userId`)**, never from the request body.
  This closes the original prototype's hole where anyone could post/vote/delete as
  any `authorId`. A user can only edit/destroy **their own** identity.
- **Roles:** the model is capability-based today (author / voter / self-owner).
  Reputation tiers (`Trusted / Neutral / Untrustworthy`) gate trust weighting, not
  permissions. *Future:* a `moderator` role for takedowns would slot into
  `requireAuth` as a claim check — noted, not yet implemented.

### 3. Session management & token expiry — ✅ Implemented
- JWT access tokens, signed (HS256) with `JWT_SECRET`, `issuer` pinned, **1h
  expiry** (configurable via `JWT_EXPIRES_IN`).
- Token kept in JS memory (not `localStorage`) to reduce XSS token theft; the
  client silently re-authenticates from the stored seed on `401`
  ([`src/api.js`](src/api.js) `silentLogin`).
- Logout and "destroy identity" clear local state; destroy also purges the user's
  rows server-side.

### 4. Secrets management — ✅ Implemented / Configured
- All secrets via environment ([`server/config.js`](server/config.js), `.env`
  which is git-ignored). `.env.example` documents every key.
- **Boot guard:** the server refuses to start in `production` with a missing or
  default `JWT_SECRET`. In dev it falls back to an ephemeral random secret and
  warns.
- No secrets in the repo, logs, or client bundle. Seed never persisted in
  plaintext anywhere.

### 5. HTTPS / TLS / certificate rotation — 📄 Documented
- App is HTTP behind a TLS-terminating reverse proxy. `helmet` sets HSTS; set
  `TRUST_PROXY=1` so secure-context and client IPs are correct behind the proxy.
- Full nginx + Let's Encrypt (auto-renewing certs) and Caddy (automatic TLS)
  recipes are in [`DEPLOYMENT.md`](DEPLOYMENT.md). Certificate rotation is handled
  by `certbot renew` / Caddy automatically.

### 6. Rate limiting & abuse prevention — ✅ Implemented
- `express-rate-limit` ([`server/app.js`](server/app.js)): auth endpoints
  20/15min/IP; writes 30/min keyed by user (fallback IP); reads 200/min/IP.
- Economic abuse control retained from the design: **Mana** gates posting (50) and
  voting (5) and regenerates over time. One-vote-per-post is enforced in the DB.

### 7. Dependency scanning & vulnerability patching — ✅ Configured
- CI job `dependency-audit` runs `npm audit --omit=dev --audit-level=high` and
  **fails the build** on high/critical advisories ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)).
- `npm run audit` for local checks. Recommend enabling Dependabot/Renovate for
  automated patch PRs (config note in DEPLOYMENT.md).

### 8. Multi-tenancy & data isolation — 📄 Documented + ✅ partial
- Deployment model is **one instance per campus tenant** — the strongest isolation
  (separate process, DB file, uploads volume, origin). No cross-tenant queries
  exist because there is no shared store.
- Within an instance, all rows are public-by-design (it's a public rumor board),
  so the isolation boundary is the tenant, not the row. A future federated mode
  would add a `tenantId` column and scope every query by it.

### 9. PII handling, retention & deletion — ✅ Implemented
- **Minimization:** no email, name, or IP is stored as PII. The campus email is
  SHA-256 hashed *in the browser*; only the hash is sent, used solely to prevent
  duplicate signups. Audit logs store IP for security forensics only (see §11) and
  are subject to the retention policy below.
- **Deletion:** `DELETE /api/me` erases the user and all of their posts/votes and
  uploaded images (right-to-erasure friendly). Self-service, no support ticket.
- **Retention:** feed content persists until the author deletes it or destroys
  their identity. Recommended audit-log retention: 90 days, then rotate/purge
  (operational cron — see DEPLOYMENT.md).

### 10. Regulatory compliance (GDPR / HIPAA) — 📄 Documented
- **GDPR:** strong posture by design — data minimization (no PII), purpose
  limitation, self-service erasure, no third-party processors/trackers. Lawful
  basis is user consent at signup. A short privacy notice belongs on the signup
  screen for a real launch.
- **HIPAA:** **out of scope / not applicable** — ANON is not a healthcare system
  and must not be used to store PHI. If that ever changed, it would require a BAA
  with the host, encryption at rest, and far stricter access controls.

### 11. Audit trails & tamper-evident logging — ✅ Implemented
- Append-only `audit_log` table with a **SHA-256 hash chain** (each row hashes the
  previous row's hash) — [`server/audit.js`](server/audit.js). Any retroactive
  edit/delete breaks the chain. `GET /api/audit/verify` reports integrity; a test
  proves tampering is detected (`tests/api.test.js`).
- Logged events: register, login (success/fail), post, vote, profile update,
  identity destroy — with actor and IP.

### 12. Unit, integration & end-to-end tests — ✅ Implemented
- **Unit:** `tests/unit.test.js` — crypto (scrypt, JWT), validation, reputation math.
- **Integration:** `tests/api.test.js` — full HTTP flows via `supertest`
  (auth, authz, posting, voting, profiles, audit).
- **End-to-end:** the live SPA↔API↔WS stack was driven through register → seed
  reveal → post → feed → profile customization during development (browser
  automation). For CI-grade E2E, a Playwright suite is the recommended next step
  (scaffold note in DEPLOYMENT.md).

### 13. Regression tests — ✅ Implemented
- The 28-test suite encodes the fixed bugs/behaviors (double-vote lock, mana
  spend, html stripping, spoofed-image rejection, auth spoofing) and runs on every
  push/PR, acting as the regression gate.

### 14. Load & stress testing — 📄 Documented
- Quick local load test (no new deps):
  `npx autocannon -c 50 -d 20 http://localhost:5000/api/feed`.
- Expect read endpoints to be SQLite-bound; WAL mode (enabled in `db.js`) keeps
  reads concurrent with writes. DEPLOYMENT.md documents scaling limits of the
  single-writer SQLite model and the Postgres migration path.

### 15. Chaos engineering & resilience testing — 📄 Documented
- Graceful degradation is built in: if the realtime WebSocket drops, the client
  falls back to fetch-on-action (verified in the browser by killing the socket).
- Recommended chaos drills (DEPLOYMENT.md): kill the container mid-write (WAL
  recovery), exhaust the uploads volume, induce proxy 502s, and confirm
  auto-restart (`restart: unless-stopped` / orchestrator) and healthcheck.

### 16. Coverage thresholds enforced in CI — ✅ Configured
- `vitest.config.js` enforces **lines/stmts/funcs ≥ 70%, branches ≥ 60%**; CI runs
  `test:coverage` so a drop fails the build. Current: ~87% lines.

### 17. Code review process & standards — 📄 Documented
- Branch protection + required CI + 1 review is the intended policy. A PR template
  and `CONTRIBUTING.md` checklist (tests added, no secrets, audit clean, docs
  updated) are recommended — see DEPLOYMENT.md. `'use strict'` modules, prepared
  statements, and centralized validation are the enforced standards.

### 18. Error handling & graceful degradation — ✅ Implemented
- Centralized Express error handler returns **safe JSON, never stack traces**
  ([`server/app.js`](server/app.js)); maps known errors (CORS, oversized upload,
  bad image) to correct status codes. Audit writes are wrapped so logging can
  never crash a request. Client surfaces friendly toasts and keeps working when
  realtime is unavailable.

### 19. Retry logic, backoff & idempotency — ✅ Implemented (app-level)
- Client retries once on token expiry after a silent re-auth, then surfaces the
  error (no infinite loops) — [`src/api.js`](src/api.js).
- **Idempotency:** voting is idempotent per `(voter, post)` via a DB uniqueness
  check returning `429` on repeats; mana spend is atomic (see §21) so a retried
  request can't double-charge.

### 20. Circuit breakers & fallback behavior — 📄 Documented + ✅ partial
- Client-side fallback (realtime → polling) is implemented. A server-side circuit
  breaker matters once external dependencies (object storage, Postgres) are added;
  the recommended pattern (e.g. `opossum` around the storage client) is noted in
  DEPLOYMENT.md.

### 21. Concurrency & race-condition prevention — ✅ Implemented
- Mana is spent with a **conditional atomic UPDATE**
  (`UPDATE ... SET mana = mana - ? WHERE id = ? AND mana >= ?`) and the affected
  row count is checked — two concurrent posts can't drive mana negative.
- Vote double-submit is prevented by the per-(voter,post) uniqueness check inside
  the request, plus an optimistic UI lock. `better-sqlite3` is synchronous, so
  each statement is atomic; WAL serializes writes safely.

### 22. Caching strategy & invalidation — 📄 Documented + ✅ partial
- Static assets are content-hashed by Vite and served `immutable` with long
  max-age; uploaded images are served with a 7-day cache + `nosniff`. The feed is
  intentionally **not cached** (freshness over hit-rate) and invalidates live via
  the WebSocket `NEW_NODE` push. A future read-through cache (Redis) for the feed
  is described in DEPLOYMENT.md with TTL + push-invalidation.

### 23. RTO & RPO — 📄 Documented
- **RPO (data loss tolerance):** ≤ 24h with nightly DB+uploads snapshots; ≤ 5min
  if WAL is shipped continuously. **RTO (time to restore):** ≤ 30min — rebuild the
  container from image and restore the data/uploads volumes. Concrete commands in
  DEPLOYMENT.md.

### 24. Disaster recovery plan — 📄 Documented
- Backups (volume snapshots of `DB_FILE` + `UPLOAD_DIR`), restore drill, and a
  redeploy runbook are in [`DEPLOYMENT.md`](DEPLOYMENT.md). Because identities are
  self-custodial, users can always recover their account from their seed even if a
  node is rebuilt from a peer/backup.

---

## Known limitations (prototype honesty)
- Single-writer SQLite caps write throughput; fine for a campus, not for millions.
  Postgres migration path documented.
- The campus-email hash provides Sybil resistance only as far as `.edu` address
  scarcity; it is a low-entropy hash and is stored only for dedup.
- No CSRF tokens are needed because auth is a Bearer header (not a cookie) and CORS
  is allow-listed; revisit if switching to cookie sessions.
- No admin/moderation tooling yet — takedowns rely on authors deleting content.
