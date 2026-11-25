-- EcoDrive Cloudflare D1 Prices Catalog Schema Migration
-- Strictly non-destructive: uses CREATE TABLE IF NOT EXISTS and CREATE INDEX IF NOT EXISTS only.
-- Existing tables (instructors*, branch_info*, admin_*) remain completely untouched.

CREATE TABLE IF NOT EXISTS prices_meta (
  id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  sheet_names_json TEXT NOT NULL,
  columns_json TEXT NOT NULL,
  detected_columns_json TEXT NOT NULL,
  notes_json TEXT NOT NULL,
  content_hash TEXT NOT NULL DEFAULT '',
  imported_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS prices (
  row_key TEXT PRIMARY KEY,
  sheet_name TEXT NOT NULL DEFAULT 'Sheet1',
  sort_order INTEGER NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  product_name TEXT NOT NULL DEFAULT '',
  price_display TEXT NOT NULL DEFAULT '',
  price_numeric REAL,
  currency TEXT NOT NULL DEFAULT 'AED',
  price_status TEXT NOT NULL DEFAULT 'valid',
  fields_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_prices_sort_order
  ON prices (sort_order);

CREATE INDEX IF NOT EXISTS idx_prices_category
  ON prices (category);

CREATE INDEX IF NOT EXISTS idx_prices_sheet_name
  ON prices (sheet_name);

CREATE TABLE IF NOT EXISTS prices_backups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  reason TEXT NOT NULL,
  file_name TEXT NOT NULL,
  record_count INTEGER NOT NULL,
  content_hash TEXT NOT NULL DEFAULT '',
  snapshot_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_prices_backups_created_at
  ON prices_backups (created_at DESC);
