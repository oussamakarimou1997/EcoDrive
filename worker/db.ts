import {
  DEFAULT_INSTRUCTORS_COLUMNS,
  DEFAULT_INSTRUCTORS_FILE_NAME,
  DEFAULT_INSTRUCTORS_RECORDS,
} from '../src/data/instructorsData';
import {
  DEFAULT_BRANCH_INFO_COLUMNS,
  DEFAULT_BRANCH_INFO_FILE_NAME,
  DEFAULT_BRANCH_INFO_NOTES,
  DEFAULT_BRANCH_INFO_RECORDS,
} from '../src/data/branchInfoData';
import {
  DEFAULT_PRICES_COLUMNS,
  DEFAULT_PRICES_CONTENT_HASH,
  DEFAULT_PRICES_DETECTED_COLUMNS,
  DEFAULT_PRICES_FILE_NAME,
  DEFAULT_PRICES_NOTES,
  DEFAULT_PRICES_RECORDS,
  DEFAULT_PRICES_SHEET_NAMES,
} from '../src/data/defaultPricesSeed';
import {
  DetectedInstructorColumns,
  InstructorRecord,
  InstructorsDataset,
} from '../src/types/instructors';
import {
  BranchInfoDataset,
  BranchInfoRecord,
  DetectedBranchInfoColumns,
  DynamicBranchFilterConfig,
} from '../src/types/branchInfo';
import {
  DetectedPriceColumns,
  PriceRecord,
  PriceValidationStatus,
  PricesBackupInfo,
  PricesDataset,
} from '../src/types/prices';
import {
  generateRandomHexToken,
  hashAccessCodePbkdf2,
  sha256Hex,
  verifyAccessCodeHash,
  verifyEnvAccessCodeConstantTime,
} from './crypto';

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

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

// ---------------------------------------------------------------------------
// Column Detection & Dynamic Filter Config Builders (100% Preserved Logic)
// ---------------------------------------------------------------------------
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
// Idempotent Non-Destructive First-Run Seeding for Cloudflare D1
// ---------------------------------------------------------------------------
const SEED_BATCH_SIZE = 40;
let instructorsSeedPromise: Promise<void> | null = null;
let branchInfoSeedPromise: Promise<void> | null = null;
let pricesSeedPromise: Promise<void> | null = null;

async function executeChunkedBatch(
  db: D1Database,
  statements: D1PreparedStatement[],
  chunkSize = SEED_BATCH_SIZE
): Promise<void> {
  for (let i = 0; i < statements.length; i += chunkSize) {
    const slice = statements.slice(i, i + chunkSize);
    if (slice.length > 0) {
      await db.batch(slice);
    }
  }
}

