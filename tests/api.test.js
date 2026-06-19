import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import { makeSeed, emailHash, buildTestApp } from './helpers.js';

let app;
let db;

beforeEach(() => {
  ({ app, db } = buildTestApp());
});

async function register(overrides = {}) {
  const body = { emailHash: emailHash(), seed: makeSeed(), displayName: 'Tester', ...overrides };
  const res = await request(app).post('/api/auth/register').send(body);
  return res;
}

describe('health', () => {
  it('reports ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('auth', () => {
  it('registers a user and returns a token', async () => {
    const res = await register();
    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(/^u_/);
    expect(res.body.token).toBeTruthy();
    expect(res.body.mana).toBe(100);
  });

  it('rejects a non-hash email token', async () => {
    const res = await register({ emailHash: 'not-a-hash' });
    expect(res.status).toBe(400);
  });

  it('rejects a bad seed', async () => {
    const res = await register({ seed: 'too short' });
    expect(res.status).toBe(400);
  });

  it('prevents duplicate email registration', async () => {
    const eh = emailHash();
    const r1 = await register({ emailHash: eh });
    expect(r1.status).toBe(201);
    const r2 = await register({ emailHash: eh });
    expect(r2.status).toBe(409);
  });

  it('logs in with correct seed and rejects wrong seed', async () => {
    const reg = await register();
    const good = await request(app).post('/api/auth/login').send({ id: reg.body.id, seed: makeSeed() });
    expect(good.status).toBe(200);
    const bad = await request(app)
      .post('/api/auth/login')
      .send({ id: reg.body.id, seed: 'wrong wrong wrong wrong wrong wrong wrong wrong wrong wrong wrong wrong' });
    expect(bad.status).toBe(401);
  });

  it('never stores the plaintext seed', () => {
    return register().then((reg) => {
      const row = db.prepare('SELECT seed_hash FROM users WHERE id = ?').get(reg.body.id);
      expect(row.seed_hash).toMatch(/^scrypt\$/);
      expect(row.seed_hash).not.toContain('apple');
    });
  });
});

describe('authorization', () => {
  it('blocks posting without a token', async () => {
    const res = await request(app).post('/api/rumors').send({ text: 'hi' });
    expect(res.status).toBe(401);
  });

  it('blocks posting with a tampered token', async () => {
    const res = await request(app).post('/api/rumors').set('Authorization', 'Bearer abc.def.ghi').send({ text: 'hi' });
    expect(res.status).toBe(401);
  });
});

describe('rumors & voting', () => {
  async function authedUser() {
    const reg = await register();
    return reg.body;
  }

  it('creates a post and shows it in the feed', async () => {
    const u = await authedUser();
    const post = await request(app)
      .post('/api/rumors')
      .set('Authorization', `Bearer ${u.token}`)
      .field('text', 'The library closes early today');
    expect(post.status).toBe(201);

    const feed = await request(app).get('/api/feed');
    expect(feed.status).toBe(200);
    expect(feed.body).toHaveLength(1);
    expect(feed.body[0].text).toBe('The library closes early today');
    expect(feed.body[0].score).toBe(0.5);
  });

  it('strips html from post text (xss defense)', async () => {
    const u = await authedUser();
    await request(app)
      .post('/api/rumors')
      .set('Authorization', `Bearer ${u.token}`)
      .field('text', 'hello <script>alert(1)</script> world');
    const feed = await request(app).get('/api/feed');
    expect(feed.body[0].text).not.toContain('<script>');
  });

  it('rejects an empty post', async () => {
    const u = await authedUser();
    const res = await request(app).post('/api/rumors').set('Authorization', `Bearer ${u.token}`).field('text', '   ');
    expect(res.status).toBe(400);
  });

  it('spends mana on posting', async () => {
    const u = await authedUser();
    await request(app).post('/api/rumors').set('Authorization', `Bearer ${u.token}`).field('text', 'a post');
    const me = await request(app).get('/api/me/mana').set('Authorization', `Bearer ${u.token}`);
    expect(me.body.mana).toBe(50);
  });

  it('prevents double voting on the same post', async () => {
    const author = await authedUser();
    const voter = await authedUser();
    const post = await request(app)
      .post('/api/rumors')
      .set('Authorization', `Bearer ${author.token}`)
      .field('text', 'vote on me');
    const id = post.body.id;

    const v1 = await request(app)
      .post(`/api/rumors/${id}/votes`)
      .set('Authorization', `Bearer ${voter.token}`)
      .send({ vote: 1 });
    expect(v1.status).toBe(201);

    const v2 = await request(app)
      .post(`/api/rumors/${id}/votes`)
      .set('Authorization', `Bearer ${voter.token}`)
      .send({ vote: 1 });
    expect(v2.status).toBe(429);
  });

  it('rejects an invalid vote value', async () => {
    const author = await authedUser();
    const post = await request(app)
      .post('/api/rumors')
      .set('Authorization', `Bearer ${author.token}`)
      .field('text', 'x');
    const res = await request(app)
      .post(`/api/rumors/${post.body.id}/votes`)
      .set('Authorization', `Bearer ${author.token}`)
      .send({ vote: 99 });
    expect(res.status).toBe(400);
  });
});

describe('profile', () => {
  it('updates and reads back profile customization', async () => {
    const reg = await register();
    const patch = await request(app)
      .patch('/api/me')
      .set('Authorization', `Bearer ${reg.body.token}`)
      .send({ displayName: 'NightOwl', bio: 'I lurk the stacks', avatarColor: '#3b82f6', avatarEmoji: '🦉' });
    expect(patch.status).toBe(200);
    expect(patch.body.displayName).toBe('NightOwl');
    expect(patch.body.avatarColor).toBe('#3b82f6');
    expect(patch.body.avatarEmoji).toBe('🦉');

    const me = await request(app).get('/api/me').set('Authorization', `Bearer ${reg.body.token}`);
    expect(me.body.bio).toBe('I lurk the stacks');
  });

  it('rejects an invalid avatar color', async () => {
    const reg = await register();
    const patch = await request(app)
      .patch('/api/me')
      .set('Authorization', `Bearer ${reg.body.token}`)
      .send({ avatarColor: 'red; drop table users' });
    expect(patch.status).toBe(200);
    expect(patch.body.avatarColor).toBe('#22c55e'); // fell back to default, injection ignored
  });

  it('lets a user destroy only their own identity', async () => {
    const reg = await register();
    const del = await request(app).delete('/api/me').set('Authorization', `Bearer ${reg.body.token}`);
    expect(del.status).toBe(200);
    const me = await request(app).get('/api/me').set('Authorization', `Bearer ${reg.body.token}`);
    expect(me.status).toBe(404);
  });
});

describe('audit log', () => {
  it('records events in a verifiable hash chain', async () => {
    await register();
    const res = await request(app).get('/api/audit/verify');
    expect(res.body.ok).toBe(true);
    expect(res.body.entries).toBeGreaterThan(0);
  });

  it('detects tampering', async () => {
    const { app: a2, db: d2 } = buildTestApp();
    await request(a2).post('/api/auth/register').send({ emailHash: emailHash(), seed: makeSeed() });
    d2.prepare('UPDATE audit_log SET actor = ? WHERE seq = 1').run('attacker');
    const res = await request(a2).get('/api/audit/verify');
    expect(res.body.ok).toBe(false);
  });
});
