/**
 * D1 数据库表结构定义
 * 与 Docker 模式 SQLite schema 保持一致
 */

export const D1_SCHEMA = `
CREATE TABLE IF NOT EXISTS storage_configs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT,
  is_default INTEGER DEFAULT 0,
  enabled INTEGER DEFAULT 1,
  encrypted_payload TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  storage_config_id TEXT,
  storage_type TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT,
  folder_path TEXT DEFAULT '/',
  list_type TEXT DEFAULT 'file',
  label TEXT,
  liked INTEGER DEFAULT 0,
  extra_json TEXT DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS virtual_folders (
  path TEXT PRIMARY KEY,
  parent_path TEXT,
  file_count INTEGER DEFAULT 0,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_agent TEXT,
  ip_hash TEXT,
  expires_at INTEGER NOT NULL,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS guest_upload_counters (
  ip_hash TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  count INTEGER DEFAULT 0,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS chunk_uploads (
  task_id TEXT PRIMARY KEY,
  file_name TEXT,
  file_size INTEGER,
  chunk_size INTEGER,
  total_chunks INTEGER,
  uploaded_chunks TEXT DEFAULT '[]',
  status TEXT DEFAULT 'pending',
  expires_at INTEGER,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT,
  updated_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_files_folder ON files(folder_path);
CREATE INDEX IF NOT EXISTS idx_files_created ON files(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_files_storage_type ON files(storage_type);
`;

/**
 * 初始化 D1 表结构
 * @param {D1Database} db - Cloudflare D1 数据库实例
 */
export async function initD1Schema(db) {
  const statements = D1_SCHEMA.split(';').filter(s => s.trim());
  for (const stmt of statements) {
    await db.prepare(stmt).run();
  }
}
