'use strict';

const crypto = require('crypto');
const { openDatabase } = require('../server/db');
const { createAuditLogger } = require('../server/audit');
const { createApp } = require('../server/app');

function makeSeed() {
  const words = ['apple', 'brave', 'campus', 'delta', 'eagle', 'falcon', 'ghost', 'hover', 'index', 'jungle', 'karma', 'lunar'];
  return words.join(' ');
}

function emailHash(email = `s${crypto.randomBytes(4).toString('hex')}@uni.edu`) {
  return crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');
}

function buildTestApp() {
  const events = [];
  const db = openDatabase(':memory:');
  const audit = createAuditLogger(db);
  const { app } = createApp({ db, audit, notify: (d) => events.push(d) });
  return { app, db, audit, events };
}

module.exports = { makeSeed, emailHash, buildTestApp };
