import {
  CategoryCode,
  FeeType,
  NormalizedPriceRecord,
  RawMatrixRow,
  SheetColumnHeader,
} from '../types/pricing';

export const SHEET_COLUMNS: SheetColumnHeader[] = [
  // LMV FEE (3 columns)
  { key: 'LMV_REGULAR', category: 'LMV', feeType: 'REGULAR', headerLabel: 'LMV - REGULAR' },
  { key: 'LMV_FLEXI', category: 'LMV', feeType: 'FLEXI', headerLabel: 'LMV - FLEXI' },
  { key: 'LMV_LUMPSUM (Absent)', category: 'LMV', feeType: 'LUMPSUM (Absent)', headerLabel: 'LMV - LUMPSUM (Absent)' },

  // MOT FEE (3 columns)
  { key: 'MOT_REGULAR', category: 'MOT', feeType: 'REGULAR', headerLabel: 'MOT - REGULAR' },
  { key: 'MOT_FLEXI', category: 'MOT', feeType: 'FLEXI', headerLabel: 'MOT - FLEXI' },
  { key: 'MOT_LUMPSUM (Absent)', category: 'MOT', feeType: 'LUMPSUM (Absent)', headerLabel: 'MOT - LUMPSUM (Absent)' },

  // HVB FEE (2 columns)
  { key: 'HVB_REGULAR', category: 'HVB', feeType: 'REGULAR', headerLabel: 'HVB - REGULAR' },
  { key: 'HVB_FLEXI', category: 'HVB', feeType: 'FLEXI', headerLabel: 'HVB - FLEXI' },

  // HVT FEE (2 columns)
  { key: 'HVT_REGULAR', category: 'HVT', feeType: 'REGULAR', headerLabel: 'HVT - REGULAR' },
  { key: 'HVT_FLEXI', category: 'HVT', feeType: 'FLEXI', headerLabel: 'HVT - FLEXI' },

  // HME FEE (2 columns)
  { key: 'HME_REGULAR', category: 'HME', feeType: 'REGULAR', headerLabel: 'HME - REGULAR' },
  { key: 'HME_FLEXI', category: 'HME', feeType: 'FLEXI', headerLabel: 'HME - FLEXI' },
];

// Default fallback matrix (t9dr t-importi l-sheet dyalk mn ba3d f l-app wla t3mmr had l-values)
export const RAW_SOURCE_MATRIX: RawMatrixRow[] = [];

export function normalizeMatrix(matrix: RawMatrixRow[]): NormalizedPriceRecord[] {
  const records: NormalizedPriceRecord[] = [];

  for (const row of matrix) {
    for (const col of SHEET_COLUMNS) {
      const rawVal = row.prices?.[col.key];
      const price = typeof rawVal === 'number' && !isNaN(rawVal) ? rawVal : null;

      records.push({
        id: `${row.serviceName}__${col.category}__${col.feeType}`,
        serviceName: row.serviceName,
        category: col.category as CategoryCode,
        feeType: col.feeType as FeeType,
        price,
      });
    }
  }

  return records;
}