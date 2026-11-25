import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Database,
  Download,
  Eye,
  FileSpreadsheet,
  Filter,
  History,
  Info,
  KeyRound,
  Layers,
  Loader2,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Tag,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  PriceRecord,
  PricesDataset,
  PricesImportPreview,
} from '../types/prices';
import {
  PricesApiValidationError,
  createPriceRecord,
  deletePriceRecord,
  exportPricesToCSV,
  exportPricesToExcel,
  fetchPricesDataset,
  formatPriceDisplay,
  getEmptyPricesDataset,
  parsePriceValue,
  parsePricesWorkbook,
  rollbackPricesDataset,
  saveImportedPricesDataset,
  updatePriceRecord,
} from '../services/pricesService';
import { AdminAuthError } from '../services/adminAuthService';
import { ToastVariant, useAdminAuth } from '../context/AdminAuthContext';
import { OperationConfirmModal, OperationConfirmType } from './OperationConfirmModal';

export interface PricesSummaryStats {
  totalCount: number;
  validCount: number;
  categoriesCount: number;
  fileName: string;
  importedAt: string;
}

interface PricesPageProps {
  onShowToast?: (message: string, variant?: ToastVariant) => void;
  onDatasetStatsChange?: (stats: PricesSummaryStats) => void;
}

type SortMode =
  | 'original'
  | 'product-asc'
  | 'product-desc'
  | 'category-asc'
  | 'category-desc'
  | 'price-asc'
  | 'price-desc'
  | { column: string; dir: 'asc' | 'desc' };

