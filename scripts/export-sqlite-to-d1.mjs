#!/usr/bin/env node
/**
 * Safe, non-destructive SQLite-to-D1 SQL exporter.
 * Reads existing local ./data/ecodrive.db (if present) and generates an idempotent
 * SQL file using INSERT OR IGNORE statements so existing D1 records are never overwritten.
 *
 * Usage:
 *   node scripts/export-sqlite-to-d1.mjs [inputDbPath] [outputSqlPath]
 */

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const inputPath = path.resolve(process.argv[2] || './data/ecodrive.db');
const outputPath = path.resolve(process.argv[3] || './data/d1-import-existing.sql');

if (!fs.existsSync(inputPath)) {
  console.error(`SQLite database file not found at: ${inputPath}`);
  process.exit(1);
}

function sqlLiteral(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return Number.isFinite(val) ? String(val) : 'NULL';
  return `'${String(val).replace(/'/g, "''")}'`;
}

const db = new DatabaseSync(inputPath, { open: true, readOnly: true });
const lines = [
  '-- Safe idempotent migration exported from local SQLite database',
  `-- Source: ${path.basename(inputPath)}`,
  `-- Generated at: ${new Date().toISOString()}`,
  '-- Uses INSERT OR IGNORE so existing Cloudflare D1 records are preserved.',
  '',
];

const instructorsMeta = db.prepare('SELECT * FROM instructors_meta').all();
for (const row of instructorsMeta) {
  lines.push(
    `INSERT OR IGNORE INTO instructors_meta (id, file_name, sheet_names_json, columns_json, detected_columns_json, is_default_source, imported_at) VALUES (${sqlLiteral(row.id)}, ${sqlLiteral(row.file_name)}, ${sqlLiteral(row.sheet_names_json)}, ${sqlLiteral(row.columns_json)}, ${sqlLiteral(row.detected_columns_json)}, ${sqlLiteral(row.is_default_source)}, ${sqlLiteral(row.imported_at)});`
  );
}

const instructors = db.prepare('SELECT * FROM instructors ORDER BY sort_order ASC').all();
for (const row of instructors) {
  lines.push(
    `INSERT OR IGNORE INTO instructors (row_key, sheet_name, sort_order, fields_json, created_at, updated_at) VALUES (${sqlLiteral(row.row_key)}, ${sqlLiteral(row.sheet_name)}, ${sqlLiteral(row.sort_order)}, ${sqlLiteral(row.fields_json)}, ${sqlLiteral(row.created_at)}, ${sqlLiteral(row.updated_at)});`
  );
}

const branchMeta = db.prepare('SELECT * FROM branch_info_meta').all();
for (const row of branchMeta) {
  lines.push(
    `INSERT OR IGNORE INTO branch_info_meta (id, file_name, sheet_names_json, columns_json, detected_columns_json, notes_json, is_default_source, imported_at) VALUES (${sqlLiteral(row.id)}, ${sqlLiteral(row.file_name)}, ${sqlLiteral(row.sheet_names_json)}, ${sqlLiteral(row.columns_json)}, ${sqlLiteral(row.detected_columns_json)}, ${sqlLiteral(row.notes_json)}, ${sqlLiteral(row.is_default_source)}, ${sqlLiteral(row.imported_at)});`
  );
}

const branches = db.prepare('SELECT * FROM branch_info ORDER BY sort_order ASC').all();
for (const row of branches) {
  lines.push(
    `INSERT OR IGNORE INTO branch_info (row_key, sheet_name, sort_order, fields_json, created_at, updated_at) VALUES (${sqlLiteral(row.row_key)}, ${sqlLiteral(row.sheet_name)}, ${sqlLiteral(row.sort_order)}, ${sqlLiteral(row.fields_json)}, ${sqlLiteral(row.created_at)}, ${sqlLiteral(row.updated_at)});`
  );
}

lines.push('');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');

console.log(
  `Exported ${instructors.length} instructors and ${branches.length} branches safely to ${outputPath}.`
);
console.log(
  'Note: Admin PIN hashes from Node scrypt are not exported; set ADMIN_ACCESS_CODE via Wrangler secret or create a fresh Admin Access Code in the deployed app.'
);
