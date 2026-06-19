'use strict';

const Database = require('better-sqlite3');

/**
 * Open (or create) the SQLite database and run idempotent migrations.
 * Each "node" still keeps its own file, but a deployed instance uses one DB.
 *
 * @param {string} file path to the sqlite file (or ':memory:' for tests)
 */
function openDatabase(file) {
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id           TEXT PRIMARY KEY,
      seed_hash    TEXT NOT NULL,
      email_hash   TEXT UNIQUE,
      mana         INTEGER NOT NULL DEFAULT 100,
      display_name TEXT,
      bio          TEXT,
      avatar_emoji TEXT,
      avatar_color TEXT,
      created_at   INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS dag (
      id        TEXT PRIMARY KEY,
      type      TEXT NOT NULL,
      text      TEXT,
      image     TEXT,
      authorId  TEXT,
      parentId  TEXT,
      vote      INTEGER,
      voterId   TEXT,
      timestamp INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_dag_type      ON dag(type);
    CREATE INDEX IF NOT EXISTS idx_dag_parent    ON dag(parentId);
    CREATE INDEX IF NOT EXISTS idx_dag_voter     ON dag(voterId);
    CREATE INDEX IF NOT EXISTS idx_dag_timestamp ON dag(timestamp);

    -- Append-only, hash-chained audit trail (tamper-evident).
    CREATE TABLE IF NOT EXISTS audit_log (
      seq       INTEGER PRIMARY KEY AUTOINCREMENT,
      ts        INTEGER NOT NULL,
      event     TEXT NOT NULL,
      actor     TEXT,
      ip        TEXT,
      detail    TEXT,
      prev_hash TEXT,
      hash      TEXT NOT NULL
    );
  `);

  // --- Defensive migrations for databases created by older versions ---
  migrateAddColumn(db, 'users', 'display_name', 'TEXT');
  migrateAddColumn(db, 'users', 'bio', 'TEXT');
  migrateAddColumn(db, 'users', 'avatar_emoji', 'TEXT');
  migrateAddColumn(db, 'users', 'avatar_color', 'TEXT');
  migrateAddColumn(db, 'users', 'created_at', 'INTEGER NOT NULL DEFAULT 0');
  migrateAddColumn(db, 'users', 'seed_hash', 'TEXT');
  migrateAddColumn(db, 'dag', 'image', 'TEXT');

  return db;
}

function migrateAddColumn(db, table, column, type) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
}

module.exports = { openDatabase };
