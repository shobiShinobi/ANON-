import { describe, it, expect } from 'vitest';
import { hashSeed, verifySeed, issueToken, verifyToken } from '../server/auth.js';
import { calculateReputations, authorTagFor } from '../server/reputation.js';
import { cleanText, cleanColor, cleanEmoji, isSeed, isUserId, isHexHash } from '../server/validate.js';
import { openDatabase } from '../server/db.js';

describe('auth crypto', () => {
  it('hashes and verifies a seed', () => {
    const h = hashSeed('apple brave campus delta eagle falcon ghost hover index jungle karma lunar');
    expect(h).toMatch(/^scrypt\$/);
    expect(verifySeed('apple brave campus delta eagle falcon ghost hover index jungle karma lunar', h)).toBe(true);
    expect(verifySeed('wrong', h)).toBe(false);
  });

  it('issues and verifies a JWT', () => {
    const token = issueToken('u_abcdef123456');
    expect(verifyToken(token).sub).toBe('u_abcdef123456');
  });
});

describe('validation', () => {
  it('strips html and control chars from text', () => {
    expect(cleanText('<b>hi</b>', 100)).toBe('hi');
    expect(cleanText('<script>x</script>safe', 100)).toBe('safe');
  });
  it('validates colors', () => {
    expect(cleanColor('#1f2937')).toBe('#1f2937');
    expect(cleanColor('red')).toBe(null);
    expect(cleanColor('#fff; evil')).toBe(null);
  });
  it('validates emoji', () => {
    expect(cleanEmoji('🦉')).toBe('🦉');
    expect(cleanEmoji('<script>')).toBe(null);
    expect(cleanEmoji('abc')).toBe(null);
  });
  it('validates ids, seeds, hashes', () => {
    expect(isUserId('u_abcdef123456')).toBe(true);
    expect(isUserId('hacker')).toBe(false);
    expect(isSeed('apple brave campus delta eagle falcon ghost hover index jungle karma lunar')).toBe(true);
    expect(isSeed('one two three')).toBe(false);
    expect(isHexHash('a'.repeat(64))).toBe(true);
    expect(isHexHash('xyz')).toBe(false);
  });
});

describe('reputation', () => {
  it('rewards consensus and penalizes contrarians once >=3 votes', () => {
    const db = openDatabase(':memory:');
    const ins = db.prepare("INSERT INTO dag (id, type, parentId, vote, voterId, timestamp) VALUES (?, 'VOTE', ?, ?, ?, ?)");
    // post P1: 3 verifies (agree), 1 dispute (contrarian)
    ins.run('v1', 'p1', 1, 'agree1', 1);
    ins.run('v2', 'p1', 1, 'agree2', 2);
    ins.run('v3', 'p1', 1, 'agree3', 3);
    ins.run('v4', 'p1', -1, 'contra', 4);
    const rep = calculateReputations(db);
    expect(rep['agree1']).toBeGreaterThan(1.0);
    expect(rep['contra']).toBeLessThan(1.0);
    expect(rep['contra']).toBeGreaterThanOrEqual(0.1); // floored
  });

  it('maps reputation to author tags', () => {
    expect(authorTagFor(1.8)).toBe('Trusted User');
    expect(authorTagFor(1.0)).toBe('Neutral User');
    expect(authorTagFor(0.5)).toBe('Untrustworthy User');
  });
});
