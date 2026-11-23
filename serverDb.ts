import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DatabaseSync } from 'node:sqlite';
import {
  DEFAULT_INSTRUCTORS_COLUMNS,
  DEFAULT_INSTRUCTORS_FILE_NAME,
  DEFAULT_INSTRUCTORS_RECORDS,
} from './src/data/instructorsData';
import {
  DEFAULT_BRANCH_INFO_COLUMNS,
  DEFAULT_BRANCH_INFO_FILE_NAME,
  DEFAULT_BRANCH_INFO_NOTES,
  DEFAULT_BRANCH_INFO_RECORDS,
} from './src/data/branchInfoData';
import {
  DetectedInstructorColumns,
  InstructorRecord,
  InstructorsDataset,
} from './src/types/instructors';
import {
  BranchInfoDataset,
  BranchInfoRecord,
  DetectedBranchInfoColumns,
  DynamicBranchFilterConfig,
} from './src/types/branchInfo';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ValidationError extends Error {
  public fieldErrors: Record<string, string>;
  constructor(message: string, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = 'ValidationError';
    this.fieldErrors = fieldErrors;
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

function detectInstructorColumnsServer(columns: string[]): DetectedInstructorColumns {
  const findCol = (patterns: RegExp[]): string | null => {
    for (const pattern of patterns) {
      const match = columns.find((col) => pattern.test(col.trim()));
      if (match) return match;
    }
    return null;
  };

  return {
    idCol: findCol([
      /^(id|instructor\s*id|emp(loyee)?\s*id|staff\s*id|code)$/i,
      /\b(instructor\s*id|emp\s*id|staff\s*id)\b/i,
    ]),
    nameCol: findCol([
      /^(name|instructor\s*name|full\s*name|instructor)$/i,
      /\b(instructor\s*name|full\s*name)\b/i,
    ]),
    branchCol: findCol([
      /^(branch|branch\s*name|center|centre|location|office)$/i,
      /\b(branch|center|centre)\b/i,
    ]),
    phoneCol: findCol([
      /^(mobile(\s*number|\s*no\.?)?|phone(\s*number|\s*no\.?)?|contact(\s*number|\s*no\.?)?|tel(ephone)?)$/i,
      /\b(mobile|phone|contact)\b/i,
    ]),
    nationalityCol: findCol([
      /^(nationality|country|citizenship)$/i,
      /\bnationality\b/i,
    ]),
    statusCol: findCol([
      /^(status|active\s*status|employment\s*status|state)$/i,
      /\bstatus\b/i,
    ]),
    categoryCol: findCol([
      /^(category|license(\s*category|\s*type)?|licence(\s*category|\s*type)?|teaching\s*category|vehicle\s*category|class)$/i,
      /\b(category|license|licence)\b/i,
    ]),
    languageCol: findCol([
      /^(language|languages|spoken\s*language(s)?)$/i,
      /\blanguage\b/i,
    ]),
  };
}

function detectBranchInfoColumnsServer(columns: string[]): DetectedBranchInfoColumns {
  const findCol = (patterns: RegExp[]): string | null => {
    for (const pattern of patterns) {
      const match = columns.find((c) => pattern.test(c.trim()));
      if (match) return match;
    }
    return null;
  };

  return {
    snCol: findCol([/^(s\.?\s*no\.?|sn\.?|sr\.?\s*no\.?|#)$/i]),
    branchNameCol: findCol([
      /^(registration\s*offices?|branch\s*name|branch|office\s*name|center\s*name|centre\s*name)$/i,
      /\b(registration\s*office|branch\s*name)\b/i,
    ]),
    phoneCol: findCol([
      /^(contact\s*number|contact\s*#|phone(\s*number|\s*no\.?)?|mobile(\s*number|\s*no\.?)?|branch\s*#|tel(ephone)?)$/i,
      /\b(contact|phone|mobile)\b/i,
    ]),
    locationCol: findCol([
      /^(location|area|emirate|district|city)$/i,
      /\b(location|area)\b/i,
    ]),
    addressCol: findCol([
      /^(full\s*address|address|street\s*address)$/i,
      /\baddress\b/i,
    ]),
    mapLinkCol: findCol([
      /^(google\s*maps?|map\s*link|maps?\s*url|coordinates|lat\/long|gps)$/i,
      /\b(google\s*map|map\s*link|coordinates)\b/i,
    ]),
    branchCodeCol: findCol([/^(branch\s*code|code|office\s*code)$/i]),
    branchTypeCol: findCol([/^(branch\s*type|type|office\s*type|category)$/i]),
    managerCol: findCol([
      /^(manager(\s*name)?|person\s*in\s*charge|incharge|supervisor|branch\s*manager)$/i,
      /\b(manager|incharge)\b/i,
    ]),
    departmentCol: findCol([/^(department|departments|dept)$/i]),
    statusCol: findCol([/^(status|branch\s*status|active\s*status|state)$/i]),
    emailCol: findCol([/^(email|email\s*address|e-mail)$/i]),
    workingHoursCol: findCol([
      /^(working\s*hours|hours|timings|opening\s*hours|operating\s*hours)$/i,
    ]),
  };
}

function buildBranchFilterConfigsServer(
  columns: string[],
  records: BranchInfoRecord[],
  detected: DetectedBranchInfoColumns
): DynamicBranchFilterConfig[] {
  return columns
    .map((col) => {
      const valueCounts = new Map<string, number>();
      records.forEach((r) => {
        const val = (r.fields[col] || '').trim();
        if (val) {
          valueCounts.set(val, (valueCounts.get(val) || 0) + 1);
        }
      });

      const options = Array.from(valueCounts.entries())
        .sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: 'base', numeric: true }))
        .map(([value, count]) => ({ value, count }));

      const isBranchName = detected.branchNameCol === col;
      const isKnownSelectCol =
        col === detected.statusCol ||
        col === detected.branchTypeCol ||
        col === detected.departmentCol;
      const isIdentifierOrContactOrAddress =
        col === detected.snCol ||
        col === detected.phoneCol ||
        col === detected.locationCol ||
        col === detected.addressCol ||
        col === detected.emailCol ||
        col === detected.branchCodeCol ||
        col === detected.mapLinkCol;

      const isRepeatedCategorical =
        !isIdentifierOrContactOrAddress &&
        options.length >= 2 &&
        options.length <= 25 &&
        options.length < records.length * 0.65;

      const kind: 'select' | 'text' =
        isBranchName || isKnownSelectCol || isRepeatedCategorical ? 'select' : 'text';

      return {
        column: col,
        label: col,
        kind,
        options,
      };
    })
    .filter((cfg) => cfg.options.length > 0 || cfg.kind === 'text');
}

// ---------------------------------------------------------------------------
// SQLite Initialization & Non-Destructive First-Run Seeding
// ---------------------------------------------------------------------------
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'ecodrive.db');
const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL;');

db.exec(`
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
`);

function seedInstructorsIfEmpty() {
  const existingMeta = db
    .prepare('SELECT id FROM instructors_meta WHERE id = ?')
    .get('active');
  if (existingMeta) return;

  const detected = detectInstructorColumnsServer(DEFAULT_INSTRUCTORS_COLUMNS);
  const now = new Date().toISOString();

  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(
      `INSERT INTO instructors_meta (id, file_name, sheet_names_json, columns_json, detected_columns_json, is_default_source, imported_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'active',
      DEFAULT_INSTRUCTORS_FILE_NAME,
      JSON.stringify(['Sheet1']),
      JSON.stringify(DEFAULT_INSTRUCTORS_COLUMNS),
      JSON.stringify(detected),
      1,
      'Database Synced (Initial Source File)'
    );

    const insertRow = db.prepare(
      `INSERT INTO instructors (row_key, sheet_name, sort_order, fields_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    );

    DEFAULT_INSTRUCTORS_RECORDS.forEach((rec, index) => {
      insertRow.run(
        rec._rowKey,
        rec._sheetName || 'Sheet1',
        index + 1,
        JSON.stringify(rec.fields),
        now,
        now
      );
    });

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function seedBranchInfoIfEmpty() {
  const existingMeta = db
    .prepare('SELECT id FROM branch_info_meta WHERE id = ?')
    .get('active');
  if (existingMeta) return;

  const detected = detectBranchInfoColumnsServer(DEFAULT_BRANCH_INFO_COLUMNS);
  const now = new Date().toISOString();

  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(
      `INSERT INTO branch_info_meta (id, file_name, sheet_names_json, columns_json, detected_columns_json, notes_json, is_default_source, imported_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'active',
      DEFAULT_BRANCH_INFO_FILE_NAME,
      JSON.stringify(['Sheet1']),
      JSON.stringify(DEFAULT_BRANCH_INFO_COLUMNS),
      JSON.stringify(detected),
      JSON.stringify(DEFAULT_BRANCH_INFO_NOTES),
      1,
      'Database Synced (Initial Source File)'
    );

    const insertRow = db.prepare(
      `INSERT INTO branch_info (row_key, sheet_name, sort_order, fields_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    );

    DEFAULT_BRANCH_INFO_RECORDS.forEach((rec, index) => {
      insertRow.run(
        rec._rowKey,
        rec._sheetName || 'Sheet1',
        index + 1,
        JSON.stringify(rec.fields),
        now,
        now
      );
    });

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

seedInstructorsIfEmpty();
seedBranchInfoIfEmpty();

// ---------------------------------------------------------------------------
// Validation Helpers
// ---------------------------------------------------------------------------
function normalizeFields(
  rawFields: Record<string, unknown>,
  columns: string[]
): Record<string, string> {
  const clean: Record<string, string> = {};
  for (const col of columns) {
    const val = rawFields?.[col];
    clean[col] = typeof val === 'string' ? val.trim() : val != null ? String(val).trim() : '';
  }
  return clean;
}

function isValidPhone(phone: string): boolean {
  if (!phone) return true;
  if (!/^[+\d\s()/-]{7,30}$/.test(phone)) return false;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

function isValidEmail(email: string): boolean {
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidMapValue(val: string): boolean {
  if (!val) return true;
  if (/^https?:\/\/\S+$/i.test(val)) return true;
  if (/^-?\d{1,2}\.\d+\s*,\s*-?\d{1,3}\.\d+$/.test(val)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Instructors CRUD Operations
// ---------------------------------------------------------------------------
export function getInstructorsDatasetFromDb(): InstructorsDataset {
  const metaRow = db
    .prepare('SELECT * FROM instructors_meta WHERE id = ?')
    .get('active') as {
    file_name: string;
    sheet_names_json: string;
    columns_json: string;
    detected_columns_json: string;
    is_default_source: number;
    imported_at: string;
  };

  const rows = db
    .prepare('SELECT row_key, sheet_name, fields_json FROM instructors ORDER BY sort_order ASC')
    .all() as Array<{
    row_key: string;
    sheet_name: string;
    fields_json: string;
  }>;

  return {
    fileName: metaRow.file_name,
    sheetNames: JSON.parse(metaRow.sheet_names_json) as string[],
    columns: JSON.parse(metaRow.columns_json) as string[],
    detectedColumns: JSON.parse(metaRow.detected_columns_json) as DetectedInstructorColumns,
    records: rows.map((r) => ({
      _rowKey: r.row_key,
      _sheetName: r.sheet_name,
      fields: JSON.parse(r.fields_json) as Record<string, string>,
    })),
    isDefaultSource: Boolean(metaRow.is_default_source),
    importedAt: metaRow.imported_at,
  };
}

function validateInstructorFields(
  fields: Record<string, string>,
  dataset: InstructorsDataset,
  excludeRowKey?: string
) {
  const cols = dataset.detectedColumns;
  const fieldErrors: Record<string, string> = {};

  const nameCol = cols.nameCol || dataset.columns[1] || dataset.columns[0];
  const idCol = cols.idCol;
  const phoneCol = cols.phoneCol;

  if (nameCol) {
    const nameVal = (fields[nameCol] || '').trim();
    if (!nameVal) {
      fieldErrors[nameCol] = `${nameCol} is required.`;
    } else if (nameVal.length < 2) {
      fieldErrors[nameCol] = `${nameCol} must be at least 2 characters.`;
    }
  }

  if (idCol) {
    const idVal = (fields[idCol] || '').trim();
    if (!idVal) {
      fieldErrors[idCol] = `${idCol} is required.`;
    } else if (!/^[a-zA-Z0-9_-]{1,40}$/.test(idVal)) {
      fieldErrors[idCol] = `${idCol} may only contain letters, numbers, hyphens, or underscores.`;
    } else {
      const duplicate = dataset.records.find(
        (r) =>
          r._rowKey !== excludeRowKey &&
          (r.fields[idCol] || '').trim().toLowerCase() === idVal.toLowerCase()
      );
      if (duplicate) {
        fieldErrors[idCol] = `Instructor ${idCol} "${idVal}" already exists.`;
      }
    }
  }

  if (cols.branchCol && !(fields[cols.branchCol] || '').trim()) {
    fieldErrors[cols.branchCol] = `${cols.branchCol} is required.`;
  }

  if (phoneCol) {
    const phoneVal = (fields[phoneCol] || '').trim();
    if (phoneVal && !isValidPhone(phoneVal)) {
      fieldErrors[phoneCol] = `Enter a valid ${phoneCol.toLowerCase()} (7–15 digits).`;
    }
  }

  const anyValue = Object.values(fields).some((v) => v.trim() !== '');
  if (!anyValue) {
    throw new ValidationError('Instructor details cannot be empty.', fieldErrors);
  }

  if (Object.keys(fieldErrors).length > 0) {
    const firstMsg = Object.values(fieldErrors)[0];
    throw new ValidationError(firstMsg, fieldErrors);
  }
}

export function createInstructorInDb(
  rawFields: Record<string, unknown>,
  sheetName = 'Sheet1'
): InstructorRecord {
  const dataset = getInstructorsDatasetFromDb();
  const cleanFields = normalizeFields(rawFields, dataset.columns);
  validateInstructorFields(cleanFields, dataset);

  const maxOrderRow = db
    .prepare('SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM instructors')
    .get() as { max_order: number };
  const nextOrder = (maxOrderRow?.max_order || 0) + 1;

  const rowKey = `inst-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO instructors (row_key, sheet_name, sort_order, fields_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(rowKey, sheetName || 'Sheet1', nextOrder, JSON.stringify(cleanFields), now, now);

  return {
    _rowKey: rowKey,
    _sheetName: sheetName || 'Sheet1',
    fields: cleanFields,
  };
}

export function updateInstructorInDb(
  rowKey: string,
  rawFields: Record<string, unknown>
): InstructorRecord {
  const existing = db
    .prepare('SELECT row_key, sheet_name FROM instructors WHERE row_key = ?')
    .get(rowKey) as { row_key: string; sheet_name: string } | undefined;

  if (!existing) {
    throw new NotFoundError('Instructor record was not found.');
  }

  const dataset = getInstructorsDatasetFromDb();
  const cleanFields = normalizeFields(rawFields, dataset.columns);
  validateInstructorFields(cleanFields, dataset, rowKey);

  const now = new Date().toISOString();
  db.prepare('UPDATE instructors SET fields_json = ?, updated_at = ? WHERE row_key = ?').run(
    JSON.stringify(cleanFields),
    now,
    rowKey
  );

  return {
    _rowKey: rowKey,
    _sheetName: existing.sheet_name,
    fields: cleanFields,
  };
}

export function deleteInstructorInDb(rowKey: string): void {
  const result = db.prepare('DELETE FROM instructors WHERE row_key = ?').run(rowKey);
  if (result.changes === 0) {
    throw new NotFoundError('Instructor record was not found.');
  }
}

export function replaceInstructorsDatasetInDb(payload: {
  fileName: string;
  sheetNames: string[];
  columns: string[];
  detectedColumns: DetectedInstructorColumns;
  records: InstructorRecord[];
  importedAt: string;
}): InstructorsDataset {
  if (!payload.columns?.length || !payload.records?.length) {
    throw new ValidationError('Imported instructors dataset must include columns and records.');
  }

  const now = new Date().toISOString();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(
      `UPDATE instructors_meta
       SET file_name = ?, sheet_names_json = ?, columns_json = ?, detected_columns_json = ?, is_default_source = 0, imported_at = ?
       WHERE id = 'active'`
    ).run(
      payload.fileName,
      JSON.stringify(payload.sheetNames),
      JSON.stringify(payload.columns),
      JSON.stringify(payload.detectedColumns),
      payload.importedAt || now
    );

    db.prepare('DELETE FROM instructors').run();

    const insertRow = db.prepare(
      `INSERT INTO instructors (row_key, sheet_name, sort_order, fields_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    );

    payload.records.forEach((rec, index) => {
      insertRow.run(
        rec._rowKey || `imp-${index + 1}`,
        rec._sheetName || 'Sheet1',
        index + 1,
        JSON.stringify(rec.fields),
        now,
        now
      );
    });

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  return getInstructorsDatasetFromDb();
}

// ---------------------------------------------------------------------------
// Branch Information CRUD Operations
// ---------------------------------------------------------------------------
export function getBranchInfoDatasetFromDb(): BranchInfoDataset {
  const metaRow = db
    .prepare('SELECT * FROM branch_info_meta WHERE id = ?')
    .get('active') as {
    file_name: string;
    sheet_names_json: string;
    columns_json: string;
    detected_columns_json: string;
    notes_json: string;
    is_default_source: number;
    imported_at: string;
  };

  const columns = JSON.parse(metaRow.columns_json) as string[];
  const detectedColumns = JSON.parse(
    metaRow.detected_columns_json
  ) as DetectedBranchInfoColumns;

  const rows = db
    .prepare('SELECT row_key, sheet_name, fields_json FROM branch_info ORDER BY sort_order ASC')
    .all() as Array<{
    row_key: string;
    sheet_name: string;
    fields_json: string;
  }>;

  const records: BranchInfoRecord[] = rows.map((r) => ({
    _rowKey: r.row_key,
    _sheetName: r.sheet_name,
    fields: JSON.parse(r.fields_json) as Record<string, string>,
  }));

  const filterConfigs = buildBranchFilterConfigsServer(columns, records, detectedColumns);

  return {
    fileName: metaRow.file_name,
    sheetNames: JSON.parse(metaRow.sheet_names_json) as string[],
    columns,
    detectedColumns,
    filterConfigs,
    records,
    notes: JSON.parse(metaRow.notes_json) as string[],
    isDefaultSource: Boolean(metaRow.is_default_source),
    importedAt: metaRow.imported_at,
  };
}

function validateBranchInfoFields(
  fields: Record<string, string>,
  dataset: BranchInfoDataset,
  excludeRowKey?: string
) {
  const cols = dataset.detectedColumns;
  const fieldErrors: Record<string, string> = {};

  const branchNameCol = cols.branchNameCol || dataset.columns[1] || dataset.columns[0];
  if (branchNameCol) {
    const nameVal = (fields[branchNameCol] || '').trim();
    if (!nameVal) {
      fieldErrors[branchNameCol] = `${branchNameCol} is required.`;
    } else if (nameVal.length < 2) {
      fieldErrors[branchNameCol] = `${branchNameCol} must be at least 2 characters.`;
    } else {
      const duplicateName = dataset.records.find(
        (r) =>
          r._rowKey !== excludeRowKey &&
          (r.fields[branchNameCol] || '').trim().toLowerCase() === nameVal.toLowerCase()
      );
      if (duplicateName) {
        fieldErrors[branchNameCol] = `Branch "${nameVal}" already exists.`;
      }
    }
  }

  if (cols.snCol) {
    const snVal = (fields[cols.snCol] || '').trim();
    if (snVal) {
      if (!/^[a-zA-Z0-9_-]{1,20}$/.test(snVal)) {
        fieldErrors[cols.snCol] = `${cols.snCol} must be alphanumeric or numeric.`;
      } else {
        const duplicateSn = dataset.records.find(
          (r) =>
            r._rowKey !== excludeRowKey &&
            (r.fields[cols.snCol!] || '').trim().toLowerCase() === snVal.toLowerCase()
        );
        if (duplicateSn) {
          fieldErrors[cols.snCol] = `${cols.snCol} "${snVal}" is already assigned to another branch.`;
        }
      }
    }
  }

  if (cols.phoneCol) {
    const phoneVal = (fields[cols.phoneCol] || '').trim();
    if (phoneVal && !isValidPhone(phoneVal)) {
      fieldErrors[cols.phoneCol] = `Enter a valid ${cols.phoneCol.toLowerCase()} (7–15 digits).`;
    }
  }

  if (cols.emailCol) {
    const emailVal = (fields[cols.emailCol] || '').trim();
    if (emailVal && !isValidEmail(emailVal)) {
      fieldErrors[cols.emailCol] = 'Enter a valid email address.';
    }
  }

  if (cols.mapLinkCol) {
    const mapVal = (fields[cols.mapLinkCol] || '').trim();
    if (mapVal && !isValidMapValue(mapVal)) {
      fieldErrors[cols.mapLinkCol] =
        'Enter a valid http(s) Maps URL or coordinates (e.g. 25.1234, 55.1234).';
    }
  }

  const locationOrAddressCol = cols.locationCol || cols.addressCol;
  if (locationOrAddressCol && !(fields[locationOrAddressCol] || '').trim()) {
    fieldErrors[locationOrAddressCol] = `${locationOrAddressCol} is required.`;
  }

  if (Object.keys(fieldErrors).length > 0) {
    const firstMsg = Object.values(fieldErrors)[0];
    throw new ValidationError(firstMsg, fieldErrors);
  }
}

export function createBranchInfoInDb(
  rawFields: Record<string, unknown>,
  sheetName = 'Sheet1'
): BranchInfoRecord {
  const dataset = getBranchInfoDatasetFromDb();
  const cleanFields = normalizeFields(rawFields, dataset.columns);
  validateBranchInfoFields(cleanFields, dataset);

  const maxOrderRow = db
    .prepare('SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM branch_info')
    .get() as { max_order: number };
  const nextOrder = (maxOrderRow?.max_order || 0) + 1;

  const rowKey = `branch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO branch_info (row_key, sheet_name, sort_order, fields_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(rowKey, sheetName || 'Sheet1', nextOrder, JSON.stringify(cleanFields), now, now);

  return {
    _rowKey: rowKey,
    _sheetName: sheetName || 'Sheet1',
    fields: cleanFields,
  };
}

export function updateBranchInfoInDb(
  rowKey: string,
  rawFields: Record<string, unknown>
): BranchInfoRecord {
  const existing = db
    .prepare('SELECT row_key, sheet_name FROM branch_info WHERE row_key = ?')
    .get(rowKey) as { row_key: string; sheet_name: string } | undefined;

  if (!existing) {
    throw new NotFoundError('Branch record was not found.');
  }

  const dataset = getBranchInfoDatasetFromDb();
  const cleanFields = normalizeFields(rawFields, dataset.columns);
  validateBranchInfoFields(cleanFields, dataset, rowKey);

  const now = new Date().toISOString();
  db.prepare('UPDATE branch_info SET fields_json = ?, updated_at = ? WHERE row_key = ?').run(
    JSON.stringify(cleanFields),
    now,
    rowKey
  );

  return {
    _rowKey: rowKey,
    _sheetName: existing.sheet_name,
    fields: cleanFields,
  };
}

export function deleteBranchInfoInDb(rowKey: string): void {
  const result = db.prepare('DELETE FROM branch_info WHERE row_key = ?').run(rowKey);
  if (result.changes === 0) {
    throw new NotFoundError('Branch record was not found.');
  }
}

export function replaceBranchInfoDatasetInDb(payload: {
  fileName: string;
  sheetNames: string[];
  columns: string[];
  detectedColumns: DetectedBranchInfoColumns;
  records: BranchInfoRecord[];
  notes: string[];
  importedAt: string;
}): BranchInfoDataset {
  if (!payload.columns?.length || !payload.records?.length) {
    throw new ValidationError('Imported branch dataset must include columns and records.');
  }

  const now = new Date().toISOString();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(
      `UPDATE branch_info_meta
       SET file_name = ?, sheet_names_json = ?, columns_json = ?, detected_columns_json = ?, notes_json = ?, is_default_source = 0, imported_at = ?
       WHERE id = 'active'`
    ).run(
      payload.fileName,
      JSON.stringify(payload.sheetNames),
      JSON.stringify(payload.columns),
      JSON.stringify(payload.detectedColumns),
      JSON.stringify(payload.notes || []),
      payload.importedAt || now
    );

    db.prepare('DELETE FROM branch_info').run();

    const insertRow = db.prepare(
      `INSERT INTO branch_info (row_key, sheet_name, sort_order, fields_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    );

    payload.records.forEach((rec, index) => {
      insertRow.run(
        rec._rowKey || `bimp-${index + 1}`,
        rec._sheetName || 'Sheet1',
        index + 1,
        JSON.stringify(rec.fields),
        now,
        now
      );
    });

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  return getBranchInfoDatasetFromDb();
}
