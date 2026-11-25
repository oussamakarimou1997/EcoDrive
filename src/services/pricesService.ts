import * as XLSX from 'xlsx';
import {
  DetectedPriceColumns,
  PriceRecord,
  PriceValidationStatus,
  PricesDataset,
  PricesImportPreview,
  SheetImportStats,
} from '../types/prices';
import { AdminAuthError } from './adminAuthService';

export class PricesApiValidationError extends Error {
  public fieldErrors: Record<string, string>;
  constructor(message: string, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = 'PricesApiValidationError';
    this.fieldErrors = fieldErrors;
  }
}

async function parsePricesJsonError(res: Response, fallbackMsg: string): Promise<never> {
  let body: { error?: string; fieldErrors?: Record<string, string> } = {};
  try {
    body = (await res.json()) as { error?: string; fieldErrors?: Record<string, string> };
  } catch {
    // ignore JSON parse failure
  }
  if (res.status === 401) {
    throw new AdminAuthError(
      body.error || 'Unauthorized: Valid Admin Access Code authorization is required.',
      401
    );
  }
  if (res.status === 400) {
    throw new PricesApiValidationError(body.error || fallbackMsg, body.fieldErrors || {});
  }
  throw new Error(body.error || fallbackMsg);
}

/**
 * Detects key semantic columns from actual Excel headers across all worksheets.
 */
