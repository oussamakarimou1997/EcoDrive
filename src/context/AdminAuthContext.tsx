import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  AlertCircle,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  AdminAuthError,
  fetchAdminAuthStatus,
  lockAdminSessionOnServer,
  verifyAdminAccessCode,
} from '../services/adminAuthService';

export type ToastVariant = 'success' | 'error' | 'info';

interface AdminSessionState {
  token: string;
  expiresAtMs: number;
}

interface AdminAuthContextValue {
  isAuthorized: boolean;
  configured: boolean;
  managedByEnv: boolean;
  isStatusLoaded: boolean;
  getValidToken: () => string | null;
  requireAdminAuthorization: (
    actionLabel: string,
    onAuthorized: (token: string) => void
  ) => void;
  openChangeCodeModal: () => void;
  lockSession: () => Promise<void>;
  handleAuthFailure: (actionLabel: string, onReauthorized: (token: string) => void) => void;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

interface AdminAuthProviderProps {
  children: React.ReactNode;
  onShowToast?: (message: string, variant?: ToastVariant) => void;
}

export const AdminAuthProvider: React.FC<AdminAuthProviderProps> = ({
  children,
  onShowToast,
}) => {
  // Strictly in-memory session state (NEVER stored in localStorage / sessionStorage)
  const [session, setSession] = useState<AdminSessionState | null>(null);
  const sessionRef = useRef<AdminSessionState | null>(null);

  const [configured, setConfigured] = useState<boolean>(true);
  const [managedByEnv, setManagedByEnv] = useState<boolean>(true);
  const [isStatusLoaded, setIsStatusLoaded] = useState<boolean>(false);

  // Security verification / setup modal state
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [pendingActionLabel, setPendingActionLabel] = useState<string>('Protected Operation');
  const pendingCallbackRef = useRef<((token: string) => void) | null>(null);

  const [accessCodeInput, setAccessCodeInput] = useState<string>('');
  const [showAccessCode, setShowAccessCode] = useState<boolean>(false);
  const [authModalError, setAuthModalError] = useState<string | null>(null);
  const [isVerifyingCode, setIsVerifyingCode] = useState<boolean>(false);
  const verifySubmitLockRef = useRef<boolean>(false);

  const notify = useCallback(
    (message: string, variant: ToastVariant = 'info') => {
      if (onShowToast) {
        onShowToast(message, variant);
      }
    },
    [onShowToast]
  );

  const updateSession = useCallback((next: AdminSessionState | null) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  const refreshStatus = useCallback(async (token?: string | null) => {
    try {
      const status = await fetchAdminAuthStatus(token);
      setConfigured(status.configured);
      setManagedByEnv(status.managedByEnv);
      if (token && !status.authorized) {
        updateSession(null);
      }
      setIsStatusLoaded(true);
      return status;
    } catch {
      setIsStatusLoaded(true);
      return null;
    }
  }, [updateSession]);

  useEffect(() => {
    void refreshStatus(null);
  }, [refreshStatus]);

  // Auto-expire in-memory session when TTL elapses
  useEffect(() => {
    if (!session) return;
    const remainingMs = session.expiresAtMs - Date.now();
    if (remainingMs <= 0) {
      updateSession(null);
      return;
    }
    const timer = window.setTimeout(() => {
      updateSession(null);
    }, remainingMs);
    return () => window.clearTimeout(timer);
  }, [session, updateSession]);

  const getValidToken = useCallback((): string | null => {
    const active = sessionRef.current;
    if (!active) return null;
    if (active.expiresAtMs <= Date.now()) {
      updateSession(null);
      return null;
    }
    return active.token;
  }, [updateSession]);

  const isAuthorized = Boolean(session && session.expiresAtMs > Date.now());

  const resetAuthModalFields = () => {
    setAccessCodeInput('');
    setShowAccessCode(false);
    setAuthModalError(null);
  };

  const openAuthModal = useCallback(
    (actionLabel: string, callback: (token: string) => void) => {
      pendingCallbackRef.current = callback;
      setPendingActionLabel(actionLabel);
      resetAuthModalFields();
      setAuthModalOpen(true);
      void refreshStatus(null);
    },
    [refreshStatus]
  );

  const closeAuthModal = useCallback(() => {
    if (isVerifyingCode) return;
    setAuthModalOpen(false);
    pendingCallbackRef.current = null;
    resetAuthModalFields();
  }, [isVerifyingCode]);

  const requireAdminAuthorization = useCallback(
    (actionLabel: string, onAuthorized: (token: string) => void) => {
      const validToken = getValidToken();
      if (validToken) {
        onAuthorized(validToken);
        return;
      }
      openAuthModal(actionLabel, onAuthorized);
    },
    [getValidToken, openAuthModal]
  );

  const handleAuthFailure = useCallback(
    (actionLabel: string, onReauthorized: (token: string) => void) => {
      updateSession(null);
      notify('Access denied. Your admin authorization expired or is invalid.', 'error');
      openAuthModal(actionLabel, onReauthorized);
    },
    [updateSession, notify, openAuthModal]
  );

  const lockSession = useCallback(async () => {
    const token = sessionRef.current?.token ?? null;
    updateSession(null);
    await lockAdminSessionOnServer(token);
    notify('Admin access locked for this session.', 'info');
  }, [updateSession, notify]);

  const openChangeCodeModal = useCallback(() => {
    notify('Access code changes are managed by the owner.', 'info');
  }, [notify]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verifySubmitLockRef.current || isVerifyingCode) return;

    const code = accessCodeInput.trim();
    if (!code) {
      setAuthModalError('Please enter the Admin Access Code.');
      return;
    }

    if (!configured) {
      setAuthModalError('Admin access is unavailable. Contact the owner.');
      return;
    }

    verifySubmitLockRef.current = true;
    setIsVerifyingCode(true);
    setAuthModalError(null);

    try {
      const payload = await verifyAdminAccessCode(code);

      const expiresAtMs = Date.parse(payload.expiresAt) || Date.now() + 10 * 60 * 1000;
      updateSession({ token: payload.token, expiresAtMs });
      setConfigured(true);

      const cb = pendingCallbackRef.current;
      pendingCallbackRef.current = null;
      setAuthModalOpen(false);
      resetAuthModalFields();

      if (cb) {
        cb(payload.token);
      }
    } catch (err) {
      const msg =
        err instanceof AdminAuthError
          ? err.message
          : 'Access denied. Invalid Admin Access Code.';
      setAuthModalError(msg);
      if (err instanceof AdminAuthError && err.status === 401) {
        notify('Access denied. Invalid Admin Access Code.', 'error');
      } else {
        notify(msg, 'error');
      }
      if (err instanceof AdminAuthError && err.status === 409) {
        setConfigured(true);
      }
    } finally {
      verifySubmitLockRef.current = false;
      setIsVerifyingCode(false);
    }
  };

  useEffect(() => {
    if (!authModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isVerifyingCode) closeAuthModal();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [authModalOpen, isVerifyingCode, closeAuthModal]);

  return (
    <AdminAuthContext.Provider
      value={{
        isAuthorized,
        configured,
        managedByEnv,
        isStatusLoaded,
        getValidToken,
        requireAdminAuthorization,
        openChangeCodeModal,
        lockSession,
        handleAuthFailure,
      }}
    >
      {children}

      {/* Admin Access Code Security Modal */}
      {authModalOpen && (
        <div
          className="fixed inset-0 z-[70] bg-slate-900/65 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-auth-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isVerifyingCode) {
              closeAuthModal();
            }
          }}
        >
          <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-[#E2E8F0] dark:border-slate-700 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-[#064E3B] dark:bg-[#043427] text-white px-5 py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
                  <Lock className="w-4 h-4 text-emerald-300" />
                </div>
                <div>
                  <h3 id="admin-auth-modal-title" className="text-sm sm:text-base font-extrabold">
                    Admin Authorization Required
                  </h3>
                  <p className="text-[11px] text-emerald-100/80">
                    {pendingActionLabel}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeAuthModal}
                disabled={isVerifyingCode}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                aria-label="Close security modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="p-5 space-y-4">
              <div className="p-3 rounded-xl bg-[#F0FDF4] dark:bg-emerald-950/40 border border-[#D1FAE5] dark:border-emerald-800/70 text-xs text-[#064E3B] dark:text-emerald-200 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-[#006B45] dark:text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  {configured
                    ? 'Enter your access code to continue. Authorization lasts 10 minutes.'
                    : 'Admin access is unavailable. Contact the owner.'}
                </span>
              </div>

              {authModalError && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-semibold flex items-start gap-2"
                >
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <span>{authModalError}</span>
                </div>
              )}

