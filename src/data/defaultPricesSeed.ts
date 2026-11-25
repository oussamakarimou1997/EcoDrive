// Reconstructed from the supplied official CSV tariff; blank cells are not prices.
import type { PriceRecord, DetectedPriceColumns } from '../types/prices';
export const DEFAULT_PRICES_FILE_NAME = 'CC- DAILY UPDATED TRACKER - TT,BOOKING(ADD ON AND REVISION CHARGES)(1).csv';
export const DEFAULT_PRICES_SHEET_NAMES = ['Sheet1'];
export const DEFAULT_PRICES_COLUMNS = ["Vehicle Category","Plan / Tier","Service / Fee Item","Price","Currency","Source Row","Source Header"];
export const DEFAULT_PRICES_DETECTED_COLUMNS: DetectedPriceColumns = {"categoryCol":"Vehicle Category","productCol":"Service / Fee Item","subCategoryCol":"Plan / Tier","feeTypeCol":null,"priceCol":"Price","priceCols":["Price"],"currencyCol":"Currency","branchCol":null,"durationCol":null,"codeCol":null,"notesCol":null};
export const DEFAULT_PRICES_NOTES = ['Blank and non-breaking-space tariff cells omitted; no prices inferred.', 'HVT LUMPSUM(Absent) normalized to LUMPSUM (Absent); original source header retained.'];
export const DEFAULT_PRICES_CONTENT_HASH = 'c11b8ae8';
export const DEFAULT_PRICES_RECORDS: PriceRecord[] = [
  {
    "_rowKey": "prc-1",
    "_sheetName": "Sheet1",
    "category": "LMV FEE",
    "productName": "THEORY TEST",
    "priceDisplay": "293.5",
    "priceNumeric": 293.5,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "LMV FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "THEORY TEST",
      "Price": "293.5",
      "Currency": "AED",
      "Source Row": "Row 6",
      "Source Header": "LMV FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-2",
    "_sheetName": "Sheet1",
    "category": "LMV FEE",
    "productName": "THEORY TEST",
    "priceDisplay": "293.5",
    "priceNumeric": 293.5,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "LMV FEE",
      "Plan / Tier": "FLEXI",
      "Service / Fee Item": "THEORY TEST",
      "Price": "293.5",
      "Currency": "AED",
      "Source Row": "Row 6",
      "Source Header": "LMV FEE / FLEXI"
    }
  },
  {
    "_rowKey": "prc-3",
    "_sheetName": "Sheet1",
    "category": "LMV FEE",
    "productName": "THEORY TEST",
    "priceDisplay": "292.45",
    "priceNumeric": 292.45,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "LMV FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "THEORY TEST",
      "Price": "292.45",
      "Currency": "AED",
      "Source Row": "Row 6",
      "Source Header": "LMV FEE / LUMPSUM (Absent)"
    }
  },
  {
    "_rowKey": "prc-4",
    "_sheetName": "Sheet1",
    "category": "MOT FEE",
    "productName": "THEORY TEST",
    "priceDisplay": "292.45",
    "priceNumeric": 292.45,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "MOT FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "THEORY TEST",
      "Price": "292.45",
      "Currency": "AED",
      "Source Row": "Row 6",
      "Source Header": "MOT FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-5",
    "_sheetName": "Sheet1",
    "category": "MOT FEE",
    "productName": "THEORY TEST",
    "priceDisplay": "292.45",
    "priceNumeric": 292.45,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "MOT FEE",
      "Plan / Tier": "FLEXI",
      "Service / Fee Item": "THEORY TEST",
      "Price": "292.45",
      "Currency": "AED",
      "Source Row": "Row 6",
      "Source Header": "MOT FEE / FLEXI"
    }
  },
  {
    "_rowKey": "prc-6",
    "_sheetName": "Sheet1",
    "category": "MOT FEE",
    "productName": "THEORY TEST",
    "priceDisplay": "292.45",
    "priceNumeric": 292.45,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "MOT FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "THEORY TEST",
      "Price": "292.45",
      "Currency": "AED",
      "Source Row": "Row 6",
      "Source Header": "MOT FEE / LUMPSUM (Absent)"
    }
  },
  {
    "_rowKey": "prc-7",
    "_sheetName": "Sheet1",
    "category": "HVB FEE",
    "productName": "THEORY TEST",
    "priceDisplay": "292.45",
    "priceNumeric": 292.45,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HVB FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "THEORY TEST",
      "Price": "292.45",
      "Currency": "AED",
      "Source Row": "Row 6",
      "Source Header": "HVB FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-8",
    "_sheetName": "Sheet1",
    "category": "HVB FEE",
    "productName": "THEORY TEST",
    "priceDisplay": "292.45",
    "priceNumeric": 292.45,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HVB FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "THEORY TEST",
      "Price": "292.45",
      "Currency": "AED",
      "Source Row": "Row 6",
      "Source Header": "HVB FEE / LUMPSUM (Absent)"
    }
  },
  {
    "_rowKey": "prc-9",
    "_sheetName": "Sheet1",
    "category": "HVT FEE",
    "productName": "THEORY TEST",
    "priceDisplay": "292.45",
    "priceNumeric": 292.45,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HVT FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "THEORY TEST",
      "Price": "292.45",
      "Currency": "AED",
      "Source Row": "Row 6",
      "Source Header": "HVT FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-10",
    "_sheetName": "Sheet1",
    "category": "HVT FEE",
    "productName": "THEORY TEST",
    "priceDisplay": "292.45",
    "priceNumeric": 292.45,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HVT FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "THEORY TEST",
      "Price": "292.45",
      "Currency": "AED",
      "Source Row": "Row 6",
      "Source Header": "HVT FEE / LUMPSUM(Absent)"
    }
  },
  {
    "_rowKey": "prc-11",
    "_sheetName": "Sheet1",
    "category": "HME FEE",
    "productName": "THEORY TEST",
    "priceDisplay": "292.45",
    "priceNumeric": 292.45,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HME FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "THEORY TEST",
      "Price": "292.45",
      "Currency": "AED",
      "Source Row": "Row 6",
      "Source Header": "HME FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-12",
    "_sheetName": "Sheet1",
    "category": "HME FEE",
    "productName": "THEORY TEST",
    "priceDisplay": "292.45",
    "priceNumeric": 292.45,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HME FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "THEORY TEST",
      "Price": "292.45",
      "Currency": "AED",
      "Source Row": "Row 6",
      "Source Header": "HME FEE / LUMPSUM (Absent)"
    }
  },
  {
    "_rowKey": "prc-13",
    "_sheetName": "Sheet1",
    "category": "LMV FEE",
    "productName": "RIS( THEORY TEST TRANSLATION FEE)",
    "priceDisplay": "415",
    "priceNumeric": 415,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "LMV FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "RIS( THEORY TEST TRANSLATION FEE)",
      "Price": "415",
      "Currency": "AED",
      "Source Row": "Row 7",
      "Source Header": "LMV FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-14",
    "_sheetName": "Sheet1",
    "category": "LMV FEE",
    "productName": "RIS( THEORY TEST TRANSLATION FEE)",
    "priceDisplay": "415",
    "priceNumeric": 415,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "LMV FEE",
      "Plan / Tier": "FLEXI",
      "Service / Fee Item": "RIS( THEORY TEST TRANSLATION FEE)",
      "Price": "415",
      "Currency": "AED",
      "Source Row": "Row 7",
      "Source Header": "LMV FEE / FLEXI"
    }
  },
  {
    "_rowKey": "prc-15",
    "_sheetName": "Sheet1",
    "category": "LMV FEE",
    "productName": "RIS( THEORY TEST TRANSLATION FEE)",
    "priceDisplay": "415",
    "priceNumeric": 415,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "LMV FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "RIS( THEORY TEST TRANSLATION FEE)",
      "Price": "415",
      "Currency": "AED",
      "Source Row": "Row 7",
      "Source Header": "LMV FEE / LUMPSUM (Absent)"
    }
  },
  {
    "_rowKey": "prc-16",
    "_sheetName": "Sheet1",
    "category": "MOT FEE",
    "productName": "RIS( THEORY TEST TRANSLATION FEE)",
    "priceDisplay": "415",
    "priceNumeric": 415,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "MOT FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "RIS( THEORY TEST TRANSLATION FEE)",
      "Price": "415",
      "Currency": "AED",
      "Source Row": "Row 7",
      "Source Header": "MOT FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-17",
    "_sheetName": "Sheet1",
    "category": "MOT FEE",
    "productName": "RIS( THEORY TEST TRANSLATION FEE)",
    "priceDisplay": "415",
    "priceNumeric": 415,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "MOT FEE",
      "Plan / Tier": "FLEXI",
      "Service / Fee Item": "RIS( THEORY TEST TRANSLATION FEE)",
      "Price": "415",
      "Currency": "AED",
      "Source Row": "Row 7",
      "Source Header": "MOT FEE / FLEXI"
    }
  },
  {
    "_rowKey": "prc-18",
    "_sheetName": "Sheet1",
    "category": "MOT FEE",
    "productName": "RIS( THEORY TEST TRANSLATION FEE)",
    "priceDisplay": "415",
    "priceNumeric": 415,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "MOT FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "RIS( THEORY TEST TRANSLATION FEE)",
      "Price": "415",
      "Currency": "AED",
      "Source Row": "Row 7",
      "Source Header": "MOT FEE / LUMPSUM (Absent)"
    }
  },
  {
    "_rowKey": "prc-19",
    "_sheetName": "Sheet1",
    "category": "HVB FEE",
    "productName": "RIS( THEORY TEST TRANSLATION FEE)",
    "priceDisplay": "415",
    "priceNumeric": 415,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HVB FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "RIS( THEORY TEST TRANSLATION FEE)",
      "Price": "415",
      "Currency": "AED",
      "Source Row": "Row 7",
      "Source Header": "HVB FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-20",
    "_sheetName": "Sheet1",
    "category": "HVB FEE",
    "productName": "RIS( THEORY TEST TRANSLATION FEE)",
    "priceDisplay": "415",
    "priceNumeric": 415,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HVB FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "RIS( THEORY TEST TRANSLATION FEE)",
      "Price": "415",
      "Currency": "AED",
      "Source Row": "Row 7",
      "Source Header": "HVB FEE / LUMPSUM (Absent)"
    }
  },
  {
    "_rowKey": "prc-21",
    "_sheetName": "Sheet1",
    "category": "HVT FEE",
    "productName": "RIS( THEORY TEST TRANSLATION FEE)",
    "priceDisplay": "415",
    "priceNumeric": 415,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HVT FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "RIS( THEORY TEST TRANSLATION FEE)",
      "Price": "415",
      "Currency": "AED",
      "Source Row": "Row 7",
      "Source Header": "HVT FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-22",
    "_sheetName": "Sheet1",
    "category": "HVT FEE",
    "productName": "RIS( THEORY TEST TRANSLATION FEE)",
    "priceDisplay": "415",
    "priceNumeric": 415,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HVT FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "RIS( THEORY TEST TRANSLATION FEE)",
      "Price": "415",
      "Currency": "AED",
      "Source Row": "Row 7",
      "Source Header": "HVT FEE / LUMPSUM(Absent)"
    }
  },
  {
    "_rowKey": "prc-23",
    "_sheetName": "Sheet1",
    "category": "HME FEE",
    "productName": "RIS( THEORY TEST TRANSLATION FEE)",
    "priceDisplay": "415",
    "priceNumeric": 415,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HME FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "RIS( THEORY TEST TRANSLATION FEE)",
      "Price": "415",
      "Currency": "AED",
      "Source Row": "Row 7",
      "Source Header": "HME FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-24",
    "_sheetName": "Sheet1",
    "category": "HME FEE",
    "productName": "RIS( THEORY TEST TRANSLATION FEE)",
    "priceDisplay": "415",
    "priceNumeric": 415,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HME FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "RIS( THEORY TEST TRANSLATION FEE)",
      "Price": "415",
      "Currency": "AED",
      "Source Row": "Row 7",
      "Source Header": "HME FEE / LUMPSUM (Absent)"
    }
  },
  {
    "_rowKey": "prc-25",
    "_sheetName": "Sheet1",
    "category": "LMV FEE",
    "productName": "RIS( THEORY TEST TRANSLATION FEE FOR GCC/GOLDEN VISA /GOLDEN CHANCE)",
    "priceDisplay": "415",
    "priceNumeric": 415,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "LMV FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "RIS( THEORY TEST TRANSLATION FEE FOR GCC/GOLDEN VISA /GOLDEN CHANCE)",
      "Price": "415",
      "Currency": "AED",
      "Source Row": "Row 8",
      "Source Header": "LMV FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-26",
    "_sheetName": "Sheet1",
    "category": "LMV FEE",
    "productName": "RIS( THEORY TEST TRANSLATION FEE FOR GCC/GOLDEN VISA /GOLDEN CHANCE)",
    "priceDisplay": "415",
    "priceNumeric": 415,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "LMV FEE",
      "Plan / Tier": "FLEXI",
      "Service / Fee Item": "RIS( THEORY TEST TRANSLATION FEE FOR GCC/GOLDEN VISA /GOLDEN CHANCE)",
      "Price": "415",
      "Currency": "AED",
      "Source Row": "Row 8",
      "Source Header": "LMV FEE / FLEXI"
    }
  },
  {
    "_rowKey": "prc-27",
    "_sheetName": "Sheet1",
    "category": "LMV FEE",
    "productName": "RIS( THEORY TEST TRANSLATION FEE FOR GCC/GOLDEN VISA /GOLDEN CHANCE)",
    "priceDisplay": "415",
    "priceNumeric": 415,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "LMV FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "RIS( THEORY TEST TRANSLATION FEE FOR GCC/GOLDEN VISA /GOLDEN CHANCE)",
      "Price": "415",
      "Currency": "AED",
      "Source Row": "Row 8",
      "Source Header": "LMV FEE / LUMPSUM (Absent)"
    }
  },
  {
    "_rowKey": "prc-28",
    "_sheetName": "Sheet1",
    "category": "MOT FEE",
    "productName": "RIS( THEORY TEST TRANSLATION FEE FOR GCC/GOLDEN VISA /GOLDEN CHANCE)",
    "priceDisplay": "415",
    "priceNumeric": 415,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "MOT FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "RIS( THEORY TEST TRANSLATION FEE FOR GCC/GOLDEN VISA /GOLDEN CHANCE)",
      "Price": "415",
      "Currency": "AED",
      "Source Row": "Row 8",
      "Source Header": "MOT FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-29",
    "_sheetName": "Sheet1",
    "category": "MOT FEE",
    "productName": "RIS( THEORY TEST TRANSLATION FEE FOR GCC/GOLDEN VISA /GOLDEN CHANCE)",
    "priceDisplay": "415",
    "priceNumeric": 415,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "MOT FEE",
      "Plan / Tier": "FLEXI",
      "Service / Fee Item": "RIS( THEORY TEST TRANSLATION FEE FOR GCC/GOLDEN VISA /GOLDEN CHANCE)",
      "Price": "415",
      "Currency": "AED",
      "Source Row": "Row 8",
      "Source Header": "MOT FEE / FLEXI"
    }
  },
  {
    "_rowKey": "prc-30",
    "_sheetName": "Sheet1",
    "category": "LMV FEE",
    "productName": "INITIAL ASSESSMENT TEST",
    "priceDisplay": "105",
    "priceNumeric": 105,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "LMV FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "INITIAL ASSESSMENT TEST",
      "Price": "105",
      "Currency": "AED",
      "Source Row": "Row 9",
      "Source Header": "LMV FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-31",
    "_sheetName": "Sheet1",
    "category": "LMV FEE",
    "productName": "INITIAL ASSESSMENT TEST",
    "priceDisplay": "105",
    "priceNumeric": 105,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "LMV FEE",
      "Plan / Tier": "FLEXI",
      "Service / Fee Item": "INITIAL ASSESSMENT TEST",
      "Price": "105",
      "Currency": "AED",
      "Source Row": "Row 9",
      "Source Header": "LMV FEE / FLEXI"
    }
  },
  {
    "_rowKey": "prc-32",
    "_sheetName": "Sheet1",
    "category": "LMV FEE",
    "productName": "INITIAL ASSESSMENT TEST",
    "priceDisplay": "103.95",
    "priceNumeric": 103.95,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "LMV FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "INITIAL ASSESSMENT TEST",
      "Price": "103.95",
      "Currency": "AED",
      "Source Row": "Row 9",
      "Source Header": "LMV FEE / LUMPSUM (Absent)"
    }
  },
  {
    "_rowKey": "prc-33",
    "_sheetName": "Sheet1",
    "category": "MOT FEE",
    "productName": "INITIAL ASSESSMENT TEST",
    "priceDisplay": "103.95",
    "priceNumeric": 103.95,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "MOT FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "INITIAL ASSESSMENT TEST",
      "Price": "103.95",
      "Currency": "AED",
      "Source Row": "Row 9",
      "Source Header": "MOT FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-34",
    "_sheetName": "Sheet1",
    "category": "MOT FEE",
    "productName": "INITIAL ASSESSMENT TEST",
    "priceDisplay": "103.95",
    "priceNumeric": 103.95,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "MOT FEE",
      "Plan / Tier": "FLEXI",
      "Service / Fee Item": "INITIAL ASSESSMENT TEST",
      "Price": "103.95",
      "Currency": "AED",
      "Source Row": "Row 9",
      "Source Header": "MOT FEE / FLEXI"
    }
  },
  {
    "_rowKey": "prc-35",
    "_sheetName": "Sheet1",
    "category": "MOT FEE",
    "productName": "INITIAL ASSESSMENT TEST",
    "priceDisplay": "103.95",
    "priceNumeric": 103.95,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "MOT FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "INITIAL ASSESSMENT TEST",
      "Price": "103.95",
      "Currency": "AED",
      "Source Row": "Row 9",
      "Source Header": "MOT FEE / LUMPSUM (Absent)"
    }
  },
  {
    "_rowKey": "prc-36",
    "_sheetName": "Sheet1",
    "category": "HVB FEE",
    "productName": "INITIAL ASSESSMENT TEST",
    "priceDisplay": "103.95",
    "priceNumeric": 103.95,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HVB FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "INITIAL ASSESSMENT TEST",
      "Price": "103.95",
      "Currency": "AED",
      "Source Row": "Row 9",
      "Source Header": "HVB FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-37",
    "_sheetName": "Sheet1",
    "category": "HVB FEE",
    "productName": "INITIAL ASSESSMENT TEST",
    "priceDisplay": "103.95",
    "priceNumeric": 103.95,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HVB FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "INITIAL ASSESSMENT TEST",
      "Price": "103.95",
      "Currency": "AED",
      "Source Row": "Row 9",
      "Source Header": "HVB FEE / LUMPSUM (Absent)"
    }
  },
  {
    "_rowKey": "prc-38",
    "_sheetName": "Sheet1",
    "category": "HVT FEE",
    "productName": "INITIAL ASSESSMENT TEST",
    "priceDisplay": "103.95",
    "priceNumeric": 103.95,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HVT FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "INITIAL ASSESSMENT TEST",
      "Price": "103.95",
      "Currency": "AED",
      "Source Row": "Row 9",
      "Source Header": "HVT FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-39",
    "_sheetName": "Sheet1",
    "category": "HVT FEE",
    "productName": "INITIAL ASSESSMENT TEST",
    "priceDisplay": "103.95",
    "priceNumeric": 103.95,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HVT FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "INITIAL ASSESSMENT TEST",
      "Price": "103.95",
      "Currency": "AED",
      "Source Row": "Row 9",
      "Source Header": "HVT FEE / LUMPSUM(Absent)"
    }
  },
  {
    "_rowKey": "prc-40",
    "_sheetName": "Sheet1",
    "category": "HME FEE",
    "productName": "INITIAL ASSESSMENT TEST",
    "priceDisplay": "103.95",
    "priceNumeric": 103.95,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HME FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "INITIAL ASSESSMENT TEST",
      "Price": "103.95",
      "Currency": "AED",
      "Source Row": "Row 9",
      "Source Header": "HME FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-41",
    "_sheetName": "Sheet1",
    "category": "HME FEE",
    "productName": "INITIAL ASSESSMENT TEST",
    "priceDisplay": "103.95",
    "priceNumeric": 103.95,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HME FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "INITIAL ASSESSMENT TEST",
      "Price": "103.95",
      "Currency": "AED",
      "Source Row": "Row 9",
      "Source Header": "HME FEE / LUMPSUM (Absent)"
    }
  },
  {
    "_rowKey": "prc-42",
    "_sheetName": "Sheet1",
    "category": "LMV FEE",
    "productName": "INTERNAL YARD",
    "priceDisplay": "105",
    "priceNumeric": 105,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "LMV FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "INTERNAL YARD",
      "Price": "105",
      "Currency": "AED",
      "Source Row": "Row 10",
      "Source Header": "LMV FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-43",
    "_sheetName": "Sheet1",
    "category": "LMV FEE",
    "productName": "INTERNAL YARD",
    "priceDisplay": "105",
    "priceNumeric": 105,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "LMV FEE",
      "Plan / Tier": "FLEXI",
      "Service / Fee Item": "INTERNAL YARD",
      "Price": "105",
      "Currency": "AED",
      "Source Row": "Row 10",
      "Source Header": "LMV FEE / FLEXI"
    }
  },
  {
    "_rowKey": "prc-44",
    "_sheetName": "Sheet1",
    "category": "LMV FEE",
    "productName": "INTERNAL YARD",
    "priceDisplay": "103.95",
    "priceNumeric": 103.95,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "LMV FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "INTERNAL YARD",
      "Price": "103.95",
      "Currency": "AED",
      "Source Row": "Row 10",
      "Source Header": "LMV FEE / LUMPSUM (Absent)"
    }
  },
  {
    "_rowKey": "prc-45",
    "_sheetName": "Sheet1",
    "category": "LMV FEE",
    "productName": "RTA YARD TEST",
    "priceDisplay": "293.5",
    "priceNumeric": 293.5,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "LMV FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "RTA YARD TEST",
      "Price": "293.5",
      "Currency": "AED",
      "Source Row": "Row 11",
      "Source Header": "LMV FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-46",
    "_sheetName": "Sheet1",
    "category": "LMV FEE",
    "productName": "RTA YARD TEST",
    "priceDisplay": "293.5",
    "priceNumeric": 293.5,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "LMV FEE",
      "Plan / Tier": "FLEXI",
      "Service / Fee Item": "RTA YARD TEST",
      "Price": "293.5",
      "Currency": "AED",
      "Source Row": "Row 11",
      "Source Header": "LMV FEE / FLEXI"
    }
  },
  {
    "_rowKey": "prc-47",
    "_sheetName": "Sheet1",
    "category": "LMV FEE",
    "productName": "RTA YARD TEST",
    "priceDisplay": "292.45",
    "priceNumeric": 292.45,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "LMV FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "RTA YARD TEST",
      "Price": "292.45",
      "Currency": "AED",
      "Source Row": "Row 11",
      "Source Header": "LMV FEE / LUMPSUM (Absent)"
    }
  },
  {
    "_rowKey": "prc-48",
    "_sheetName": "Sheet1",
    "category": "MOT FEE",
    "productName": "RTA YARD TEST",
    "priceDisplay": "292.45",
    "priceNumeric": 292.45,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "MOT FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "RTA YARD TEST",
      "Price": "292.45",
      "Currency": "AED",
      "Source Row": "Row 11",
      "Source Header": "MOT FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-49",
    "_sheetName": "Sheet1",
    "category": "MOT FEE",
    "productName": "RTA YARD TEST",
    "priceDisplay": "292.45",
    "priceNumeric": 292.45,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "MOT FEE",
      "Plan / Tier": "FLEXI",
      "Service / Fee Item": "RTA YARD TEST",
      "Price": "292.45",
      "Currency": "AED",
      "Source Row": "Row 11",
      "Source Header": "MOT FEE / FLEXI"
    }
  },
  {
    "_rowKey": "prc-50",
    "_sheetName": "Sheet1",
    "category": "MOT FEE",
    "productName": "RTA YARD TEST",
    "priceDisplay": "292.45",
    "priceNumeric": 292.45,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "MOT FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "RTA YARD TEST",
      "Price": "292.45",
      "Currency": "AED",
      "Source Row": "Row 11",
      "Source Header": "MOT FEE / LUMPSUM (Absent)"
    }
  },
  {
    "_rowKey": "prc-51",
    "_sheetName": "Sheet1",
    "category": "HVB FEE",
    "productName": "RTA YARD TEST",
    "priceDisplay": "292.45",
    "priceNumeric": 292.45,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HVB FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "RTA YARD TEST",
      "Price": "292.45",
      "Currency": "AED",
      "Source Row": "Row 11",
      "Source Header": "HVB FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-52",
    "_sheetName": "Sheet1",
    "category": "HVB FEE",
    "productName": "RTA YARD TEST",
    "priceDisplay": "292.45",
    "priceNumeric": 292.45,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HVB FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "RTA YARD TEST",
      "Price": "292.45",
      "Currency": "AED",
      "Source Row": "Row 11",
      "Source Header": "HVB FEE / LUMPSUM (Absent)"
    }
  },
  {
    "_rowKey": "prc-53",
    "_sheetName": "Sheet1",
    "category": "HVT FEE",
    "productName": "RTA YARD TEST",
    "priceDisplay": "292.45",
    "priceNumeric": 292.45,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HVT FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "RTA YARD TEST",
      "Price": "292.45",
      "Currency": "AED",
      "Source Row": "Row 11",
      "Source Header": "HVT FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-54",
    "_sheetName": "Sheet1",
    "category": "HVT FEE",
    "productName": "RTA YARD TEST",
    "priceDisplay": "292.45",
    "priceNumeric": 292.45,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HVT FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "RTA YARD TEST",
      "Price": "292.45",
      "Currency": "AED",
      "Source Row": "Row 11",
      "Source Header": "HVT FEE / LUMPSUM(Absent)"
    }
  },
  {
    "_rowKey": "prc-55",
    "_sheetName": "Sheet1",
    "category": "HME FEE",
    "productName": "RTA YARD TEST",
    "priceDisplay": "292.45",
    "priceNumeric": 292.45,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HME FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "RTA YARD TEST",
      "Price": "292.45",
      "Currency": "AED",
      "Source Row": "Row 11",
      "Source Header": "HME FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-56",
    "_sheetName": "Sheet1",
    "category": "HME FEE",
    "productName": "RTA YARD TEST",
    "priceDisplay": "292.45",
    "priceNumeric": 292.45,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HME FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "RTA YARD TEST",
      "Price": "292.45",
      "Currency": "AED",
      "Source Row": "Row 11",
      "Source Header": "HME FEE / LUMPSUM (Absent)"
    }
  },
  {
    "_rowKey": "prc-57",
    "_sheetName": "Sheet1",
    "category": "LMV FEE",
    "productName": "RTA ROAD TEST",
    "priceDisplay": "293.5",
    "priceNumeric": 293.5,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "LMV FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "RTA ROAD TEST",
      "Price": "293.5",
      "Currency": "AED",
      "Source Row": "Row 12",
      "Source Header": "LMV FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-58",
    "_sheetName": "Sheet1",
    "category": "LMV FEE",
    "productName": "RTA ROAD TEST",
    "priceDisplay": "293.5",
    "priceNumeric": 293.5,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "LMV FEE",
      "Plan / Tier": "FLEXI",
      "Service / Fee Item": "RTA ROAD TEST",
      "Price": "293.5",
      "Currency": "AED",
      "Source Row": "Row 12",
      "Source Header": "LMV FEE / FLEXI"
    }
  },
  {
    "_rowKey": "prc-59",
    "_sheetName": "Sheet1",
    "category": "LMV FEE",
    "productName": "RTA ROAD TEST",
    "priceDisplay": "292.45",
    "priceNumeric": 292.45,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "LMV FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "RTA ROAD TEST",
      "Price": "292.45",
      "Currency": "AED",
      "Source Row": "Row 12",
      "Source Header": "LMV FEE / LUMPSUM (Absent)"
    }
  },
  {
    "_rowKey": "prc-60",
    "_sheetName": "Sheet1",
    "category": "MOT FEE",
    "productName": "RTA ROAD TEST",
    "priceDisplay": "292.45",
    "priceNumeric": 292.45,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "MOT FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "RTA ROAD TEST",
      "Price": "292.45",
      "Currency": "AED",
      "Source Row": "Row 12",
      "Source Header": "MOT FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-61",
    "_sheetName": "Sheet1",
    "category": "MOT FEE",
    "productName": "RTA ROAD TEST",
    "priceDisplay": "292.45",
    "priceNumeric": 292.45,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "MOT FEE",
      "Plan / Tier": "FLEXI",
      "Service / Fee Item": "RTA ROAD TEST",
      "Price": "292.45",
      "Currency": "AED",
      "Source Row": "Row 12",
      "Source Header": "MOT FEE / FLEXI"
    }
  },
  {
    "_rowKey": "prc-62",
    "_sheetName": "Sheet1",
    "category": "MOT FEE",
    "productName": "RTA ROAD TEST",
    "priceDisplay": "292.45",
    "priceNumeric": 292.45,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "MOT FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "RTA ROAD TEST",
      "Price": "292.45",
      "Currency": "AED",
      "Source Row": "Row 12",
      "Source Header": "MOT FEE / LUMPSUM (Absent)"
    }
  },
  {
    "_rowKey": "prc-63",
    "_sheetName": "Sheet1",
    "category": "HVB FEE",
    "productName": "RTA ROAD TEST",
    "priceDisplay": "292.45",
    "priceNumeric": 292.45,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HVB FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "RTA ROAD TEST",
      "Price": "292.45",
      "Currency": "AED",
      "Source Row": "Row 12",
      "Source Header": "HVB FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-64",
    "_sheetName": "Sheet1",
    "category": "HVB FEE",
    "productName": "RTA ROAD TEST",
    "priceDisplay": "292.45",
    "priceNumeric": 292.45,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HVB FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "RTA ROAD TEST",
      "Price": "292.45",
      "Currency": "AED",
      "Source Row": "Row 12",
      "Source Header": "HVB FEE / LUMPSUM (Absent)"
    }
  },
  {
    "_rowKey": "prc-65",
    "_sheetName": "Sheet1",
    "category": "HVT FEE",
    "productName": "RTA ROAD TEST",
    "priceDisplay": "292.45",
    "priceNumeric": 292.45,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HVT FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "RTA ROAD TEST",
      "Price": "292.45",
      "Currency": "AED",
      "Source Row": "Row 12",
      "Source Header": "HVT FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-66",
    "_sheetName": "Sheet1",
    "category": "HVT FEE",
    "productName": "RTA ROAD TEST",
    "priceDisplay": "292.45",
    "priceNumeric": 292.45,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HVT FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "RTA ROAD TEST",
      "Price": "292.45",
      "Currency": "AED",
      "Source Row": "Row 12",
      "Source Header": "HVT FEE / LUMPSUM(Absent)"
    }
  },
  {
    "_rowKey": "prc-67",
    "_sheetName": "Sheet1",
    "category": "HME FEE",
    "productName": "RTA ROAD TEST",
    "priceDisplay": "292.45",
    "priceNumeric": 292.45,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HME FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "RTA ROAD TEST",
      "Price": "292.45",
      "Currency": "AED",
      "Source Row": "Row 12",
      "Source Header": "HME FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-68",
    "_sheetName": "Sheet1",
    "category": "HME FEE",
    "productName": "RTA ROAD TEST",
    "priceDisplay": "292.45",
    "priceNumeric": 292.45,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HME FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "RTA ROAD TEST",
      "Price": "292.45",
      "Currency": "AED",
      "Source Row": "Row 12",
      "Source Header": "HME FEE / LUMPSUM (Absent)"
    }
  },
  {
    "_rowKey": "prc-69",
    "_sheetName": "Sheet1",
    "category": "HVT FEE",
    "productName": "ARTICULATED ASSESSEMENT",
    "priceDisplay": "103.95",
    "priceNumeric": 103.95,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HVT FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "ARTICULATED ASSESSEMENT",
      "Price": "103.95",
      "Currency": "AED",
      "Source Row": "Row 13",
      "Source Header": "HVT FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-70",
    "_sheetName": "Sheet1",
    "category": "LMV FEE",
    "productName": "CLASS/HR",
    "priceDisplay": "105",
    "priceNumeric": 105,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "LMV FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "CLASS/HR",
      "Price": "105",
      "Currency": "AED",
      "Source Row": "Row 14",
      "Source Header": "LMV FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-71",
    "_sheetName": "Sheet1",
    "category": "LMV FEE",
    "productName": "CLASS/HR",
    "priceDisplay": "138.6",
    "priceNumeric": 138.6,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "LMV FEE",
      "Plan / Tier": "FLEXI",
      "Service / Fee Item": "CLASS/HR",
      "Price": "138.6",
      "Currency": "AED",
      "Source Row": "Row 14",
      "Source Header": "LMV FEE / FLEXI"
    }
  },
  {
    "_rowKey": "prc-72",
    "_sheetName": "Sheet1",
    "category": "LMV FEE",
    "productName": "CLASS/HR",
    "priceDisplay": "105",
    "priceNumeric": 105,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "LMV FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "CLASS/HR",
      "Price": "105",
      "Currency": "AED",
      "Source Row": "Row 14",
      "Source Header": "LMV FEE / LUMPSUM (Absent)"
    }
  },
  {
    "_rowKey": "prc-73",
    "_sheetName": "Sheet1",
    "category": "MOT FEE",
    "productName": "CLASS/HR",
    "priceDisplay": "73.5",
    "priceNumeric": 73.5,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "MOT FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "CLASS/HR",
      "Price": "73.5",
      "Currency": "AED",
      "Source Row": "Row 14",
      "Source Header": "MOT FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-74",
    "_sheetName": "Sheet1",
    "category": "MOT FEE",
    "productName": "CLASS/HR",
    "priceDisplay": "115.5",
    "priceNumeric": 115.5,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "MOT FEE",
      "Plan / Tier": "FLEXI",
      "Service / Fee Item": "CLASS/HR",
      "Price": "115.5",
      "Currency": "AED",
      "Source Row": "Row 14",
      "Source Header": "MOT FEE / FLEXI"
    }
  },
  {
    "_rowKey": "prc-75",
    "_sheetName": "Sheet1",
    "category": "MOT FEE",
    "productName": "CLASS/HR",
    "priceDisplay": "105",
    "priceNumeric": 105,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "MOT FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "CLASS/HR",
      "Price": "105",
      "Currency": "AED",
      "Source Row": "Row 14",
      "Source Header": "MOT FEE / LUMPSUM (Absent)"
    }
  },
  {
    "_rowKey": "prc-76",
    "_sheetName": "Sheet1",
    "category": "HVB FEE",
    "productName": "CLASS/HR",
    "priceDisplay": "115.5",
    "priceNumeric": 115.5,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HVB FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "CLASS/HR",
      "Price": "115.5",
      "Currency": "AED",
      "Source Row": "Row 14",
      "Source Header": "HVB FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-77",
    "_sheetName": "Sheet1",
    "category": "HVB FEE",
    "productName": "CLASS/HR",
    "priceDisplay": "157.5",
    "priceNumeric": 157.5,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HVB FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "CLASS/HR",
      "Price": "157.5",
      "Currency": "AED",
      "Source Row": "Row 14",
      "Source Header": "HVB FEE / LUMPSUM (Absent)"
    }
  },
  {
    "_rowKey": "prc-78",
    "_sheetName": "Sheet1",
    "category": "HVT FEE",
    "productName": "CLASS/HR",
    "priceDisplay": "126",
    "priceNumeric": 126,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HVT FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "CLASS/HR",
      "Price": "126",
      "Currency": "AED",
      "Source Row": "Row 14",
      "Source Header": "HVT FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-79",
    "_sheetName": "Sheet1",
    "category": "HVT FEE",
    "productName": "CLASS/HR",
    "priceDisplay": "157.5",
    "priceNumeric": 157.5,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HVT FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "CLASS/HR",
      "Price": "157.5",
      "Currency": "AED",
      "Source Row": "Row 14",
      "Source Header": "HVT FEE / LUMPSUM(Absent)"
    }
  },
  {
    "_rowKey": "prc-80",
    "_sheetName": "Sheet1",
    "category": "HME FEE",
    "productName": "CLASS/HR",
    "priceDisplay": "115.5",
    "priceNumeric": 115.5,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HME FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "CLASS/HR",
      "Price": "115.5",
      "Currency": "AED",
      "Source Row": "Row 14",
      "Source Header": "HME FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-81",
    "_sheetName": "Sheet1",
    "category": "LMV FEE",
    "productName": "Learning Permit",
    "priceDisplay": "120",
    "priceNumeric": 120,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "LMV FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "Learning Permit",
      "Price": "120",
      "Currency": "AED",
      "Source Row": "Row 15",
      "Source Header": "LMV FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-82",
    "_sheetName": "Sheet1",
    "category": "LMV FEE",
    "productName": "Learning Permit",
    "priceDisplay": "120",
    "priceNumeric": 120,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "LMV FEE",
      "Plan / Tier": "FLEXI",
      "Service / Fee Item": "Learning Permit",
      "Price": "120",
      "Currency": "AED",
      "Source Row": "Row 15",
      "Source Header": "LMV FEE / FLEXI"
    }
  },
  {
    "_rowKey": "prc-83",
    "_sheetName": "Sheet1",
    "category": "LMV FEE",
    "productName": "Learning Permit",
    "priceDisplay": "120",
    "priceNumeric": 120,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "LMV FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "Learning Permit",
      "Price": "120",
      "Currency": "AED",
      "Source Row": "Row 15",
      "Source Header": "LMV FEE / LUMPSUM (Absent)"
    }
  },
  {
    "_rowKey": "prc-84",
    "_sheetName": "Sheet1",
    "category": "MOT FEE",
    "productName": "Learning Permit",
    "priceDisplay": "120",
    "priceNumeric": 120,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "MOT FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "Learning Permit",
      "Price": "120",
      "Currency": "AED",
      "Source Row": "Row 15",
      "Source Header": "MOT FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-85",
    "_sheetName": "Sheet1",
    "category": "MOT FEE",
    "productName": "Learning Permit",
    "priceDisplay": "120",
    "priceNumeric": 120,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "MOT FEE",
      "Plan / Tier": "FLEXI",
      "Service / Fee Item": "Learning Permit",
      "Price": "120",
      "Currency": "AED",
      "Source Row": "Row 15",
      "Source Header": "MOT FEE / FLEXI"
    }
  },
  {
    "_rowKey": "prc-86",
    "_sheetName": "Sheet1",
    "category": "MOT FEE",
    "productName": "Learning Permit",
    "priceDisplay": "120",
    "priceNumeric": 120,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "MOT FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "Learning Permit",
      "Price": "120",
      "Currency": "AED",
      "Source Row": "Row 15",
      "Source Header": "MOT FEE / LUMPSUM (Absent)"
    }
  },
  {
    "_rowKey": "prc-87",
    "_sheetName": "Sheet1",
    "category": "HVB FEE",
    "productName": "Learning Permit",
    "priceDisplay": "220",
    "priceNumeric": 220,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HVB FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "Learning Permit",
      "Price": "220",
      "Currency": "AED",
      "Source Row": "Row 15",
      "Source Header": "HVB FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-88",
    "_sheetName": "Sheet1",
    "category": "HVB FEE",
    "productName": "Learning Permit",
    "priceDisplay": "220",
    "priceNumeric": 220,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HVB FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "Learning Permit",
      "Price": "220",
      "Currency": "AED",
      "Source Row": "Row 15",
      "Source Header": "HVB FEE / LUMPSUM (Absent)"
    }
  },
  {
    "_rowKey": "prc-89",
    "_sheetName": "Sheet1",
    "category": "HVT FEE",
    "productName": "Learning Permit",
    "priceDisplay": "220",
    "priceNumeric": 220,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HVT FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "Learning Permit",
      "Price": "220",
      "Currency": "AED",
      "Source Row": "Row 15",
      "Source Header": "HVT FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-90",
    "_sheetName": "Sheet1",
    "category": "HVT FEE",
    "productName": "Learning Permit",
    "priceDisplay": "220",
    "priceNumeric": 220,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HVT FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "Learning Permit",
      "Price": "220",
      "Currency": "AED",
      "Source Row": "Row 15",
      "Source Header": "HVT FEE / LUMPSUM(Absent)"
    }
  },
  {
    "_rowKey": "prc-91",
    "_sheetName": "Sheet1",
    "category": "HME FEE",
    "productName": "Learning Permit",
    "priceDisplay": "220",
    "priceNumeric": 220,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HME FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "Learning Permit",
      "Price": "220",
      "Currency": "AED",
      "Source Row": "Row 15",
      "Source Header": "HME FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-92",
    "_sheetName": "Sheet1",
    "category": "HME FEE",
    "productName": "Learning Permit",
    "priceDisplay": "220",
    "priceNumeric": 220,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HME FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "Learning Permit",
      "Price": "220",
      "Currency": "AED",
      "Source Row": "Row 15",
      "Source Header": "HME FEE / LUMPSUM (Absent)"
    }
  },
  {
    "_rowKey": "prc-93",
    "_sheetName": "Sheet1",
    "category": "LMV FEE",
    "productName": "RTA FILE RENEWAL",
    "priceDisplay": "320",
    "priceNumeric": 320,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "LMV FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "RTA FILE RENEWAL",
      "Price": "320",
      "Currency": "AED",
      "Source Row": "Row 16",
      "Source Header": "LMV FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-94",
    "_sheetName": "Sheet1",
    "category": "LMV FEE",
    "productName": "RTA FILE RENEWAL",
    "priceDisplay": "320",
    "priceNumeric": 320,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "LMV FEE",
      "Plan / Tier": "FLEXI",
      "Service / Fee Item": "RTA FILE RENEWAL",
      "Price": "320",
      "Currency": "AED",
      "Source Row": "Row 16",
      "Source Header": "LMV FEE / FLEXI"
    }
  },
  {
    "_rowKey": "prc-95",
    "_sheetName": "Sheet1",
    "category": "LMV FEE",
    "productName": "RTA FILE RENEWAL",
    "priceDisplay": "320",
    "priceNumeric": 320,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "LMV FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "RTA FILE RENEWAL",
      "Price": "320",
      "Currency": "AED",
      "Source Row": "Row 16",
      "Source Header": "LMV FEE / LUMPSUM (Absent)"
    }
  },
  {
    "_rowKey": "prc-96",
    "_sheetName": "Sheet1",
    "category": "MOT FEE",
    "productName": "RTA FILE RENEWAL",
    "priceDisplay": "320",
    "priceNumeric": 320,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "MOT FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "RTA FILE RENEWAL",
      "Price": "320",
      "Currency": "AED",
      "Source Row": "Row 16",
      "Source Header": "MOT FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-97",
    "_sheetName": "Sheet1",
    "category": "MOT FEE",
    "productName": "RTA FILE RENEWAL",
    "priceDisplay": "320",
    "priceNumeric": 320,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "MOT FEE",
      "Plan / Tier": "FLEXI",
      "Service / Fee Item": "RTA FILE RENEWAL",
      "Price": "320",
      "Currency": "AED",
      "Source Row": "Row 16",
      "Source Header": "MOT FEE / FLEXI"
    }
  },
  {
    "_rowKey": "prc-98",
    "_sheetName": "Sheet1",
    "category": "MOT FEE",
    "productName": "RTA FILE RENEWAL",
    "priceDisplay": "320",
    "priceNumeric": 320,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "MOT FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "RTA FILE RENEWAL",
      "Price": "320",
      "Currency": "AED",
      "Source Row": "Row 16",
      "Source Header": "MOT FEE / LUMPSUM (Absent)"
    }
  },
  {
    "_rowKey": "prc-99",
    "_sheetName": "Sheet1",
    "category": "HVB FEE",
    "productName": "RTA FILE RENEWAL",
    "priceDisplay": "420",
    "priceNumeric": 420,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HVB FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "RTA FILE RENEWAL",
      "Price": "420",
      "Currency": "AED",
      "Source Row": "Row 16",
      "Source Header": "HVB FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-100",
    "_sheetName": "Sheet1",
    "category": "HVB FEE",
    "productName": "RTA FILE RENEWAL",
    "priceDisplay": "420",
    "priceNumeric": 420,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HVB FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "RTA FILE RENEWAL",
      "Price": "420",
      "Currency": "AED",
      "Source Row": "Row 16",
      "Source Header": "HVB FEE / LUMPSUM (Absent)"
    }
  },
  {
    "_rowKey": "prc-101",
    "_sheetName": "Sheet1",
    "category": "HVT FEE",
    "productName": "RTA FILE RENEWAL",
    "priceDisplay": "420",
    "priceNumeric": 420,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HVT FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "RTA FILE RENEWAL",
      "Price": "420",
      "Currency": "AED",
      "Source Row": "Row 16",
      "Source Header": "HVT FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-102",
    "_sheetName": "Sheet1",
    "category": "HVT FEE",
    "productName": "RTA FILE RENEWAL",
    "priceDisplay": "420",
    "priceNumeric": 420,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HVT FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "RTA FILE RENEWAL",
      "Price": "420",
      "Currency": "AED",
      "Source Row": "Row 16",
      "Source Header": "HVT FEE / LUMPSUM(Absent)"
    }
  },
  {
    "_rowKey": "prc-103",
    "_sheetName": "Sheet1",
    "category": "HME FEE",
    "productName": "RTA FILE RENEWAL",
    "priceDisplay": "420",
    "priceNumeric": 420,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HME FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "RTA FILE RENEWAL",
      "Price": "420",
      "Currency": "AED",
      "Source Row": "Row 16",
      "Source Header": "HME FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-104",
    "_sheetName": "Sheet1",
    "category": "HME FEE",
    "productName": "RTA FILE RENEWAL",
    "priceDisplay": "420",
    "priceNumeric": 420,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HME FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "RTA FILE RENEWAL",
      "Price": "420",
      "Currency": "AED",
      "Source Row": "Row 16",
      "Source Header": "HME FEE / LUMPSUM (Absent)"
    }
  },
  {
    "_rowKey": "prc-105",
    "_sheetName": "Sheet1",
    "category": "LMV FEE",
    "productName": "RTA PREPONE TEST FEE",
    "priceDisplay": "320",
    "priceNumeric": 320,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "LMV FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "RTA PREPONE TEST FEE",
      "Price": "320",
      "Currency": "AED",
      "Source Row": "Row 17",
      "Source Header": "LMV FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-106",
    "_sheetName": "Sheet1",
    "category": "LMV FEE",
    "productName": "RTA PREPONE TEST FEE",
    "priceDisplay": "320",
    "priceNumeric": 320,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "LMV FEE",
      "Plan / Tier": "FLEXI",
      "Service / Fee Item": "RTA PREPONE TEST FEE",
      "Price": "320",
      "Currency": "AED",
      "Source Row": "Row 17",
      "Source Header": "LMV FEE / FLEXI"
    }
  },
  {
    "_rowKey": "prc-107",
    "_sheetName": "Sheet1",
    "category": "LMV FEE",
    "productName": "RTA PREPONE TEST FEE",
    "priceDisplay": "320",
    "priceNumeric": 320,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "LMV FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "RTA PREPONE TEST FEE",
      "Price": "320",
      "Currency": "AED",
      "Source Row": "Row 17",
      "Source Header": "LMV FEE / LUMPSUM (Absent)"
    }
  },
  {
    "_rowKey": "prc-108",
    "_sheetName": "Sheet1",
    "category": "MOT FEE",
    "productName": "RTA PREPONE TEST FEE",
    "priceDisplay": "320",
    "priceNumeric": 320,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "MOT FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "RTA PREPONE TEST FEE",
      "Price": "320",
      "Currency": "AED",
      "Source Row": "Row 17",
      "Source Header": "MOT FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-109",
    "_sheetName": "Sheet1",
    "category": "MOT FEE",
    "productName": "RTA PREPONE TEST FEE",
    "priceDisplay": "320",
    "priceNumeric": 320,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "MOT FEE",
      "Plan / Tier": "FLEXI",
      "Service / Fee Item": "RTA PREPONE TEST FEE",
      "Price": "320",
      "Currency": "AED",
      "Source Row": "Row 17",
      "Source Header": "MOT FEE / FLEXI"
    }
  },
  {
    "_rowKey": "prc-110",
    "_sheetName": "Sheet1",
    "category": "MOT FEE",
    "productName": "RTA PREPONE TEST FEE",
    "priceDisplay": "320",
    "priceNumeric": 320,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "MOT FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "RTA PREPONE TEST FEE",
      "Price": "320",
      "Currency": "AED",
      "Source Row": "Row 17",
      "Source Header": "MOT FEE / LUMPSUM (Absent)"
    }
  },
  {
    "_rowKey": "prc-111",
    "_sheetName": "Sheet1",
    "category": "HVB FEE",
    "productName": "RTA PREPONE TEST FEE",
    "priceDisplay": "320",
    "priceNumeric": 320,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HVB FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "RTA PREPONE TEST FEE",
      "Price": "320",
      "Currency": "AED",
      "Source Row": "Row 17",
      "Source Header": "HVB FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-112",
    "_sheetName": "Sheet1",
    "category": "HVB FEE",
    "productName": "RTA PREPONE TEST FEE",
    "priceDisplay": "320",
    "priceNumeric": 320,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HVB FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "RTA PREPONE TEST FEE",
      "Price": "320",
      "Currency": "AED",
      "Source Row": "Row 17",
      "Source Header": "HVB FEE / LUMPSUM (Absent)"
    }
  },
  {
    "_rowKey": "prc-113",
    "_sheetName": "Sheet1",
    "category": "HVT FEE",
    "productName": "RTA PREPONE TEST FEE",
    "priceDisplay": "320",
    "priceNumeric": 320,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HVT FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "RTA PREPONE TEST FEE",
      "Price": "320",
      "Currency": "AED",
      "Source Row": "Row 17",
      "Source Header": "HVT FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-114",
    "_sheetName": "Sheet1",
    "category": "HVT FEE",
    "productName": "RTA PREPONE TEST FEE",
    "priceDisplay": "320",
    "priceNumeric": 320,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HVT FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "RTA PREPONE TEST FEE",
      "Price": "320",
      "Currency": "AED",
      "Source Row": "Row 17",
      "Source Header": "HVT FEE / LUMPSUM(Absent)"
    }
  },
  {
    "_rowKey": "prc-115",
    "_sheetName": "Sheet1",
    "category": "HME FEE",
    "productName": "RTA PREPONE TEST FEE",
    "priceDisplay": "320",
    "priceNumeric": 320,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HME FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "RTA PREPONE TEST FEE",
      "Price": "320",
      "Currency": "AED",
      "Source Row": "Row 17",
      "Source Header": "HME FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-116",
    "_sheetName": "Sheet1",
    "category": "HME FEE",
    "productName": "RTA PREPONE TEST FEE",
    "priceDisplay": "320",
    "priceNumeric": 320,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HME FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "RTA PREPONE TEST FEE",
      "Price": "320",
      "Currency": "AED",
      "Source Row": "Row 17",
      "Source Header": "HME FEE / LUMPSUM (Absent)"
    }
  },
  {
    "_rowKey": "prc-117",
    "_sheetName": "Sheet1",
    "category": "LMV FEE",
    "productName": "GEAR CHANGE",
    "priceDisplay": "272.5",
    "priceNumeric": 272.5,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "LMV FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "GEAR CHANGE",
      "Price": "272.5",
      "Currency": "AED",
      "Source Row": "Row 18",
      "Source Header": "LMV FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-118",
    "_sheetName": "Sheet1",
    "category": "LMV FEE",
    "productName": "GEAR CHANGE",
    "priceDisplay": "272.5",
    "priceNumeric": 272.5,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "LMV FEE",
      "Plan / Tier": "FLEXI",
      "Service / Fee Item": "GEAR CHANGE",
      "Price": "272.5",
      "Currency": "AED",
      "Source Row": "Row 18",
      "Source Header": "LMV FEE / FLEXI"
    }
  },
  {
    "_rowKey": "prc-119",
    "_sheetName": "Sheet1",
    "category": "LMV FEE",
    "productName": "GEAR CHANGE",
    "priceDisplay": "272.5",
    "priceNumeric": 272.5,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "LMV FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "GEAR CHANGE",
      "Price": "272.5",
      "Currency": "AED",
      "Source Row": "Row 18",
      "Source Header": "LMV FEE / LUMPSUM (Absent)"
    }
  },
  {
    "_rowKey": "prc-120",
    "_sheetName": "Sheet1",
    "category": "LMV FEE",
    "productName": "EYE TEST ( OUR SCHOOL CHARGES)",
    "priceDisplay": "184.5",
    "priceNumeric": 184.5,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "LMV FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "EYE TEST ( OUR SCHOOL CHARGES)",
      "Price": "184.5",
      "Currency": "AED",
      "Source Row": "Row 19",
      "Source Header": "LMV FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-121",
    "_sheetName": "Sheet1",
    "category": "LMV FEE",
    "productName": "EYE TEST ( OUR SCHOOL CHARGES)",
    "priceDisplay": "184.5",
    "priceNumeric": 184.5,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "LMV FEE",
      "Plan / Tier": "FLEXI",
      "Service / Fee Item": "EYE TEST ( OUR SCHOOL CHARGES)",
      "Price": "184.5",
      "Currency": "AED",
      "Source Row": "Row 19",
      "Source Header": "LMV FEE / FLEXI"
    }
  },
  {
    "_rowKey": "prc-122",
    "_sheetName": "Sheet1",
    "category": "LMV FEE",
    "productName": "EYE TEST ( OUR SCHOOL CHARGES)",
    "priceDisplay": "184.5",
    "priceNumeric": 184.5,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "LMV FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "EYE TEST ( OUR SCHOOL CHARGES)",
      "Price": "184.5",
      "Currency": "AED",
      "Source Row": "Row 19",
      "Source Header": "LMV FEE / LUMPSUM (Absent)"
    }
  },
  {
    "_rowKey": "prc-123",
    "_sheetName": "Sheet1",
    "category": "MOT FEE",
    "productName": "EYE TEST ( OUR SCHOOL CHARGES)",
    "priceDisplay": "184.5",
    "priceNumeric": 184.5,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "MOT FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "EYE TEST ( OUR SCHOOL CHARGES)",
      "Price": "184.5",
      "Currency": "AED",
      "Source Row": "Row 19",
      "Source Header": "MOT FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-124",
    "_sheetName": "Sheet1",
    "category": "MOT FEE",
    "productName": "EYE TEST ( OUR SCHOOL CHARGES)",
    "priceDisplay": "184.5",
    "priceNumeric": 184.5,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "MOT FEE",
      "Plan / Tier": "FLEXI",
      "Service / Fee Item": "EYE TEST ( OUR SCHOOL CHARGES)",
      "Price": "184.5",
      "Currency": "AED",
      "Source Row": "Row 19",
      "Source Header": "MOT FEE / FLEXI"
    }
  },
  {
    "_rowKey": "prc-125",
    "_sheetName": "Sheet1",
    "category": "MOT FEE",
    "productName": "EYE TEST ( OUR SCHOOL CHARGES)",
    "priceDisplay": "184.5",
    "priceNumeric": 184.5,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "MOT FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "EYE TEST ( OUR SCHOOL CHARGES)",
      "Price": "184.5",
      "Currency": "AED",
      "Source Row": "Row 19",
      "Source Header": "MOT FEE / LUMPSUM (Absent)"
    }
  },
  {
    "_rowKey": "prc-126",
    "_sheetName": "Sheet1",
    "category": "HVB FEE",
    "productName": "EYE TEST ( OUR SCHOOL CHARGES)",
    "priceDisplay": "184.5",
    "priceNumeric": 184.5,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HVB FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "EYE TEST ( OUR SCHOOL CHARGES)",
      "Price": "184.5",
      "Currency": "AED",
      "Source Row": "Row 19",
      "Source Header": "HVB FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-127",
    "_sheetName": "Sheet1",
    "category": "HVB FEE",
    "productName": "EYE TEST ( OUR SCHOOL CHARGES)",
    "priceDisplay": "184.5",
    "priceNumeric": 184.5,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HVB FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "EYE TEST ( OUR SCHOOL CHARGES)",
      "Price": "184.5",
      "Currency": "AED",
      "Source Row": "Row 19",
      "Source Header": "HVB FEE / LUMPSUM (Absent)"
    }
  },
  {
    "_rowKey": "prc-128",
    "_sheetName": "Sheet1",
    "category": "HVT FEE",
    "productName": "EYE TEST ( OUR SCHOOL CHARGES)",
    "priceDisplay": "184.5",
    "priceNumeric": 184.5,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HVT FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "EYE TEST ( OUR SCHOOL CHARGES)",
      "Price": "184.5",
      "Currency": "AED",
      "Source Row": "Row 19",
      "Source Header": "HVT FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-129",
    "_sheetName": "Sheet1",
    "category": "HVT FEE",
    "productName": "EYE TEST ( OUR SCHOOL CHARGES)",
    "priceDisplay": "184.5",
    "priceNumeric": 184.5,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HVT FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "EYE TEST ( OUR SCHOOL CHARGES)",
      "Price": "184.5",
      "Currency": "AED",
      "Source Row": "Row 19",
      "Source Header": "HVT FEE / LUMPSUM(Absent)"
    }
  },
  {
    "_rowKey": "prc-130",
    "_sheetName": "Sheet1",
    "category": "HME FEE",
    "productName": "EYE TEST ( OUR SCHOOL CHARGES)",
    "priceDisplay": "184.5",
    "priceNumeric": 184.5,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HME FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "EYE TEST ( OUR SCHOOL CHARGES)",
      "Price": "184.5",
      "Currency": "AED",
      "Source Row": "Row 19",
      "Source Header": "HME FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-131",
    "_sheetName": "Sheet1",
    "category": "HME FEE",
    "productName": "EYE TEST ( OUR SCHOOL CHARGES)",
    "priceDisplay": "184.5",
    "priceNumeric": 184.5,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "HME FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "EYE TEST ( OUR SCHOOL CHARGES)",
      "Price": "184.5",
      "Currency": "AED",
      "Source Row": "Row 19",
      "Source Header": "HME FEE / LUMPSUM (Absent)"
    }
  },
  {
    "_rowKey": "prc-132",
    "_sheetName": "Sheet1",
    "category": "LMV FEE",
    "productName": "LMV-DIRECT THEORY TEST (GCC/GOLDEN CHANCE- GOLDEN VISA)",
    "priceDisplay": "492.45",
    "priceNumeric": 492.45,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "LMV FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "LMV-DIRECT THEORY TEST (GCC/GOLDEN CHANCE- GOLDEN VISA)",
      "Price": "492.45",
      "Currency": "AED",
      "Source Row": "Row 20",
      "Source Header": "LMV FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-133",
    "_sheetName": "Sheet1",
    "category": "LMV FEE",
    "productName": "LMV-DIRECT THEORY TEST (GCC/GOLDEN CHANCE- GOLDEN VISA)",
    "priceDisplay": "492.45",
    "priceNumeric": 492.45,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "LMV FEE",
      "Plan / Tier": "FLEXI",
      "Service / Fee Item": "LMV-DIRECT THEORY TEST (GCC/GOLDEN CHANCE- GOLDEN VISA)",
      "Price": "492.45",
      "Currency": "AED",
      "Source Row": "Row 20",
      "Source Header": "LMV FEE / FLEXI"
    }
  },
  {
    "_rowKey": "prc-134",
    "_sheetName": "Sheet1",
    "category": "LMV FEE",
    "productName": "LMV- DIRECT ROAD TEST (GCC/GOLDEN VISA)",
    "priceDisplay": "492.45",
    "priceNumeric": 492.45,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "LMV FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "LMV- DIRECT ROAD TEST (GCC/GOLDEN VISA)",
      "Price": "492.45",
      "Currency": "AED",
      "Source Row": "Row 21",
      "Source Header": "LMV FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-135",
    "_sheetName": "Sheet1",
    "category": "LMV FEE",
    "productName": "LMV- DIRECT ROAD TEST (GCC/GOLDEN VISA)",
    "priceDisplay": "492.45",
    "priceNumeric": 492.45,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "LMV FEE",
      "Plan / Tier": "FLEXI",
      "Service / Fee Item": "LMV- DIRECT ROAD TEST (GCC/GOLDEN VISA)",
      "Price": "492.45",
      "Currency": "AED",
      "Source Row": "Row 21",
      "Source Header": "LMV FEE / FLEXI"
    }
  },
  {
    "_rowKey": "prc-136",
    "_sheetName": "Sheet1",
    "category": "LMV FEE",
    "productName": "NOC FOR FEMALE (BELOW 21YEARS)",
    "priceDisplay": "10",
    "priceNumeric": 10,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "LMV FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "NOC FOR FEMALE (BELOW 21YEARS)",
      "Price": "10",
      "Currency": "AED",
      "Source Row": "Row 22",
      "Source Header": "LMV FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-137",
    "_sheetName": "Sheet1",
    "category": "LMV FEE",
    "productName": "NOC FOR FEMALE (BELOW 21YEARS)",
    "priceDisplay": "10",
    "priceNumeric": 10,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "LMV FEE",
      "Plan / Tier": "FLEXI",
      "Service / Fee Item": "NOC FOR FEMALE (BELOW 21YEARS)",
      "Price": "10",
      "Currency": "AED",
      "Source Row": "Row 22",
      "Source Header": "LMV FEE / FLEXI"
    }
  },
  {
    "_rowKey": "prc-138",
    "_sheetName": "Sheet1",
    "category": "LMV FEE",
    "productName": "NOC FOR FEMALE (BELOW 21YEARS)",
    "priceDisplay": "10",
    "priceNumeric": 10,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "LMV FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "NOC FOR FEMALE (BELOW 21YEARS)",
      "Price": "10",
      "Currency": "AED",
      "Source Row": "Row 22",
      "Source Header": "LMV FEE / LUMPSUM (Absent)"
    }
  },
  {
    "_rowKey": "prc-139",
    "_sheetName": "Sheet1",
    "category": "LMV FEE",
    "productName": "Refersher course Per Hour",
    "priceDisplay": "105",
    "priceNumeric": 105,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "LMV FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "Refersher course Per Hour",
      "Price": "105",
      "Currency": "AED",
      "Source Row": "Row 23",
      "Source Header": "LMV FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-140",
    "_sheetName": "Sheet1",
    "category": "LMV FEE",
    "productName": "Refersher course Per Hour",
    "priceDisplay": "138.6",
    "priceNumeric": 138.6,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "LMV FEE",
      "Plan / Tier": "FLEXI",
      "Service / Fee Item": "Refersher course Per Hour",
      "Price": "138.6",
      "Currency": "AED",
      "Source Row": "Row 23",
      "Source Header": "LMV FEE / FLEXI"
    }
  },
  {
    "_rowKey": "prc-141",
    "_sheetName": "Sheet1",
    "category": "LMV FEE",
    "productName": "Refersher course Per Hour",
    "priceDisplay": "105",
    "priceNumeric": 105,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "LMV FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "Refersher course Per Hour",
      "Price": "105",
      "Currency": "AED",
      "Source Row": "Row 23",
      "Source Header": "LMV FEE / LUMPSUM (Absent)"
    }
  },
  {
    "_rowKey": "prc-142",
    "_sheetName": "Sheet1",
    "category": "MOT FEE",
    "productName": "MOT- GCC- PER HOUR",
    "priceDisplay": "73.5",
    "priceNumeric": 73.5,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "MOT FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "MOT- GCC- PER HOUR",
      "Price": "73.5",
      "Currency": "AED",
      "Source Row": "Row 24",
      "Source Header": "MOT FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-143",
    "_sheetName": "Sheet1",
    "category": "MOT FEE",
    "productName": "MOT- GCC- PER HOUR",
    "priceDisplay": "115.5",
    "priceNumeric": 115.5,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "MOT FEE",
      "Plan / Tier": "FLEXI",
      "Service / Fee Item": "MOT- GCC- PER HOUR",
      "Price": "115.5",
      "Currency": "AED",
      "Source Row": "Row 24",
      "Source Header": "MOT FEE / FLEXI"
    }
  },
  {
    "_rowKey": "prc-144",
    "_sheetName": "Sheet1",
    "category": "MOT FEE",
    "productName": "MOT-DIRECT THEORY TEST/ ROAD TEST (GCC)",
    "priceDisplay": "492.45",
    "priceNumeric": 492.45,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "MOT FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "MOT-DIRECT THEORY TEST/ ROAD TEST (GCC)",
      "Price": "492.45",
      "Currency": "AED",
      "Source Row": "Row 25",
      "Source Header": "MOT FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-145",
    "_sheetName": "Sheet1",
    "category": "MOT FEE",
    "productName": "MOT-DIRECT THEORY TEST/ ROAD TEST (GCC)",
    "priceDisplay": "492.45",
    "priceNumeric": 492.45,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "MOT FEE",
      "Plan / Tier": "FLEXI",
      "Service / Fee Item": "MOT-DIRECT THEORY TEST/ ROAD TEST (GCC)",
      "Price": "492.45",
      "Currency": "AED",
      "Source Row": "Row 25",
      "Source Header": "MOT FEE / FLEXI"
    }
  },
  {
    "_rowKey": "prc-146",
    "_sheetName": "Sheet1",
    "category": "LMV FEE",
    "productName": "RTA gear change",
    "priceDisplay": "220",
    "priceNumeric": 220,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "LMV FEE",
      "Plan / Tier": "REGULAR",
      "Service / Fee Item": "RTA gear change",
      "Price": "220",
      "Currency": "AED",
      "Source Row": "Row 26",
      "Source Header": "LMV FEE / REGULAR"
    }
  },
  {
    "_rowKey": "prc-147",
    "_sheetName": "Sheet1",
    "category": "LMV FEE",
    "productName": "RTA gear change",
    "priceDisplay": "220",
    "priceNumeric": 220,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "LMV FEE",
      "Plan / Tier": "FLEXI",
      "Service / Fee Item": "RTA gear change",
      "Price": "220",
      "Currency": "AED",
      "Source Row": "Row 26",
      "Source Header": "LMV FEE / FLEXI"
    }
  },
  {
    "_rowKey": "prc-148",
    "_sheetName": "Sheet1",
    "category": "LMV FEE",
    "productName": "RTA gear change",
    "priceDisplay": "220",
    "priceNumeric": 220,
    "currency": "AED",
    "priceStatus": "valid",
    "fields": {
      "Vehicle Category": "LMV FEE",
      "Plan / Tier": "LUMPSUM (Absent)",
      "Service / Fee Item": "RTA gear change",
      "Price": "220",
      "Currency": "AED",
      "Source Row": "Row 26",
      "Source Header": "LMV FEE / LUMPSUM (Absent)"
    }
  }
];
