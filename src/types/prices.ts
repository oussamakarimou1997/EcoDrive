export type PriceValidationStatus = 'valid' | 'missing' | 'invalid_format';

export interface PriceRecord {
  /** Internal unique row key for D1 & React rendering */
  _rowKey: string;
  /** Worksheet name this record originated from */
  _sheetName: string;
  /** Normalized category extracted from Excel or worksheet name */
  category: string;
  /** Normalized product / offer / service name */
  productName: string;
  /** Original formatted price string preserved verbatim */
  priceDisplay: string;
  /** Parsed numeric value (null if missing or non-numeric) */
  priceNumeric: number | null;
  /** Currency symbol or code (e.g. AED) */
  currency: string;
  /** Validation status for missing/malformed price cells */
  priceStatus: PriceValidationStatus;
  /** Exact Excel column header -> exact formatted cell string */
  fields: Record<string, string>;
}

export interface DetectedPriceColumns {
  categoryCol: string | null;
  productCol: string | null;
  subCategoryCol: string | null;
  feeTypeCol: string | null;
  priceCol: string | null;
  priceCols: string[];
  currencyCol: string | null;
  branchCol: string | null;
  durationCol: string | null;
  codeCol: string | null;
  notesCol: string | null;
}

export interface PricesBackupInfo {
  hasBackup: boolean;
  latestBackupId?: number;
  createdAt?: string;
  fileName?: string;
  recordCount?: number;
  reason?: string;
}

export interface PricesDataset {
  fileName: string;
  sheetNames: string[];
  columns: string[];
  detectedColumns: DetectedPriceColumns;
  records: PriceRecord[];
  notes: string[];
  contentHash: string;
  importedAt: string;
  backupInfo: PricesBackupInfo;
}

export interface SheetImportStats {
  sheetName: string;
  rawRows: number;
  importedRows: number;
  duplicateRows: number;
  missingPriceRows: number;
  invalidPriceRows: number;
  columns: string[];
}

export interface PricesImportPreview {
  fileName: string;
  sheetNames: string[];
  columns: string[];
  detectedColumns: DetectedPriceColumns;
  /** Deduplicated records (duplicates skipped by default when deduplicate=true) */
  records: PriceRecord[];
  /** All extracted non-empty rows prior to duplicate removal */
  allRecords: PriceRecord[];
  notes: string[];
  contentHash: string;
  totalRawRows: number;
  duplicatesDetected: number;
  emptyRowsSkipped: number;
  missingPriceCount: number;
  invalidPriceCount: number;
  sheetStats: SheetImportStats[];
  warnings: string[];
}
