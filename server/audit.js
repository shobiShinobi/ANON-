'use strict';

const crypto = require('crypto');

/**
 * Tamper-evident, append-only audit log. Each entry stores a SHA-256 hash of
 * (prev_hash + canonical entry). Any retroactive edit/deletion breaks the chain,
 * which `verifyChain` will detect.
 */
function createAuditLogger(db) {
  const insert = db.prepare(
    `INSERT INTO audit_log (ts, event, actor, ip, detail, prev_hash, hash)
     VALUES (@ts, @event, @actor, @ip, @detail, @prev_hash, @hash)`
  );
  const lastStmt = db.prepare('SELECT hash FROM audit_log ORDER BY seq DESC LIMIT 1');

  function record(event, { actor = null, ip = null, detail = null } = {}) {
    const ts = Date.now();
    const prev = lastStmt.get();
    const prevHash = prev ? prev.hash : 'GENESIS';
    const detailStr = detail == null ? null : JSON.stringify(detail);
    const payload = `${prevHash}|${ts}|${event}|${actor || ''}|${ip || ''}|${detailStr || ''}`;
    const hash = crypto.createHash('sha256').update(payload).digest('hex');
    try {
      insert.run({ ts, event, actor, ip, detail: detailStr, prev_hash: prevHash, hash });
    } catch {
      // Auditing must never crash the request path.
    }
  }

  function verifyChain() {
    const rows = db.prepare('SELECT * FROM audit_log ORDER BY seq ASC').all();
    let prevHash = 'GENESIS';
    for (const row of rows) {
      const payload = `${prevHash}|${row.ts}|${row.event}|${row.actor || ''}|${row.ip || ''}|${row.detail || ''}`;
      const expected = crypto.createHash('sha256').update(payload).digest('hex');
      if (expected !== row.hash || row.prev_hash !== prevHash) {
        return { ok: false, brokenAt: row.seq };
      }
      prevHash = row.hash;
    }
    return { ok: true, entries: rows.length };
  }

  return { record, verifyChain };
}

module.exports = { createAuditLogger };
