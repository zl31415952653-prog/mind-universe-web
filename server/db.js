import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('data');
fs.mkdirSync(root, { recursive: true });
const db = new DatabaseSync(path.join(root, 'infinity.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), kind TEXT NOT NULL,
  title TEXT NOT NULL, content TEXT NOT NULL DEFAULT '', primary_void TEXT NOT NULL,
  secondary_voids TEXT NOT NULL DEFAULT '[]', tags TEXT NOT NULL DEFAULT '[]',
  emotion TEXT NOT NULL DEFAULT '{}', encoding TEXT NOT NULL DEFAULT '{}',
  knowledge TEXT NOT NULL DEFAULT '{}', privacy TEXT NOT NULL DEFAULT '{"aiVisible":false}',
  source TEXT, is_default INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL, version INTEGER NOT NULL DEFAULT 1, deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_entries_owner_updated ON entries(owner_id, updated_at DESC);
CREATE TABLE IF NOT EXISTS links (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), source_id TEXT NOT NULL,
  target_id TEXT NOT NULL, relation_type TEXT NOT NULL, description TEXT DEFAULT '',
  strength REAL NOT NULL DEFAULT 0.5, source TEXT NOT NULL DEFAULT 'user',
  status TEXT NOT NULL DEFAULT 'accepted', created_at INTEGER NOT NULL,
  UNIQUE(owner_id, source_id, target_id, relation_type)
);
CREATE TABLE IF NOT EXISTS ai_suggestions (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), entry_id TEXT NOT NULL,
  payload TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, action TEXT NOT NULL, metadata TEXT DEFAULT '{}', created_at INTEGER NOT NULL
);
`);

export default db;
