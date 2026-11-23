import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Users,
  Search,
  X,
  Filter,
  RotateCcw,
  Building2,
  Phone,
  Copy,
  Check,
  Download,
  FileSpreadsheet,
  Upload,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertCircle,
  CheckCircle2,
  Eye,
  Globe,
  RefreshCw,
  UserCheck,
  UserX,
  Info,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Database,
  Lock,
  ShieldCheck,
  KeyRound,
} from 'lucide-react';
import {
  ExcelImportPreview,
  InstructorRecord,
  InstructorsDataset,
} from '../types/instructors';
import {
  ApiValidationError,
  createInstructorRecord,
  deleteInstructorRecord,
  exportInstructorsToCSV,
  exportInstructorsToExcel,
  fetchInstructorsDataset,
  getDefaultInstructorsDataset,
  parseInstructorsWorkbook,
  saveImportedInstructorsDataset,
  updateInstructorRecord,
} from '../services/instructorsService';
import { AdminAuthError } from '../services/adminAuthService';
import { ToastVariant, useAdminAuth } from '../context/AdminAuthContext';
import { OperationConfirmModal, OperationConfirmType } from './OperationConfirmModal';

interface InstructorsPageProps {
  onShowToast?: (message: string, variant?: ToastVariant) => void;
}

type SortDirection = 'asc' | 'desc';