export async function ensureInstructorsSeeded(db: D1Database): Promise<void> {
  if (instructorsSeedPromise) {
    return instructorsSeedPromise;
  }

  instructorsSeedPromise = (async () => {
    const existingMeta = await db
      .prepare('SELECT id FROM instructors_meta WHERE id = ?')
      .bind('active')
      .first<{ id: string }>();

    if (existingMeta) return;

    // Extra safety: never overwrite if rows already exist from a manual import/migration
    const existingCount = await db
      .prepare('SELECT COUNT(*) AS cnt FROM instructors')
      .first<{ cnt: number }>();

    const detected = detectInstructorColumnsServer(DEFAULT_INSTRUCTORS_COLUMNS);
    const now = new Date().toISOString();

    await db
      .prepare(
        `INSERT OR IGNORE INTO instructors_meta
         (id, file_name, sheet_names_json, columns_json, detected_columns_json, is_default_source, imported_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        'active',
        DEFAULT_INSTRUCTORS_FILE_NAME,
        JSON.stringify(['Sheet1']),
        JSON.stringify(DEFAULT_INSTRUCTORS_COLUMNS),
        JSON.stringify(detected),
        1,
        'Database Synced (Initial Source File)'
      )
      .run();

    if ((existingCount?.cnt ?? 0) > 0) {
      return;
    }

    const insertStmt = db.prepare(
      `INSERT OR IGNORE INTO instructors (row_key, sheet_name, sort_order, fields_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    );

    const rowStmts = DEFAULT_INSTRUCTORS_RECORDS.map((rec, index) =>
      insertStmt.bind(
        rec._rowKey,
        rec._sheetName || 'Sheet1',
        index + 1,
        JSON.stringify(rec.fields),
        now,
        now
      )
    );

    await executeChunkedBatch(db, rowStmts);
  })().finally(() => {
    instructorsSeedPromise = null;
  });

  return instructorsSeedPromise;
}

export async function ensureBranchInfoSeeded(db: D1Database): Promise<void> {
  if (branchInfoSeedPromise) {
    return branchInfoSeedPromise;
  }

  branchInfoSeedPromise = (async () => {
    const existingMeta = await db
      .prepare('SELECT id FROM branch_info_meta WHERE id = ?')
      .bind('active')
      .first<{ id: string }>();

    if (existingMeta) return;

    const existingCount = await db
      .prepare('SELECT COUNT(*) AS cnt FROM branch_info')
      .first<{ cnt: number }>();

    const detected = detectBranchInfoColumnsServer(DEFAULT_BRANCH_INFO_COLUMNS);
    const now = new Date().toISOString();

    await db
      .prepare(
        `INSERT OR IGNORE INTO branch_info_meta
         (id, file_name, sheet_names_json, columns_json, detected_columns_json, notes_json, is_default_source, imported_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        'active',
        DEFAULT_BRANCH_INFO_FILE_NAME,
        JSON.stringify(['Sheet1']),
        JSON.stringify(DEFAULT_BRANCH_INFO_COLUMNS),
        JSON.stringify(detected),
        JSON.stringify(DEFAULT_BRANCH_INFO_NOTES),
        1,
        'Database Synced (Initial Source File)'
      )
      .run();

    if ((existingCount?.cnt ?? 0) > 0) {
      return;
    }

    const insertStmt = db.prepare(
      `INSERT OR IGNORE INTO branch_info (row_key, sheet_name, sort_order, fields_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    );

    const rowStmts = DEFAULT_BRANCH_INFO_RECORDS.map((rec, index) =>
      insertStmt.bind(
        rec._rowKey,
        rec._sheetName || 'Sheet1',
        index + 1,
        JSON.stringify(rec.fields),
        now,
        now
      )
    );

    await executeChunkedBatch(db, rowStmts);
  })().finally(() => {
    branchInfoSeedPromise = null;
  });

  return branchInfoSeedPromise;
}

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
// Instructors CRUD Operations (Cloudflare D1)
// ---------------------------------------------------------------------------
export async function getInstructorsDatasetFromDb(db: D1Database): Promise<InstructorsDataset> {
  await ensureInstructorsSeeded(db);

  const metaRow = await db
    .prepare('SELECT * FROM instructors_meta WHERE id = ?')
    .bind('active')
    .first<{
      file_name: string;
      sheet_names_json: string;
      columns_json: string;
      detected_columns_json: string;
      is_default_source: number;
      imported_at: string;
    }>();

  if (!metaRow) {
    throw new Error('Instructors metadata record is missing from D1 database.');
  }

  const rowsResult = await db
    .prepare('SELECT row_key, sheet_name, fields_json FROM instructors ORDER BY sort_order ASC')
    .all<{
      row_key: string;
      sheet_name: string;
      fields_json: string;
    }>();

  const rows = rowsResult.results || [];

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

export async function createInstructorInDb(
  db: D1Database,
  rawFields: Record<string, unknown>,
  sheetName = 'Sheet1'
): Promise<InstructorRecord> {
  const dataset = await getInstructorsDatasetFromDb(db);
  const cleanFields = normalizeFields(rawFields, dataset.columns);
  validateInstructorFields(cleanFields, dataset);

  const maxOrderRow = await db
    .prepare('SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM instructors')
    .first<{ max_order: number }>();
  const nextOrder = (maxOrderRow?.max_order || 0) + 1;

  const rowKey = `inst-${Date.now()}-${generateRandomHexToken(4)}`;
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO instructors (row_key, sheet_name, sort_order, fields_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(rowKey, sheetName || 'Sheet1', nextOrder, JSON.stringify(cleanFields), now, now)
    .run();

  return {
    _rowKey: rowKey,
    _sheetName: sheetName || 'Sheet1',
    fields: cleanFields,
  };
}

export async function updateInstructorInDb(
  db: D1Database,
  rowKey: string,
  rawFields: Record<string, unknown>
): Promise<InstructorRecord> {
  await ensureInstructorsSeeded(db);

  const existing = await db
    .prepare('SELECT row_key, sheet_name FROM instructors WHERE row_key = ?')
    .bind(rowKey)
    .first<{ row_key: string; sheet_name: string }>();

  if (!existing) {
    throw new NotFoundError('Instructor record was not found.');
  }

  const dataset = await getInstructorsDatasetFromDb(db);
  const cleanFields = normalizeFields(rawFields, dataset.columns);
  validateInstructorFields(cleanFields, dataset, rowKey);

  const now = new Date().toISOString();
  await db
    .prepare('UPDATE instructors SET fields_json = ?, updated_at = ? WHERE row_key = ?')
    .bind(JSON.stringify(cleanFields), now, rowKey)
    .run();

  return {
    _rowKey: rowKey,
    _sheetName: existing.sheet_name,
    fields: cleanFields,
  };
}

export async function deleteInstructorInDb(db: D1Database, rowKey: string): Promise<void> {
  await ensureInstructorsSeeded(db);

  const result = await db
    .prepare('DELETE FROM instructors WHERE row_key = ?')
    .bind(rowKey)
    .run();

  if (!result.meta || result.meta.changes === 0) {
    throw new NotFoundError('Instructor record was not found.');
  }
}

export async function replaceInstructorsDatasetInDb(
  db: D1Database,
  payload: {
    fileName: string;
    sheetNames: string[];
    columns: string[];
    detectedColumns: DetectedInstructorColumns;
    records: InstructorRecord[];
    importedAt: string;
  }
): Promise<InstructorsDataset> {
  if (!payload?.columns?.length || !payload?.records?.length) {
    throw new ValidationError('Imported instructors dataset must include columns and records.');
  }

  await ensureInstructorsSeeded(db);

  const now = new Date().toISOString();
  const updateMetaStmt = db
    .prepare(
      `UPDATE instructors_meta
       SET file_name = ?, sheet_names_json = ?, columns_json = ?, detected_columns_json = ?, is_default_source = 0, imported_at = ?
       WHERE id = 'active'`
    )
    .bind(
      payload.fileName,
      JSON.stringify(payload.sheetNames),
      JSON.stringify(payload.columns),
      JSON.stringify(payload.detectedColumns),
      payload.importedAt || now
    );

  const deleteAllStmt = db.prepare('DELETE FROM instructors');

  const insertRowTemplate = db.prepare(
    `INSERT INTO instructors (row_key, sheet_name, sort_order, fields_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  const rowStmts = payload.records.map((rec, index) =>
    insertRowTemplate.bind(
      rec._rowKey || `imp-${index + 1}`,
      rec._sheetName || 'Sheet1',
      index + 1,
      JSON.stringify(rec.fields),
      now,
      now
    )
  );

  // Execute in one atomic D1 batch transaction
  await db.batch([updateMetaStmt, deleteAllStmt, ...rowStmts]);

  return getInstructorsDatasetFromDb(db);
}

// ---------------------------------------------------------------------------
// Branch Information CRUD Operations (Cloudflare D1)
// ---------------------------------------------------------------------------
export async function getBranchInfoDatasetFromDb(db: D1Database): Promise<BranchInfoDataset> {
  await ensureBranchInfoSeeded(db);

  const metaRow = await db
    .prepare('SELECT * FROM branch_info_meta WHERE id = ?')
    .bind('active')
    .first<{
      file_name: string;
      sheet_names_json: string;
      columns_json: string;
      detected_columns_json: string;
      notes_json: string;
      is_default_source: number;
      imported_at: string;
    }>();

  if (!metaRow) {
    throw new Error('Branch information metadata record is missing from D1 database.');
  }

  const columns = JSON.parse(metaRow.columns_json) as string[];
  const detectedColumns = JSON.parse(
    metaRow.detected_columns_json
  ) as DetectedBranchInfoColumns;

  const rowsResult = await db
    .prepare('SELECT row_key, sheet_name, fields_json FROM branch_info ORDER BY sort_order ASC')
    .all<{
      row_key: string;
      sheet_name: string;
      fields_json: string;
    }>();

  const rows = rowsResult.results || [];
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

export async function createBranchInfoInDb(
  db: D1Database,
  rawFields: Record<string, unknown>,
  sheetName = 'Sheet1'
): Promise<BranchInfoRecord> {
  const dataset = await getBranchInfoDatasetFromDb(db);
  const cleanFields = normalizeFields(rawFields, dataset.columns);
  validateBranchInfoFields(cleanFields, dataset);

  const maxOrderRow = await db
    .prepare('SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM branch_info')
    .first<{ max_order: number }>();
  const nextOrder = (maxOrderRow?.max_order || 0) + 1;

  const rowKey = `branch-${Date.now()}-${generateRandomHexToken(4)}`;
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO branch_info (row_key, sheet_name, sort_order, fields_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(rowKey, sheetName || 'Sheet1', nextOrder, JSON.stringify(cleanFields), now, now)
    .run();

  return {
    _rowKey: rowKey,
    _sheetName: sheetName || 'Sheet1',
    fields: cleanFields,
  };
}

export async function updateBranchInfoInDb(
  db: D1Database,
  rowKey: string,
  rawFields: Record<string, unknown>
): Promise<BranchInfoRecord> {
  await ensureBranchInfoSeeded(db);

  const existing = await db
    .prepare('SELECT row_key, sheet_name FROM branch_info WHERE row_key = ?')
    .bind(rowKey)
    .first<{ row_key: string; sheet_name: string }>();

  if (!existing) {
    throw new NotFoundError('Branch record was not found.');
  }

  const dataset = await getBranchInfoDatasetFromDb(db);
  const cleanFields = normalizeFields(rawFields, dataset.columns);
  validateBranchInfoFields(cleanFields, dataset, rowKey);

  const now = new Date().toISOString();
  await db
    .prepare('UPDATE branch_info SET fields_json = ?, updated_at = ? WHERE row_key = ?')
    .bind(JSON.stringify(cleanFields), now, rowKey)
    .run();

  return {
    _rowKey: rowKey,
    _sheetName: existing.sheet_name,
    fields: cleanFields,
  };
}

export async function deleteBranchInfoInDb(db: D1Database, rowKey: string): Promise<void> {
  await ensureBranchInfoSeeded(db);

  const result = await db
    .prepare('DELETE FROM branch_info WHERE row_key = ?')
    .bind(rowKey)
    .run();

  if (!result.meta || result.meta.changes === 0) {
    throw new NotFoundError('Branch record was not found.');
  }
}

export async function replaceBranchInfoDatasetInDb(
  db: D1Database,
  payload: {
    fileName: string;
    sheetNames: string[];
    columns: string[];
    detectedColumns: DetectedBranchInfoColumns;
    records: BranchInfoRecord[];
    notes: string[];
    importedAt: string;
  }
): Promise<BranchInfoDataset> {
  if (!payload?.columns?.length || !payload?.records?.length) {
    throw new ValidationError('Imported branch dataset must include columns and records.');
  }

  await ensureBranchInfoSeeded(db);

  const now = new Date().toISOString();
  const updateMetaStmt = db
    .prepare(
      `UPDATE branch_info_meta
       SET file_name = ?, sheet_names_json = ?, columns_json = ?, detected_columns_json = ?, notes_json = ?, is_default_source = 0, imported_at = ?
       WHERE id = 'active'`
    )
    .bind(
      payload.fileName,
      JSON.stringify(payload.sheetNames),
      JSON.stringify(payload.columns),
      JSON.stringify(payload.detectedColumns),
      JSON.stringify(payload.notes || []),
      payload.importedAt || now
    );

  const deleteAllStmt = db.prepare('DELETE FROM branch_info');

  const insertRowTemplate = db.prepare(
    `INSERT INTO branch_info (row_key, sheet_name, sort_order, fields_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  const rowStmts = payload.records.map((rec, index) =>
    insertRowTemplate.bind(
      rec._rowKey || `bimp-${index + 1}`,
      rec._sheetName || 'Sheet1',
      index + 1,
      JSON.stringify(rec.fields),
      now,
      now
    )
  );

  await db.batch([updateMetaStmt, deleteAllStmt, ...rowStmts]);

  return getBranchInfoDatasetFromDb(db);
}

// ---------------------------------------------------------------------------
// Admin Access Code Authentication, Sessions & D1 Rate Limiting
// ---------------------------------------------------------------------------
const ADMIN_SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_VERIFY_FAILURES = 5;
const VERIFY_LOCKOUT_MS = 30 * 1000;

function normalizeEnvAdminAccessCode(envAdminCode?: string): string {
  return (envAdminCode || '').trim();
}

async function pruneExpiredSessions(db: D1Database): Promise<void> {
  const nowIso = new Date().toISOString();
  await db.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').bind(nowIso).run();
}

async function createAdminSession(
  db: D1Database
): Promise<{ token: string; expiresAt: string }> {
  await pruneExpiredSessions(db);
  const token = generateRandomHexToken(32);
  const tokenHash = await sha256Hex(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ADMIN_SESSION_TTL_MS).toISOString();

  await db
    .prepare(
      `INSERT INTO admin_sessions (token_hash, created_at, expires_at)
       VALUES (?, ?, ?)`
    )
    .bind(tokenHash, now.toISOString(), expiresAt)
    .run();

  return { token, expiresAt };
}

export async function getAdminAuthStatus(
  db: D1Database,
  envAdminCode?: string
): Promise<{ configured: boolean; managedByEnv: boolean }> {
  const envCode = normalizeEnvAdminAccessCode(envAdminCode);
  if (envCode) {
    return { configured: true, managedByEnv: true };
  }
  const row = await db
    .prepare('SELECT id FROM admin_auth WHERE id = ?')
    .bind('primary')
    .first<{ id: string }>();
  return { configured: Boolean(row), managedByEnv: false };
}

export async function setupInitialAdminAccessCode(
  db: D1Database,
  rawCode: unknown,
  envAdminCode?: string
): Promise<{ token: string; expiresAt: string }> {
  if (normalizeEnvAdminAccessCode(envAdminCode)) {
    throw new ConflictError('Admin Access Code is already configured via environment secret.');
  }

  const code = typeof rawCode === 'string' ? rawCode.trim() : '';
  if (code.length < 4 || code.length > 64) {
    throw new ValidationError('Admin Access Code must be between 4 and 64 characters.', {
      accessCode: 'Admin Access Code must be between 4 and 64 characters.',
    });
  }

  const hash = await hashAccessCodePbkdf2(code);
  const now = new Date().toISOString();

  // Atomic one-time insert via INSERT OR IGNORE
  const insertResult = await db
    .prepare(
      `INSERT OR IGNORE INTO admin_auth (id, password_hash, updated_at)
       VALUES (?, ?, ?)`
    )
    .bind('primary', hash, now)
    .run();

  if (!insertResult.meta || insertResult.meta.changes === 0) {
    throw new ConflictError('Admin Access Code has already been configured.');
  }

  return createAdminSession(db);
}

export async function checkVerifyRateLimit(
  db: D1Database,
  clientKey: string
): Promise<number> {
  const now = Date.now();
  const record = await db
    .prepare('SELECT fail_count, blocked_until FROM admin_rate_limits WHERE client_key = ?')
    .bind(clientKey)
    .first<{ fail_count: number; blocked_until: number }>();

  if (record && record.blocked_until > now) {
    return Math.ceil((record.blocked_until - now) / 1000);
  }
  return 0;
}

export async function clearVerifyRateLimit(db: D1Database, clientKey: string): Promise<void> {
  await db
    .prepare('DELETE FROM admin_rate_limits WHERE client_key = ?')
    .bind(clientKey)
    .run();
}

export async function recordVerifyFailure(db: D1Database, clientKey: string): Promise<void> {
  const now = Date.now();
  const record = await db
    .prepare('SELECT fail_count, blocked_until FROM admin_rate_limits WHERE client_key = ?')
    .bind(clientKey)
    .first<{ fail_count: number; blocked_until: number }>();

  const prevCount = record && record.blocked_until <= now ? record.fail_count : 0;
  const nextCount = prevCount + 1;

  const newFailCount = nextCount >= MAX_VERIFY_FAILURES ? 0 : nextCount;
  const newBlockedUntil = nextCount >= MAX_VERIFY_FAILURES ? now + VERIFY_LOCKOUT_MS : 0;

  await db
    .prepare(
      `INSERT INTO admin_rate_limits (client_key, fail_count, blocked_until)
       VALUES (?, ?, ?)
       ON CONFLICT(client_key) DO UPDATE SET
         fail_count = excluded.fail_count,
         blocked_until = excluded.blocked_until`
    )
    .bind(clientKey, newFailCount, newBlockedUntil)
    .run();
}

export async function verifyAdminAccessCodeAndCreateSession(
  db: D1Database,
  rawCode: unknown,
  envAdminCode?: string
): Promise<{ token: string; expiresAt: string }> {
  const code = typeof rawCode === 'string' ? rawCode.trim() : '';
  if (!code) {
    throw new UnauthorizedError('Access denied. Invalid Admin Access Code.');
  }

  const envCode = normalizeEnvAdminAccessCode(envAdminCode);
  if (envCode) {
    const valid = await verifyEnvAccessCodeConstantTime(code, envCode);
    if (!valid) {
      throw new UnauthorizedError('Access denied. Invalid Admin Access Code.');
    }
    return createAdminSession(db);
  }

  const row = await db
    .prepare('SELECT password_hash FROM admin_auth WHERE id = ?')
    .bind('primary')
    .first<{ password_hash: string }>();

  if (!row) {
    throw new ValidationError('Admin Access Code is not set up yet. Please configure one first.');
  }

  const valid = await verifyAccessCodeHash(code, row.password_hash);
  if (!valid) {
    throw new UnauthorizedError('Access denied. Invalid Admin Access Code.');
  }

  return createAdminSession(db);
}

export async function validateAdminSessionToken(
  db: D1Database,
  token: string | null | undefined,
  envAdminCode?: string
): Promise<boolean> {
  if (!token || typeof token !== 'string') return false;
  const trimmed = token.trim();
  if (!trimmed) return false;

  const { configured } = await getAdminAuthStatus(db, envAdminCode);
  if (!configured) return false;

  const tokenHash = await sha256Hex(trimmed);
  const nowIso = new Date().toISOString();
  const row = await db
    .prepare('SELECT token_hash FROM admin_sessions WHERE token_hash = ? AND expires_at > ?')
    .bind(tokenHash, nowIso)
    .first<{ token_hash: string }>();

  return Boolean(row);
}

export async function revokeAdminSessionToken(
  db: D1Database,
  token: string | null | undefined
): Promise<void> {
  if (!token || typeof token !== 'string') return;
  const tokenHash = await sha256Hex(token.trim());
  await db
    .prepare('DELETE FROM admin_sessions WHERE token_hash = ?')
    .bind(tokenHash)
    .run();
}

export async function changeAdminAccessCode(
  db: D1Database,
  rawCurrentCode: unknown,
  rawNewCode: unknown,
  envAdminCode?: string
): Promise<{ token: string; expiresAt: string }> {
  if (normalizeEnvAdminAccessCode(envAdminCode)) {
    throw new ValidationError(
      'Admin Access Code is managed by the server ADMIN_ACCESS_CODE environment secret.'
    );
  }

  const currentCode = typeof rawCurrentCode === 'string' ? rawCurrentCode.trim() : '';
  const newCode = typeof rawNewCode === 'string' ? rawNewCode.trim() : '';

  if (!currentCode) {
    throw new ValidationError('Current Admin Access Code is required.', {
      currentCode: 'Current Admin Access Code is required.',
    });
  }
  if (newCode.length < 4 || newCode.length > 64) {
    throw new ValidationError('New Admin Access Code must be between 4 and 64 characters.', {
      newCode: 'New Admin Access Code must be between 4 and 64 characters.',
    });
  }
  if (currentCode === newCode) {
    throw new ValidationError('New Admin Access Code must be different from the current code.', {
      newCode: 'New Admin Access Code must be different from the current code.',
    });
  }

  const row = await db
    .prepare('SELECT password_hash FROM admin_auth WHERE id = ?')
    .bind('primary')
    .first<{ password_hash: string }>();

  if (!row) {
    throw new ValidationError('Admin Access Code has not been configured yet.');
  }

  const valid = await verifyAccessCodeHash(currentCode, row.password_hash);
  if (!valid) {
    throw new UnauthorizedError('Access denied. Invalid Admin Access Code.');
  }

  const nextHash = await hashAccessCodePbkdf2(newCode);
  const now = new Date().toISOString();

  await db.batch([
    db
      .prepare('UPDATE admin_auth SET password_hash = ?, updated_at = ? WHERE id = ?')
      .bind(nextHash, now, 'primary'),
    db.prepare('DELETE FROM admin_sessions'),
  ]);

  return createAdminSession(db);
}

// ---------------------------------------------------------------------------
// Prices Catalog CRUD, Excel Import Backup & Rollback (Cloudflare D1)
// ---------------------------------------------------------------------------
const DEFAULT_MANUAL_PRICE_COLUMNS = [
  'Category',
  'Product / Service',
  'Price',
  'Currency',
  'Branch',
  'Notes',
];

function detectPriceColumnsServer(columns: string[]): DetectedPriceColumns {
  const findCol = (patterns: RegExp[]): string | null => {
    for (const pattern of patterns) {
      const match = columns.find((col) => pattern.test(col.trim()));
      if (match) return match;
    }
    return null;
  };

  const findAllCols = (patterns: RegExp[]): string[] => {
    const matched: string[] = [];
    for (const col of columns) {
      if (patterns.some((p) => p.test(col.trim()))) {
        matched.push(col);
      }
    }
    return matched;
  };

  const categoryCol = findCol([
    /^(category|license\s*category|licence\s*category|vehicle\s*category|course\s*category|group|department|section|type)$/i,
    /\b(category|vehicle\s*type|license\s*type)\b/i,
  ]);
  const productCol = findCol([
    /^(product(\s*name)?|offer(\s*name)?|service(\s*name)?|package(\s*name)?|course(\s*name)?|item(\s*name)?|title|name|description|particulars)$/i,
    /\b(service|product|offer|package|course|item)\b/i,
  ]);
  const subCategoryCol = findCol([
    /^(sub\s*category|subcategory|variant|tier|shift|plan|class|option)$/i,
    /\b(sub\s*category|variant|tier|shift|plan)\b/i,
  ]);
  const feeTypeCol = findCol([
    /^(fee\s*type|payment\s*type|schedule\s*type|mode|training\s*type)$/i,
    /\b(fee\s*type|payment|schedule|training)\b/i,
  ]);
  const currencyCol = findCol([/^(currency|curr|unit)$/i, /\bcurrency\b/i]);
  const priceCol = findCol([
    /^(price|total\s*price|fee|amount|rate|cost|tariff|total(\s*amount)?|selling\s*price|gross\s*price|price\s*\(aed\)|aed(\s*price)?)$/i,
    /\b(price|fee|amount|rate|cost|tariff|aed)\b/i,
  ]);
  const semanticNonPriceCols = new Set(
    [categoryCol, productCol, subCategoryCol, feeTypeCol, currencyCol].filter(
      (v): v is string => Boolean(v)
    )
  );
  const priceCols = findAllCols([
    /^(price|total\s*price|fee|amount|rate|cost|tariff|total(\s*amount)?|selling\s*price|gross\s*price|regular|flexi|lumpsum|vip|standard|with\s*vat|without\s*vat|vat|discount)/i,
    /\b(price|fee|amount|rate|cost|tariff|aed|regular|flexi|lumpsum)\b/i,
  ]).filter((col) => !semanticNonPriceCols.has(col));
  const branchCol = findCol([
    /^(branch|branch\s*name|center|centre|location|emirate)$/i,
    /\b(branch|center|centre)\b/i,
  ]);
  const durationCol = findCol([
    /^(duration|hours|classes|sessions|lessons|validity)$/i,
    /\b(hours|classes|sessions|lessons|duration)\b/i,
  ]);
  const codeCol = findCol([
    /^(code|sku|item\s*code|service\s*code|id|s\.?\s*no\.?|sr\.?\s*no\.?|#)$/i,
  ]);
  const notesCol = findCol([
    /^(notes?|remarks?|comments?|details|info|conditions?)$/i,
    /\b(note|remark|comment|condition)\b/i,
  ]);

  return {
    categoryCol,
    productCol,
    subCategoryCol,
    feeTypeCol,
    priceCol: priceCol || priceCols[0] || null,
    priceCols,
    currencyCol,
    branchCol,
    durationCol,
    codeCol,
    notesCol,
  };
}

function parsePriceValueServer(
  rawDisplay: string,
  explicitCurrency = ''
): {
  priceDisplay: string;
  priceNumeric: number | null;
  currency: string;
  priceStatus: PriceValidationStatus;
} {
  const trimmed = rawDisplay.trim();
  const upper = trimmed.toUpperCase();

  let detectedCurrency = explicitCurrency.trim().toUpperCase();
  if (!detectedCurrency) {
    if (upper.includes('AED') || upper.includes('DHS') || upper.includes('د.إ')) {
      detectedCurrency = 'AED';
    } else if (upper.includes('USD') || trimmed.includes('$')) {
      detectedCurrency = 'USD';
    } else if (upper.includes('EUR') || trimmed.includes('€')) {
      detectedCurrency = 'EUR';
    } else if (upper.includes('GBP') || trimmed.includes('£')) {
      detectedCurrency = 'GBP';
    } else {
      detectedCurrency = 'AED';
    }
  }

  if (
    !trimmed ||
    trimmed === '-' ||
    trimmed === '—' ||
    upper === 'N/A' ||
    upper === 'NA' ||
    upper === 'NULL' ||
    upper === 'TBD' ||
    upper === 'NOT AVAILABLE'
  ) {
    return {
      priceDisplay: trimmed,
      priceNumeric: null,
      currency: detectedCurrency,
      priceStatus: 'missing',
    };
  }

  if (upper === 'FREE' || upper === 'COMPLIMENTARY') {
    return {
      priceDisplay: trimmed,
      priceNumeric: 0,
      currency: detectedCurrency,
      priceStatus: 'valid',
    };
  }

  const sanitized = trimmed.replace(/AED|DHS|USD|EUR|GBP|د\.إ|[$€£,\s]/gi, '').trim();
  if (/^-?\d+(\.\d+)?$/.test(sanitized)) {
    const num = Number(sanitized);
    if (Number.isFinite(num)) {
      return {
        priceDisplay: trimmed,
        priceNumeric: num,
        currency: detectedCurrency,
        priceStatus: 'valid',
      };
    }
  }

  const embeddedMatch = trimmed.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  if (
    embeddedMatch &&
    !/[a-zA-Z]{4,}/.test(trimmed.replace(/AED|DHS|USD|EUR|GBP|VAT|INCL|EXCL/gi, ''))
  ) {
    const num = Number(embeddedMatch[0]);
    if (Number.isFinite(num)) {
      return {
        priceDisplay: trimmed,
        priceNumeric: num,
        currency: detectedCurrency,
        priceStatus: 'valid',
      };
    }
  }

  return {
    priceDisplay: trimmed,
    priceNumeric: null,
    currency: detectedCurrency,
    priceStatus: 'invalid_format',
  };
}

async function getLatestPricesBackupInfo(db: D1Database): Promise<PricesBackupInfo> {
  try {
    const backup = await db
      .prepare(
        `SELECT id, created_at, file_name, record_count, reason
         FROM prices_backups
         ORDER BY id DESC
         LIMIT 1`
      )
      .first<{
        id: number;
        created_at: string;
        file_name: string;
        record_count: number;
        reason: string;
      }>();

    if (!backup) {
      return { hasBackup: false };
    }

    return {
      hasBackup: true,
      latestBackupId: backup.id,
      createdAt: backup.created_at,
      fileName: backup.file_name,
      recordCount: backup.record_count,
      reason: backup.reason,
    };
  } catch {
    return { hasBackup: false };
  }
}

export async function ensurePricesSeeded(db: D1Database): Promise<void> {
  if (pricesSeedPromise) {
    return pricesSeedPromise;
  }

  pricesSeedPromise = (async () => {
    const existingMeta = await db
      .prepare('SELECT id FROM prices_meta WHERE id = ?')
      .bind('active')
      .first<{ id: string }>();

    if (existingMeta) return;

    const existingCount = await db
      .prepare('SELECT COUNT(*) AS cnt FROM prices')
      .first<{ cnt: number }>();

    const now = new Date().toISOString();

    await db
      .prepare(
        `INSERT OR IGNORE INTO prices_meta
         (id, file_name, sheet_names_json, columns_json, detected_columns_json, notes_json, content_hash, imported_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        'active',
        DEFAULT_PRICES_FILE_NAME,
        JSON.stringify(DEFAULT_PRICES_SHEET_NAMES),
        JSON.stringify(DEFAULT_PRICES_COLUMNS),
        JSON.stringify(DEFAULT_PRICES_DETECTED_COLUMNS),
        JSON.stringify(DEFAULT_PRICES_NOTES),
        DEFAULT_PRICES_CONTENT_HASH,
        'Database Synced (Official CSV Tariff)'
      )
      .run();

    if ((existingCount?.cnt ?? 0) > 0) {
      return;
    }

    const insertStmt = db.prepare(
      `INSERT OR IGNORE INTO prices
       (row_key, sheet_name, sort_order, category, product_name, price_display, price_numeric, currency, price_status, fields_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const stmts = DEFAULT_PRICES_RECORDS.map((rec, index) =>
      insertStmt.bind(
        rec._rowKey,
        rec._sheetName || 'Sheet1',
        index + 1,
        rec.category,
        rec.productName,
        rec.priceDisplay,
        rec.priceNumeric,
        rec.currency || 'AED',
        rec.priceStatus || 'valid',
        JSON.stringify(rec.fields),
        now,
        now
      )
    );

    await executeChunkedBatch(db, stmts);
  })().finally(() => {
    pricesSeedPromise = null;
  });

  return pricesSeedPromise;
}

export async function getPricesDatasetFromDb(db: D1Database): Promise<PricesDataset> {
  await ensurePricesSeeded(db);
  const backupInfo = await getLatestPricesBackupInfo(db);

  const metaRow = await db
    .prepare('SELECT * FROM prices_meta WHERE id = ?')
    .bind('active')
    .first<{
      file_name: string;
      sheet_names_json: string;
      columns_json: string;
      detected_columns_json: string;
      notes_json: string;
      content_hash: string;
      imported_at: string;
    }>();

  if (!metaRow) {
    return {
      fileName: 'No Excel Price List Imported Yet',
      sheetNames: [],
      columns: [],
      detectedColumns: detectPriceColumnsServer([]),
      records: [],
      notes: [],
      contentHash: '',
      importedAt: '',
      backupInfo,
    };
  }

  const rowsResult = await db
    .prepare(
      `SELECT row_key, sheet_name, category, product_name, price_display, price_numeric, currency, price_status, fields_json
       FROM prices
       ORDER BY sort_order ASC`
    )
    .all<{
      row_key: string;
      sheet_name: string;
      category: string;
      product_name: string;
      price_display: string;
      price_numeric: number | null;
      currency: string;
      price_status: string;
      fields_json: string;
    }>();

  const rows = rowsResult.results || [];
  const records: PriceRecord[] = rows.map((r) => ({
    _rowKey: r.row_key,
    _sheetName: r.sheet_name,
    category: r.category,
    productName: r.product_name,
    priceDisplay: r.price_display,
    priceNumeric: r.price_numeric,
    currency: r.currency || 'AED',
    priceStatus:
      r.price_status === 'missing' || r.price_status === 'invalid_format'
        ? r.price_status
        : 'valid',
    fields: JSON.parse(r.fields_json) as Record<string, string>,
  }));

  return {
    fileName: metaRow.file_name,
    sheetNames: JSON.parse(metaRow.sheet_names_json) as string[],
    columns: JSON.parse(metaRow.columns_json) as string[],
    detectedColumns: JSON.parse(metaRow.detected_columns_json) as DetectedPriceColumns,
    records,
    notes: JSON.parse(metaRow.notes_json) as string[],
    contentHash: metaRow.content_hash || '',
    importedAt: metaRow.imported_at,
    backupInfo,
  };
}

export async function replacePricesDatasetInDb(
  db: D1Database,
  payload: {
    fileName: string;
    sheetNames: string[];
    columns: string[];
    detectedColumns: DetectedPriceColumns;
    records: PriceRecord[];
    notes: string[];
    contentHash: string;
    importedAt: string;
  }
): Promise<PricesDataset> {
  if (!payload?.columns?.length || !payload?.records?.length) {
    throw new ValidationError('Imported Excel dataset must include columns and at least one record.');
  }
  if (payload.records.length > 10000) {
    throw new ValidationError('Imported Excel dataset exceeds maximum limit of 10,000 rows.');
  }

  const existingDataset = await getPricesDatasetFromDb(db);
  const now = new Date().toISOString();

  // Preserve rollback snapshot before overwriting existing D1 prices records
  const isIdenticalReimport =
    Boolean(existingDataset.contentHash) &&
    Boolean(payload.contentHash) &&
    existingDataset.contentHash === payload.contentHash &&
    existingDataset.records.length === payload.records.length;

  if (existingDataset.records.length > 0 && !isIdenticalReimport) {
    const snapshot = JSON.stringify({
      fileName: existingDataset.fileName,
      sheetNames: existingDataset.sheetNames,
      columns: existingDataset.columns,
      detectedColumns: existingDataset.detectedColumns,
      records: existingDataset.records,
      notes: existingDataset.notes,
      contentHash: existingDataset.contentHash,
      importedAt: existingDataset.importedAt,
    });

    await db
      .prepare(
        `INSERT INTO prices_backups (created_at, reason, file_name, record_count, content_hash, snapshot_json)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(
        now,
        `Before importing ${payload.fileName}`,
        existingDataset.fileName,
        existingDataset.records.length,
        existingDataset.contentHash || '',
        snapshot
      )
      .run();

    await db
      .prepare(
        `DELETE FROM prices_backups
         WHERE id NOT IN (
           SELECT id FROM prices_backups ORDER BY id DESC LIMIT 5
         )`
      )
      .run();
  }

  const normalizedCols = payload.columns.map((c) => String(c).trim()).filter(Boolean);
  const seenKeys = new Set<string>();

  const normalizedRecords: PriceRecord[] = payload.records.map((rec, idx) => {
    const cleanFields: Record<string, string> = {};
    for (const col of normalizedCols) {
      const val = rec.fields?.[col];
      cleanFields[col] = typeof val === 'string' ? val.trim() : val != null ? String(val).trim() : '';
    }

    let rawRowKey = (rec._rowKey || `prc-${idx + 1}`).trim();
    if (!rawRowKey || seenKeys.has(rawRowKey)) {
      rawRowKey = `prc-${idx + 1}-${generateRandomHexToken(2)}`;
    }
    seenKeys.add(rawRowKey);

    const parsed = parsePriceValueServer(
      String(rec.priceDisplay ?? ''),
      String(rec.currency ?? '')
    );

    return {
      _rowKey: rawRowKey,
      _sheetName: (rec._sheetName || 'Sheet1').trim() || 'Sheet1',
      category: String(rec.category ?? '').trim() || (rec._sheetName || 'General'),
      productName: String(rec.productName ?? '').trim() || `Item #${idx + 1}`,
      priceDisplay: parsed.priceDisplay,
      priceNumeric: parsed.priceNumeric,
      currency: parsed.currency,
      priceStatus: parsed.priceStatus,
      fields: cleanFields,
    };
  });

  await db
    .prepare(
      `INSERT OR REPLACE INTO prices_meta
       (id, file_name, sheet_names_json, columns_json, detected_columns_json, notes_json, content_hash, imported_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      'active',
      payload.fileName,
      JSON.stringify(payload.sheetNames || ['Sheet1']),
      JSON.stringify(normalizedCols),
      JSON.stringify(payload.detectedColumns || detectPriceColumnsServer(normalizedCols)),
      JSON.stringify(payload.notes || []),
      payload.contentHash || '',
      payload.importedAt || now
    )
    .run();

  await db.prepare('DELETE FROM prices').run();

  const insertStmt = db.prepare(
    `INSERT INTO prices
     (row_key, sheet_name, sort_order, category, product_name, price_display, price_numeric, currency, price_status, fields_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const stmts = normalizedRecords.map((rec, idx) =>
    insertStmt.bind(
      rec._rowKey,
      rec._sheetName,
      idx + 1,
      rec.category,
      rec.productName,
      rec.priceDisplay,
      rec.priceNumeric,
      rec.currency,
      rec.priceStatus,
      JSON.stringify(rec.fields),
      now,
      now
    )
  );

  await executeChunkedBatch(db, stmts);

  return getPricesDatasetFromDb(db);
}

export async function rollbackPricesDatasetInDb(db: D1Database): Promise<PricesDataset> {
  const backup = await db
    .prepare(
      `SELECT id, snapshot_json
       FROM prices_backups
       ORDER BY id DESC
       LIMIT 1`
    )
    .first<{ id: number; snapshot_json: string }>();

  if (!backup) {
    throw new NotFoundError('No previous Prices backup is available to restore.');
  }

  const snapshot = JSON.parse(backup.snapshot_json) as {
    fileName: string;
    sheetNames: string[];
    columns: string[];
    detectedColumns: DetectedPriceColumns;
    records: PriceRecord[];
    notes: string[];
    contentHash: string;
    importedAt: string;
  };

  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT OR REPLACE INTO prices_meta
       (id, file_name, sheet_names_json, columns_json, detected_columns_json, notes_json, content_hash, imported_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      'active',
      snapshot.fileName,
      JSON.stringify(snapshot.sheetNames || ['Sheet1']),
      JSON.stringify(snapshot.columns || DEFAULT_MANUAL_PRICE_COLUMNS),
      JSON.stringify(snapshot.detectedColumns || detectPriceColumnsServer(snapshot.columns || [])),
      JSON.stringify(snapshot.notes || []),
      snapshot.contentHash || '',
      snapshot.importedAt || now
    )
    .run();

  await db.prepare('DELETE FROM prices').run();

  const insertStmt = db.prepare(
    `INSERT INTO prices
     (row_key, sheet_name, sort_order, category, product_name, price_display, price_numeric, currency, price_status, fields_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const stmts = (snapshot.records || []).map((rec, idx) =>
    insertStmt.bind(
      rec._rowKey,
      rec._sheetName || 'Sheet1',
      idx + 1,
      rec.category || '',
      rec.productName || '',
      rec.priceDisplay || '',
      rec.priceNumeric ?? null,
      rec.currency || 'AED',
      rec.priceStatus || 'valid',
      JSON.stringify(rec.fields || {}),
      now,
      now
    )
  );

  await executeChunkedBatch(db, stmts);

  await db.prepare('DELETE FROM prices_backups WHERE id = ?').bind(backup.id).run();

  return getPricesDatasetFromDb(db);
}

export async function createPriceRecordInDb(
  db: D1Database,
  payload: {
    fields?: Record<string, unknown>;
    sheetName?: string;
    category?: string;
    productName?: string;
    priceDisplay?: string;
    currency?: string;
  }
): Promise<PriceRecord> {
  const existingDataset = await getPricesDatasetFromDb(db);
  const now = new Date().toISOString();

  let columns = existingDataset.columns;
  let detected = existingDataset.detectedColumns;

  if (columns.length === 0) {
    const incomingKeys = Object.keys(payload.fields || {}).filter((k) => k.trim() !== '');
    columns = incomingKeys.length > 0 ? incomingKeys : DEFAULT_MANUAL_PRICE_COLUMNS;
    detected = detectPriceColumnsServer(columns);

    await db
      .prepare(
        `INSERT OR REPLACE INTO prices_meta
         (id, file_name, sheet_names_json, columns_json, detected_columns_json, notes_json, content_hash, imported_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        'active',
        'Manual Prices Catalog',
        JSON.stringify(['Sheet1']),
        JSON.stringify(columns),
        JSON.stringify(detected),
        JSON.stringify([]),
        '',
        now
      )
      .run();
  }

  const cleanFields = normalizeFields(payload.fields || {}, columns);
  const category =
    (payload.category || '').trim() ||
    (detected.categoryCol ? cleanFields[detected.categoryCol] : '') ||
    'General';
  const productName =
    (payload.productName || '').trim() ||
    (detected.productCol ? cleanFields[detected.productCol] : '') ||
    Object.values(cleanFields).find((v) => v.trim() !== '') ||
    '';

  if (!productName) {
    const targetCol = detected.productCol || columns[0];
    throw new ValidationError('Product or service name is required.', {
      [targetCol]: 'Product or service name is required.',
    });
  }

  const rawPrice =
    payload.priceDisplay !== undefined
      ? String(payload.priceDisplay)
      : detected.priceCol
      ? cleanFields[detected.priceCol]
      : '';
  const explicitCurrency =
    (payload.currency || '').trim() ||
    (detected.currencyCol ? cleanFields[detected.currencyCol] : '');

  const parsedPrice = parsePriceValueServer(rawPrice, explicitCurrency);

  if (detected.categoryCol && !cleanFields[detected.categoryCol]) {
    cleanFields[detected.categoryCol] = category;
  }
  if (detected.productCol && !cleanFields[detected.productCol]) {
    cleanFields[detected.productCol] = productName;
  }
  if (detected.priceCol && cleanFields[detected.priceCol] === '' && parsedPrice.priceDisplay) {
    cleanFields[detected.priceCol] = parsedPrice.priceDisplay;
  }
  if (detected.currencyCol && !cleanFields[detected.currencyCol]) {
    cleanFields[detected.currencyCol] = parsedPrice.currency;
  }

  const maxOrderRow = await db
    .prepare('SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM prices')
    .first<{ max_order: number }>();
  const nextOrder = (maxOrderRow?.max_order || 0) + 1;

  const rowKey = `prc-${Date.now()}-${generateRandomHexToken(4)}`;
  const sheetName = (payload.sheetName || 'Sheet1').trim() || 'Sheet1';

  await db
    .prepare(
      `INSERT INTO prices
       (row_key, sheet_name, sort_order, category, product_name, price_display, price_numeric, currency, price_status, fields_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      rowKey,
      sheetName,
      nextOrder,
      category,
      productName,
      parsedPrice.priceDisplay,
      parsedPrice.priceNumeric,
      parsedPrice.currency,
      parsedPrice.priceStatus,
      JSON.stringify(cleanFields),
      now,
      now
    )
    .run();

  return {
    _rowKey: rowKey,
    _sheetName: sheetName,
    category,
    productName,
    priceDisplay: parsedPrice.priceDisplay,
    priceNumeric: parsedPrice.priceNumeric,
    currency: parsedPrice.currency,
    priceStatus: parsedPrice.priceStatus,
    fields: cleanFields,
  };
}

export async function updatePriceRecordInDb(
  db: D1Database,
  rowKey: string,
  payload: {
    fields?: Record<string, unknown>;
    category?: string;
    productName?: string;
    priceDisplay?: string;
    currency?: string;
  }
): Promise<PriceRecord> {
  const existing = await db
    .prepare('SELECT row_key, sheet_name FROM prices WHERE row_key = ?')
    .bind(rowKey)
    .first<{ row_key: string; sheet_name: string }>();

  if (!existing) {
    throw new NotFoundError('Price record was not found.');
  }

  const dataset = await getPricesDatasetFromDb(db);
  const columns = dataset.columns.length > 0 ? dataset.columns : DEFAULT_MANUAL_PRICE_COLUMNS;
  const detected = dataset.detectedColumns;
  const cleanFields = normalizeFields(payload.fields || {}, columns);

  const category =
    (payload.category || '').trim() ||
    (detected.categoryCol ? cleanFields[detected.categoryCol] : '') ||
    'General';
  const productName =
    (payload.productName || '').trim() ||
    (detected.productCol ? cleanFields[detected.productCol] : '') ||
    Object.values(cleanFields).find((v) => v.trim() !== '') ||
    '';

  if (!productName) {
    const targetCol = detected.productCol || columns[0];
    throw new ValidationError('Product or service name is required.', {
      [targetCol]: 'Product or service name is required.',
    });
  }

  const rawPrice =
    payload.priceDisplay !== undefined
      ? String(payload.priceDisplay)
      : detected.priceCol
      ? cleanFields[detected.priceCol]
      : '';
  const explicitCurrency =
    (payload.currency || '').trim() ||
    (detected.currencyCol ? cleanFields[detected.currencyCol] : '');

  const parsedPrice = parsePriceValueServer(rawPrice, explicitCurrency);

  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE prices
       SET category = ?, product_name = ?, price_display = ?, price_numeric = ?, currency = ?, price_status = ?, fields_json = ?, updated_at = ?
       WHERE row_key = ?`
    )
    .bind(
      category,
      productName,
      parsedPrice.priceDisplay,
      parsedPrice.priceNumeric,
      parsedPrice.currency,
      parsedPrice.priceStatus,
      JSON.stringify(cleanFields),
      now,
      rowKey
    )
    .run();

  return {
    _rowKey: rowKey,
    _sheetName: existing.sheet_name,
    category,
    productName,
    priceDisplay: parsedPrice.priceDisplay,
    priceNumeric: parsedPrice.priceNumeric,
    currency: parsedPrice.currency,
    priceStatus: parsedPrice.priceStatus,
    fields: cleanFields,
  };
}

export async function deletePriceRecordInDb(db: D1Database, rowKey: string): Promise<void> {
  await ensurePricesSeeded(db);
  const result = await db
    .prepare('DELETE FROM prices WHERE row_key = ?')
    .bind(rowKey)
    .run();

  if (!result.meta || result.meta.changes === 0) {
    throw new NotFoundError('Price record was not found.');
  }
}
