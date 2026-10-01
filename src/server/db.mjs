// SQLite 数据库：Node.js 内置的 node:sqlite，数据全部存放在 DATA_DIR/site.db 一个文件里。
// 网站和命令行工具（scripts/admin.mjs）共用这个模块。
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

/** @type {DatabaseSync | undefined} */
let db;

export function dataDir() {
  return path.resolve(process.env.DATA_DIR || 'data');
}

export function getDb() {
  if (db) return db;
  const dir = dataDir();
  fs.mkdirSync(dir, { recursive: true });
  db = new DatabaseSync(path.join(dir, 'site.db'));
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  migrate(db);
  return db;
}

// 每个版本一段 SQL，按顺序执行；以后改表结构就在末尾追加一项。
const MIGRATIONS = [
  `
  CREATE TABLE users (
    id            INTEGER PRIMARY KEY,
    username      TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    display_name  TEXT    NOT NULL,
    password_hash TEXT    NOT NULL,
    role          TEXT    NOT NULL CHECK (role IN ('admin', 'member')),
    disabled      INTEGER NOT NULL DEFAULT 0,
    invited_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    invite_code   TEXT,
    created_at    TEXT    NOT NULL,
    last_login_at TEXT
  );

  CREATE TABLE sessions (
    token_hash TEXT    PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT    NOT NULL,
    expires_at TEXT    NOT NULL
  );
  CREATE INDEX sessions_user ON sessions(user_id);

  CREATE TABLE invites (
    code       TEXT    PRIMARY KEY,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    note       TEXT    NOT NULL DEFAULT '',
    max_uses   INTEGER,
    uses       INTEGER NOT NULL DEFAULT 0,
    expires_at TEXT,
    revoked    INTEGER NOT NULL DEFAULT 0,
    created_at TEXT    NOT NULL
  );

  CREATE TABLE settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE tutorials (
    slug        TEXT    PRIMARY KEY,
    title       TEXT    NOT NULL,
    description TEXT    NOT NULL DEFAULT '',
    category    TEXT    NOT NULL,
    level       TEXT    NOT NULL DEFAULT '入门',
    duration    INTEGER NOT NULL DEFAULT 10,
    sort_order  INTEGER NOT NULL DEFAULT 100,
    featured    INTEGER NOT NULL DEFAULT 0,
    tags        TEXT    NOT NULL DEFAULT '[]',
    body        TEXT    NOT NULL DEFAULT '',
    draft       INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL,
    updated_at  TEXT    NOT NULL,
    updated_by  INTEGER REFERENCES users(id) ON DELETE SET NULL
  );

  -- 每次保存前的旧内容，误改时可以从这里找回
  CREATE TABLE revisions (
    id       INTEGER PRIMARY KEY,
    kind     TEXT    NOT NULL CHECK (kind IN ('tutorial', 'settings')),
    ref      TEXT    NOT NULL,
    data     TEXT    NOT NULL,
    saved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    saved_at TEXT    NOT NULL
  );
  CREATE INDEX revisions_ref ON revisions(kind, ref, id);
  `,
];

/** @param {DatabaseSync} d */
function migrate(d) {
  const { user_version: version } = /** @type {{ user_version: number }} */ (
    d.prepare('PRAGMA user_version').get()
  );
  for (let v = version; v < MIGRATIONS.length; v++) {
    d.exec('BEGIN');
    try {
      d.exec(MIGRATIONS[v]);
      d.exec(`PRAGMA user_version = ${v + 1}`);
      d.exec('COMMIT');
    } catch (err) {
      d.exec('ROLLBACK');
      throw err;
    }
  }
}

/**
 * 在一个事务里执行 fn，出错自动回滚。
 * @template T
 * @param {() => T} fn
 * @returns {T}
 */
export function transaction(fn) {
  const d = getDb();
  d.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    d.exec('COMMIT');
    return result;
  } catch (err) {
    d.exec('ROLLBACK');
    throw err;
  }
}

export const now = () => new Date().toISOString();