export const InstructorsPage: React.FC<InstructorsPageProps> = ({ onShowToast }) => {
  // 1. Active Dataset State (initialized with default structure, immediately synced from SQLite DB)
  const [dataset, setDataset] = useState<InstructorsDataset>(() =>
    getDefaultInstructorsDataset()
  );
  const [isLoadingDb, setIsLoadingDb] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  // 2. Detail View State
  const [selectedInstructor, setSelectedInstructor] = useState<InstructorRecord | null>(null);

  // 3. Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [idFilter, setIdFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('All');
  const [nationalityFilter, setNationalityFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [languageFilter, setLanguageFilter] = useState('All');

  // 4. Sorting & Pagination States
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // 5. Excel Import & Preview States
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [isSavingImport, setIsSavingImport] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<ExcelImportPreview | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 6. Copy feedback state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // 7. CRUD Modal States (Add / Edit / Delete Confirmation)
  const [formModalMode, setFormModalMode] = useState<'add' | 'edit' | null>(null);
  const [editingRecord, setEditingRecord] = useState<InstructorRecord | null>(null);
  const [formFields, setFormFields] = useState<Record<string, string>>({});
  const [formFieldErrors, setFormFieldErrors] = useState<Record<string, string>>({});
  const [formGeneralError, setFormGeneralError] = useState<string | null>(null);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);

  // 8. Admin Auth + Two-Step Operation Confirmation State
  const {
    isAuthorized,
    getValidToken,
    requireAdminAuthorization,
    openChangeCodeModal,
    lockSession,
    handleAuthFailure,
  } = useAdminAuth();

  type PendingInstructorConfirm =
    | {
        kind: 'add';
        fields: Record<string, string>;
        recordName: string;
        details: string[];
      }
    | {
        kind: 'update';
        record: InstructorRecord;
        fields: Record<string, string>;
        recordName: string;
        details: string[];
      }
    | {
        kind: 'delete';
        record: InstructorRecord;
        recordName: string;
        details: string[];
      }
    | {
        kind: 'import';
        preview: ExcelImportPreview;
        recordName: string;
        details: string[];
      };

  const [pendingConfirm, setPendingConfirm] = useState<PendingInstructorConfirm | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [isExecutingConfirm, setIsExecutingConfirm] = useState(false);
  const operationLockRef = useRef(false);

  const notify = (msg: string, variant: ToastVariant = 'success') => {
    if (onShowToast) {
      onShowToast(msg, variant);
    }
  };

  // Load persisted instructors from database on mount
  const loadFromDatabase = async (showSuccessToast = false) => {
    setIsLoadingDb(true);
    setDbError(null);
    try {
      const dbData = await fetchInstructorsDataset();
      setDataset(dbData);
      if (showSuccessToast) {
        notify(`Refreshed ${dbData.records.length} instructors from database`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to load instructors from database.';
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
      notify('Unable to copy to clipboard');
    }
  };

  const formatCellDisplay = (value: string | undefined): string => {
    const trimmed = (value ?? '').trim();
    return trimmed !== '' ? trimmed : 'Not Available';
  };

  const isCellEmpty = (value: string | undefined): boolean => {
    return (value ?? '').trim() === '';
  };

  const buildInstructorCopyText = (record: InstructorRecord): string => {
    return dataset.columns
      .map((col) => `${col}: ${formatCellDisplay(record.fields[col])}`)
      .join('\n');
  };

  // Detected columns from current dataset
  const cols = dataset.detectedColumns;

  // Automatically populate dropdown & autocomplete options from actual data
  const filterOptions = useMemo(() => {
    const getUniqueOptions = (colName: string | null) => {
      if (!colName) return [];
      const counts = new Map<string, number>();
      dataset.records.forEach((r) => {
        const val = (r.fields[colName] || '').trim();
        if (val) {
          counts.set(val, (counts.get(val) || 0) + 1);
        }
      });
      return Array.from(counts.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([value, count]) => ({ value, count }));
    };

    return {
      branches: getUniqueOptions(cols.branchCol),
      nationalities: getUniqueOptions(cols.nationalityCol),
      statuses: getUniqueOptions(cols.statusCol),
      categories: getUniqueOptions(cols.categoryCol),
      languages: getUniqueOptions(cols.languageCol),
    };
  }, [dataset.records, cols]);

  // Summary statistics calculated reliably from actual dataset
  const summaryStats = useMemo(() => {
    const total = dataset.records.length;

    const branchCount = cols.branchCol
      ? new Set(
          dataset.records
            .map((r) => (r.fields[cols.branchCol!] || '').trim())
            .filter(Boolean)
        ).size
      : null;

    let activeCount: number | null = null;
    let inactiveCount: number | null = null;
    if (cols.statusCol) {
      let active = 0;
      let inactive = 0;
      dataset.records.forEach((r) => {
        const val = (r.fields[cols.statusCol!] || '').trim().toLowerCase();
        if (!val) return;
        if (val === 'active' || val.startsWith('active')) {
          active++;
        } else if (
          val === 'inactive' ||
          val.includes('inactive') ||
          val.includes('terminated') ||
          val.includes('resigned') ||
          val.includes('suspended')
        ) {
          inactive++;
        }
      });
      activeCount = active;
      inactiveCount = inactive;
    }

    return {
      total,
      branchCount,
      activeCount,
      inactiveCount,
    };
  }, [dataset.records, cols]);

  // Reset all filters
  const handleClearFilters = () => {
    setSearchQuery('');
    setIdFilter('');
    setBranchFilter('All');
    setNationalityFilter('All');
    setStatusFilter('All');
    setCategoryFilter('All');
    setLanguageFilter('All');
    setCurrentPage(1);
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    idFilter.trim() !== '' ||
    branchFilter !== 'All' ||
    nationalityFilter !== 'All' ||
    statusFilter !== 'All' ||
    categoryFilter !== 'All' ||
    languageFilter !== 'All';

  // Filtered records (partial text, case-insensitive, combined AND logic)
  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const idQ = idFilter.trim().toLowerCase();

    return dataset.records.filter((record) => {
      if (q) {
        const nameVal = cols.nameCol ? (record.fields[cols.nameCol] || '').toLowerCase() : '';
        const idVal = cols.idCol ? (record.fields[cols.idCol] || '').toLowerCase() : '';
        if (cols.nameCol || cols.idCol) {
          if (!nameVal.includes(q) && !idVal.includes(q)) {
            return false;
          }
        } else {
          const anyMatch = dataset.columns.some((c) =>
            (record.fields[c] || '').toLowerCase().includes(q)
          );
          if (!anyMatch) return false;
        }
      }

      if (idQ && cols.idCol) {
        const idVal = (record.fields[cols.idCol] || '').toLowerCase();
        if (!idVal.includes(idQ)) return false;
      }

      if (branchFilter !== 'All' && cols.branchCol) {
        if ((record.fields[cols.branchCol] || '').trim() !== branchFilter) return false;
      }

      if (nationalityFilter !== 'All' && cols.nationalityCol) {
        if ((record.fields[cols.nationalityCol] || '').trim() !== nationalityFilter) return false;
      }

      if (statusFilter !== 'All' && cols.statusCol) {
        if ((record.fields[cols.statusCol] || '').trim() !== statusFilter) return false;
      }

      if (categoryFilter !== 'All' && cols.categoryCol) {
        if ((record.fields[cols.categoryCol] || '').trim() !== categoryFilter) return false;
      }

      if (languageFilter !== 'All' && cols.languageCol) {
        if ((record.fields[cols.languageCol] || '').trim() !== languageFilter) return false;
      }

      return true;
    });
  }, [
    dataset.records,
    dataset.columns,
    cols,
    searchQuery,
    idFilter,
    branchFilter,
    nationalityFilter,
    statusFilter,
    categoryFilter,
    languageFilter,
  ]);

  // Sorted records
  const sortedRecords = useMemo(() => {
    if (!sortColumn) return filteredRecords;

    return [...filteredRecords].sort((a, b) => {
      const valA = (a.fields[sortColumn] || '').trim();
      const valB = (b.fields[sortColumn] || '').trim();

      if (!valA && !valB) return 0;
      if (!valA) return 1;
      if (!valB) return -1;

      const numA = Number(valA);
      const numB = Number(valB);
      let cmp = 0;
      if (!Number.isNaN(numA) && !Number.isNaN(numB) && /^\d+(\.\d+)?$/.test(valA) && /^\d+(\.\d+)?$/.test(valB)) {
        cmp = numA - numB;
      } else {
        cmp = valA.localeCompare(valB, undefined, { sensitivity: 'base', numeric: true });
      }

      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [filteredRecords, sortColumn, sortDirection]);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(sortedRecords.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedRecords = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sortedRecords.slice(start, start + pageSize);
  }, [sortedRecords, safePage, pageSize]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortColumn(null);
        setSortDirection('asc');
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const getInstructorDisplayName = (fields: Record<string, string>, fallbackKey = ''): string => {
    const nameCol = cols.nameCol || dataset.columns[1] || dataset.columns[0];
    const name = nameCol ? (fields[nameCol] || '').trim() : '';
    return name || fallbackKey || 'Instructor';
  };

  const getInstructorDetailsList = (fields: Record<string, string>): string[] => {
    const details: string[] = [];
    if (cols.idCol && fields[cols.idCol]?.trim()) {
      details.push(`ID: ${fields[cols.idCol].trim()}`);
    }
    if (cols.branchCol && fields[cols.branchCol]?.trim()) {
      details.push(`Branch: ${fields[cols.branchCol].trim()}`);
    }
    if (cols.phoneCol && fields[cols.phoneCol]?.trim()) {
      details.push(`Phone: ${fields[cols.phoneCol].trim()}`);
    }
    return details;
  };

  // =========================================================
  // CRUD HANDLERS (Admin Code Auth -> Form/Validation -> Confirm Modal)
  // =========================================================
  const openAddModalNow = () => {
    const empty: Record<string, string> = {};
    dataset.columns.forEach((c) => {
      empty[c] = '';
    });
    setFormFields(empty);
    setFormFieldErrors({});
    setFormGeneralError(null);
    setEditingRecord(null);
    setFormModalMode('add');
  };

  const requestOpenAddModal = () => {
    requireAdminAuthorization('Add New Instructor', () => {
      openAddModalNow();
    });
  };

  const openEditModalNow = (record: InstructorRecord) => {
    const initial: Record<string, string> = {};
    dataset.columns.forEach((c) => {
      initial[c] = record.fields[c] ?? '';
    });
    setFormFields(initial);
    setFormFieldErrors({});
    setFormGeneralError(null);
    setEditingRecord(record);
    setFormModalMode('edit');
  };

  const requestOpenEditModal = (record: InstructorRecord) => {
    const label = getInstructorDisplayName(record.fields, record._rowKey);
    requireAdminAuthorization(`Edit Instructor: ${label}`, () => {
      openEditModalNow(record);
    });
  };

  const requestDeleteRecord = (record: InstructorRecord) => {
    const label = getInstructorDisplayName(record.fields, record._rowKey);
    requireAdminAuthorization(`Delete Instructor: ${label}`, () => {
      setConfirmError(null);
      setPendingConfirm({
        kind: 'delete',
        record,
        recordName: label,
        details: getInstructorDetailsList(record.fields),
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

  const validateInstructorFormClient = (
    values: Record<string, string>,
    excludeRowKey?: string
  ): Record<string, string> => {
    const errs: Record<string, string> = {};
    const nameCol = cols.nameCol || dataset.columns[1] || dataset.columns[0];
    const idCol = cols.idCol;
    const phoneCol = cols.phoneCol;

    if (nameCol) {
      const nameVal = (values[nameCol] || '').trim();
      if (!nameVal) {
        errs[nameCol] = `${nameCol} is required.`;
      } else if (nameVal.length < 2) {
        errs[nameCol] = `${nameCol} must be at least 2 characters.`;
      }
    }

    if (idCol) {
      const idVal = (values[idCol] || '').trim();
      if (!idVal) {
        errs[idCol] = `${idCol} is required.`;
      } else if (!/^[a-zA-Z0-9_-]{1,40}$/.test(idVal)) {
        errs[idCol] = `${idCol} can only contain letters, numbers, "-" or "_".`;
      } else {
        const dup = dataset.records.find(
          (r) =>
            r._rowKey !== excludeRowKey &&
            (r.fields[idCol] || '').trim().toLowerCase() === idVal.toLowerCase()
        );
        if (dup) {
          errs[idCol] = `Instructor ${idCol} "${idVal}" already exists.`;
        }
      }
    }

    if (cols.branchCol && !(values[cols.branchCol] || '').trim()) {
      errs[cols.branchCol] = `${cols.branchCol} is required.`;
    }

    if (phoneCol) {
      const ph = (values[phoneCol] || '').trim();
      if (ph) {
        const digits = ph.replace(/\D/g, '');
        if (!/^[+\d\s()/-]{7,30}$/.test(ph) || digits.length < 7 || digits.length > 15) {
          errs[phoneCol] = `Enter a valid ${phoneCol.toLowerCase()} (7–15 digits).`;
        }
      }
    }

    return errs;
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingForm || isExecutingConfirm || operationLockRef.current) return;

    const trimmed: Record<string, string> = {};
    dataset.columns.forEach((c) => {
      trimmed[c] = (formFields[c] ?? '').trim();
    });

    const clientErrors = validateInstructorFormClient(
      trimmed,
      formModalMode === 'edit' ? editingRecord?._rowKey : undefined
    );
    if (Object.keys(clientErrors).length > 0) {
      setFormFieldErrors(clientErrors);
      setFormGeneralError(Object.values(clientErrors)[0]);
      return;
    }

    setFormFieldErrors({});
    setFormGeneralError(null);
    setConfirmError(null);

    if (formModalMode === 'add') {
      const recordName = getInstructorDisplayName(trimmed);
      setPendingConfirm({
        kind: 'add',
        fields: trimmed,
        recordName,
        details: getInstructorDetailsList(trimmed),
      });
    } else if (formModalMode === 'edit' && editingRecord) {
      const recordName = getInstructorDisplayName(trimmed, editingRecord._rowKey);
      setPendingConfirm({
        kind: 'update',
        record: editingRecord,
        fields: trimmed,
        recordName,
        details: getInstructorDetailsList(trimmed),
      });
    }
  };

  const runConfirmedMutation = async (action: PendingInstructorConfirm, token: string) => {
    if (operationLockRef.current) return;
    operationLockRef.current = true;
    setIsExecutingConfirm(true);
    setIsSubmittingForm(action.kind === 'add' || action.kind === 'update');
    if (action.kind === 'import') {
      setIsSavingImport(true);
    }
    setConfirmError(null);

    try {
      if (action.kind === 'add') {
        const created = await createInstructorRecord(action.fields, token);
        setDataset((prev) => ({
          ...prev,
          records: [created, ...prev.records],
        }));
        setCurrentPage(1);
        setPendingConfirm(null);
        setFormModalMode(null);
        setEditingRecord(null);
        notify('Record added successfully!', 'success');
      } else if (action.kind === 'update') {
        const updated = await updateInstructorRecord(action.record._rowKey, action.fields, token);
        setDataset((prev) => ({
          ...prev,
          records: prev.records.map((r) => (r._rowKey === updated._rowKey ? updated : r)),
        }));
        if (selectedInstructor?._rowKey === updated._rowKey) {
          setSelectedInstructor(updated);
        }
        setPendingConfirm(null);
        setFormModalMode(null);
        setEditingRecord(null);
        notify('Record updated successfully!', 'success');
      } else if (action.kind === 'delete') {
        await deleteInstructorRecord(action.record._rowKey, token);
        setDataset((prev) => ({
          ...prev,
          records: prev.records.filter((r) => r._rowKey !== action.record._rowKey),
        }));
        if (selectedInstructor?._rowKey === action.record._rowKey) {
          setSelectedInstructor(null);
        }
        setPendingConfirm(null);
        notify('Record deleted successfully!', 'success');
      } else if (action.kind === 'import') {
        const savedDataset = await saveImportedInstructorsDataset(
          {
            fileName: action.preview.fileName,
            sheetNames: action.preview.sheetNames,
            columns: action.preview.columns,
            detectedColumns: action.preview.detectedColumns,
            records: action.preview.records,
            importedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
          token
        );

        setDataset(savedDataset);
        setSelectedInstructor(null);
        handleClearFilters();
        setSortColumn(null);
        setImportPreview(null);
        setImportError(null);
        setShowImportPanel(false);
        setPendingConfirm(null);
        notify('Record updated successfully!', 'success');
      }
    } catch (err) {
      if (err instanceof AdminAuthError) {
        setPendingConfirm(null);
        handleAuthFailure(`Re-authorize: ${action.recordName}`, (newToken) => {
          setPendingConfirm(action);
          void newToken;
        });
      } else if (err instanceof ApiValidationError) {
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
      setIsSavingImport(false);
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

  // Handle Excel / CSV File Upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingFile(true);
    setImportError(null);
    setImportPreview(null);

    try {
      const preview = await parseInstructorsWorkbook(file);
      setImportPreview(preview);
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : 'Failed to parse the uploaded Excel file.'
      );
    } finally {
      setIsParsingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Confirm Import Preview -> Admin Auth -> Second Confirmation Modal
  const requestImportConfirm = () => {
    if (!importPreview) return;
    const previewSnapshot = importPreview;
    requireAdminAuthorization(`Import Dataset (${previewSnapshot.fileName})`, () => {
      setConfirmError(null);
      setPendingConfirm({
        kind: 'import',
        preview: previewSnapshot,
        recordName: `${previewSnapshot.fileName} (${previewSnapshot.records.length} Instructors)`,
        details: [
          `Worksheets: ${previewSnapshot.sheetNames.join(', ')}`,
          `Replaces current instructors table`,
        ],
      });
    });
  };

  const getSuggestedDatalistId = (col: string): string | undefined => {
    if (col === cols.branchCol && filterOptions.branches.length > 0) return 'inst-branch-options';
    if (col === cols.nationalityCol && filterOptions.nationalities.length > 0)
      return 'inst-nationality-options';
    if (col === cols.statusCol && filterOptions.statuses.length > 0) return 'inst-status-options';
    if (col === cols.categoryCol && filterOptions.categories.length > 0)
      return 'inst-category-options';
    if (col === cols.languageCol && filterOptions.languages.length > 0)
      return 'inst-language-options';
    return undefined;
  };

  const isFieldRequired = (col: string): boolean => {
    const nameCol = cols.nameCol || dataset.columns[1] || dataset.columns[0];
    return col === nameCol || col === cols.idCol || col === cols.branchCol;
  };

  // =========================================================
  // SHARED MODALS (Rendered across both Detail & Directory views)
  // =========================================================
  const renderModals = () => (
    <>
      {/* Datalist suggestions for fast, consistent entry */}
      <datalist id="inst-branch-options">
        {filterOptions.branches.map((o) => (
          <option key={o.value} value={o.value} />
        ))}
      </datalist>
      <datalist id="inst-nationality-options">
        {filterOptions.nationalities.map((o) => (
          <option key={o.value} value={o.value} />
        ))}
      </datalist>
      <datalist id="inst-status-options">
        {filterOptions.statuses.map((o) => (
          <option key={o.value} value={o.value} />
        ))}
      </datalist>
      <datalist id="inst-category-options">
        {filterOptions.categories.map((o) => (
          <option key={o.value} value={o.value} />
        ))}
      </datalist>
      <datalist id="inst-language-options">
        {filterOptions.languages.map((o) => (
          <option key={o.value} value={o.value} />
        ))}
      </datalist>

      {/* Add / Edit Instructor Modal */}
      {formModalMode && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="instructor-form-modal-title"
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
                  <h3 id="instructor-form-modal-title" className="text-base font-extrabold">
                    {formModalMode === 'add' ? 'Add New Instructor' : 'Edit Instructor'}
                  </h3>
                  <p className="text-[11px] text-emerald-100/80">
                    {formModalMode === 'add'
                      ? 'Create a new instructor record and persist it to the database.'
                      : 'Update instructor fields and save changes to the database.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeFormModal}
                disabled={isSubmittingForm}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {dataset.columns.map((col) => {
                    const required = isFieldRequired(col);
                    const error = formFieldErrors[col];
                    const datalistId = getSuggestedDatalistId(col);
                    const isPhone = col === cols.phoneCol;

                    return (
                      <div key={col} className={col === cols.nameCol ? 'sm:col-span-2' : ''}>
                        <label
                          htmlFor={`inst-field-${col}`}
                          className="block text-xs font-bold text-[#0F172A] dark:text-slate-200 mb-1.5"
                        >
                          {col}
                          {required && <span className="text-rose-500 ml-1">*</span>}
                        </label>
                        <input
                          id={`inst-field-${col}`}
                          type={isPhone ? 'tel' : 'text'}
                          list={datalistId}
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
                          className={`w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border transition-all focus:outline-none focus:ring-2 ${
                            error
                              ? 'bg-rose-50/50 dark:bg-rose-950/30 border-rose-400 dark:border-rose-700 text-[#0F172A] dark:text-slate-100 focus:ring-rose-500'
                              : 'bg-[#F8FAFC] dark:bg-slate-900 border-[#CBD5E1] dark:border-slate-700 text-[#0F172A] dark:text-slate-100 placeholder-[#94A3B8] dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-[#006B45] focus:border-[#006B45]'
                          }`}
                        />
                        {error && (
                          <p className="mt-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                            {error}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="px-5 py-3.5 bg-[#F8FAFC] dark:bg-slate-900/80 border-t border-[#E2E8F0] dark:border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={closeFormModal}
                  disabled={isSubmittingForm}
                  className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 text-[#475569] dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingForm}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#006B45] hover:bg-[#064E3B] disabled:opacity-60 text-white text-xs font-bold shadow-xs transition-colors"
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
                      ? 'Add Instructor'
                      : 'Save Changes'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Two-Step Operation Confirmation Modal (Add / Update / Delete / Import) */}
      <OperationConfirmModal
        isOpen={Boolean(pendingConfirm)}
        operationType={
          pendingConfirm
            ? pendingConfirm.kind === 'import'
              ? ('update' as OperationConfirmType)
              : (pendingConfirm.kind as OperationConfirmType)
            : 'add'
        }
        entityLabel={pendingConfirm?.kind === 'import' ? 'Instructors Dataset' : 'Instructor'}
        recordName={pendingConfirm?.recordName || ''}
        recordDetails={pendingConfirm?.details || []}
        actionDescription={
          pendingConfirm?.kind === 'import'
            ? 'All current instructor records will be replaced with the imported Excel dataset.'
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
    </>
  );

  // =========================================================
  // DETAIL VIEW (When clicking an instructor's name or row)
  // =========================================================
  if (selectedInstructor) {
    const instructorName = cols.nameCol
      ? formatCellDisplay(selectedInstructor.fields[cols.nameCol])
      : formatCellDisplay(selectedInstructor.fields[dataset.columns[0]]);
    const instructorId = cols.idCol
      ? formatCellDisplay(selectedInstructor.fields[cols.idCol])
      : null;
    const instructorBranch = cols.branchCol
      ? formatCellDisplay(selectedInstructor.fields[cols.branchCol])
      : null;
    const instructorPhone = cols.phoneCol
      ? (selectedInstructor.fields[cols.phoneCol] || '').trim()
      : '';
    const instructorStatus = cols.statusCol
      ? (selectedInstructor.fields[cols.statusCol] || '').trim()
      : '';

    const initials = instructorName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('');

    return (
      <div className="space-y-6">
        {renderModals()}

        {/* Top Back Navigation & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setSelectedInstructor(null)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 hover:border-[#006B45] dark:hover:border-emerald-500 text-[#0F172A] dark:text-slate-100 hover:text-[#006B45] dark:hover:text-emerald-300 text-xs font-bold shadow-2xs transition-colors w-max"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Instructors</span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {instructorPhone && (
              <button
                type="button"
                onClick={() =>
                  handleCopyText(
                    instructorPhone,
                    `detail-phone-${selectedInstructor._rowKey}`,
                    `Copied phone number: ${instructorPhone}`
                  )
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 hover:border-[#006B45] text-[#0F172A] dark:text-slate-100 text-xs font-semibold shadow-2xs transition-colors"
              >
                {copiedKey === `detail-phone-${selectedInstructor._rowKey}` ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Phone className="w-3.5 h-3.5 text-[#006B45] dark:text-emerald-400" />
                )}
                <span>Copy Phone Number</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => requestOpenEditModal(selectedInstructor)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 hover:border-[#006B45] text-[#0F172A] dark:text-slate-100 text-xs font-semibold shadow-2xs transition-colors"
            >
              <Pencil className="w-3.5 h-3.5 text-[#006B45] dark:text-emerald-400" />
              <span>Edit</span>
            </button>

            <button
              type="button"
              onClick={() => requestDeleteRecord(selectedInstructor)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-semibold shadow-2xs transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>

            <button
              type="button"
              onClick={() =>
                handleCopyText(
                  buildInstructorCopyText(selectedInstructor),
                  `detail-info-${selectedInstructor._rowKey}`,
                  `Copied information for ${instructorName}`
                )
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#006B45] hover:bg-[#064E3B] text-white text-xs font-bold shadow-xs transition-colors"
            >
              {copiedKey === `detail-info-${selectedInstructor._rowKey}` ? (
                <Check className="w-3.5 h-3.5 text-emerald-300" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-emerald-200" />
              )}
              <span>Copy Instructor Information</span>
            </button>
          </div>
        </div>

        {/* Instructor Profile Header Card */}
        <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="bg-gradient-to-r from-[#064E3B] to-[#006B45] text-white p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center text-lg font-extrabold text-white shrink-0">
                  {initials || 'IN'}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    {instructorId && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-400/20 text-emerald-100 border border-emerald-400/30 font-mono">
                        ID: {instructorId}
                      </span>
                    )}
                    {instructorStatus && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/15 text-white border border-white/25">
                        {instructorStatus}
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight mt-1">
                    {instructorName}
                  </h2>
                  {instructorBranch && (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-100/90 mt-1">
                      <Building2 className="w-3.5 h-3.5 text-emerald-300" />
                      <span>{instructorBranch}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="text-xs text-emerald-100/80 bg-black/20 px-3 py-2 rounded-xl border border-white/10 self-start sm:self-auto">
                <span className="block font-semibold text-white">Database Record</span>
                <span className="text-[11px]">Worksheet: {selectedInstructor._sheetName}</span>
              </div>
            </div>
          </div>

          {/* All Available Fields Grid */}
          <div className="p-5 sm:p-6">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-slate-800 pb-3 mb-4">
              <h3 className="text-sm font-bold text-[#0F172A] dark:text-slate-100">
                Complete Instructor Information ({dataset.columns.length} Fields)
              </h3>
              <span className="text-[11px] text-[#64748B] dark:text-slate-400">
                Source: {dataset.fileName}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {dataset.columns.map((colName) => {
                const rawVal = selectedInstructor.fields[colName];
                const empty = isCellEmpty(rawVal);
                const isPhone = cols.phoneCol === colName;
                const isId = cols.idCol === colName;

                return (
                  <div
                    key={colName}
                    className="bg-[#F8FAFC] dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-2"
                  >
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                      {colName}
                    </span>

                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-sm font-bold break-words ${
                          empty
                            ? 'text-[#94A3B8] dark:text-slate-500 italic font-medium'
                            : isId || isPhone
                            ? 'text-[#0F172A] dark:text-slate-100 font-mono'
                            : 'text-[#0F172A] dark:text-slate-100'
                        }`}
                      >
                        {formatCellDisplay(rawVal)}
                      </span>

                      {!empty && (
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyText(
                              rawVal.trim(),
                              `field-${colName}`,
                              `Copied ${colName}: ${rawVal.trim()}`
                            )
                          }
                          className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 hover:border-[#006B45] text-[#64748B] dark:text-slate-300 hover:text-[#006B45] dark:hover:text-emerald-300 transition-colors shrink-0"
                          title={`Copy ${colName}`}
                        >
                          {copiedKey === `field-${colName}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================
  // MAIN DIRECTORY VIEW
  // =========================================================
  const startIdx = filteredRecords.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endIdx = Math.min(safePage * pageSize, sortedRecords.length);

  return (
    <div className="space-y-6">
      {renderModals()}

      {/* Database Error Banner if any */}
      {dbError && (
        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>{dbError}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadFromDatabase(true)}
            className="px-3 py-1 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-700 shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* 1. Source Banner & Quick Actions Header */}
      <div className="bg-gradient-to-r from-[#064E3B] to-[#006B45] text-white rounded-2xl p-4 sm:p-5 shadow-sm border border-emerald-400/20">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/20">
              <Users className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-400/20 text-emerald-200 border border-emerald-400/30">
                  <Database className="w-3 h-3" />
                  Database Active
                </span>
                <span className="text-[11px] text-emerald-100/80 font-medium">
                  {dataset.sheetNames.length} worksheet{dataset.sheetNames.length > 1 ? 's' : ''} · {dataset.columns.length} columns
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-bold text-white mt-1 break-all">
                {dataset.fileName}
              </h2>
            </div>
          </div>

          {/* Quick Actions Bar */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={requestOpenAddModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-[#064E3B] text-xs font-extrabold shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Add Instructor</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowImportPanel((prev) => !prev);
                setImportError(null);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold border border-white/20 transition-colors"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-300" />
              <span>{showImportPanel ? 'Close Import' : 'Import / Update Excel'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                exportInstructorsToExcel(sortedRecords, dataset.columns);
                notify(`Exported ${sortedRecords.length} instructors to Excel (.xlsx)`);
              }}
              disabled={sortedRecords.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white text-xs font-semibold border border-white/15 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-emerald-300" />
              <span>Export Excel</span>
            </button>

            <button
              type="button"
              onClick={() => {
                exportInstructorsToCSV(sortedRecords, dataset.columns);
                notify(`Exported ${sortedRecords.length} instructors to CSV`);
              }}
              disabled={sortedRecords.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white text-xs font-semibold border border-white/15 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-emerald-300" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={() => void loadFromDatabase(true)}
              disabled={isLoadingDb}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black/25 hover:bg-black/35 text-emerald-100 text-xs font-semibold border border-white/10 transition-colors"
              title="Refresh instructors from database"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-300 ${isLoadingDb ? 'animate-spin' : ''}`} />
              <span>Refresh Data</span>
            </button>

            <button
              type="button"
              onClick={openChangeCodeModal}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black/25 hover:bg-black/35 text-emerald-100 text-xs font-semibold border border-white/15 transition-colors"
              title="Change Admin Access Code"
            >
              <KeyRound className="w-3.5 h-3.5 text-emerald-300" />
              <span>Access Code</span>
            </button>

            {isAuthorized && (
              <button
                type="button"
                onClick={() => void lockSession()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-100 text-xs font-semibold border border-emerald-300/30 transition-colors"
                title="Admin authorized — click to lock session"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                <span>Unlocked</span>
                <Lock className="w-3 h-3 text-emerald-200/80" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Excel Import & Preview Panel */}
      {showImportPanel && (
        <div className="bg-white dark:bg-[#0F172A] rounded-2xl border-2 border-[#006B45]/30 dark:border-emerald-700/50 p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E8F0] dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#F0FDF4] dark:bg-emerald-950/60 text-[#006B45] dark:text-emerald-300 border border-[#D1FAE5] dark:border-emerald-800 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-[#0F172A] dark:text-slate-100">
                  Import Instructors Excel / CSV File
                </h3>
                <p className="text-xs text-[#64748B] dark:text-slate-400">
                  Reads all worksheets (.xlsx, .xls, .csv), validates headers, prevents duplicates, and previews data before saving to the database.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowImportPanel(false);
                setImportError(null);
                setImportPreview(null);
              }}
              className="p-1.5 rounded-lg text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 self-end sm:self-auto"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* File Input Box */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
              id="instructors-excel-upload"
            />
            <label
              htmlFor="instructors-excel-upload"
              className="flex-1 cursor-pointer border-2 border-dashed border-[#CBD5E1] dark:border-slate-700 hover:border-[#006B45] dark:hover:border-emerald-500 bg-[#F8FAFC] dark:bg-slate-900 hover:bg-[#F0FDF4]/50 dark:hover:bg-emerald-950/30 rounded-xl p-4 flex items-center justify-center gap-3 transition-colors"
            >
              <Upload className="w-5 h-5 text-[#006B45] dark:text-emerald-400 shrink-0" />
              <div className="text-xs">
                <span className="font-bold text-[#0F172A] dark:text-slate-100 block">
                  {isParsingFile
                    ? 'Reading worksheets and validating columns...'
                    : 'Click to select an Excel (.xlsx, .xls) or CSV file'}
                </span>
                <span className="text-[#64748B] dark:text-slate-400">
                  All columns and instructor details are preserved verbatim
                </span>
              </div>
            </label>
          </div>

          {importError && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Import Validation Failed</span>
                <span>{importError}</span>
              </div>
            </div>
          )}

          {importPreview && (
            <div className="bg-[#F8FAFC] dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800 rounded-xl p-4 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs font-extrabold text-[#064E3B] dark:text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-[#006B45] dark:text-emerald-400" />
                    <span>Preview Ready: {importPreview.fileName}</span>
                  </div>
                  <p className="text-[11px] text-[#64748B] dark:text-slate-400 mt-0.5">
                    {importPreview.records.length} unique records extracted across{' '}
                    {importPreview.sheetNames.length} worksheet(s) (
                    {importPreview.sheetNames.join(', ')})
                    {importPreview.duplicatesRemoved > 0 &&
                      ` · ${importPreview.duplicatesRemoved} duplicates removed`}
                    {importPreview.emptyRowsSkipped > 0 &&
                      ` · ${importPreview.emptyRowsSkipped} empty rows skipped`}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setImportPreview(null)}
                    disabled={isSavingImport}
                    className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 text-[#64748B] dark:text-slate-300 hover:text-[#0F172A] dark:hover:text-white text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={requestImportConfirm}
                    disabled={isSavingImport || isExecutingConfirm}
                    className="px-4 py-2 rounded-xl bg-[#006B45] hover:bg-[#064E3B] disabled:opacity-60 text-white text-xs font-bold shadow-xs flex items-center gap-1.5"
                  >
                    {isSavingImport ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                    )}
                    <span>
                      {isSavingImport
                        ? 'Saving to Database...'
                        : `Confirm Import (${importPreview.records.length} Records)`}
                    </span>
                  </button>
                </div>
              </div>

              {importPreview.warnings.length > 0 && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-[11px] space-y-1">
                  {importPreview.warnings.map((w, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="font-bold text-[#0F172A] dark:text-slate-200 mr-1">
                  Detected Headers:
                </span>
                {importPreview.columns.map((c) => (
                  <span
                    key={c}
                    className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 text-[#0F172A] dark:text-slate-200 font-medium"
                  >
                    {c}
                  </span>
                ))}
              </div>

              <div className="overflow-x-auto bg-white dark:bg-[#0F172A] rounded-lg border border-[#E2E8F0] dark:border-slate-800">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-[#E2E8F0] dark:border-slate-700 text-[#475569] dark:text-slate-300 font-bold">
                      {importPreview.columns.map((col) => (
                        <th key={col} className="py-2 px-3 whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] dark:divide-slate-800">
                    {importPreview.records.slice(0, 5).map((row) => (
                      <tr key={row._rowKey}>
                        {importPreview.columns.map((col) => (
                          <td key={col} className="py-2 px-3 whitespace-nowrap">
                            {isCellEmpty(row.fields[col]) ? (
                              <span className="text-[#94A3B8] dark:text-slate-500 italic">
                                Not Available
                              </span>
                            ) : (
                              <span className="text-[#0F172A] dark:text-slate-100">
                                {row.fields[col]}
                              </span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-[11px] text-[#64748B] dark:text-slate-400 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-[#006B45] dark:text-emerald-400 shrink-0" />
                <span>
                  Confirming saves the imported instructors dataset into the Eco Drive database.
                </span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* 3. Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-[#0F172A] p-3.5 rounded-xl border border-[#E2E8F0] dark:border-slate-800 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#F0FDF4] dark:bg-emerald-950/60 text-[#006B45] dark:text-emerald-300 border border-[#D1FAE5] dark:border-emerald-800 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 block">
              Total Instructors
            </span>
            <span className="text-base font-extrabold text-[#0F172A] dark:text-slate-100">
              {summaryStats.total} Instructors
            </span>
          </div>
        </div>

        {summaryStats.activeCount !== null && (
          <div className="bg-white dark:bg-[#0F172A] p-3.5 rounded-xl border border-[#E2E8F0] dark:border-slate-800 shadow-2xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center shrink-0">
              <UserCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 block">
                Active Instructors
              </span>
              <span className="text-base font-extrabold text-emerald-700 dark:text-emerald-300">
                {summaryStats.activeCount} Active
              </span>
            </div>
          </div>
        )}

        {summaryStats.inactiveCount !== null && (
          <div className="bg-white dark:bg-[#0F172A] p-3.5 rounded-xl border border-[#E2E8F0] dark:border-slate-800 shadow-2xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-center justify-center shrink-0">
              <UserX className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 block">
                Inactive Instructors
              </span>
              <span className="text-base font-extrabold text-rose-700 dark:text-rose-300">
                {summaryStats.inactiveCount} Inactive
              </span>
            </div>
          </div>
        )}

        {summaryStats.branchCount !== null && (
          <div className="bg-white dark:bg-[#0F172A] p-3.5 rounded-xl border border-[#E2E8F0] dark:border-slate-800 shadow-2xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#F0FDF4] dark:bg-emerald-950/60 text-[#006B45] dark:text-emerald-300 border border-[#D1FAE5] dark:border-emerald-800 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 block">
                Number of Branches
              </span>
              <span className="text-base font-extrabold text-[#0F172A] dark:text-slate-100">
                {summaryStats.branchCount} Branches
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 4. Search & Dynamic Filters Bar */}
      <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-[#E2E8F0] dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E8F0] dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#F0FDF4] dark:bg-emerald-950/60 text-[#006B45] dark:text-emerald-300 flex items-center justify-center border border-[#D1FAE5] dark:border-emerald-800">
              <Filter className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-[#0F172A] dark:text-slate-100">
              Search &amp; Filter Instructors
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs font-semibold text-[#64748B] dark:text-slate-400">
              Showing <strong className="text-[#0F172A] dark:text-slate-100">{sortedRecords.length}</strong> of{' '}
              {dataset.records.length} instructors
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#64748B] dark:text-slate-300 hover:text-[#0F172A] dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#006B45] dark:text-emerald-400" />
                <span>Clear Filters</span>
              </button>
            )}
          </div>
        </div>

        {/* Prominent Top Search Bar */}
        <div>
          <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-200 mb-1.5">
            Search Instructor
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-[#006B45] dark:text-emerald-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by instructor name or ID (partial match, case-insensitive)..."
              className="w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm bg-[#F8FAFC] dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded-xl text-[#0F172A] dark:text-slate-100 placeholder-[#94A3B8] dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006B45] focus:border-[#006B45] transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {cols.idCol && (
            <div>
              <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-200 mb-1.5">
                Instructor ID
              </label>
              <input
                type="text"
                value={idFilter}
                onChange={(e) => {
                  setIdFilter(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder={`Filter by ${cols.idCol}...`}
                className="w-full px-3 py-2 text-xs bg-[#F8FAFC] dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded-xl text-[#0F172A] dark:text-slate-100 placeholder-[#94A3B8] dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006B45] focus:border-[#006B45]"
              />
            </div>
          )}

          {cols.branchCol && (
            <div>
              <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-200 mb-1.5">
                Branch
              </label>
              <select
                value={branchFilter}
                onChange={(e) => {
                  setBranchFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 text-xs bg-[#F8FAFC] dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded-xl text-[#0F172A] dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006B45] focus:border-[#006B45] font-medium"
              >
                <option value="All">All Branches ({filterOptions.branches.length})</option>
                {filterOptions.branches.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.value} ({opt.count})
                  </option>
                ))}
              </select>
            </div>
          )}

          {cols.nationalityCol && (
            <div>
              <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-200 mb-1.5">
                Nationality
              </label>
              <select
                value={nationalityFilter}
                onChange={(e) => {
                  setNationalityFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 text-xs bg-[#F8FAFC] dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded-xl text-[#0F172A] dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006B45] focus:border-[#006B45] font-medium"
              >
                <option value="All">
                  All Nationalities ({filterOptions.nationalities.length})
                </option>
                {filterOptions.nationalities.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.value} ({opt.count})
                  </option>
                ))}
              </select>
            </div>
          )}

          {cols.statusCol && (
            <div>
              <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-200 mb-1.5">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 text-xs bg-[#F8FAFC] dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded-xl text-[#0F172A] dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006B45] focus:border-[#006B45] font-medium"
              >
                <option value="All">All Statuses ({filterOptions.statuses.length})</option>
                {filterOptions.statuses.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.value} ({opt.count})
                  </option>
                ))}
              </select>
            </div>
          )}

          {cols.categoryCol && (
            <div>
              <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-200 mb-1.5">
                Category / License
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 text-xs bg-[#F8FAFC] dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded-xl text-[#0F172A] dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006B45] focus:border-[#006B45] font-medium"
              >
                <option value="All">All Categories ({filterOptions.categories.length})</option>
                {filterOptions.categories.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.value} ({opt.count})
                  </option>
                ))}
              </select>
            </div>
          )}

          {cols.languageCol && (
            <div>
              <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-200 mb-1.5">
                Language
              </label>
              <select
                value={languageFilter}
                onChange={(e) => {
                  setLanguageFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 text-xs bg-[#F8FAFC] dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded-xl text-[#0F172A] dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006B45] focus:border-[#006B45] font-medium"
              >
                <option value="All">All Languages ({filterOptions.languages.length})</option>
                {filterOptions.languages.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.value} ({opt.count})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* 5. Instructors Results Table */}
      {sortedRecords.length === 0 ? (
        <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-[#E2E8F0] dark:border-slate-800 p-12 text-center shadow-xs">
          <Users className="w-12 h-12 text-[#94A3B8] mx-auto mb-3" />
          <h3 className="text-base font-bold text-[#0F172A] dark:text-slate-100">
            No Matching Instructors Found
          </h3>
          <p className="text-xs text-[#64748B] dark:text-slate-400 max-w-md mx-auto mt-1">
            No instructor record matches your current search or filter criteria.
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="mt-4 px-4 py-2 bg-[#006B45] text-white text-xs font-semibold rounded-xl hover:bg-[#064E3B] transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#F8FAFC] dark:bg-slate-900 border-b border-[#E2E8F0] dark:border-slate-800 text-[#475569] dark:text-slate-300 font-bold text-[11px] uppercase tracking-wider">
                  <th className="py-3.5 px-4 w-12 text-center">#</th>
                  {dataset.columns.map((col) => {
                    const isSorted = sortColumn === col;
                    return (
                      <th key={col} className="py-3.5 px-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleSort(col)}
                          className="inline-flex items-center gap-1.5 hover:text-[#006B45] dark:hover:text-emerald-300 transition-colors font-bold uppercase tracking-wider text-left"
                        >
                          <span>{col}</span>
                          {isSorted ? (
                            sortDirection === 'asc' ? (
                              <ArrowUp className="w-3.5 h-3.5 text-[#006B45] dark:text-emerald-400" />
                            ) : (
                              <ArrowDown className="w-3.5 h-3.5 text-[#006B45] dark:text-emerald-400" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-[#94A3B8]" />
                          )}
                        </button>
                      </th>
                    );
                  })}
                  <th className="py-3.5 px-4 text-right whitespace-nowrap">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] dark:divide-slate-800">
                {paginatedRecords.map((item, idx) => {
                  const rowNum = (safePage - 1) * pageSize + idx + 1;
                  const phoneVal = cols.phoneCol ? (item.fields[cols.phoneCol] || '').trim() : '';

                  return (
                    <tr
                      key={item._rowKey}
                      onClick={() => setSelectedInstructor(item)}
                      className={`cursor-pointer transition-colors ${
                        idx % 2 === 0
                          ? 'bg-white dark:bg-[#0F172A] hover:bg-emerald-50/40 dark:hover:bg-emerald-950/30'
                          : 'bg-[#FAFAFA] dark:bg-slate-900/50 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/30'
                      }`}
                    >
                      <td className="py-3.5 px-4 text-center text-[#64748B] dark:text-slate-400 font-semibold">
                        <span className="inline-block min-w-6 px-1.5 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-[#475569] dark:text-slate-300 leading-6 text-[11px]">
                          {rowNum}
                        </span>
                      </td>

                      {dataset.columns.map((col) => {
                        const val = item.fields[col];
                        const empty = isCellEmpty(val);
                        const isName = cols.nameCol === col;
                        const isId = cols.idCol === col;
                        const isPhone = cols.phoneCol === col;
                        const isBranch = cols.branchCol === col;
                        const isNationality = cols.nationalityCol === col;

                        return (
                          <td key={col} className="py-3.5 px-4 whitespace-nowrap">
                            {empty ? (
                              <span className="text-[#94A3B8] dark:text-slate-500 italic">
                                Not Available
                              </span>
                            ) : isName ? (
                              <span className="font-extrabold text-[#006B45] dark:text-emerald-300 hover:underline text-xs sm:text-sm">
                                {val}
                              </span>
                            ) : isId ? (
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[#0F172A] dark:text-slate-100 font-mono font-bold text-xs">
                                {val}
                              </span>
                            ) : isPhone ? (
                              <span className="font-mono font-semibold text-[#0F172A] dark:text-slate-200 flex items-center gap-1.5">
                                <Phone className="w-3.5 h-3.5 text-[#006B45] dark:text-emerald-400 shrink-0" />
                                <span>{val}</span>
                              </span>
                            ) : isBranch ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#F0FDF4] dark:bg-emerald-950/60 text-[#064E3B] dark:text-emerald-300 border border-[#D1FAE5] dark:border-emerald-800/70 font-semibold text-xs">
                                <Building2 className="w-3 h-3 text-[#006B45] dark:text-emerald-400 shrink-0" />
                                <span>{val}</span>
                              </span>
                            ) : isNationality ? (
                              <span className="inline-flex items-center gap-1.5 text-[#334155] dark:text-slate-300 font-medium">
                                <Globe className="w-3.5 h-3.5 text-[#64748B] dark:text-slate-400 shrink-0" />
                                <span>{val}</span>
                              </span>
                            ) : (
                              <span className="text-[#0F172A] dark:text-slate-200 font-medium">
                                {val}
                              </span>
                            )}
                          </td>
                        );
                      })}

                      {/* Quick Actions */}
                      <td
                        className="py-3.5 px-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {phoneVal && (
                            <button
                              type="button"
                              onClick={() =>
                                handleCopyText(
                                  phoneVal,
                                  `row-phone-${item._rowKey}`,
                                  `Copied phone: ${phoneVal}`
                                )
                              }
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#F8FAFC] dark:bg-slate-800 hover:bg-[#F0FDF4] dark:hover:bg-emerald-950/60 text-[#0F172A] dark:text-slate-200 hover:text-[#006B45] dark:hover:text-emerald-300 border border-[#CBD5E1] dark:border-slate-700 hover:border-[#006B45] text-[11px] font-semibold transition-colors"
                              title="Copy Phone Number"
                            >
                              {copiedKey === `row-phone-${item._rowKey}` ? (
                                <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <Phone className="w-3 h-3 text-[#006B45] dark:text-emerald-400" />
                              )}
                              <span className="hidden xl:inline">Phone</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              handleCopyText(
                                buildInstructorCopyText(item),
                                `row-info-${item._rowKey}`,
                                `Copied instructor information`
                              )
                            }
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#F8FAFC] dark:bg-slate-800 hover:bg-[#F0FDF4] dark:hover:bg-emerald-950/60 text-[#0F172A] dark:text-slate-200 hover:text-[#006B45] dark:hover:text-emerald-300 border border-[#CBD5E1] dark:border-slate-700 hover:border-[#006B45] text-[11px] font-semibold transition-colors"
                            title="Copy Instructor Information"
                          >
                            {copiedKey === `row-info-${item._rowKey}` ? (
                              <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3 text-[#006B45] dark:text-emerald-400" />
                            )}
                            <span className="hidden xl:inline">Copy</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => requestOpenEditModal(item)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#F8FAFC] dark:bg-slate-800 hover:bg-[#F0FDF4] dark:hover:bg-emerald-950/60 text-[#0F172A] dark:text-slate-200 hover:text-[#006B45] dark:hover:text-emerald-300 border border-[#CBD5E1] dark:border-slate-700 hover:border-[#006B45] text-[11px] font-semibold transition-colors"
                            title="Edit Instructor"
                          >
                            <Pencil className="w-3 h-3 text-[#006B45] dark:text-emerald-400" />
                            <span className="hidden xl:inline">Edit</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => requestDeleteRecord(item)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/70 text-[11px] font-semibold transition-colors"
                            title="Delete Instructor"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span className="hidden xl:inline">Delete</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedInstructor(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#006B45] hover:bg-[#064E3B] text-white text-[11px] font-semibold transition-colors"
                            title="View Instructor Details"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Details</span>
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
          <div className="p-4 bg-[#F8FAFC] dark:bg-slate-900 border-t border-[#E2E8F0] dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#64748B] dark:text-slate-400">
            <div className="flex flex-wrap items-center gap-3">
              <span>
                Showing <strong className="text-[#0F172A] dark:text-slate-100">{startIdx}–{endIdx}</strong> of{' '}
                <strong className="text-[#0F172A] dark:text-slate-100">{sortedRecords.length}</strong> matching instructors
              </span>
              <div className="flex items-center gap-1.5">
                <span>Rows:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 rounded-lg text-xs font-semibold text-[#0F172A] dark:text-slate-100"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 text-[#0F172A] dark:text-slate-100 font-semibold disabled:opacity-40 hover:border-[#006B45]"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Prev</span>
                </button>

                <span className="px-2.5 font-semibold text-[#0F172A] dark:text-slate-100">
                  Page {safePage} of {totalPages}
                </span>

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 text-[#0F172A] dark:text-slate-100 font-semibold disabled:opacity-40 hover:border-[#006B45]"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
