import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

// 数据目录：部署时用 DATA_DIR 指向独立数据盘（如 /opt/infinity/data），默认项目 data/
export const dataRoot = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.resolve('data');
fs.mkdirSync(dataRoot, { recursive: true });
export const uploadsRoot = path.join(dataRoot, 'uploads');
fs.mkdirSync(uploadsRoot, { recursive: true });

const db = new DatabaseSync(path.join(dataRoot, 'infinity.db'));
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
CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id),
  filename TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL,
  created_at INTEGER NOT NULL, deleted_at INTEGER
);
CREATE TABLE IF NOT EXISTS entry_versions (
  id TEXT PRIMARY KEY, entry_id TEXT NOT NULL, owner_id TEXT NOT NULL REFERENCES users(id),
  version INTEGER NOT NULL, snapshot TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_versions_entry ON entry_versions(entry_id, version DESC);
CREATE TABLE IF NOT EXISTS knowledge_entries (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL, content TEXT NOT NULL DEFAULT '',
  domain TEXT NOT NULL DEFAULT '', void_type TEXT NOT NULL,
  taxonomy TEXT NOT NULL DEFAULT '[]', difficulty INTEGER NOT NULL DEFAULT 2,
  prerequisites TEXT NOT NULL DEFAULT '[]', related_entries TEXT NOT NULL DEFAULT '[]',
  tags TEXT NOT NULL DEFAULT '[]', is_default INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1, deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_knowledge_owner_updated ON knowledge_entries(owner_id, updated_at DESC);
`);

// 轻量迁移：为旧库补新增列（正式迁移脚本体系在第 8 轮落地）
function ensureColumn(table: string, column: string, ddl: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some(c => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
}
ensureColumn('entries', 'attachments', "TEXT NOT NULL DEFAULT '[]'");
ensureColumn('entries', 'sensory', "TEXT NOT NULL DEFAULT '{}'");
ensureColumn('entries', 'occurred_at', 'INTEGER');

export default db;
