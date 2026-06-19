'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('./config');

// --- Secret (seed) hashing with scrypt -------------------------------------
// We treat the 12-word recovery seed exactly like a password: it is sent once
// over TLS, hashed immediately, and only the hash is ever stored. The plaintext
// seed lives only in the user's browser (localStorage), never in our DB.

const SCRYPT_KEYLEN = 64;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };

function hashSeed(seed) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(seed, salt, SCRYPT_KEYLEN, SCRYPT_PARAMS);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

function verifySeed(seed, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  let derived;
  try {
    derived = crypto.scryptSync(seed, salt, expected.length, SCRYPT_PARAMS);
  } catch {
    return false;
  }
  // constant-time comparison
  return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
}

// --- Session tokens (JWT) ---------------------------------------------------

function issueToken(userId) {
  return jwt.sign({ sub: userId }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
    issuer: 'anon-mesh',
  });
}

function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret, { issuer: 'anon-mesh' });
}

/**
 * Express middleware: require a valid Bearer token. Sets req.userId.
 */
function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return res.status(401).json({ error: 'Authentication required.' });
  try {
    const payload = verifyToken(match[1]);
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired or invalid. Please re-authenticate.' });
  }
}

module.exports = { hashSeed, verifySeed, issueToken, verifyToken, requireAuth };