export const PricesPage: React.FC<PricesPageProps> = ({
  onShowToast,
  onDatasetStatsChange,
}) => {
  // 1. D1 Persisted Dataset State
  const [dataset, setDataset] = useState<PricesDataset>(() => getEmptyPricesDataset());
  const [isLoadingDb, setIsLoadingDb] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  // 2. Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [sheetFilter, setSheetFilter] = useState('All');
  const [subCategoryFilter, setSubCategoryFilter] = useState('All');
  const [branchFilter, setBranchFilter] = useState('All');
  const [priceStatusFilter, setPriceStatusFilter] = useState<'all' | 'valid' | 'flagged'>('all');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  // 3. Sorting & Pagination States
  const [sortMode, setSortMode] = useState<SortMode>('original');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // 4. Detail Drawer / Modal State
  const [detailRecord, setDetailRecord] = useState<PriceRecord | null>(null);

  // 5. Excel Import & Preview States
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<PricesImportPreview | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 6. Copy feedback state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // 7. Add / Edit Record Modal States
  const [formModalMode, setFormModalMode] = useState<'add' | 'edit' | null>(null);
  const [editingRecord, setEditingRecord] = useState<PriceRecord | null>(null);
  const [formFields, setFormFields] = useState<Record<string, string>>({});
  const [formCategory, setFormCategory] = useState('');
  const [formProduct, setFormProduct] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formCurrency, setFormCurrency] = useState('AED');
  const [formFieldErrors, setFormFieldErrors] = useState<Record<string, string>>({});
  const [formGeneralError, setFormGeneralError] = useState<string | null>(null);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);

  // 8. Admin Auth + Two-Step Confirmation Modal State
  const {
    isAuthorized,
    getValidToken,
    requireAdminAuthorization,
    openChangeCodeModal,
    lockSession,
    handleAuthFailure,
  } = useAdminAuth();

  type PendingPriceConfirm =
    | {
        kind: 'add';
        fields: Record<string, string>;
        category: string;
        productName: string;
        priceDisplay: string;
        currency: string;
        recordName: string;
        details: string[];
      }
    | {
        kind: 'update';
        record: PriceRecord;
        fields: Record<string, string>;
        category: string;
        productName: string;
        priceDisplay: string;
        currency: string;
        recordName: string;
        details: string[];
      }
    | {
        kind: 'delete';
        record: PriceRecord;
        recordName: string;
        details: string[];
      }
    | {
        kind: 'import';
        preview: PricesImportPreview;
        recordsToImport: PriceRecord[];
        recordName: string;
        details: string[];
      }
    | {
        kind: 'rollback';
        recordName: string;
        details: string[];
      };

  const [pendingConfirm, setPendingConfirm] = useState<PendingPriceConfirm | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [isExecutingConfirm, setIsExecutingConfirm] = useState(false);
  const operationLockRef = useRef(false);

  const notify = (msg: string, variant: ToastVariant = 'success') => {
    if (onShowToast) onShowToast(msg, variant);
  };

  // Sync top-level stats whenever dataset updates
  useEffect(() => {
    if (!onDatasetStatsChange) return;
    const validCount = dataset.records.filter((r) => r.priceStatus === 'valid').length;
    const categoriesCount = new Set(
      dataset.records.map((r) => r.category.trim()).filter(Boolean)
    ).size;
    onDatasetStatsChange({
      totalCount: dataset.records.length,
      validCount,
      categoriesCount,
      fileName: dataset.fileName,
      importedAt: dataset.importedAt,
    });
  }, [dataset, onDatasetStatsChange]);

  const loadFromDatabase = async (showSuccessToast = false) => {
    setIsLoadingDb(true);
    setDbError(null);
    try {
      const dbData = await fetchPricesDataset();
      setDataset(dbData);
      if (showSuccessToast) {
        notify(`Loaded ${dbData.records.length} price records from D1 database`);
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Unable to load Prices catalog from D1 database.';
      setDbError(msg);
    } finally {
      setIsLoadingDb(false);
    }
  };

  useEffect(() => {
    void loadFromDatabase(false);
  }, []);

  const handleCopyText = async (text: string, key: string, toastLabel: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      notify(toastLabel);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      notify('Unable to copy to clipboard.', 'error');
    }
  };

  const cols = dataset.detectedColumns;

  // Dynamic Filter Options derived directly from imported records
  const filterOptions = useMemo(() => {
    const countMap = (getter: (r: PriceRecord) => string) => {
      const counts = new Map<string, number>();
      dataset.records.forEach((r) => {
        const val = getter(r).trim();
        if (val) {
          counts.set(val, (counts.get(val) || 0) + 1);
        }
      });
      return Array.from(counts.entries())
        .sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: 'base', numeric: true }))
        .map(([value, count]) => ({ value, count }));
    };

    const categories = countMap((r) => r.category);
    const sheets = countMap((r) => r._sheetName);
    const subCategories = cols.subCategoryCol
      ? countMap((r) => r.fields[cols.subCategoryCol!] || '')
      : [];
    const branches = cols.branchCol ? countMap((r) => r.fields[cols.branchCol!] || '') : [];

    return { categories, sheets, subCategories, branches };
  }, [dataset.records, cols]);

  // Summary Stats
  const summaryStats = useMemo(() => {
    const total = dataset.records.length;
    const validCount = dataset.records.filter((r) => r.priceStatus === 'valid').length;
    const flaggedCount = total - validCount;
    const categoriesCount = filterOptions.categories.length;
    const sheetsCount = Math.max(dataset.sheetNames.length, filterOptions.sheets.length);

    return { total, validCount, flaggedCount, categoriesCount, sheetsCount };
  }, [dataset.records, dataset.sheetNames.length, filterOptions]);

  // Choose display columns cleanly so primary columns aren't cluttered
  const extraDisplayColumns = useMemo(() => {
    const hiddenPrimary = new Set<string>();
    if (cols.categoryCol) hiddenPrimary.add(cols.categoryCol);
    if (cols.productCol) hiddenPrimary.add(cols.productCol);
    if (cols.priceCol) hiddenPrimary.add(cols.priceCol);
    if (cols.currencyCol) hiddenPrimary.add(cols.currencyCol);
    return dataset.columns.filter((c) => !hiddenPrimary.has(c)).slice(0, 4);
  }, [dataset.columns, cols]);

  // Filtered Records
  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const minVal = minPrice.trim() !== '' ? Number(minPrice) : null;
    const maxVal = maxPrice.trim() !== '' ? Number(maxPrice) : null;

    return dataset.records.filter((rec) => {
      if (categoryFilter !== 'All' && rec.category.trim() !== categoryFilter) {
        return false;
      }
      if (sheetFilter !== 'All' && rec._sheetName.trim() !== sheetFilter) {
        return false;
      }
      if (subCategoryFilter !== 'All' && cols.subCategoryCol) {
        if ((rec.fields[cols.subCategoryCol] || '').trim() !== subCategoryFilter) return false;
      }
      if (branchFilter !== 'All' && cols.branchCol) {
        if ((rec.fields[cols.branchCol] || '').trim() !== branchFilter) return false;
      }
      if (priceStatusFilter === 'valid' && rec.priceStatus !== 'valid') {
        return false;
      }
      if (priceStatusFilter === 'flagged' && rec.priceStatus === 'valid') {
        return false;
      }

      if (minVal !== null && Number.isFinite(minVal)) {
        if (rec.priceNumeric === null || rec.priceNumeric < minVal) return false;
      }
      if (maxVal !== null && Number.isFinite(maxVal)) {
        if (rec.priceNumeric === null || rec.priceNumeric > maxVal) return false;
      }

      if (q) {
        const haystacks = [
          rec.category,
          rec.productName,
          rec.priceDisplay,
          rec.currency,
          rec._sheetName,
          ...Object.values(rec.fields),
        ];
        if (!haystacks.some((val) => val.toLowerCase().includes(q))) {
          return false;
        }
      }

      return true;
    });
  }, [
    dataset.records,
    cols,
    searchQuery,
    categoryFilter,
    sheetFilter,
    subCategoryFilter,
    branchFilter,
    priceStatusFilter,
    minPrice,
    maxPrice,
  ]);

  // Sorted Records
  const sortedRecords = useMemo(() => {
    if (sortMode === 'original') return filteredRecords;

    return [...filteredRecords].sort((a, b) => {
      if (sortMode === 'product-asc' || sortMode === 'product-desc') {
        const cmp = a.productName.localeCompare(b.productName, undefined, {
          sensitivity: 'base',
          numeric: true,
        });
        return sortMode === 'product-asc' ? cmp : -cmp;
      }

      if (sortMode === 'category-asc' || sortMode === 'category-desc') {
        const cmp = a.category.localeCompare(b.category, undefined, {
          sensitivity: 'base',
          numeric: true,
        });
        return sortMode === 'category-asc' ? cmp : -cmp;
      }

      if (sortMode === 'price-asc' || sortMode === 'price-desc') {
        if (a.priceNumeric === null && b.priceNumeric === null) return 0;
        if (a.priceNumeric === null) return 1;
        if (b.priceNumeric === null) return -1;
        const cmp = a.priceNumeric - b.priceNumeric;
        return sortMode === 'price-asc' ? cmp : -cmp;
      }

      // Dynamic Excel column sorting
      const { column, dir } = sortMode;
      const valA = (a.fields[column] || '').trim();
      const valB = (b.fields[column] || '').trim();
      if (!valA && !valB) return 0;
      if (!valA) return 1;
      if (!valB) return -1;

      const parsedA = parsePriceValue(valA);
      const parsedB = parsePriceValue(valB);
      let cmp = 0;
      if (parsedA.priceNumeric !== null && parsedB.priceNumeric !== null) {
        cmp = parsedA.priceNumeric - parsedB.priceNumeric;
      } else {
        cmp = valA.localeCompare(valB, undefined, { sensitivity: 'base', numeric: true });
      }
      return dir === 'asc' ? cmp : -cmp;
    });
  }, [filteredRecords, sortMode]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedRecords.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedRecords = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sortedRecords.slice(start, start + pageSize);
  }, [sortedRecords, safePage, pageSize]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setCategoryFilter('All');
    setSheetFilter('All');
    setSubCategoryFilter('All');
    setBranchFilter('All');
    setPriceStatusFilter('all');
    setMinPrice('');
    setMaxPrice('');
    setSortMode('original');
    setCurrentPage(1);
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    categoryFilter !== 'All' ||
    sheetFilter !== 'All' ||
    subCategoryFilter !== 'All' ||
    branchFilter !== 'All' ||
    priceStatusFilter !== 'all' ||
    minPrice.trim() !== '' ||
    maxPrice.trim() !== '' ||
    sortMode !== 'original';

  const handleColumnSort = (col: string) => {
    setCurrentPage(1);
    setSortMode((prev) => {
      if (typeof prev === 'object' && prev.column === col) {
        if (prev.dir === 'asc') return { column: col, dir: 'desc' };
        return 'original';
      }
      return { column: col, dir: 'asc' };
    });
  };

  // =========================================================================
  // EXCEL FILE INSPECTION & IMPORT WORKFLOW
  // =========================================================================
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingFile(true);
    setImportError(null);
    setImportPreview(null);
    setShowImportPanel(true);

    try {
      const preview = await parsePricesWorkbook(file);
      setImportPreview(preview);
      setSkipDuplicates(true);
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : 'Failed to read the uploaded Excel file.'
      );
    } finally {
      setIsParsingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const requestImportConfirm = () => {
    if (!importPreview) return;
    const recordsToImport = skipDuplicates ? importPreview.records : importPreview.allRecords;
    const previewSnapshot = importPreview;

    requireAdminAuthorization(`Import Excel Prices (${previewSnapshot.fileName})`, () => {
      setConfirmError(null);
      setPendingConfirm({
        kind: 'import',
        preview: previewSnapshot,
        recordsToImport,
        recordName: `${previewSnapshot.fileName} (${recordsToImport.length} Prices)`,
        details: [
          `Worksheets: ${previewSnapshot.sheetNames.join(', ')}`,
          dataset.records.length > 0
            ? `Creates automatic D1 rollback backup of ${dataset.records.length} existing rows before replacing`
            : 'Initializes D1 Prices catalog cleanly (unrelated tables remain untouched)',
          skipDuplicates && previewSnapshot.duplicatesDetected > 0
            ? `Excludes ${previewSnapshot.duplicatesDetected} duplicate row(s)`
            : 'Includes all extracted non-empty rows',
        ],
      });
    });
  };

  const requestRollbackConfirm = () => {
    if (!dataset.backupInfo.hasBackup) return;
    requireAdminAuthorization('Restore Previous Prices Backup', () => {
      setConfirmError(null);
      setPendingConfirm({
        kind: 'rollback',
        recordName: `${dataset.backupInfo.fileName || 'Previous Backup'} (${dataset.backupInfo.recordCount ?? 0} rows)`,
        details: [
          `Backup created: ${
            dataset.backupInfo.createdAt
              ? new Date(dataset.backupInfo.createdAt).toLocaleString()
              : 'Available'
          }`,
          dataset.backupInfo.reason || 'Snapshot taken before previous Excel import',
        ],
      });
    });
  };

  // =========================================================================
  // CRUD HANDLERS (Admin Code Auth -> Form/Validation -> Confirm Modal -> D1)
  // =========================================================================
  const effectiveFormColumns = useMemo(() => {
    return dataset.columns.length > 0
      ? dataset.columns
      : ['Category', 'Product / Service', 'Price', 'Currency', 'Branch', 'Notes'];
  }, [dataset.columns]);

  const openAddModalNow = () => {
    const empty: Record<string, string> = {};
    effectiveFormColumns.forEach((c) => {
      empty[c] = '';
    });
    if (cols.currencyCol) empty[cols.currencyCol] = 'AED';
    if (!cols.currencyCol && empty['Currency'] !== undefined) empty['Currency'] = 'AED';

    setFormFields(empty);
    setFormCategory(categoryFilter !== 'All' ? categoryFilter : '');
    setFormProduct('');
    setFormPrice('');
    setFormCurrency('AED');
    setFormFieldErrors({});
    setFormGeneralError(null);
    setEditingRecord(null);
    setFormModalMode('add');
  };

  const requestOpenAddModal = () => {
    requireAdminAuthorization('Add New Price Record', () => {
      openAddModalNow();
    });
  };

  const openEditModalNow = (record: PriceRecord) => {
    const initial: Record<string, string> = {};
    effectiveFormColumns.forEach((c) => {
      initial[c] = record.fields[c] ?? '';
    });
    setFormFields(initial);
    setFormCategory(record.category);
    setFormProduct(record.productName);
    setFormPrice(record.priceDisplay);
    setFormCurrency(record.currency || 'AED');
    setFormFieldErrors({});
    setFormGeneralError(null);
    setEditingRecord(record);
    setFormModalMode('edit');
  };

  const requestOpenEditModal = (record: PriceRecord) => {
    requireAdminAuthorization(`Edit Price: ${record.productName}`, () => {
      openEditModalNow(record);
    });
  };

  const requestDeleteRecord = (record: PriceRecord) => {
    requireAdminAuthorization(`Delete Price: ${record.productName}`, () => {
      setConfirmError(null);
      setPendingConfirm({
        kind: 'delete',
        record,
        recordName: record.productName,
        details: [
          `Category: ${record.category}`,
          `Price: ${formatPriceDisplay(record.priceDisplay, record.priceNumeric, record.currency)}`,
          `Worksheet: ${record._sheetName}`,
        ],
      });
    });
  };

  const closeFormModal = () => {
    if (isSubmittingForm || isExecutingConfirm) return;
    setFormModalMode(null);
    setEditingRecord(null);
    setFormFieldErrors({});
    setFormGeneralError(null);
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingForm || isExecutingConfirm || operationLockRef.current) return;

    const trimmedFields: Record<string, string> = {};
    effectiveFormColumns.forEach((c) => {
      trimmedFields[c] = (formFields[c] ?? '').trim();
    });

    const resolvedCategory =
      formCategory.trim() ||
      (cols.categoryCol ? trimmedFields[cols.categoryCol] : '') ||
      'General';
    const resolvedProduct =
      formProduct.trim() ||
      (cols.productCol ? trimmedFields[cols.productCol] : '') ||
      trimmedFields['Product / Service'] ||
      '';
    const resolvedPrice =
      formPrice.trim() ||
      (cols.priceCol ? trimmedFields[cols.priceCol] : '') ||
      trimmedFields['Price'] ||
      '';
    const resolvedCurrency =
      formCurrency.trim() ||
      (cols.currencyCol ? trimmedFields[cols.currencyCol] : '') ||
      trimmedFields['Currency'] ||
      'AED';

    if (!resolvedProduct) {
      setFormGeneralError('Product or Service name is required.');
      return;
    }

    if (cols.categoryCol && !trimmedFields[cols.categoryCol]) {
      trimmedFields[cols.categoryCol] = resolvedCategory;
    }
    if (cols.productCol && !trimmedFields[cols.productCol]) {
      trimmedFields[cols.productCol] = resolvedProduct;
    }
    if (cols.priceCol && !trimmedFields[cols.priceCol]) {
      trimmedFields[cols.priceCol] = resolvedPrice;
    }
    if (cols.currencyCol && !trimmedFields[cols.currencyCol]) {
      trimmedFields[cols.currencyCol] = resolvedCurrency;
    }
    if (dataset.columns.length === 0) {
      trimmedFields['Category'] = resolvedCategory;
      trimmedFields['Product / Service'] = resolvedProduct;
      trimmedFields['Price'] = resolvedPrice;
      trimmedFields['Currency'] = resolvedCurrency;
    }

    setFormFieldErrors({});
    setFormGeneralError(null);
    setConfirmError(null);

    if (formModalMode === 'add') {
      setPendingConfirm({
        kind: 'add',
        fields: trimmedFields,
        category: resolvedCategory,
        productName: resolvedProduct,
        priceDisplay: resolvedPrice,
        currency: resolvedCurrency,
        recordName: resolvedProduct,
        details: [
          `Category: ${resolvedCategory}`,
          `Price: ${resolvedPrice || 'Not Specified'} (${resolvedCurrency})`,
        ],
      });
    } else if (formModalMode === 'edit' && editingRecord) {
      setPendingConfirm({
        kind: 'update',
        record: editingRecord,
        fields: trimmedFields,
        category: resolvedCategory,
        productName: resolvedProduct,
        priceDisplay: resolvedPrice,
        currency: resolvedCurrency,
        recordName: resolvedProduct,
        details: [
          `Category: ${resolvedCategory}`,
          `Price: ${resolvedPrice || 'Not Specified'} (${resolvedCurrency})`,
        ],
      });
    }
  };

  const runConfirmedMutation = async (action: PendingPriceConfirm, token: string) => {
    if (operationLockRef.current) return;
    operationLockRef.current = true;
    setIsExecutingConfirm(true);
    setIsSubmittingForm(action.kind === 'add' || action.kind === 'update');
    setConfirmError(null);

    try {
      if (action.kind === 'add') {
        await createPriceRecord(
          {
            fields: action.fields,
            category: action.category,
            productName: action.productName,
            priceDisplay: action.priceDisplay,
            currency: action.currency,
          },
          token
        );
        await loadFromDatabase(false);
        setCurrentPage(1);
        setPendingConfirm(null);
        setFormModalMode(null);
        setEditingRecord(null);
        notify('Price record saved to database!', 'success');
      } else if (action.kind === 'update') {
        const updated = await updatePriceRecord(
          action.record._rowKey,
          {
            fields: action.fields,
            category: action.category,
            productName: action.productName,
            priceDisplay: action.priceDisplay,
            currency: action.currency,
          },
          token
        );
        setDataset((prev) => ({
          ...prev,
          records: prev.records.map((r) => (r._rowKey === updated._rowKey ? updated : r)),
        }));
        if (detailRecord?._rowKey === updated._rowKey) {
          setDetailRecord(updated);
        }
        setPendingConfirm(null);
        setFormModalMode(null);
        setEditingRecord(null);
        notify('Price record updated successfully!', 'success');
      } else if (action.kind === 'delete') {
        await deletePriceRecord(action.record._rowKey, token);
        setDataset((prev) => ({
          ...prev,
          records: prev.records.filter((r) => r._rowKey !== action.record._rowKey),
        }));
        if (detailRecord?._rowKey === action.record._rowKey) {
          setDetailRecord(null);
        }
        setPendingConfirm(null);
        notify('Price record deleted from database!', 'success');
      } else if (action.kind === 'import') {
        const saved = await saveImportedPricesDataset(
          {
            fileName: action.preview.fileName,
            sheetNames: action.preview.sheetNames,
            columns: action.preview.columns,
            detectedColumns: action.preview.detectedColumns,
            records: action.recordsToImport,
            notes: action.preview.notes,
            contentHash: action.preview.contentHash,
            importedAt: new Date().toLocaleString([], {
              dateStyle: 'medium',
              timeStyle: 'short',
            }),
          },
          token
        );
        setDataset(saved);
        setDetailRecord(null);
        handleResetFilters();
        setImportPreview(null);
        setImportError(null);
        setShowImportPanel(false);
        setPendingConfirm(null);
        notify(`Imported ${saved.records.length} prices into D1 database!`, 'success');
      } else if (action.kind === 'rollback') {
        const restored = await rollbackPricesDataset(token);
        setDataset(restored);
        setDetailRecord(null);
        handleResetFilters();
        setPendingConfirm(null);
        notify(`Restored ${restored.records.length} price records from backup!`, 'success');
      }
    } catch (err) {
      if (err instanceof AdminAuthError) {
        setPendingConfirm(null);
        handleAuthFailure(`Re-authorize: ${action.recordName}`, () => {
          setPendingConfirm(action);
        });
      } else if (err instanceof PricesApiValidationError) {
        setPendingConfirm(null);
        if (action.kind === 'add' || action.kind === 'update') {
          setFormFieldErrors(err.fieldErrors);
          setFormGeneralError(err.message);
        } else if (action.kind === 'import') {
          setImportError(err.message);
        }
        notify(err.message, 'error');
      } else {
        const msg = err instanceof Error ? err.message : 'Operation failed. Please try again.';
        setConfirmError(msg);
        notify(msg, 'error');
      }
    } finally {
      operationLockRef.current = false;
      setIsExecutingConfirm(false);
      setIsSubmittingForm(false);
    }
  };

  const handleConfirmOperation = async () => {
    if (!pendingConfirm || operationLockRef.current) return;
    const actionSnapshot = pendingConfirm;
    const token = getValidToken();
    if (!token) {
      setPendingConfirm(null);
      requireAdminAuthorization(`Authorize: ${actionSnapshot.recordName}`, () => {
        setPendingConfirm(actionSnapshot);
      });
      return;
    }
    await runConfirmedMutation(actionSnapshot, token);
  };

  // =========================================================================
  // RENDER HELPERS
  // =========================================================================
  const previewRecords = importPreview
    ? skipDuplicates
      ? importPreview.records
      : importPreview.allRecords
    : [];

  const isIdenticalAlreadyLoaded = Boolean(
    importPreview &&
      dataset.contentHash &&
      importPreview.contentHash === dataset.contentHash &&
      dataset.records.length === previewRecords.length
  );

  return (
    <div className="space-y-6">
      {/* Hidden Excel File Picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleFileChange}
        className="hidden"
        aria-label="Upload Prices Excel File"
      />

      {/* Top Admin Security & Database Sync Strip */}
      <section className="bg-white dark:bg-[#0F172A] rounded-2xl border border-[#E2E8F0] dark:border-slate-800 p-4 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#F0FDF4] dark:bg-emerald-950/60 border border-[#D1FAE5] dark:border-emerald-800/70 text-[#064E3B] dark:text-emerald-200 font-semibold">
            <Database className="w-3.5 h-3.5 text-[#059669] dark:text-emerald-400 shrink-0" />
            <span>Cloudflare D1 Persistent Prices</span>
          </div>

          <div className="flex items-center gap-2 text-[#475569] dark:text-slate-300">
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#006B45] dark:text-emerald-400 shrink-0" />
            <span className="font-semibold text-[#0F172A] dark:text-slate-100">
              {dataset.fileName}
            </span>
            {dataset.importedAt && (
              <span className="text-[11px] text-[#64748B] dark:text-slate-400">
                · Updated {dataset.importedAt}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAuthorized ? (
            <>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-[#006B45] dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Admin Unlocked</span>
              </span>
              <button
                type="button"
                onClick={openChangeCodeModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-[#0F172A] dark:text-slate-100 border border-[#CBD5E1] dark:border-slate-700 text-xs font-semibold transition-colors"
              >
                <KeyRound className="w-3.5 h-3.5 text-[#006B45] dark:text-emerald-400" />
                <span>Change Code</span>
              </button>
              <button
                type="button"
                onClick={lockSession}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[#475569] dark:text-slate-300 text-xs font-semibold transition-colors"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Lock</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => requireAdminAuthorization('Manage Prices Catalog', () => {})}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#F8FAFC] dark:bg-slate-800 hover:bg-[#F0FDF4] dark:hover:bg-emerald-950/60 text-[#0F172A] dark:text-slate-100 border border-[#CBD5E1] dark:border-slate-700 text-xs font-semibold transition-colors"
            >
              <Lock className="w-3.5 h-3.5 text-[#006B45] dark:text-emerald-400" />
              <span>Unlock Admin Edit &amp; Import</span>
            </button>
          )}
        </div>
      </section>

      {/* Database Error Banner */}
      {dbError && (
        <div
          role="alert"
          className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-rose-900 dark:text-rose-200"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-bold">Database Load Warning</strong>
              <span>{dbError}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadFromDatabase(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Summary Metric Cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-[#E2E8F0] dark:border-slate-800 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
              Total Price Records
            </span>
            <Tag className="w-4 h-4 text-[#006B45] dark:text-emerald-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-extrabold text-[#0F172A] dark:text-slate-100">
            {summaryStats.total}
          </div>
          <span className="text-[11px] text-[#64748B] dark:text-slate-400">
            Stored persistently in D1
          </span>
        </div>

        <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-[#E2E8F0] dark:border-slate-800 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
              Categories
            </span>
            <Layers className="w-4 h-4 text-[#006B45] dark:text-emerald-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-extrabold text-[#0F172A] dark:text-slate-100">
            {summaryStats.categoriesCount}
          </div>
          <span className="text-[11px] text-[#64748B] dark:text-slate-400">
            Distinct product / course groups
          </span>
        </div>

        <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-[#E2E8F0] dark:border-slate-800 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
              Valid Prices
            </span>
            <CheckCircle2 className="w-4 h-4 text-[#059669] dark:text-emerald-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-extrabold text-[#064E3B] dark:text-emerald-300">
            {summaryStats.validCount}
          </div>
          <span className="text-[11px] text-[#64748B] dark:text-slate-400">
            {summaryStats.flaggedCount > 0
              ? `${summaryStats.flaggedCount} missing or text-formatted`
              : 'All amounts validated'}
          </span>
        </div>

        <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-[#E2E8F0] dark:border-slate-800 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
              Excel Worksheets
            </span>
            <FileSpreadsheet className="w-4 h-4 text-[#006B45] dark:text-emerald-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-extrabold text-[#0F172A] dark:text-slate-100">
            {summaryStats.sheetsCount}
          </div>
          <span className="text-[11px] text-[#64748B] dark:text-slate-400">
            {dataset.backupInfo.hasBackup ? 'Rollback snapshot ready' : 'Multi-sheet import supported'}
          </span>
        </div>
      </section>

      {/* Action Toolbar */}
      <section className="bg-white dark:bg-[#0F172A] rounded-2xl border border-[#E2E8F0] dark:border-slate-800 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowImportPanel((v) => !v)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#006B45] hover:bg-[#064E3B] text-white text-xs font-bold shadow-xs transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import Prices Excel</span>
          </button>

          <button
            type="button"
            onClick={requestOpenAddModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F0FDF4] dark:bg-emerald-950/60 hover:bg-[#D1FAE5] dark:hover:bg-emerald-900/60 text-[#006B45] dark:text-emerald-300 border border-[#D1FAE5] dark:border-emerald-800/70 text-xs font-bold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Price Row</span>
          </button>

          {dataset.backupInfo.hasBackup && (
            <button
              type="button"
              onClick={requestRollbackConfirm}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800 text-xs font-bold transition-colors"
              title={`Restore backup from ${dataset.backupInfo.fileName}`}
            >
              <History className="w-3.5 h-3.5" />
              <span>
                Restore Backup ({dataset.backupInfo.recordCount ?? 0})
              </span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={filteredRecords.length === 0}
            onClick={() =>
              exportPricesToExcel(filteredRecords, dataset.columns, 'EcoDrive_Prices')
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 text-[#0F172A] dark:text-slate-100 border border-[#CBD5E1] dark:border-slate-700 text-xs font-semibold transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-[#006B45] dark:text-emerald-400" />
            <span>Export Excel</span>
          </button>

          <button
            type="button"
            disabled={filteredRecords.length === 0}
            onClick={() =>
              exportPricesToCSV(filteredRecords, dataset.columns, 'EcoDrive_Prices')
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 text-[#0F172A] dark:text-slate-100 border border-[#CBD5E1] dark:border-slate-700 text-xs font-semibold transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-[#006B45] dark:text-emerald-400" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            disabled={isLoadingDb}
            onClick={() => void loadFromDatabase(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 text-[#0F172A] dark:text-slate-100 border border-[#CBD5E1] dark:border-slate-700 text-xs font-semibold transition-colors"
            title="Reload prices from Cloudflare D1"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-[#006B45] dark:text-emerald-400 ${
                isLoadingDb ? 'animate-spin' : ''
              }`}
            />
            <span>Refresh DB</span>
          </button>
        </div>
      </section>

      {/* Excel Workbook Inspector & Safe D1 Import Panel */}
      {showImportPanel && (
        <section className="bg-white dark:bg-[#0F172A] rounded-2xl border-2 border-[#006B45]/40 dark:border-emerald-700/70 p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E8F0] dark:border-slate-800 pb-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#064E3B] text-emerald-300 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-[#0F172A] dark:text-slate-100">
                  Import Prices from Excel Workbook (.xlsx, .xls, .csv)
                </h3>
                <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
                  Inspects every worksheet, preserves original columns, prices &amp; currency formats, validates missing/invalid prices, detects duplicates, and creates a D1 rollback backup before importing.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowImportPanel(false);
                setImportError(null);
              }}
              className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A] dark:hover:text-white self-end sm:self-center"
              aria-label="Close Excel import panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <button
              type="button"
              disabled={isParsingFile}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#F0FDF4] dark:bg-emerald-950/60 hover:bg-[#D1FAE5] dark:hover:bg-emerald-900/60 text-[#006B45] dark:text-emerald-300 border-2 border-dashed border-[#006B45]/40 dark:border-emerald-700 text-xs font-bold transition-colors"
            >
              {isParsingFile ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              <span>{isParsingFile ? 'Inspecting Excel Worksheets...' : 'Select Excel / CSV File'}</span>
            </button>

            <span className="text-xs text-[#64748B] dark:text-slate-400">
              Supports multi-sheet `.xlsx` / `.xls` workbooks and `.csv` files.
            </span>
          </div>

          {importError && (
            <div
              role="alert"
              className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl p-3.5 flex items-start gap-2 text-xs text-rose-900 dark:text-rose-200"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <span>{importError}</span>
            </div>
          )}

          {importPreview && (
            <div className="space-y-4 pt-2 border-t border-[#E2E8F0] dark:border-slate-800">
              {/* Inspection Summary Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
                <div className="p-3 rounded-xl bg-[#F8FAFC] dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800">
                  <span className="block text-[10px] font-bold uppercase text-[#64748B] dark:text-slate-400">
                    Worksheets
                  </span>
                  <span className="font-mono text-base font-extrabold text-[#0F172A] dark:text-slate-100">
                    {importPreview.sheetNames.length}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-[#F8FAFC] dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800">
                  <span className="block text-[10px] font-bold uppercase text-[#64748B] dark:text-slate-400">
                    Extracted Rows
                  </span>
                  <span className="font-mono text-base font-extrabold text-[#0F172A] dark:text-slate-100">
                    {importPreview.totalRawRows}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-[#F0FDF4] dark:bg-emerald-950/50 border border-[#D1FAE5] dark:border-emerald-800/70">
                  <span className="block text-[10px] font-bold uppercase text-[#064E3B] dark:text-emerald-300">
                    Ready to Save
                  </span>
                  <span className="font-mono text-base font-extrabold text-[#064E3B] dark:text-emerald-200">
                    {previewRecords.length}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-[#F8FAFC] dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800">
                  <span className="block text-[10px] font-bold uppercase text-[#64748B] dark:text-slate-400">
                    Duplicates
                  </span>
                  <span className="font-mono text-base font-extrabold text-amber-700 dark:text-amber-300">
                    {importPreview.duplicatesDetected}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-[#F8FAFC] dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800">
                  <span className="block text-[10px] font-bold uppercase text-[#64748B] dark:text-slate-400">
                    Missing / Invalid
                  </span>
                  <span className="font-mono text-base font-extrabold text-rose-700 dark:text-rose-300">
                    {importPreview.missingPriceCount + importPreview.invalidPriceCount}
                  </span>
                </div>
              </div>

              {/* Duplicate Check & Idempotency Notice */}
              {isIdenticalAlreadyLoaded && (
                <div className="bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 rounded-xl p-3 flex items-start gap-2 text-xs text-sky-900 dark:text-sky-200">
                  <Info className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                  <span>
                    This exact workbook content (<code className="font-mono">{importPreview.contentHash}</code>) is already active in D1. Re-running import is safe and idempotent.
                  </span>
                </div>
              )}

              {importPreview.warnings.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 rounded-xl p-3 space-y-1 text-xs text-amber-900 dark:text-amber-200">
                  {importPreview.warnings.map((w, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}

              {importPreview.duplicatesDetected > 0 && (
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#0F172A] dark:text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={skipDuplicates}
                    onChange={(e) => setSkipDuplicates(e.target.checked)}
                    className="rounded border-slate-300 text-[#006B45] focus:ring-[#006B45]"
                  />
                  <span>
                    Exclude {importPreview.duplicatesDetected} exact duplicate row(s) during import
                  </span>
                </label>
              )}

              {/* Worksheet Breakdown Table */}
              <div className="overflow-x-auto border border-[#E2E8F0] dark:border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-[#F8FAFC] dark:bg-slate-900 border-b border-[#E2E8F0] dark:border-slate-800 text-[11px] font-bold uppercase text-[#475569] dark:text-slate-300">
                      <th className="py-2.5 px-3">Worksheet</th>
                      <th className="py-2.5 px-3">Extracted</th>
                      <th className="py-2.5 px-3">Unique</th>
                      <th className="py-2.5 px-3">Duplicates</th>
                      <th className="py-2.5 px-3">Missing / Invalid Price</th>
                      <th className="py-2.5 px-3">Detected Columns</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] dark:divide-slate-800">
                    {importPreview.sheetStats.map((st) => (
                      <tr key={st.sheetName}>
                        <td className="py-2 px-3 font-bold text-[#0F172A] dark:text-slate-100">
                          {st.sheetName}
                        </td>
                        <td className="py-2 px-3 font-mono">{st.rawRows}</td>
                        <td className="py-2 px-3 font-mono text-[#006B45] dark:text-emerald-400 font-semibold">
                          {st.importedRows}
                        </td>
                        <td className="py-2 px-3 font-mono">{st.duplicateRows}</td>
                        <td className="py-2 px-3 font-mono">
                          {st.missingPriceRows + st.invalidPriceRows}
                        </td>
                        <td className="py-2 px-3 text-[11px] text-[#64748B] dark:text-slate-400">
                          {st.columns.join(', ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Sample Row Preview */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                  Preview (First {Math.min(6, previewRecords.length)} of {previewRecords.length} rows)
                </span>
                <div className="overflow-x-auto border border-[#E2E8F0] dark:border-slate-800 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-[#F8FAFC] dark:bg-slate-900 border-b border-[#E2E8F0] dark:border-slate-800 text-[11px] font-bold text-[#475569] dark:text-slate-300">
                        <th className="py-2 px-3">Sheet</th>
                        <th className="py-2 px-3">Category</th>
                        <th className="py-2 px-3">Product / Offer</th>
                        <th className="py-2 px-3">Original Price</th>
                        <th className="py-2 px-3">Validation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0] dark:divide-slate-800">
                      {previewRecords.slice(0, 6).map((row) => (
                        <tr key={row._rowKey}>
                          <td className="py-2 px-3 text-[#64748B] dark:text-slate-400">
                            {row._sheetName}
                          </td>
                          <td className="py-2 px-3 font-semibold">{row.category}</td>
                          <td className="py-2 px-3 font-bold text-[#0F172A] dark:text-slate-100">
                            {row.productName}
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-[#006B45] dark:text-emerald-300">
                            {formatPriceDisplay(row.priceDisplay, row.priceNumeric, row.currency)}
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                row.priceStatus === 'valid'
                                  ? 'bg-[#F0FDF4] dark:bg-emerald-950/70 text-[#006B45] dark:text-emerald-300'
                                  : row.priceStatus === 'missing'
                                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                                  : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
                              }`}
                            >
                              {row.priceStatus === 'valid'
                                ? 'Valid'
                                : row.priceStatus === 'missing'
                                ? 'Missing Price'
                                : 'Non-Numeric Text'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setImportPreview(null);
                    setImportError(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 text-xs font-semibold text-[#475569] dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  Clear Preview
                </button>
                <button
                  type="button"
                  onClick={requestImportConfirm}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#006B45] hover:bg-[#064E3B] text-white text-xs font-extrabold shadow-xs transition-colors"
                >
                  <Database className="w-4 h-4" />
                  <span>Confirm &amp; Import to D1 Database</span>
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Search, Category Filter & Sorting Controls */}
      <section className="bg-white dark:bg-[#0F172A] rounded-2xl border border-[#E2E8F0] dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#006B45] dark:text-emerald-400" />
            <h2 className="text-sm font-bold text-[#0F172A] dark:text-slate-100">
              Search &amp; Filter Prices
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#64748B] dark:text-slate-400">
              Showing <strong className="text-[#0F172A] dark:text-slate-100">{sortedRecords.length}</strong> of{' '}
              <strong className="text-[#0F172A] dark:text-slate-100">{dataset.records.length}</strong> records
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-[#0F172A] dark:text-slate-100"
              >
                <RotateCcw className="w-3 h-3 text-[#006B45] dark:text-emerald-400" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Main Search + Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-4 relative">
            <Search className="w-4 h-4 text-[#006B45] dark:text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search product, offer, category, code, or price..."
              className="w-full pl-10 pr-8 py-2.5 text-xs sm:text-sm bg-[#F8FAFC] dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded-xl text-[#0F172A] dark:text-slate-100 placeholder-[#94A3B8] dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006B45]"
              aria-label="Search prices catalog"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="lg:col-span-3">
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              aria-label="Filter by category"
              className="w-full px-3 py-2.5 text-xs sm:text-sm bg-[#F8FAFC] dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded-xl text-[#0F172A] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#006B45]"
            >
              <option value="All">All Categories ({filterOptions.categories.length})</option>
              {filterOptions.categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.value} ({c.count})
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <select
              value={priceStatusFilter}
              onChange={(e) => {
                setPriceStatusFilter(e.target.value as 'all' | 'valid' | 'flagged');
                setCurrentPage(1);
              }}
              aria-label="Filter by price validation status"
              className="w-full px-3 py-2.5 text-xs sm:text-sm bg-[#F8FAFC] dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded-xl text-[#0F172A] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#006B45]"
            >
              <option value="all">All Price Status</option>
              <option value="valid">Valid Prices</option>
              <option value="flagged">Missing / Flagged</option>
            </select>
          </div>

          <div className="lg:col-span-3">
            <select
              value={typeof sortMode === 'string' ? sortMode : 'custom'}
              onChange={(e) => {
                const val = e.target.value;
                if (val !== 'custom') {
                  setSortMode(val as SortMode);
                  setCurrentPage(1);
                }
              }}
              aria-label="Sort prices"
              className="w-full px-3 py-2.5 text-xs sm:text-sm bg-[#F8FAFC] dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded-xl text-[#0F172A] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#006B45]"
            >
              <option value="original">Sort: Original Excel Order</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="product-asc">Product / Service: A – Z</option>
              <option value="product-desc">Product / Service: Z – A</option>
              <option value="category-asc">Category: A – Z</option>
              <option value="category-desc">Category: Z – A</option>
              {typeof sortMode === 'object' && (
                <option value="custom">
                  Column: {sortMode.column} ({sortMode.dir.toUpperCase()})
                </option>
              )}
            </select>
          </div>
        </div>

        {/* Secondary Row: Worksheet / Subcategory / Branch / Min-Max Price */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {filterOptions.sheets.length > 1 && (
            <select
              value={sheetFilter}
              onChange={(e) => {
                setSheetFilter(e.target.value);
                setCurrentPage(1);
              }}
              aria-label="Filter by worksheet"
              className="px-3 py-2 text-xs bg-[#F8FAFC] dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded-xl text-[#0F172A] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#006B45]"
            >
              <option value="All">All Worksheets ({filterOptions.sheets.length})</option>
              {filterOptions.sheets.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.value} ({s.count})
                </option>
              ))}
            </select>
          )}

          {filterOptions.subCategories.length > 0 && (
            <select
              value={subCategoryFilter}
              onChange={(e) => {
                setSubCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              aria-label="Filter by subcategory"
              className="px-3 py-2 text-xs bg-[#F8FAFC] dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded-xl text-[#0F172A] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#006B45]"
            >
              <option value="All">All {cols.subCategoryCol}</option>
              {filterOptions.subCategories.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.value} ({s.count})
                </option>
              ))}
            </select>
          )}

          {filterOptions.branches.length > 0 && (
            <select
              value={branchFilter}
              onChange={(e) => {
                setBranchFilter(e.target.value);
                setCurrentPage(1);
              }}
              aria-label="Filter by branch"
              className="px-3 py-2 text-xs bg-[#F8FAFC] dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded-xl text-[#0F172A] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#006B45]"
            >
              <option value="All">All Branches</option>
              {filterOptions.branches.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.value} ({b.count})
                </option>
              ))}
            </select>
          )}

          <input
            type="number"
            min="0"
            step="any"
            value={minPrice}
            onChange={(e) => {
              setMinPrice(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Min Price"
            aria-label="Minimum price filter"
            className="px-3 py-2 text-xs bg-[#F8FAFC] dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded-xl text-[#0F172A] dark:text-slate-100 placeholder-[#94A3B8] dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#006B45]"
          />

          <input
            type="number"
            min="0"
            step="any"
            value={maxPrice}
            onChange={(e) => {
              setMaxPrice(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Max Price"
            aria-label="Maximum price filter"
            className="px-3 py-2 text-xs bg-[#F8FAFC] dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded-xl text-[#0F172A] dark:text-slate-100 placeholder-[#94A3B8] dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#006B45]"
          />
        </div>

        {/* Category Quick Pills when manageable count */}
        {filterOptions.categories.length > 0 && filterOptions.categories.length <= 12 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => {
                setCategoryFilter('All');
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                categoryFilter === 'All'
                  ? 'bg-[#064E3B] text-white border-[#064E3B]'
                  : 'bg-[#F8FAFC] dark:bg-slate-900 text-[#475569] dark:text-slate-300 border-[#E2E8F0] dark:border-slate-700 hover:border-[#006B45]/50'
              }`}
            >
              All ({dataset.records.length})
            </button>
            {filterOptions.categories.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => {
                  setCategoryFilter(cat.value);
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                  categoryFilter === cat.value
                    ? 'bg-[#006B45] text-white border-[#006B45]'
                    : 'bg-[#F8FAFC] dark:bg-slate-900 text-[#475569] dark:text-slate-300 border-[#E2E8F0] dark:border-slate-700 hover:border-[#006B45]/50'
                }`}
              >
                {cat.value} ({cat.count})
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Main Prices Table or Honest Empty State */}
      <section className="bg-white dark:bg-[#0F172A] rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-xs overflow-hidden">
        {isLoadingDb ? (
          <div className="p-12 text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#006B45] dark:text-emerald-400 mx-auto" />
            <p className="text-xs font-semibold text-[#64748B] dark:text-slate-400">
              Loading Prices catalog from Cloudflare D1 database...
            </p>
          </div>
        ) : dataset.records.length === 0 ? (
          <div className="p-10 sm:p-14 text-center max-w-xl mx-auto space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-[#F0FDF4] dark:bg-emerald-950/60 border border-[#D1FAE5] dark:border-emerald-800/70 text-[#006B45] dark:text-emerald-400 flex items-center justify-center mx-auto">
              <FileSpreadsheet className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base sm:text-lg font-extrabold text-[#0F172A] dark:text-slate-100">
                No Prices Imported Yet
              </h3>
              <p className="text-xs sm:text-sm text-[#64748B] dark:text-slate-400 leading-relaxed">
                The Cloudflare D1 Prices catalog is ready. Upload your Excel price file (.xlsx, .xls, or .csv) to inspect all worksheets, validate prices, and publish persistent records across devices.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowImportPanel(true);
                  fileInputRef.current?.click();
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#006B45] hover:bg-[#064E3B] text-white text-xs font-extrabold shadow-xs transition-colors"
              >
                <Upload className="w-4 h-4" />
                <span>Upload Prices Excel File</span>
              </button>
              <button
                type="button"
                onClick={requestOpenAddModal}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-[#0F172A] dark:text-slate-100 border border-[#CBD5E1] dark:border-slate-700 text-xs font-bold transition-colors"
              >
                <Plus className="w-4 h-4 text-[#006B45] dark:text-emerald-400" />
                <span>Add Price Manually</span>
              </button>
            </div>
          </div>
        ) : sortedRecords.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <Search className="w-10 h-10 text-[#94A3B8] dark:text-slate-500 mx-auto" />
            <h3 className="text-sm font-bold text-[#0F172A] dark:text-slate-100">
              No Matching Price Records Found
            </h3>
            <p className="text-xs text-[#64748B] dark:text-slate-400">
              Try adjusting your search query, category filter, or price range.
            </p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#006B45] text-white text-xs font-bold hover:bg-[#064E3B]"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset All Filters</span>
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#F8FAFC] dark:bg-slate-900 border-b border-[#E2E8F0] dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-[#475569] dark:text-slate-300">
                    <th className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() =>
                          setSortMode((m) =>
                            m === 'category-asc' ? 'category-desc' : 'category-asc'
                          )
                        }
                        className="inline-flex items-center gap-1 hover:text-[#006B45] dark:hover:text-emerald-400"
                      >
                        <span>Category</span>
                        {sortMode === 'category-asc' ? (
                          <ArrowUp className="w-3 h-3" />
                        ) : sortMode === 'category-desc' ? (
                          <ArrowDown className="w-3 h-3" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-50" />
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() =>
                          setSortMode((m) =>
                            m === 'product-asc' ? 'product-desc' : 'product-asc'
                          )
                        }
                        className="inline-flex items-center gap-1 hover:text-[#006B45] dark:hover:text-emerald-400"
                      >
                        <span>Product / Service</span>
                        {sortMode === 'product-asc' ? (
                          <ArrowUp className="w-3 h-3" />
                        ) : sortMode === 'product-desc' ? (
                          <ArrowDown className="w-3 h-3" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-50" />
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() =>
                          setSortMode((m) => (m === 'price-asc' ? 'price-desc' : 'price-asc'))
                        }
                        className="inline-flex items-center gap-1 hover:text-[#006B45] dark:hover:text-emerald-400"
                      >
                        <span>Price</span>
                        {sortMode === 'price-asc' ? (
                          <ArrowUp className="w-3 h-3" />
                        ) : sortMode === 'price-desc' ? (
                          <ArrowDown className="w-3 h-3" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-50" />
                        )}
                      </button>
                    </th>
                    {extraDisplayColumns.map((col) => {
                      const activeSort =
                        typeof sortMode === 'object' && sortMode.column === col
                          ? sortMode.dir
                          : null;
                      return (
                        <th key={col} className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => handleColumnSort(col)}
                            className="inline-flex items-center gap-1 hover:text-[#006B45] dark:hover:text-emerald-400"
                          >
                            <span className="truncate max-w-[140px]">{col}</span>
                            {activeSort === 'asc' ? (
                              <ArrowUp className="w-3 h-3" />
                            ) : activeSort === 'desc' ? (
                              <ArrowDown className="w-3 h-3" />
                            ) : (
                              <ArrowUpDown className="w-3 h-3 opacity-50" />
                            )}
                          </button>
                        </th>
                      );
                    })}
                    {filterOptions.sheets.length > 1 && <th className="py-3 px-4">Sheet</th>}
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] dark:divide-slate-800">
                  {paginatedRecords.map((rec, idx) => {
                    const priceText = formatPriceDisplay(
                      rec.priceDisplay,
                      rec.priceNumeric,
                      rec.currency
                    );

                    return (
                      <tr
                        key={rec._rowKey}
                        className={`transition-colors ${
                          idx % 2 === 0
                            ? 'bg-white dark:bg-[#0F172A] hover:bg-slate-50 dark:hover:bg-slate-800/60'
                            : 'bg-[#FAFAFA] dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg bg-[#F0FDF4] dark:bg-emerald-950/60 text-[#064E3B] dark:text-emerald-300 border border-[#D1FAE5] dark:border-emerald-800/70 font-semibold text-[11px]">
                            {rec.category}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => setDetailRecord(rec)}
                            className="text-left font-bold text-[#0F172A] dark:text-slate-100 hover:text-[#006B45] dark:hover:text-emerald-300 transition-colors"
                          >
                            {rec.productName}
                          </button>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`font-mono font-extrabold text-xs sm:text-sm ${
                                rec.priceStatus === 'valid'
                                  ? 'text-[#006B45] dark:text-emerald-300'
                                  : rec.priceStatus === 'missing'
                                  ? 'text-amber-700 dark:text-amber-300'
                                  : 'text-rose-700 dark:text-rose-300'
                              }`}
                            >
                              {priceText}
                            </span>
                            {rec.priceStatus !== 'valid' && (
                              <span
                                className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 text-[10px] font-bold"
                                title={
                                  rec.priceStatus === 'missing'
                                    ? 'Price was empty in source workbook'
                                    : 'Non-numeric text price preserved'
                                }
                              >
                                {rec.priceStatus === 'missing' ? 'Missing' : 'Text'}
                              </span>
                            )}
                          </div>
                        </td>
                        {extraDisplayColumns.map((col) => {
                          const val = (rec.fields[col] || '').trim();
                          return (
                            <td
                              key={col}
                              className="py-3 px-4 text-[#475569] dark:text-slate-300 max-w-[180px] truncate"
                              title={val}
                            >
                              {val || <span className="text-[#94A3B8] dark:text-slate-500">—</span>}
                            </td>
                          );
                        })}
                        {filterOptions.sheets.length > 1 && (
                          <td className="py-3 px-4 text-[11px] text-[#64748B] dark:text-slate-400">
                            {rec._sheetName}
                          </td>
                        )}
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                void handleCopyText(
                                  `${rec.productName} (${rec.category}): ${priceText}`,
                                  `copy-${rec._rowKey}`,
                                  `Copied price for ${rec.productName}`
                                )
                              }
                              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-[#64748B] dark:text-slate-400 hover:text-[#006B45] dark:hover:text-emerald-300 transition-colors"
                              title="Copy price summary"
                            >
                              {copiedKey === `copy-${rec._rowKey}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => setDetailRecord(rec)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-[#64748B] dark:text-slate-400 hover:text-[#006B45] dark:hover:text-emerald-300 transition-colors"
                              title="Inspect all Excel fields"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => requestOpenEditModal(rec)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-[#64748B] dark:text-slate-400 hover:text-[#006B45] dark:hover:text-emerald-300 transition-colors"
                              title="Edit price record"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => requestDeleteRecord(rec)}
                              className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/60 text-[#64748B] dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                              title="Delete price record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="px-4 py-3 bg-[#F8FAFC] dark:bg-slate-900 border-t border-[#E2E8F0] dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#64748B] dark:text-slate-400">
              <div className="flex items-center gap-2">
                <span>Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  aria-label="Rows per page"
                  className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 text-[#0F172A] dark:text-slate-100 font-semibold"
                >
                  {[10, 25, 50, 100].map((sz) => (
                    <option key={sz} value={sz}>
                      {sz}
                    </option>
                  ))}
                </select>
                <span>
                  Page <strong className="text-[#0F172A] dark:text-slate-100">{safePage}</strong> of{' '}
                  <strong className="text-[#0F172A] dark:text-slate-100">{totalPages}</strong>
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 text-[#0F172A] dark:text-slate-100 font-semibold disabled:opacity-40"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Prev</span>
                </button>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 text-[#0F172A] dark:text-slate-100 font-semibold disabled:opacity-40"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Excel Workbook Notes if present */}
      {dataset.notes.length > 0 && (
        <section className="bg-slate-50 dark:bg-slate-900/70 rounded-2xl border border-[#E2E8F0] dark:border-slate-800 p-4 space-y-2 text-xs text-[#475569] dark:text-slate-300">
          <div className="flex items-center gap-1.5 font-bold text-[#0F172A] dark:text-slate-100">
            <Info className="w-4 h-4 text-[#006B45] dark:text-emerald-400" />
            <span>Imported Workbook Notes</span>
          </div>
          <ul className="list-disc pl-5 space-y-1">
            {dataset.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Detail Inspection Modal */}
      {detailRecord && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="price-detail-title"
        >
          <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-[#E2E8F0] dark:border-slate-700 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="bg-[#064E3B] dark:bg-[#043427] text-white px-5 py-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                  {detailRecord.category} · {detailRecord._sheetName}
                </span>
                <h3 id="price-detail-title" className="text-base font-extrabold truncate">
                  {detailRecord.productName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailRecord(null)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white shrink-0"
                aria-label="Close detail modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <div className="p-4 rounded-xl bg-[#F0FDF4] dark:bg-emerald-950/50 border border-[#D1FAE5] dark:border-emerald-800/70 flex items-center justify-between">
                <div>
                  <span className="block text-[10px] font-bold uppercase text-[#006B45] dark:text-emerald-400">
                    Price Value
                  </span>
                  <span className="font-mono text-2xl font-extrabold text-[#064E3B] dark:text-emerald-200">
                    {formatPriceDisplay(
                      detailRecord.priceDisplay,
                      detailRecord.priceNumeric,
                      detailRecord.currency
                    )}
                  </span>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-[#D1FAE5] dark:border-emerald-800 text-xs font-bold text-[#064E3B] dark:text-emerald-300">
                  Currency: {detailRecord.currency}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(dataset.columns.length > 0
                  ? dataset.columns
                  : Object.keys(detailRecord.fields)
                ).map((col) => (
                  <div
                    key={col}
                    className="p-3 rounded-xl bg-[#F8FAFC] dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800"
                  >
                    <span className="block text-[10px] font-bold uppercase text-[#64748B] dark:text-slate-400">
                      {col}
                    </span>
                    <span className="block text-xs sm:text-sm font-semibold text-[#0F172A] dark:text-slate-100 mt-1 break-words">
                      {detailRecord.fields[col]?.trim() || 'Not Available'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-5 py-3.5 bg-[#F8FAFC] dark:bg-slate-900/80 border-t border-[#E2E8F0] dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  const rec = detailRecord;
                  setDetailRecord(null);
                  requestOpenEditModal(rec);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#006B45] hover:bg-[#064E3B] text-white text-xs font-bold"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Edit Record</span>
              </button>
              <button
                type="button"
                onClick={() => setDetailRecord(null)}
                className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 text-xs font-semibold text-[#475569] dark:text-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Price Modal */}
      {formModalMode && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="price-form-modal-title"
        >
          <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-[#E2E8F0] dark:border-slate-700 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="bg-[#064E3B] dark:bg-[#043427] text-white px-5 py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
                  {formModalMode === 'add' ? (
                    <Plus className="w-5 h-5 text-emerald-300" />
                  ) : (
                    <Pencil className="w-4 h-4 text-emerald-300" />
                  )}
                </div>
                <div>
                  <h3 id="price-form-modal-title" className="text-base font-extrabold">
                    {formModalMode === 'add' ? 'Add New Price Record' : 'Edit Price Record'}
                  </h3>
                  <p className="text-[11px] text-emerald-100/80">
                    Persisted directly to Cloudflare D1 database
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeFormModal}
                disabled={isSubmittingForm}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 overflow-y-auto space-y-4">
                {formGeneralError && (
                  <div
                    role="alert"
                    className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2"
                  >
                    <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    <span>{formGeneralError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5 rounded-xl bg-[#F8FAFC] dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800">
                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-200 mb-1">
                      Category *
                    </label>
                    <input
                      type="text"
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      placeholder="e.g. Light Motor Vehicle"
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 rounded-xl text-[#0F172A] dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-200 mb-1">
                      Product / Service Name *
                    </label>
                    <input
                      type="text"
                      value={formProduct}
                      onChange={(e) => setFormProduct(e.target.value)}
                      placeholder="e.g. Regular 20 Hours Package"
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 rounded-xl text-[#0F172A] dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-200 mb-1">
                      Price Amount / Text
                    </label>
                    <input
                      type="text"
                      value={formPrice}
                      onChange={(e) => setFormPrice(e.target.value)}
                      placeholder="e.g. 4,500.00"
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 rounded-xl text-[#0F172A] dark:text-slate-100 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-200 mb-1">
                      Currency
                    </label>
                    <input
                      type="text"
                      value={formCurrency}
                      onChange={(e) => setFormCurrency(e.target.value)}
                      placeholder="AED"
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 rounded-xl text-[#0F172A] dark:text-slate-100 font-mono"
                    />
                  </div>
                </div>

                {dataset.columns.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {effectiveFormColumns.map((col) => (
                      <div key={col}>
                        <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-200 mb-1">
                          {col}
                        </label>
                        <input
                          type="text"
                          value={formFields[col] ?? ''}
                          onChange={(e) => {
                            const nextVal = e.target.value;
                            setFormFields((prev) => ({ ...prev, [col]: nextVal }));
                            if (formFieldErrors[col]) {
                              setFormFieldErrors((prev) => {
                                const copy = { ...prev };
                                delete copy[col];
                                return copy;
                              });
                            }
                          }}
                          placeholder={`Enter ${col}...`}
                          className="w-full px-3 py-2 text-xs bg-[#F8FAFC] dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded-xl text-[#0F172A] dark:text-slate-100"
                        />
                        {formFieldErrors[col] && (
                          <p className="mt-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                            {formFieldErrors[col]}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="px-5 py-3.5 bg-[#F8FAFC] dark:bg-slate-900/80 border-t border-[#E2E8F0] dark:border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={closeFormModal}
                  disabled={isSubmittingForm}
                  className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 text-xs font-semibold text-[#475569] dark:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingForm}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#006B45] hover:bg-[#064E3B] disabled:opacity-60 text-white text-xs font-bold shadow-xs"
                >
                  {isSubmittingForm ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                  )}
                  <span>
                    {isSubmittingForm
                      ? 'Saving...'
                      : formModalMode === 'add'
                      ? 'Add Price'
                      : 'Save Changes'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Two-Step Operation Confirmation Modal */}
      <OperationConfirmModal
        isOpen={Boolean(pendingConfirm)}
        operationType={
          pendingConfirm
            ? pendingConfirm.kind === 'import' || pendingConfirm.kind === 'rollback'
              ? ('update' as OperationConfirmType)
              : (pendingConfirm.kind as OperationConfirmType)
            : 'add'
        }
        entityLabel={
          pendingConfirm?.kind === 'import'
            ? 'Excel Prices Import'
            : pendingConfirm?.kind === 'rollback'
            ? 'Prices Backup Rollback'
            : 'Price Record'
        }
        recordName={pendingConfirm?.recordName || ''}
        recordDetails={pendingConfirm?.details || []}
        actionDescription={
          pendingConfirm?.kind === 'import'
            ? 'Existing D1 Prices records will be backed up automatically before applying this Excel import. Unrelated D1 tables remain completely untouched.'
            : pendingConfirm?.kind === 'rollback'
            ? 'The current D1 Prices catalog will revert to your previous backup snapshot.'
            : undefined
        }
        isSubmitting={isExecutingConfirm}
        errorMessage={confirmError}
        onConfirm={handleConfirmOperation}
        onCancel={() => {
          if (!isExecutingConfirm) {
            setPendingConfirm(null);
            setConfirmError(null);
          }
        }}
      />
    </div>
  );
};