              <div>
                <label
                  htmlFor="admin-access-code-input"
                  className="block text-xs font-bold text-[#0F172A] dark:text-slate-200 mb-1.5"
                >
                  Access Code
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <KeyRound className="w-4 h-4 text-[#006B45] dark:text-emerald-400" />
                  </div>
                  <input
                    id="admin-access-code-input"
                    type={showAccessCode ? 'text' : 'password'}
                    autoFocus
                    autoComplete="off"
                    value={accessCodeInput}
                    onChange={(e) => {
                      setAccessCodeInput(e.target.value);
                      if (authModalError) setAuthModalError(null);
                    }}
                    placeholder="Enter access code"
                    className="w-full pl-10 pr-10 py-2.5 text-sm bg-[#F8FAFC] dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded-xl text-[#0F172A] dark:text-slate-100 placeholder-[#94A3B8] dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006B45] focus:border-[#006B45] font-mono tracking-wider"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAccessCode((prev) => !prev)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#64748B] hover:text-[#0F172A] dark:text-slate-400 dark:hover:text-slate-100"
                    aria-label={showAccessCode ? 'Hide access code' : 'Show access code'}
                  >
                    {showAccessCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-[#E2E8F0] dark:border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={closeAuthModal}
                  disabled={isVerifyingCode}
                  className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 text-[#475569] dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingCode || !configured}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#006B45] hover:bg-[#064E3B] disabled:opacity-60 text-white text-xs font-bold shadow-xs transition-colors"
                >
                  {isVerifyingCode ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                  )}
                  <span>
                    {isVerifyingCode ? 'Verifying...' : 'Verify & Continue'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </AdminAuthContext.Provider>
  );
};

export function useAdminAuth(): AdminAuthContextValue {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return ctx;
}
