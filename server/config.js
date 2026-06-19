'use strict';

require('dotenv').config();

const path = require('path');
const crypto = require('crypto');

const isProd = process.env.NODE_ENV === 'production';

// In production we refuse to boot with an insecure/default JWT secret.
let jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.startsWith('change-me')) {
  if (isProd) {
    throw new Error(
      'FATAL: JWT_SECRET is missing or set to the default value. ' +
        'Set a strong random JWT_SECRET in the environment before starting in production.'
    );
  }
  // Dev convenience only: ephemeral secret (sessions reset on restart).
  jwtSecret = crypto.randomBytes(48).toString('hex');
  // eslint-disable-next-line no-console
  console.warn('[config] No JWT_SECRET set — using an ephemeral dev secret. Do NOT use in production.');
}

const config = {
  isProd,
  port: Number(process.env.PORT) || 5000,
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:4173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  uploadDir: path.resolve(process.env.UPLOAD_DIR || 'uploads'),
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES) || 5 * 1024 * 1024,
  dbFile: process.env.DB_FILE || `node_${process.env.PORT || 5000}.db`,
  trustProxy: process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true',
};

module.exports = config;
