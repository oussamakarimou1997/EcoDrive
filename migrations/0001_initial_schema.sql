-- EcoDrive Cloudflare D1 Initial Schema Migration
-- Strictly non-destructive: uses CREATE TABLE IF NOT EXISTS and CREATE INDEX IF NOT EXISTS only.

CREATE TABLE IF NOT EXISTS instructors_meta (
  id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  sheet_names_json TEXT NOT NULL,
  columns_json TEXT NOT NULL,
  detected_columns_json TEXT NOT NULL,
  is_default_source INTEGER NOT NULL DEFAULT 1,
  imported_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS instructors (
  row_key TEXT PRIMARY KEY,
  sheet_name TEXT NOT NULL DEFAULT 'Sheet1',
  sort_order INTEGER NOT NULL,
  fields_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_instructors_sort_order
  ON instructors (sort_order);

CREATE TABLE IF NOT EXISTS branch_info_meta (
  id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  sheet_names_json TEXT NOT NULL,
  columns_json TEXT NOT NULL,
  detected_columns_json TEXT NOT NULL,
  notes_json TEXT NOT NULL,
  is_default_source INTEGER NOT NULL DEFAULT 1,
  imported_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS branch_info (
  row_key TEXT PRIMARY KEY,
  sheet_name TEXT NOT NULL DEFAULT 'Sheet1',
  sort_order INTEGER NOT NULL,
  fields_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_branch_info_sort_order
  ON branch_info (sort_order);

CREATE TABLE IF NOT EXISTS admin_auth (
  id TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at
  ON admin_sessions (expires_at);

CREATE TABLE IF NOT EXISTS admin_rate_limits (
  client_key TEXT PRIMARY KEY,
  fail_count INTEGER NOT NULL DEFAULT 0,
  blocked_until INTEGER NOT NULL DEFAULT 0
);
