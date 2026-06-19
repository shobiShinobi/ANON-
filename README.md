# ANON — Anonymous Campus Rumor Mesh

ANON is a campus-verified, **anonymous** social board where students post rumors
and the community **verifies** or **disputes** them. Trust scores and reputation
emerge from consensus voting. Your identity is self-custodial — it lives on your
device, not in our database.

> **v2** turns the original local-only mesh *prototype* into a single,
> **deployment-ready** web app while preserving the anonymous, "keys-on-device"
> peer-to-peer feel. See [`SECURITY.md`](SECURITY.md) and
> [`DEPLOYMENT.md`](DEPLOYMENT.md).

---

## Features

- **Anonymous, self-custodial identity.** Sign up with a `.edu` email that is
  SHA-256 hashed **in your browser** — the server never receives or stores it. You
  get a public Node ID and a 12-word recovery seed (your private key). The seed is
  stored only in your browser and only ever hashed (scrypt) on the server.
- **Post rumors — now with images.** Up to 500 chars and/or one image (JPEG / PNG
  / GIF / WebP, ≤ 5 MB), validated by magic bytes server-side. Posting costs Mana.
- **Verify / dispute voting** with reputation-weighted trust scores and
  `VERIFIED / NEUTRAL / DISPUTED` badges.
- **Reputation** that rewards voting with consensus and penalizes trolling;
  surfaces `Trusted / Neutral / Untrustworthy` author tags.
- **Profile customization** — display name, bio, avatar emoji and color.
- **Mana economy** — posting (50) and voting (5) cost Mana, which regenerates,
  providing built-in spam/abuse resistance.
- **Live mesh feel** — realtime feed/Mana updates over WebSocket, a live network
  terminal, and a peer topology graph. Degrades gracefully to polling if realtime
  is unavailable.
- **Self-service data control** — log out, or destroy your identity and all of
  your content (GDPR-friendly erasure).

## Tech stack

- **Frontend:** React 18, Vite 5, Tailwind CSS v4
- **Backend:** Node.js, Express 4, `ws` WebSockets
- **Storage:** SQLite (`better-sqlite3`, WAL) + local image uploads
- **Security:** helmet, scrypt seed hashing, JWT sessions, rate limiting,
  sanitize-html, hash-chained audit log
- **Tests/CI:** Vitest + Supertest, coverage gates, GitHub Actions (+ `npm audit`)

---

## Quick start (development)

```bash
npm install
npm run dev:all      # backend on :5000, Vite web app on :5173
```

Open <http://localhost:5173>. The web app proxies the API and WebSocket to the
backend, so everything is same-origin.

> Prefer two terminals? Run `npm run dev:server` and `npm run dev` separately, or
> `node launcher.js`.

### Try it
1. **Sign up** with a `.edu` email and save your Node ID + seed phrase.
2. **Post** a rumor (optionally attach an image).
3. **Vote** verify/dispute and watch the trust badge and reputation update.
4. **Customize** your profile (avatar, color, bio) on the Profile tab.
5. **Recover** by logging out and logging back in with your Node ID + seed.
6. **Destroy identity** to erase your account and content.

---

## Production build

```bash
npm run build                      # outputs dist/
NODE_ENV=production JWT_SECRET=$(openssl rand -hex 48) node server/server.js
```

The single Node process now serves the built SPA, API, uploads, and WebSocket on
`PORT` (default 5000). For Docker, TLS, backups, and the full ops runbook, see
[`DEPLOYMENT.md`](DEPLOYMENT.md).

---

## Testing

```bash
npm test               # unit + integration (Vitest + Supertest)
npm run test:coverage  # with coverage thresholds (enforced in CI)
```

---

## Project layout

```
server/
  config.js       env/config + production secret guard
  db.js           SQLite open + schema/migrations
  auth.js         scrypt seed hashing + JWT + requireAuth middleware
  validate.js     input sanitization & allow-list validators
  uploads.js      multer + magic-byte image validation
  reputation.js   consensus-alignment reputation math
  audit.js        tamper-evident hash-chained audit log
  app.js          Express app: routes, rate limits, error handling
  server.js       HTTP + WebSocket + Mana regen + graceful shutdown
src/              React app (api client, onboarding, feed, profile, UI)
tests/            unit + integration tests
```

See [`SECURITY.md`](SECURITY.md) for how the project maps to the full security &
reliability checklist.
