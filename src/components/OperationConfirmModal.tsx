import React, { useEffect } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Pencil,
  PlusCircle,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';

export type OperationConfirmType = 'add' | 'update' | 'delete';

interface OperationConfirmModalProps {
  isOpen: boolean;
  operationType: OperationConfirmType;
  entityLabel: string;
  recordName: string;
  recordDetails?: string[];
  actionDescription?: string;
  isSubmitting: boolean;
  errorMessage?: string | null;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
}

const CONFIRM_MESSAGES: Record<OperationConfirmType, string> = {
  add: 'Are you sure you want to add this new record?',
  update: 'Are you sure you want to update this record? The existing information will be modified.',
  delete: 'Are you sure you want to permanently delete this record? This action may not be reversible.',
};

export const OperationConfirmModal: React.FC<OperationConfirmModalProps> = ({
  isOpen,
  operationType,
  entityLabel,
  recordName,
  recordDetails = [],
  actionDescription,
  isSubmitting,
  errorMessage,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onCancel]);

  if (!isOpen) return null;

  const isDelete = operationType === 'delete';
  const isUpdate = operationType === 'update';

  const title =
    operationType === 'add'
      ? `Confirm Add ${entityLabel}`
      : operationType === 'update'
      ? `Confirm Update ${entityLabel}`
      : `Confirm Delete ${entityLabel}`;

  const confirmLabel =
    operationType === 'add'
      ? `Confirm Add`
      : operationType === 'update'
      ? `Confirm Update`
      : `Confirm Delete`;

  const submittingLabel =
    operationType === 'add'
      ? 'Adding...'
      : operationType === 'update'
      ? 'Updating...'
      : 'Deleting...';

  return (
    <div
      className="fixed inset-0 z-[60] bg-slate-900/65 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="operation-confirm-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onCancel();
        }
      }}
    >
      <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-[#E2E8F0] dark:border-slate-700 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Top Accent Header */}
        <div
          className={`px-5 py-4 flex items-center justify-between gap-3 border-b ${
            isDelete
              ? 'bg-rose-600 dark:bg-rose-950/90 text-white border-rose-500/40 dark:border-rose-800/70'
              : isUpdate
              ? 'bg-amber-600 dark:bg-amber-950/90 text-white border-amber-500/40 dark:border-amber-800/70'
              : 'bg-[#064E3B] dark:bg-[#043427] text-white border-[#004d32] dark:border-emerald-900/60'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
              {isDelete ? (
                <Trash2 className="w-4 h-4 text-white" />
              ) : isUpdate ? (
                <Pencil className="w-4 h-4 text-white" />
              ) : (
                <PlusCircle className="w-4 h-4 text-emerald-200" />
              )}
            </div>
            <div>
              <h3 id="operation-confirm-title" className="text-sm sm:text-base font-extrabold">
                {title}
              </h3>
              <p className="text-[11px] text-white/80">
                Verification required before saving changes
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white transition-colors"
            aria-label="Cancel confirmation"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                isDelete
                  ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400'
                  : isUpdate
                  ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400'
                  : 'bg-[#F0FDF4] dark:bg-emerald-950/60 border-[#D1FAE5] dark:border-emerald-800 text-[#006B45] dark:text-emerald-400'
              }`}
            >
              {isDelete ? (
                <ShieldAlert className="w-5 h-5" />
              ) : isUpdate ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-[#0F172A] dark:text-slate-100 leading-snug">
                {CONFIRM_MESSAGES[operationType]}
              </p>
              {actionDescription && (
                <p className="text-xs text-[#64748B] dark:text-slate-400 leading-relaxed">
                  {actionDescription}
                </p>
              )}
            </div>
          </div>

          {/* Target Record Summary Box */}
          <div className="bg-[#F8FAFC] dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800 rounded-xl p-3.5 space-y-1.5">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
              Target {entityLabel}
            </span>
            <div className="text-sm font-extrabold text-[#0F172A] dark:text-slate-100 break-words">
              {recordName || `New ${entityLabel}`}
            </div>
            {recordDetails.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#64748B] dark:text-slate-400 pt-0.5">
                {recordDetails.map((detail, index) => (
                  <span key={index} className="break-words">
                    {detail}
                  </span>
                ))}
              </div>
            )}
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-medium"
            >
              {errorMessage}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-[#F8FAFC] dark:bg-slate-900/80 border-t border-[#E2E8F0] dark:border-slate-800 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 text-[#475569] dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 text-xs font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={isSubmitting}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl disabled:opacity-60 text-white text-xs font-bold shadow-xs transition-colors ${
              isDelete
                ? 'bg-rose-600 hover:bg-rose-700'
                : isUpdate
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-[#006B45] hover:bg-[#064E3B]'
            }`}
          >
            {isSubmitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : isDelete ? (
              <Trash2 className="w-3.5 h-3.5" />
            ) : isUpdate ? (
              <Pencil className="w-3.5 h-3.5" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
            )}
            <span>{isSubmitting ? submittingLabel : confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
