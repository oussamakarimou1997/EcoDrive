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
  CheckCircle2,
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
  changeAdminCode,
  fetchAdminAuthStatus,
  lockAdminSessionOnServer,
  setupInitialAdminCode,
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
  const [managedByEnv, setManagedByEnv] = useState<boolean>(false);
  const [isStatusLoaded, setIsStatusLoaded] = useState<boolean>(false);

  // Security verification / setup modal state
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [pendingActionLabel, setPendingActionLabel] = useState<string>('Protected Operation');
  const pendingCallbackRef = useRef<((token: string) => void) | null>(null);

  const [accessCodeInput, setAccessCodeInput] = useState<string>('');
  const [confirmAccessCodeInput, setConfirmAccessCodeInput] = useState<string>('');
  const [showAccessCode, setShowAccessCode] = useState<boolean>(false);
  const [authModalError, setAuthModalError] = useState<string | null>(null);
  const [isVerifyingCode, setIsVerifyingCode] = useState<boolean>(false);
  const verifySubmitLockRef = useRef<boolean>(false);

  // Change Access Code modal state
  const [changeModalOpen, setChangeModalOpen] = useState<boolean>(false);
  const [currentCodeInput, setCurrentCodeInput] = useState<string>('');
  const [newCodeInput, setNewCodeInput] = useState<string>('');
  const [confirmNewCodeInput, setConfirmNewCodeInput] = useState<string>('');
  const [showChangeCodes, setShowChangeCodes] = useState<boolean>(false);
  const [changeModalError, setChangeModalError] = useState<string | null>(null);
  const [isChangingCode, setIsChangingCode] = useState<boolean>(false);
  const changeSubmitLockRef = useRef<boolean>(false);

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
    setConfirmAccessCodeInput('');
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

  const resetChangeCodeFields = () => {
    setCurrentCodeInput('');
    setNewCodeInput('');
    setConfirmNewCodeInput('');
    setShowChangeCodes(false);
    setChangeModalError(null);
  };

  const openChangeCodeModal = useCallback(() => {
    resetChangeCodeFields();
    setChangeModalOpen(true);
    void refreshStatus(sessionRef.current?.token ?? null);
  }, [refreshStatus]);

  const closeChangeCodeModal = useCallback(() => {
    if (isChangingCode) return;
    setChangeModalOpen(false);
    resetChangeCodeFields();
  }, [isChangingCode]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verifySubmitLockRef.current || isVerifyingCode) return;

    const code = accessCodeInput.trim();
    if (!code) {
      setAuthModalError('Please enter the Admin Access Code.');
      return;
    }

    if (!configured) {
      if (code.length < 4 || code.length > 64) {
        setAuthModalError('Admin Access Code must be between 4 and 64 characters.');
        return;
      }
      if (code !== confirmAccessCodeInput.trim()) {
        setAuthModalError('Access codes do not match.');
        return;
      }
    }

    verifySubmitLockRef.current = true;
    setIsVerifyingCode(true);
    setAuthModalError(null);

    try {
      const payload = configured
        ? await verifyAdminAccessCode(code)
        : await setupInitialAdminCode(code);

      const expiresAtMs = Date.parse(payload.expiresAt) || Date.now() + 10 * 60 * 1000;
      updateSession({ token: payload.token, expiresAtMs });
      setConfigured(true);

      const cb = pendingCallbackRef.current;
      pendingCallbackRef.current = null;
      setAuthModalOpen(false);
      resetAuthModalFields();

      if (!configured) {
        notify('Admin Access Code configured. Temporary authorization granted.', 'success');
      }

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

  const handleChangeCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (changeSubmitLockRef.current || isChangingCode) return;

    const currentCode = currentCodeInput.trim();
    const newCode = newCodeInput.trim();
    const confirmNew = confirmNewCodeInput.trim();

    if (!currentCode) {
      setChangeModalError('Please enter your current Admin Access Code.');
      return;
    }
    if (newCode.length < 4 || newCode.length > 64) {
      setChangeModalError('New Admin Access Code must be between 4 and 64 characters.');
      return;
    }
    if (newCode !== confirmNew) {
      setChangeModalError('New access code and confirmation do not match.');
      return;
    }
    if (newCode === currentCode) {
      setChangeModalError('New Admin Access Code must be different from the current code.');
      return;
    }

    changeSubmitLockRef.current = true;
    setIsChangingCode(true);
    setChangeModalError(null);

    try {
      // Ensure we hold a valid session token first by verifying the current access code
      let token = getValidToken();
      if (!token) {
        const verified = await verifyAdminAccessCode(currentCode);
        token = verified.token;
      }

      const updatedSession = await changeAdminCode(token, currentCode, newCode);
      const expiresAtMs = Date.parse(updatedSession.expiresAt) || Date.now() + 10 * 60 * 1000;
      updateSession({ token: updatedSession.token, expiresAtMs });
      setConfigured(true);
      setChangeModalOpen(false);
      resetChangeCodeFields();
      notify('Admin Access Code updated successfully!', 'success');
    } catch (err) {
      const msg =
        err instanceof AdminAuthError
          ? err.message
          : 'Failed to update Admin Access Code.';
      setChangeModalError(msg);
      if (err instanceof AdminAuthError && err.status === 401) {
        notify('Access denied. Invalid Admin Access Code.', 'error');
      } else {
        notify(msg, 'error');
      }
    } finally {
      changeSubmitLockRef.current = false;
      setIsChangingCode(false);
    }
  };

  // ESC support for both modals
  useEffect(() => {
    if (!authModalOpen && !changeModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (changeModalOpen && !isChangingCode) {
          closeChangeCodeModal();
        } else if (authModalOpen && !isVerifyingCode) {
          closeAuthModal();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    authModalOpen,
    changeModalOpen,
    isVerifyingCode,
    isChangingCode,
    closeAuthModal,
    closeChangeCodeModal,
  ]);

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
                    {configured ? 'Admin Authorization Required' : 'Set Up Admin Access Code'}
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
                    ? 'Enter the Admin Access Code to authorize this modification. Authorization stays active temporarily during your current work session.'
                    : 'No Admin Access Code has been configured yet. Create a secure Admin Access Code (4–64 characters) to protect Add, Update, and Delete actions.'}
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
                  {configured ? 'Admin Access Code (PIN)' : 'Create Admin Access Code'}
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
                    placeholder={configured ? 'Enter Admin Access Code...' : 'Minimum 4 characters...'}
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

              {!configured && (
                <div>
                  <label
                    htmlFor="admin-access-code-confirm"
                    className="block text-xs font-bold text-[#0F172A] dark:text-slate-200 mb-1.5"
                  >
                    Confirm Admin Access Code
                  </label>
                  <input
                    id="admin-access-code-confirm"
                    type={showAccessCode ? 'text' : 'password'}
                    autoComplete="off"
                    value={confirmAccessCodeInput}
                    onChange={(e) => {
                      setConfirmAccessCodeInput(e.target.value);
                      if (authModalError) setAuthModalError(null);
                    }}
                    placeholder="Re-enter Admin Access Code..."
                    className="w-full px-3.5 py-2.5 text-sm bg-[#F8FAFC] dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded-xl text-[#0F172A] dark:text-slate-100 placeholder-[#94A3B8] dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006B45] focus:border-[#006B45] font-mono tracking-wider"
                  />
                </div>
              )}

              {configured && !managedByEnv && (
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      closeAuthModal();
                      openChangeCodeModal();
                    }}
                    className="text-xs font-semibold text-[#006B45] dark:text-emerald-400 hover:underline"
                  >
                    Need to change the Admin Access Code?
                  </button>
                </div>
              )}

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
                  disabled={isVerifyingCode}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#006B45] hover:bg-[#064E3B] disabled:opacity-60 text-white text-xs font-bold shadow-xs transition-colors"
                >
                  {isVerifyingCode ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                  )}
                  <span>
                    {isVerifyingCode
                      ? 'Verifying...'
                      : configured
                      ? 'Verify & Continue'
                      : 'Save Code & Continue'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Admin Access Code Modal */}
      {changeModalOpen && (
        <div
          className="fixed inset-0 z-[75] bg-slate-900/65 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="change-admin-code-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isChangingCode) {
              closeChangeCodeModal();
            }
          }}
        >
          <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-[#E2E8F0] dark:border-slate-700 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-[#064E3B] dark:bg-[#043427] text-white px-5 py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
                  <KeyRound className="w-4 h-4 text-emerald-300" />
                </div>
                <div>
                  <h3 id="change-admin-code-title" className="text-sm sm:text-base font-extrabold">
                    Change Admin Access Code
                  </h3>
                  <p className="text-[11px] text-emerald-100/80">
                    Update administrator authorization PIN
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeChangeCodeModal}
                disabled={isChangingCode}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                aria-label="Close change code modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {managedByEnv ? (
              <div className="p-5 space-y-4">
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block mb-1">Managed by Environment Variable</span>
                    <span>
                      The Admin Access Code is currently configured via the server{' '}
                      <code className="font-mono font-semibold">ADMIN_ACCESS_CODE</code> environment
                      secret. Update it in your environment configuration to change the code.
                    </span>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={closeChangeCodeModal}
                    className="px-4 py-2 rounded-xl bg-[#006B45] text-white text-xs font-bold hover:bg-[#064E3B]"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : !configured ? (
              <div className="p-5 space-y-4">
                <div className="p-3.5 rounded-xl bg-[#F0FDF4] dark:bg-emerald-950/40 border border-[#D1FAE5] dark:border-emerald-800 text-xs text-[#064E3B] dark:text-emerald-200">
                  No Admin Access Code has been set up yet. Click below to create the initial code.
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeChangeCodeModal}
                    className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 text-xs font-semibold text-[#475569] dark:text-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      closeChangeCodeModal();
                      openAuthModal('Initial Admin Access Code Setup', () => {});
                    }}
                    className="px-4 py-2 rounded-xl bg-[#006B45] text-white text-xs font-bold hover:bg-[#064E3B]"
                  >
                    Set Up Access Code
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleChangeCodeSubmit} className="p-5 space-y-4">
                {changeModalError && (
                  <div
                    role="alert"
                    className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-semibold flex items-start gap-2"
                  >
                    <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    <span>{changeModalError}</span>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="current-admin-code"
                    className="block text-xs font-bold text-[#0F172A] dark:text-slate-200 mb-1.5"
                  >
                    Current Admin Access Code
                  </label>
                  <input
                    id="current-admin-code"
                    type={showChangeCodes ? 'text' : 'password'}
                    autoFocus
                    autoComplete="off"
                    value={currentCodeInput}
                    onChange={(e) => {
                      setCurrentCodeInput(e.target.value);
                      if (changeModalError) setChangeModalError(null);
                    }}
                    placeholder="Enter current code..."
                    className="w-full px-3.5 py-2.5 text-sm bg-[#F8FAFC] dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded-xl text-[#0F172A] dark:text-slate-100 placeholder-[#94A3B8] dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006B45] font-mono"
                  />
                </div>

                <div>
                  <label
                    htmlFor="new-admin-code"
                    className="block text-xs font-bold text-[#0F172A] dark:text-slate-200 mb-1.5"
                  >
                    New Admin Access Code
                  </label>
                  <input
                    id="new-admin-code"
                    type={showChangeCodes ? 'text' : 'password'}
                    autoComplete="off"
                    value={newCodeInput}
                    onChange={(e) => {
                      setNewCodeInput(e.target.value);
                      if (changeModalError) setChangeModalError(null);
                    }}
                    placeholder="Minimum 4 characters..."
                    className="w-full px-3.5 py-2.5 text-sm bg-[#F8FAFC] dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded-xl text-[#0F172A] dark:text-slate-100 placeholder-[#94A3B8] dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006B45] font-mono"
                  />
                </div>

                <div>
                  <label
                    htmlFor="confirm-new-admin-code"
                    className="block text-xs font-bold text-[#0F172A] dark:text-slate-200 mb-1.5"
                  >
                    Confirm New Admin Access Code
                  </label>
                  <input
                    id="confirm-new-admin-code"
                    type={showChangeCodes ? 'text' : 'password'}
                    autoComplete="off"
                    value={confirmNewCodeInput}
                    onChange={(e) => {
                      setConfirmNewCodeInput(e.target.value);
                      if (changeModalError) setChangeModalError(null);
                    }}
                    placeholder="Re-enter new code..."
                    className="w-full px-3.5 py-2.5 text-sm bg-[#F8FAFC] dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded-xl text-[#0F172A] dark:text-slate-100 placeholder-[#94A3B8] dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006B45] font-mono"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setShowChangeCodes((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-slate-200"
                  >
                    {showChangeCodes ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                    <span>{showChangeCodes ? 'Hide codes' : 'Show codes'}</span>
                  </button>
                </div>

                <div className="pt-2 border-t border-[#E2E8F0] dark:border-slate-800 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={closeChangeCodeModal}
                    disabled={isChangingCode}
                    className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 text-[#475569] dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isChangingCode}
                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#006B45] hover:bg-[#064E3B] disabled:opacity-60 text-white text-xs font-bold shadow-xs transition-colors"
                  >
                    {isChangingCode ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                    )}
                    <span>{isChangingCode ? 'Updating...' : 'Update Access Code'}</span>
                  </button>
                </div>
              </form>
            )}
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
