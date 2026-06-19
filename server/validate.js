'use strict';

const sanitizeHtml = require('sanitize-html');

const LIMITS = {
  POST_TEXT_MAX: 500,
  DISPLAY_NAME_MAX: 32,
  BIO_MAX: 160,
  SEED_WORDS: 12,
};

// Built from \u escapes (pure-ASCII source) to avoid embedding literal control bytes.
const CONTROL_CHARS = new RegExp('[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F-\\u009F]', 'g');
const NON_EMOJI = new RegExp('[\\u0000-\\u007F<>]');

// Strip ALL html — rumors and profiles are plain text only. This is defense in
// depth; React already escapes on render, but we never want markup in storage.
function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  const stripped = sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} });
  // sanitize-html entity-encodes a few chars for plain text; decode them back so
  // storage stays human-readable plain text.
  const decoded = stripped
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  // strip control characters but keep newlines and tabs
  const noControl = decoded.replace(CONTROL_CHARS, '');
  return noControl.trim().slice(0, max);
}

function isHexHash(value, len = 64) {
  return typeof value === 'string' && new RegExp(`^[a-f0-9]{${len}}$`, 'i').test(value);
}

function isUserId(value) {
  return typeof value === 'string' && /^u_[a-z0-9]{6,32}$/i.test(value);
}

function isSeed(value) {
  if (typeof value !== 'string') return false;
  const words = value.trim().split(/\s+/);
  return words.length === LIMITS.SEED_WORDS && words.every((w) => /^[a-z]{2,20}$/i.test(w));
}

// Hex color like #1f2937.
function cleanColor(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  return /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : null;
}

// Allow a single emoji-ish glyph (1-4 codepoints, no ascii/markup).
function cleanEmoji(value) {
  if (typeof value !== 'string') return null;
  const v = Array.from(value.trim());
  if (v.length === 0 || v.length > 4) return null;
  if (NON_EMOJI.test(value)) return null;
  return v.join('');
}

module.exports = { LIMITS, cleanText, cleanColor, cleanEmoji, isHexHash, isUserId, isSeed };
