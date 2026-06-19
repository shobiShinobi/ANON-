'use strict';

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const { hashSeed, verifySeed, issueToken, requireAuth } = require('./auth');
const { calculateReputations, authorTagFor } = require('./reputation');
const { LIMITS, cleanText, cleanColor, cleanEmoji, isHexHash, isUserId, isSeed } = require('./validate');
const { upload, persistImage, removeImage } = require('./uploads');

const MANA = { POST_COST: 50, VOTE_COST: 5, MAX: 100, START: 100 };

/**
 * Build the Express app. `notify` broadcasts realtime events to connected
 * websocket clients; in tests it can be a no-op.
 */
function createApp({ db, audit, notify = () => {} }) {
  const app = express();

  if (config.trustProxy) app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // --- Security headers ---
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow images to load cross-origin
      // Explicit CSP tuned to what the SPA needs: external bundled JS/CSS,
      // inline style attributes (avatar gradients), blob/data images (upload
      // previews), and ws/wss for the realtime socket. Disabled in dev so Vite
      // HMR (inline scripts) works.
      contentSecurityPolicy: config.isProd
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:', 'blob:'],
              connectSrc: ["'self'", 'ws:', 'wss:'],
              objectSrc: ["'none'"],
              baseUri: ["'self'"],
              frameAncestors: ["'self'"],
              upgradeInsecureRequests: [],
            },
          }
        : false,
    })
  );

  // --- CORS (allowlist only) ---
  app.use(
    cors({
      origin(origin, cb) {
        // allow same-origin / curl (no origin) and explicitly allowlisted origins
        if (!origin || config.corsOrigins.includes(origin)) return cb(null, true);
        return cb(new Error('Origin not allowed by CORS policy.'));
      },
      credentials: true,
    })
  );

  app.use(express.json({ limit: '16kb' }));
  app.use(cookieParser());

  // --- Rate limiters ---
  const ipKey = (req) => req.ip;
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: ipKey,
    message: { error: 'Too many attempts. Please wait and try again.' },
  });
  const writeLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => req.userId || req.ip,
    message: { error: 'You are doing that too fast. Slow down.' },
  });
  const readLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 200,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: ipKey,
  });

  // --- Static: uploaded images (read-only, long cache, no listing) ---
  app.use(
    '/uploads',
    express.static(config.uploadDir, {
      index: false,
      dotfiles: 'deny',
      maxAge: '7d',
      setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
    })
  );

  // ---- Prepared statements ----
  const q = {
    insertUser: db.prepare(
      `INSERT INTO users (id, seed_hash, email_hash, mana, display_name, bio, avatar_emoji, avatar_color, created_at)
       VALUES (@id, @seed_hash, @email_hash, @mana, @display_name, @bio, @avatar_emoji, @avatar_color, @created_at)`
    ),
    userById: db.prepare('SELECT * FROM users WHERE id = ?'),
    userByEmail: db.prepare('SELECT id FROM users WHERE email_hash = ?'),
    setMana: db.prepare('UPDATE users SET mana = ? WHERE id = ?'),
    spendMana: db.prepare('UPDATE users SET mana = mana - ? WHERE id = ? AND mana >= ?'),
    updateProfile: db.prepare(
      `UPDATE users SET display_name = @display_name, bio = @bio, avatar_emoji = @avatar_emoji, avatar_color = @avatar_color WHERE id = @id`
    ),
    deleteUser: db.prepare('DELETE FROM users WHERE id = ?'),
    rumors: db.prepare("SELECT * FROM dag WHERE type = 'RUMOR' ORDER BY timestamp DESC"),
    allVotes: db.prepare("SELECT * FROM dag WHERE type = 'VOTE'"),
    insertRumor: db.prepare(
      `INSERT INTO dag (id, type, text, image, authorId, timestamp) VALUES (@id, 'RUMOR', @text, @image, @authorId, @timestamp)`
    ),
    insertVote: db.prepare(
      `INSERT INTO dag (id, type, parentId, vote, voterId, timestamp) VALUES (@id, 'VOTE', @parentId, @vote, @voterId, @timestamp)`
    ),
    rumorById: db.prepare("SELECT * FROM dag WHERE id = ? AND type = 'RUMOR'"),
    existingVote: db.prepare("SELECT id FROM dag WHERE type = 'VOTE' AND voterId = ? AND parentId = ?"),
    imagesByAuthor: db.prepare("SELECT image FROM dag WHERE authorId = ? AND image IS NOT NULL"),
    deleteByUser: db.prepare('DELETE FROM dag WHERE authorId = ? OR voterId = ?'),
  };

  function publicProfile(user, rep) {
    return {
      id: user.id,
      displayName: user.display_name || `Anon ${user.id.slice(-4)}`,
      bio: user.bio || '',
      avatarEmoji: user.avatar_emoji || '🛰️',
      avatarColor: user.avatar_color || '#22c55e',
      trust: Number((rep[user.id] || 1.0).toFixed(2)),
      authorTag: authorTagFor(rep[user.id] || 1.0),
    };
  }

  // ===================== Health =====================
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: Date.now() });
  });

  // ===================== Auth =====================
  app.post('/api/auth/register', authLimiter, (req, res) => {
    const { emailHash, seed } = req.body || {};
    if (!isHexHash(emailHash)) return res.status(400).json({ error: 'Invalid campus verification token.' });
    if (!isSeed(seed)) return res.status(400).json({ error: 'Invalid recovery seed (must be 12 words).' });

    if (q.userByEmail.get(emailHash)) {
      audit.record('REGISTER_DUPLICATE', { ip: req.ip, detail: { emailHash } });
      return res.status(409).json({ error: 'This campus email has already been registered.' });
    }

    const displayName = cleanText(req.body.displayName, LIMITS.DISPLAY_NAME_MAX) || null;
    const id = 'u_' + crypto.randomBytes(8).toString('hex').slice(0, 12);
    const user = {
      id,
      seed_hash: hashSeed(seed),
      email_hash: emailHash,
      mana: MANA.START,
      display_name: displayName,
      bio: null,
      avatar_emoji: null,
      avatar_color: null,
      created_at: Date.now(),
    };
    try {
      q.insertUser.run(user);
    } catch (err) {
      if (String(err.message).includes('UNIQUE')) {
        return res.status(409).json({ error: 'This campus email has already been registered.' });
      }
      throw err;
    }
    audit.record('REGISTER', { actor: id, ip: req.ip });
    const token = issueToken(id);
    const rep = calculateReputations(db);
    res.status(201).json({ id, token, user: publicProfile(q.userById.get(id), rep), mana: user.mana });
  });

  app.post('/api/auth/login', authLimiter, (req, res) => {
    const { id, seed } = req.body || {};
    if (!isUserId(id) || typeof seed !== 'string') {
      return res.status(400).json({ error: 'Invalid Node ID or seed format.' });
    }
    const user = q.userById.get(id);
    // Always run a verify to keep timing roughly constant whether or not the user exists.
    const ok = user ? verifySeed(seed, user.seed_hash) : verifySeed(seed, 'scrypt$00$00');
    if (!user || !ok) {
      audit.record('LOGIN_FAIL', { actor: id, ip: req.ip });
      return res.status(401).json({ error: 'Identity not found or seed incorrect.' });
    }
    audit.record('LOGIN', { actor: id, ip: req.ip });
    const token = issueToken(id);
    const rep = calculateReputations(db);
    res.json({ id, token, user: publicProfile(user, rep), mana: user.mana });
  });

  // ===================== Me / Profile =====================
  app.get('/api/me', requireAuth, (req, res) => {
    const user = q.userById.get(req.userId);
    if (!user) return res.status(404).json({ error: 'Identity no longer exists.' });
    const rep = calculateReputations(db);
    res.json({ ...publicProfile(user, rep), mana: user.mana, emailHash: undefined });
  });

  app.patch('/api/me', requireAuth, writeLimiter, (req, res) => {
    const user = q.userById.get(req.userId);
    if (!user) return res.status(404).json({ error: 'Identity no longer exists.' });
    const next = {
      id: user.id,
      display_name: cleanText(req.body.displayName ?? user.display_name, LIMITS.DISPLAY_NAME_MAX) || null,
      bio: cleanText(req.body.bio ?? user.bio, LIMITS.BIO_MAX) || null,
      avatar_emoji: req.body.avatarEmoji != null ? cleanEmoji(req.body.avatarEmoji) : user.avatar_emoji,
      avatar_color: req.body.avatarColor != null ? cleanColor(req.body.avatarColor) : user.avatar_color,
    };
    q.updateProfile.run(next);
    audit.record('PROFILE_UPDATE', { actor: user.id, ip: req.ip });
    notify({ type: 'NEW_NODE' });
    const rep = calculateReputations(db);
    res.json({ ...publicProfile(q.userById.get(user.id), rep), mana: user.mana });
  });

  app.get('/api/users/:id', readLimiter, (req, res) => {
    if (!isUserId(req.params.id)) return res.status(400).json({ error: 'Invalid Node ID.' });
    const user = q.userById.get(req.params.id);
    if (!user) return res.status(404).json({ error: 'Not found.' });
    const rep = calculateReputations(db);
    res.json(publicProfile(user, rep));
  });

  app.get('/api/me/mana', requireAuth, (req, res) => {
    const user = q.userById.get(req.userId);
    res.json({ mana: user ? user.mana : 0 });
  });

  app.delete('/api/me', requireAuth, (req, res) => {
    const user = q.userById.get(req.userId);
    if (!user) return res.status(404).json({ error: 'Identity no longer exists.' });
    // best-effort cleanup of any uploaded images owned by this user
    for (const row of q.imagesByAuthor.all(user.id)) removeImage(row.image);
    db.transaction(() => {
      q.deleteUser.run(user.id);
      q.deleteByUser.run(user.id, user.id);
    })();
    audit.record('IDENTITY_DESTROY', { actor: user.id, ip: req.ip });
    notify({ type: 'NEW_NODE' });
    res.json({ success: true });
  });

  // ===================== Feed =====================
  app.get('/api/feed', readLimiter, (req, res) => {
    const rumors = q.rumors.all();
    const allVotes = q.allVotes.all();
    const rep = calculateReputations(db);
    const votesByParent = new Map();
    for (const v of allVotes) {
      if (!votesByParent.has(v.parentId)) votesByParent.set(v.parentId, []);
      votesByParent.get(v.parentId).push(v);
    }

    const feed = rumors.map((rumor) => {
      const postVotes = votesByParent.get(rumor.id) || [];
      let score = 0.5;
      if (postVotes.length > 0) {
        let wPos = 0;
        let tWeight = 0;
        for (const v of postVotes) {
          const weight = Math.min(rep[v.voterId] || 1.0, 5.0);
          tWeight += weight;
          if (v.vote === 1) wPos += weight;
        }
        score = tWeight > 0 ? wPos / tWeight : 0.5;
      }
      const author = q.userById.get(rumor.authorId);
      const authorRep = rep[rumor.authorId] || 1.0;
      return {
        id: rumor.id,
        text: rumor.text,
        image: rumor.image || null,
        authorId: rumor.authorId,
        authorName: author ? author.display_name || `Anon ${rumor.authorId.slice(-4)}` : 'Unknown',
        authorEmoji: (author && author.avatar_emoji) || '🛰️',
        authorColor: (author && author.avatar_color) || '#22c55e',
        timestamp: rumor.timestamp,
        score,
        totalVotes: postVotes.length,
        authorTag: authorTagFor(authorRep),
      };
    });
    res.json(feed);
  });

  app.post('/api/rumors', requireAuth, writeLimiter, upload.single('image'), (req, res) => {
    const text = cleanText(req.body.text, LIMITS.POST_TEXT_MAX);
    const hasImage = !!req.file;
    if (!text && !hasImage) return res.status(400).json({ error: 'Post must contain text or an image.' });

    const user = q.userById.get(req.userId);
    if (!user) return res.status(404).json({ error: 'Identity no longer exists.' });
    if (user.mana < MANA.POST_COST) return res.status(403).json({ error: `Need ${MANA.POST_COST} Mana to post.` });

    let imagePath = null;
    if (hasImage) {
      try {
        imagePath = persistImage(req.file);
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    }

    const spend = q.spendMana.run(MANA.POST_COST, user.id, MANA.POST_COST);
    if (spend.changes === 0) {
      if (imagePath) removeImage(imagePath);
      return res.status(403).json({ error: `Need ${MANA.POST_COST} Mana to post.` });
    }

    const node = {
      id: `r_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`,
      text: text || null,
      image: imagePath,
      authorId: user.id,
      timestamp: Date.now(),
    };
    q.insertRumor.run(node);
    audit.record('POST', { actor: user.id, ip: req.ip, detail: { id: node.id, image: !!imagePath } });
    notify({ type: 'MANA_UPDATE', userId: user.id, mana: user.mana - MANA.POST_COST });
    notify({ type: 'NEW_NODE' });
    res.status(201).json({ ...node, type: 'RUMOR' });
  });

  app.post('/api/rumors/:id/votes', requireAuth, writeLimiter, (req, res) => {
    const parentId = req.params.id;
    const vote = Number(req.body.vote);
    if (vote !== 1 && vote !== -1) return res.status(400).json({ error: 'Vote must be +1 or -1.' });
    if (!q.rumorById.get(parentId)) return res.status(404).json({ error: 'Post not found.' });

    const user = q.userById.get(req.userId);
    if (!user) return res.status(404).json({ error: 'Identity no longer exists.' });
    if (user.mana < MANA.VOTE_COST) return res.status(403).json({ error: `Need ${MANA.VOTE_COST} Mana to vote.` });
    if (q.existingVote.get(user.id, parentId)) {
      return res.status(429).json({ error: 'You have already voted on this post.' });
    }

    const spend = q.spendMana.run(MANA.VOTE_COST, user.id, MANA.VOTE_COST);
    if (spend.changes === 0) return res.status(403).json({ error: `Need ${MANA.VOTE_COST} Mana to vote.` });

    const node = {
      id: `v_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`,
      parentId,
      vote,
      voterId: user.id,
      timestamp: Date.now(),
    };
    try {
      q.insertVote.run(node);
    } catch {
      return res.status(429).json({ error: 'You have already voted on this post.' });
    }
    audit.record('VOTE', { actor: user.id, ip: req.ip, detail: { parentId, vote } });
    notify({ type: 'MANA_UPDATE', userId: user.id, mana: user.mana - MANA.VOTE_COST });
    notify({ type: 'NEW_NODE' });
    res.status(201).json({ ...node, type: 'VOTE' });
  });

  // ===================== Audit integrity (self-check) =====================
  app.get('/api/audit/verify', readLimiter, (req, res) => {
    res.json(audit.verifyChain());
  });

  // SPA / static frontend (production build) -------------------------------
  const distDir = path.resolve('dist');
  app.use(express.static(distDir, { index: false }));

  // 404 for unknown API routes
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

  // Centralized error handler (no stack traces leak to clients)
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err && err.message && err.message.includes('CORS')) {
      return res.status(403).json({ error: 'Origin not allowed.' });
    }
    if (err && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Image too large.' });
    }
    if (err && /Unsupported image type|image format/.test(err.message || '')) {
      return res.status(400).json({ error: err.message });
    }
    // eslint-disable-next-line no-console
    console.error('[error]', err);
    res.status(500).json({ error: 'Internal server error.' });
  });

  return { app, q, MANA };
}

module.exports = { createApp, MANA };
