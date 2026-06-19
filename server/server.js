'use strict';

const http = require('http');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');

const config = require('./config');
const { openDatabase } = require('./db');
const { createAuditLogger } = require('./audit');
const { createApp } = require('./app');
const { ensureUploadDir } = require('./uploads');

const db = openDatabase(config.dbFile);
const audit = createAuditLogger(db);
ensureUploadDir();

// --- Realtime: browser clients connect here for live feed/mana updates ---
let clients = [];
function notify(data) {
  const msg = JSON.stringify(data);
  clients.forEach((c) => {
    if (c.readyState === WebSocket.OPEN) c.send(msg);
  });
}

const { app } = createApp({ db, audit, notify });

// SPA fallback: serve index.html for non-API GET routes when a build exists.
const indexHtml = path.resolve('dist', 'index.html');
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
  if (fs.existsSync(indexHtml)) return res.sendFile(indexHtml);
  next();
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

wss.on('connection', (ws) => {
  clients.push(ws);
  notify({ type: 'PEER_UPDATE', count: clients.length });
  ws.on('close', () => {
    clients = clients.filter((c) => c !== ws);
    notify({ type: 'PEER_UPDATE', count: clients.length });
  });
  ws.on('error', () => {});
});

// --- Mana regeneration (+2 every 5s up to 100) ---
const regen = db.prepare('SELECT id, mana FROM users WHERE mana < 100');
const setMana = db.prepare('UPDATE users SET mana = ? WHERE id = ?');
const manaTimer = setInterval(() => {
  for (const u of regen.all()) {
    const newMana = Math.min(100, u.mana + 2);
    setMana.run(newMana, u.id);
    notify({ type: 'MANA_UPDATE', userId: u.id, mana: newMana });
  }
}, 5000);

server.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`ANON node active on :${config.port}  (env=${config.isProd ? 'production' : 'development'})`);
});

function shutdown(signal) {
  // eslint-disable-next-line no-console
  console.log(`\n${signal} received — shutting down gracefully.`);
  clearInterval(manaTimer);
  wss.clients.forEach((c) => c.terminate());
  server.close(() => {
    try {
      db.close();
    } catch {
      /* ignore */
    }
    process.exit(0);
  });
  // Force-exit if connections linger.
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = { server, db };