export function detectPriceColumns(columns: string[]): DetectedPriceColumns {
  const findCol = (patterns: RegExp[], exclude = new Set<string>()): string | null => {
    for (const pattern of patterns) {
      const match = columns.find((col) => !exclude.has(col) && pattern.test(col.trim()));
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

export function getEmptyPricesDataset(): PricesDataset {
  return {
    fileName: 'No Excel Price List Imported Yet',
    sheetNames: [],
    columns: [],
    detectedColumns: detectPriceColumns([]),
    records: [],
    notes: [],
    contentHash: '',
    importedAt: '',
    backupInfo: { hasBackup: false },
  };
}

/**
 * Parses a price display string and optional currency cell into normalized metadata
 * while preserving the exact original string formatting.
 */
export function parsePriceValue(
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

  // Extract numeric value from strings like "AED 1,250.50", "1,250", "293.50 AED", "Free"
  if (upper === 'FREE' || upper === 'COMPLIMENTARY') {
    return {
      priceDisplay: trimmed,
      priceNumeric: 0,
      currency: detectedCurrency,
      priceStatus: 'valid',
    };
  }

  const sanitized = trimmed
    .replace(/AED|DHS|USD|EUR|GBP|د\.إ|[$€£,\s]/gi, '')
    .trim();

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

  // Try matching first decimal number inside formatted text like "AED 450 + VAT"
  const embeddedMatch = trimmed.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  if (embeddedMatch && !/[a-zA-Z]{4,}/.test(trimmed.replace(/AED|DHS|USD|EUR|GBP|VAT|INCL|EXCL/gi, ''))) {
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

export function formatPriceDisplay(
  priceDisplay: string,
  priceNumeric: number | null,
  currency = 'AED'
): string {
  const trimmed = (priceDisplay || '').trim();
  if (trimmed) {
    // If raw display is purely numeric (e.g. "293.5" or "1250"), append currency clearly while keeping original digits
    if (/^-?[\d,]+(\.\d+)?$/.test(trimmed)) {
      return `${currency} ${trimmed}`;
    }
    return trimmed;
  }
  if (priceNumeric !== null && Number.isFinite(priceNumeric)) {
    return `${currency} ${priceNumeric.toFixed(2)}`;
  }
  return 'Not Available';
}

function getRawCellString(cell: XLSX.CellObject | undefined): string {
  if (!cell || cell.v === undefined || cell.v === null) return '';

  if (cell.t === 'n' && typeof cell.v === 'number') {
    if (cell.w !== undefined && !/[eE][+-]?\d+/.test(cell.w)) {
      return String(cell.w);
    }
    if (Number.isInteger(cell.v)) {
      return cell.v.toFixed(0);
    }
    return String(cell.v);
  }

  if (cell.w !== undefined) {
    return String(cell.w);
  }

  return String(cell.v);
}

function cleanCellText(raw: string): string {
  return raw.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractCellString(cell: XLSX.CellObject | undefined): string {
  return cleanCellText(getRawCellString(cell));
}

function isPlaceholderNbspCell(cell: XLSX.CellObject | undefined): boolean {
  const raw = getRawCellString(cell);
  return raw.length > 0 && cleanCellText(raw) === '' && /\u00A0/.test(raw);
}

function normalizeMatrixTierLabel(rawTier: string): string {
  return cleanCellText(rawTier).replace(/^LUMPSUM\s*\(\s*Absent\s*\)$/i, 'LUMPSUM (Absent)');
}

interface GroupedMatrixLayout {
  groupRowIdx: number;
  subHeaderRowIdx: number;
  serviceColIdx: number;
  serviceColHeader: string;
  tierColumns: Array<{
    colIdx: number;
    category: string;
    rawTier: string;
    normalizedTier: string;
    sourceHeader: string;
  }>;
  headerDiscrepancies: string[];
}

function detectGroupedTariffMatrix(
  sheet: XLSX.WorkSheet,
  range: XLSX.Range
): GroupedMatrixLayout | null {
  const maxScanRow = Math.min(range.e.r - 1, range.s.r + 12);

  for (let r = range.s.r; r <= maxScanRow; r++) {
    const groupCells: Array<{ colIdx: number; text: string }> = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const val = extractCellString(sheet[XLSX.utils.encode_cell({ r, c })]);
      if (val) groupCells.push({ colIdx: c, text: val });
    }
    if (groupCells.length < 2) continue;

    // Look 1 or 2 rows below for tier/plan subheaders (allowing a blank spacer row between group & tier headers)
    for (const offset of [1, 2]) {
      const subR = r + offset;
      if (subR > range.e.r) continue;

      if (offset === 2) {
        let middleNonEmpty = false;
        for (let c = range.s.c; c <= range.e.c; c++) {
          if (extractCellString(sheet[XLSX.utils.encode_cell({ r: r + 1, c })])) {
            middleNonEmpty = true;
            break;
          }
        }
        if (middleNonEmpty) continue;
      }

      const subCells: Array<{ colIdx: number; text: string }> = [];
      for (let c = range.s.c; c <= range.e.c; c++) {
        const val = extractCellString(sheet[XLSX.utils.encode_cell({ r: subR, c })]);
        if (val) subCells.push({ colIdx: c, text: val });
      }
      if (subCells.length < 3 || subCells.length <= groupCells.length) continue;

      // Determine the item/service label column (leftmost column present in data rows)
      const firstGroupCol = groupCells[0].colIdx;
      const firstSubCol = subCells[0].colIdx;
      const serviceColIdx = range.s.c;

      // Verify service column is empty in group row or contains a non-fee label while first tier column is to its right
      const tierStartCol = Math.max(serviceColIdx + 1, Math.min(firstGroupCol, firstSubCol));
      const tierSubCells = subCells.filter((cell) => cell.colIdx >= tierStartCol);
      if (tierSubCells.length < 3) continue;

      const hasRepeatedOrTierKeywords =
        new Set(tierSubCells.map((c) => normalizeMatrixTierLabel(c.text).toUpperCase())).size <
          tierSubCells.length ||
        tierSubCells.some((c) =>
          /\b(regular|flexi|lumpsum|standard|vip|absent|fee|price|rate)\b/i.test(c.text)
        );

      if (!hasRepeatedOrTierKeywords) continue;

      // Build column -> category mapping by carrying each group header rightwards across its sub-columns
      const groupAtCol = new Map<number, string>();
      groupCells.forEach((g) => {
        if (g.colIdx >= tierStartCol) {
          groupAtCol.set(g.colIdx, g.text);
        }
      });

      const tierColumns: GroupedMatrixLayout['tierColumns'] = [];
      const headerDiscrepancies: string[] = [];
      let currentGroup = '';

      for (const subCell of tierSubCells) {
        if (groupAtCol.has(subCell.colIdx)) {
          currentGroup = groupAtCol.get(subCell.colIdx)!;
        }
        if (!currentGroup) continue;

        const normalizedTier = normalizeMatrixTierLabel(subCell.text);
        if (normalizedTier !== subCell.text) {
          headerDiscrepancies.push(
            `Row ${subR + 1} (${currentGroup}): header "${subCell.text}" normalized to "${normalizedTier}" for consistent Plan / Tier filtering (original preserved in Source Header).`
          );
        }

        tierColumns.push({
          colIdx: subCell.colIdx,
          category: currentGroup,
          rawTier: subCell.text,
          normalizedTier,
          sourceHeader: `${currentGroup} / ${subCell.text}`,
        });
      }

      if (tierColumns.length >= 3) {
        const subServiceLabel = extractCellString(
          sheet[XLSX.utils.encode_cell({ r: subR, c: serviceColIdx })]
        );
        const groupServiceLabel = extractCellString(
          sheet[XLSX.utils.encode_cell({ r, c: serviceColIdx })]
        );
        return {
          groupRowIdx: r,
          subHeaderRowIdx: subR,
          serviceColIdx,
          serviceColHeader: subServiceLabel || groupServiceLabel || 'Service / Fee Item',
          tierColumns,
          headerDiscrepancies,
        };
      }
    }
  }

  return null;
}

export function computeSimpleHash(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export const MATRIX_PRICE_COLUMNS = [
  'Vehicle Category',
  'Plan / Tier',
  'Service / Fee Item',
  'Price',
  'Currency',
  'Source Row',
  'Source Header',
] as const;

/**
 * Reads an uploaded .xlsx, .xls, or .csv workbook across ALL worksheets.
 * Supports both flat tabular price lists and 2-row grouped fee/tariff matrices.
 * Preserves every price verbatim without estimating/modifying numbers,
 * flags duplicate rows, non-breaking-space placeholders, and missing/invalid price formats.
 */
export async function parsePricesWorkbook(file: File): Promise<PricesImportPreview> {
  const lowerName = file.name.toLowerCase();
  const isCsv = lowerName.endsWith('.csv');
  const buffer = await file.arrayBuffer();

  let workbook: XLSX.WorkBook;
  try {
    if (isCsv) {
      const bytes = new Uint8Array(buffer);
      let text = new TextDecoder('utf-8').decode(bytes);
      if (text.includes('\uFFFD')) {
        text = new TextDecoder('windows-1252').decode(bytes);
      }
      workbook = XLSX.read(text, { type: 'string', raw: false });
    } else {
      workbook = XLSX.read(buffer, { type: 'array', raw: false });
    }
  } catch {
    throw new Error(
      `Unable to read "${file.name}". Please ensure it is a valid .xlsx, .xls, or .csv Excel file.`
    );
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('The uploaded workbook contains no worksheets.');
  }

  const allColumnsSet = new Set<string>();
  const orderedColumns: string[] = [];
  const rawExtractedRows: Array<{
    sheetName: string;
    fields: Record<string, string>;
  }> = [];
  const notes: string[] = [];
  const warnings: string[] = [];
  const sheetColumnMap = new Map<string, string[]>();
  const sheetRawRowCounts = new Map<string, number>();
  let emptyRowsSkipped = 0;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet || !sheet['!ref']) {
      warnings.push(`Worksheet "${sheetName}" is empty and has no cell range.`);
      continue;
    }

    const range = XLSX.utils.decode_range(sheet['!ref']);
    const groupedMatrix = detectGroupedTariffMatrix(sheet, range);

    if (groupedMatrix) {
      const matrixCols = [...MATRIX_PRICE_COLUMNS];
      sheetColumnMap.set(sheetName, matrixCols);
      for (const col of matrixCols) {
        if (!allColumnsSet.has(col)) {
          allColumnsSet.add(col);
          orderedColumns.push(col);
        }
      }

      if (groupedMatrix.headerDiscrepancies.length > 0) {
        groupedMatrix.headerDiscrepancies.forEach((d) => {
          notes.push(`[${sheetName}] ${d}`);
        });
        warnings.push(
          `[${sheetName}] ${groupedMatrix.headerDiscrepancies[0]}`
        );
      }

      // Capture any non-empty banner lines above groupRowIdx as notes
      for (let r = range.s.r; r < groupedMatrix.groupRowIdx; r++) {
        const parts: string[] = [];
        for (let c = range.s.c; c <= range.e.c; c++) {
          const val = extractCellString(sheet[XLSX.utils.encode_cell({ r, c })]);
          if (val) parts.push(val);
        }
        if (parts.length > 0) {
          notes.push(`[${sheetName}] ${parts.join(' — ')}`);
        }
      }

      const nbspPlaceholders: string[] = [];
      let matrixRowsExtracted = 0;
      let matrixRowsWithoutAnyPrice = 0;

      for (let r = groupedMatrix.subHeaderRowIdx + 1; r <= range.e.r; r++) {
        const serviceCell = sheet[XLSX.utils.encode_cell({ r, c: groupedMatrix.serviceColIdx })];
        const serviceName = extractCellString(serviceCell);

        let anyNonEmptyInRow = serviceName !== '';
        if (!anyNonEmptyInRow) {
          for (const tc of groupedMatrix.tierColumns) {
            const val = extractCellString(sheet[XLSX.utils.encode_cell({ r, c: tc.colIdx })]);
            if (val !== '') {
              anyNonEmptyInRow = true;
              break;
            }
          }
        }

        if (!anyNonEmptyInRow) {
          emptyRowsSkipped++;
          continue;
        }

        const effectiveServiceName = serviceName || `Unnamed Row ${r + 1}`;
        const rowLabel = `Row ${r + 1}`;
        let populatedForService = 0;

        for (const tc of groupedMatrix.tierColumns) {
          const cell = sheet[XLSX.utils.encode_cell({ r, c: tc.colIdx })];
          if (isPlaceholderNbspCell(cell)) {
            nbspPlaceholders.push(`${rowLabel} (${effectiveServiceName}) -> ${tc.sourceHeader}`);
            continue;
          }

          const val = extractCellString(cell);
          if (!val) continue;

          populatedForService++;
          matrixRowsExtracted++;
          rawExtractedRows.push({
            sheetName,
            fields: {
              'Vehicle Category': tc.category,
              'Plan / Tier': tc.normalizedTier,
              'Service / Fee Item': effectiveServiceName,
              Price: val,
              Currency: 'AED',
              'Source Row': rowLabel,
              'Source Header': tc.sourceHeader,
            },
          });
        }

        if (populatedForService === 0 && serviceName) {
          matrixRowsWithoutAnyPrice++;
          matrixRowsExtracted++;
          rawExtractedRows.push({
            sheetName,
            fields: {
              'Vehicle Category': 'Unassigned',
              'Plan / Tier': 'Unspecified',
              'Service / Fee Item': effectiveServiceName,
              Price: '',
              Currency: 'AED',
              'Source Row': rowLabel,
              'Source Header': groupedMatrix.serviceColHeader,
            },
          });
        }
      }

      if (nbspPlaceholders.length > 0) {
        const summary = `${nbspPlaceholders.length} matrix cell(s) contained a non-breaking space (\\u00A0) instead of a fixed price and were not guessed or filled with zero: ${nbspPlaceholders.join('; ')}`;
        notes.push(`[${sheetName}] ${summary}`);
        warnings.push(
          `[${sheetName}] ${nbspPlaceholders.length} cell(s) contain blank/non-breaking space (\\u00A0) placeholders (not filled with guessed prices). See Imported Workbook Notes for the exact cell list.`
        );
      }

      if (matrixRowsWithoutAnyPrice > 0) {
        warnings.push(
          `[${sheetName}] ${matrixRowsWithoutAnyPrice} service row(s) had no price in any vehicle/tier column and are flagged as Missing Price.`
        );
      }

      sheetRawRowCounts.set(sheetName, matrixRowsExtracted);
      continue;
    }

    // Standard flat table extraction
    // Find the best header row in the first 10 rows (prefer row with >=2 non-empty cells or first non-empty row)
    let headerRowIdx = -1;
    let bestRowCells: Array<{ colIdx: number; text: string }> = [];

    for (let r = range.s.r; r <= Math.min(range.e.r, range.s.r + 10); r++) {
      const rowCells: Array<{ colIdx: number; text: string }> = [];
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const val = extractCellString(sheet[addr]);
        if (val !== '') {
          rowCells.push({ colIdx: c, text: val });
        }
      }
      if (rowCells.length >= 2) {
        headerRowIdx = r;
        bestRowCells = rowCells;
        break;
      }
      if (rowCells.length === 1 && headerRowIdx === -1) {
        headerRowIdx = r;
        bestRowCells = rowCells;
      }
    }

    // If single-cell banner rows appeared above the true multi-column header, capture them as sheet notes
    if (headerRowIdx > range.s.r) {
      for (let r = range.s.r; r < headerRowIdx; r++) {
        const parts: string[] = [];
        for (let c = range.s.c; c <= range.e.c; c++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          const val = extractCellString(sheet[addr]);
          if (val) parts.push(val);
        }
        if (parts.length > 0) {
          notes.push(`[${sheetName}] ${parts.join(' — ')}`);
        }
      }
    }

    if (headerRowIdx === -1 || bestRowCells.length === 0) {
      warnings.push(`Worksheet "${sheetName}" has no recognizable header row.`);
      continue;
    }

    const sheetHeaders: Array<{ colIdx: number; name: string }> = [];
    const usedHeaderNames = new Set<string>();
    bestRowCells.forEach(({ colIdx, text }) => {
      let finalHeader = text;
      let suffix = 2;
      while (usedHeaderNames.has(finalHeader)) {
        finalHeader = `${text} (${suffix++})`;
      }
      usedHeaderNames.add(finalHeader);
      sheetHeaders.push({ colIdx, name: finalHeader });
    });

    // Check if there are columns below headerRowIdx with data outside named headers
    const namedColIndices = new Set(sheetHeaders.map((h) => h.colIdx));
    let hasUnnamedCols = false;
    for (let r = headerRowIdx + 1; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        if (!namedColIndices.has(c)) {
          const addr = XLSX.utils.encode_cell({ r, c });
          if (extractCellString(sheet[addr]) !== '') {
            hasUnnamedCols = true;
            const colLetter = XLSX.utils.encode_col(c);
            const fallbackName = `Column ${colLetter}`;
            sheetHeaders.push({ colIdx: c, name: fallbackName });
            namedColIndices.add(c);
          }
        }
      }
    }

    if (hasUnnamedCols) {
      warnings.push(
        `Worksheet "${sheetName}" had values in unnamed columns; automatically preserved using column letters.`
      );
    }

    sheetColumnMap.set(
      sheetName,
      sheetHeaders.map((h) => h.name)
    );
    for (const h of sheetHeaders) {
      if (!allColumnsSet.has(h.name)) {
        allColumnsSet.add(h.name);
        orderedColumns.push(h.name);
      }
    }

    let sheetRowsCount = 0;
    for (let r = headerRowIdx + 1; r <= range.e.r; r++) {
      const fields: Record<string, string> = {};
      let rowHasValue = false;

      for (const h of sheetHeaders) {
        const addr = XLSX.utils.encode_cell({ r, c: h.colIdx });
        const val = extractCellString(sheet[addr]);
        if (val !== '') {
          rowHasValue = true;
        }
        fields[h.name] = val;
      }

      if (!rowHasValue) {
        emptyRowsSkipped++;
        continue;
      }

      // Skip repeated header rows inside tables
      const isRepeatedHeader = sheetHeaders.every(
        (h) => (fields[h.name] || '').trim().toLowerCase() === h.name.trim().toLowerCase()
      );
      if (isRepeatedHeader) {
        continue;
      }

      sheetRowsCount++;
      rawExtractedRows.push({ sheetName, fields });
    }
    sheetRawRowCounts.set(sheetName, sheetRowsCount);
  }

  if (orderedColumns.length === 0 || rawExtractedRows.length === 0) {
    throw new Error(
      'No price records could be extracted. Verify that the Excel workbook has column headers and at least one non-empty data row.'
    );
  }

  const detectedColumns = detectPriceColumns(orderedColumns);

  // Build normalized PriceRecord objects & detect duplicates across rows
  const allRecords: PriceRecord[] = [];
  const dedupedRecords: PriceRecord[] = [];
  const seenSignatures = new Set<string>();
  const sheetDupCounts = new Map<string, number>();
  const sheetMissingCounts = new Map<string, number>();
  const sheetInvalidCounts = new Map<string, number>();
  const sheetImportedCounts = new Map<string, number>();

  let duplicatesDetected = 0;
  let missingPriceCount = 0;
  let invalidPriceCount = 0;

  rawExtractedRows.forEach((raw, idx) => {
    const normalizedFields: Record<string, string> = {};
    for (const col of orderedColumns) {
      normalizedFields[col] = raw.fields[col] ?? '';
    }

    const rawCategory =
      (detectedColumns.categoryCol ? normalizedFields[detectedColumns.categoryCol] : '') ||
      (detectedColumns.branchCol ? normalizedFields[detectedColumns.branchCol] : '') ||
      raw.sheetName ||
      'General';

    const rawProduct =
      (detectedColumns.productCol ? normalizedFields[detectedColumns.productCol] : '') ||
      orderedColumns
        .filter(
          (c) =>
            c !== detectedColumns.categoryCol &&
            c !== detectedColumns.priceCol &&
            c !== detectedColumns.currencyCol &&
            c !== detectedColumns.codeCol
        )
        .map((c) => normalizedFields[c])
        .find((v) => v.trim() !== '') ||
      `Item #${idx + 1}`;

    // Find primary price cell (if primary priceCol empty, check secondary detected priceCols)
    let rawPriceStr = detectedColumns.priceCol ? normalizedFields[detectedColumns.priceCol] : '';
    if (!rawPriceStr && detectedColumns.priceCols.length > 0) {
      for (const pc of detectedColumns.priceCols) {
        if (normalizedFields[pc]?.trim()) {
          rawPriceStr = normalizedFields[pc];
          break;
        }
      }
    }

    const explicitCurrency = detectedColumns.currencyCol
      ? normalizedFields[detectedColumns.currencyCol]
      : '';
    const parsedPrice = parsePriceValue(rawPriceStr, explicitCurrency);

    if (parsedPrice.priceStatus === 'missing') {
      missingPriceCount++;
      sheetMissingCounts.set(raw.sheetName, (sheetMissingCounts.get(raw.sheetName) || 0) + 1);
    } else if (parsedPrice.priceStatus === 'invalid_format') {
      invalidPriceCount++;
      sheetInvalidCounts.set(raw.sheetName, (sheetInvalidCounts.get(raw.sheetName) || 0) + 1);
    }

    const record: PriceRecord = {
      _rowKey: `prc-${idx + 1}`,
      _sheetName: raw.sheetName,
      category: rawCategory.trim() || raw.sheetName,
      productName: rawProduct.trim(),
      priceDisplay: parsedPrice.priceDisplay,
      priceNumeric: parsedPrice.priceNumeric,
      currency: parsedPrice.currency,
      priceStatus: parsedPrice.priceStatus,
      fields: normalizedFields,
    };

    allRecords.push(record);

    const sig =
      raw.sheetName.trim().toLowerCase() +
      '::' +
      orderedColumns.map((c) => (normalizedFields[c] || '').trim().toLowerCase()).join('|');

    if (seenSignatures.has(sig)) {
      duplicatesDetected++;
      sheetDupCounts.set(raw.sheetName, (sheetDupCounts.get(raw.sheetName) || 0) + 1);
    } else {
      seenSignatures.add(sig);
      dedupedRecords.push(record);
      sheetImportedCounts.set(raw.sheetName, (sheetImportedCounts.get(raw.sheetName) || 0) + 1);
    }
  });

  if (duplicatesDetected > 0) {
    warnings.push(
      `${duplicatesDetected} exact duplicate row${duplicatesDetected > 1 ? 's' : ''} detected. Duplicates are excluded by default (you can choose to keep all rows if intentional).`
    );
  }
  if (missingPriceCount > 0) {
    warnings.push(
      `${missingPriceCount} row${missingPriceCount > 1 ? 's have' : ' has'} an empty or missing price value (preserved and flagged for review).`
    );
  }
  if (invalidPriceCount > 0) {
    warnings.push(
      `${invalidPriceCount} row${invalidPriceCount > 1 ? 's contain' : ' contains'} a non-numeric or text price format (original text preserved).`
    );
  }

  const sheetStats: SheetImportStats[] = workbook.SheetNames.map((name) => ({
    sheetName: name,
    rawRows: sheetRawRowCounts.get(name) || 0,
    importedRows: sheetImportedCounts.get(name) || 0,
    duplicateRows: sheetDupCounts.get(name) || 0,
    missingPriceRows: sheetMissingCounts.get(name) || 0,
    invalidPriceRows: sheetInvalidCounts.get(name) || 0,
    columns: sheetColumnMap.get(name) || [],
  }));

  const hashPayload = JSON.stringify({
    columns: orderedColumns,
    records: dedupedRecords.map((r) => [r._sheetName, r.fields]),
  });

  return {
    fileName: file.name,
    sheetNames: workbook.SheetNames,
    columns: orderedColumns,
    detectedColumns,
    records: dedupedRecords,
    allRecords,
    notes,
    contentHash: computeSimpleHash(hashPayload),
    totalRawRows: rawExtractedRows.length,
    duplicatesDetected,
    emptyRowsSkipped,
    missingPriceCount,
    invalidPriceCount,
    sheetStats,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Cloudflare D1 API Calls
// ---------------------------------------------------------------------------
export async function fetchPricesDataset(): Promise<PricesDataset> {
  const res = await fetch('/api/prices');
  if (!res.ok) {
    await parsePricesJsonError(res, 'Failed to load Prices catalog from database.');
  }
  return (await res.json()) as PricesDataset;
}

export async function saveImportedPricesDataset(
  payload: {
    fileName: string;
    sheetNames: string[];
    columns: string[];
    detectedColumns: DetectedPriceColumns;
    records: PriceRecord[];
    notes: string[];
    contentHash: string;
    importedAt: string;
  },
  adminToken: string
): Promise<PricesDataset> {
  const res = await fetch('/api/prices/import', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    await parsePricesJsonError(res, 'Failed to save imported Excel price list to D1.');
  }
  return (await res.json()) as PricesDataset;
}

export async function rollbackPricesDataset(adminToken: string): Promise<PricesDataset> {
  const res = await fetch('/api/prices/rollback', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
  });
  if (!res.ok) {
    await parsePricesJsonError(res, 'Failed to restore previous Prices backup.');
  }
  return (await res.json()) as PricesDataset;
}

export async function createPriceRecord(
  payload: {
    fields: Record<string, string>;
    sheetName?: string;
    category?: string;
    productName?: string;
    priceDisplay?: string;
    currency?: string;
  },
  adminToken: string
): Promise<PriceRecord> {
  const res = await fetch('/api/prices', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    await parsePricesJsonError(res, 'Failed to create price record.');
  }
  const data = (await res.json()) as { record: PriceRecord };
  return data.record;
}

export async function updatePriceRecord(
  rowKey: string,
  payload: {
    fields: Record<string, string>;
    category?: string;
    productName?: string;
    priceDisplay?: string;
    currency?: string;
  },
  adminToken: string
): Promise<PriceRecord> {
  const res = await fetch(`/api/prices/${encodeURIComponent(rowKey)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    await parsePricesJsonError(res, 'Failed to update price record.');
  }
  const data = (await res.json()) as { record: PriceRecord };
  return data.record;
}

export async function deletePriceRecord(rowKey: string, adminToken: string): Promise<void> {
  const res = await fetch(`/api/prices/${encodeURIComponent(rowKey)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
  });
  if (!res.ok) {
    await parsePricesJsonError(res, 'Failed to delete price record.');
  }
}

// ---------------------------------------------------------------------------
// Export Helpers (Excel & CSV)
// ---------------------------------------------------------------------------
export function exportPricesToExcel(
  records: PriceRecord[],
  columns: string[],
  fileNamePrefix = 'EcoDrive_Prices'
): void {
  const effectiveCols =
    columns.length > 0 ? columns : ['Category', 'Product / Service', 'Price', 'Currency'];

  const rows = records.map((rec) => {
    const obj: Record<string, string> = {};
    if (columns.length > 0) {
      effectiveCols.forEach((col) => {
        obj[col] = rec.fields[col] ?? '';
      });
    } else {
      obj['Category'] = rec.category;
      obj['Product / Service'] = rec.productName;
      obj['Price'] = rec.priceDisplay;
      obj['Currency'] = rec.currency;
    }
    return obj;
  });

  const worksheet = XLSX.utils.json_to_sheet(rows, { header: effectiveCols });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Prices');

  const dateTag = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `${fileNamePrefix}_${dateTag}.xlsx`);
}

export function exportPricesToCSV(
  records: PriceRecord[],
  columns: string[],
  fileNamePrefix = 'EcoDrive_Prices'
): void {
  const effectiveCols =
    columns.length > 0 ? columns : ['Category', 'Product / Service', 'Price', 'Currency'];

  const escapeCsv = (val: string): string => {
    if (/[",\n\r]/.test(val)) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const lines = [
    ['Worksheet', ...effectiveCols].map(escapeCsv).join(','),
    ...records.map((rec) => {
      const vals =
        columns.length > 0
          ? effectiveCols.map((c) => rec.fields[c] ?? '')
          : [rec.category, rec.productName, rec.priceDisplay, rec.currency];
      return [rec._sheetName, ...vals].map(escapeCsv).join(',');
    }),
  ];

  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateTag = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.setAttribute('download', `${fileNamePrefix}_${dateTag}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
