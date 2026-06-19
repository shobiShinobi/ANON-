'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const config = require('./config');

// Keep the file in memory so we can validate its real bytes before it ever
// touches disk (prevents content-type spoofing and path traversal).
const ALLOWED = {
  'image/jpeg': { ext: '.jpg', sniff: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/png': {
    ext: '.png',
    sniff: (b) =>
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a,
  },
  'image/gif': { ext: '.gif', sniff: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 },
  'image/webp': {
    ext: '.webp',
    sniff: (b) =>
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45,
  },
};

function ensureUploadDir() {
  fs.mkdirSync(config.uploadDir, { recursive: true });
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadBytes, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED[file.mimetype]) {
      return cb(new Error('Unsupported image type. Use JPEG, PNG, GIF, or WebP.'));
    }
    cb(null, true);
  },
});

/**
 * Validate the in-memory buffer's magic bytes and persist it with a random,
 * non-guessable filename. Returns the public-relative path, or throws.
 */
function persistImage(file) {
  if (!file || !file.buffer) return null;
  const spec = ALLOWED[file.mimetype];
  if (!spec || !spec.sniff(file.buffer)) {
    throw new Error('File content does not match a supported image format.');
  }
  ensureUploadDir();
  const name = `img_${Date.now()}_${crypto.randomBytes(8).toString('hex')}${spec.ext}`;
  const dest = path.join(config.uploadDir, name);
  fs.writeFileSync(dest, file.buffer, { flag: 'wx' });
  return `/uploads/${name}`;
}

function removeImage(relPath) {
  if (!relPath || typeof relPath !== 'string') return;
  // Only allow deleting files we created, inside the upload dir.
  const base = path.basename(relPath);
  if (!/^img_[0-9]+_[a-f0-9]{16}\.(jpg|png|gif|webp)$/.test(base)) return;
  const full = path.join(config.uploadDir, base);
  fs.rm(full, { force: true }, () => {});
}

module.exports = { upload, persistImage, removeImage, ensureUploadDir };
