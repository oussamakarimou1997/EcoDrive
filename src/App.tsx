import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Header, ActiveTab } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { SearchByFilter } from './components/SearchByFilter';
import { TransportationPage } from './components/TransportationPage';
import { AISmartTransportFinderPage } from './components/AISmartTransportFinderPage';
import { BranchLocationPage } from './components/BranchLocationPage';
import { BranchInformationPage } from './components/BranchInformationPage';
import { InstructorsPage } from './components/InstructorsPage';
import {
  RawMatrixRow,
  DataSourceState,
} from './types/pricing';
import { loadSavedMatrix } from './services/sheetsService';
import { normalizeMatrix } from './data/defaultPriceData';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { ThemeProvider } from './context/ThemeContext';
import { AdminAuthProvider, ToastVariant } from './context/AdminAuthContext';

export default function App() {
  // Load initial matrix & metadata
  const initialData = useMemo(() => loadSavedMatrix(), []);
  const [matrix] = useState<RawMatrixRow[]>(initialData.matrix);

  // Compute normalized records whenever matrix changes
  const records = useMemo(() => normalizeMatrix(matrix), [matrix]);

  // Navigation tab state (filter | transport | ai-transport-finder | branches | branch-info | instructors)
  const [activeTab, setActiveTab] = useState<ActiveTab>('filter');

  // Google Maps Platform Demo Key quota banner state
  const [gmpQuotaExceeded, setGmpQuotaExceeded] = useState(false);

  useEffect(() => {
    const handleQuotaExceeded = () => setGmpQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
  }, []);

  // Notification toast state
  const [toast, setToast] = useState<{ message: string; variant: ToastVariant } | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((msg: string, variant: ToastVariant = 'success') => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast({ message: msg, variant });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 3200);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // Data source metrics
  const dataSource: DataSourceState = useMemo(() => {
    const totalCombinations = records.length;
    const availablePrices = records.filter((r) => r.price !== null).length;
    return {
      type: initialData.meta.sourceType,
      sourceName: initialData.meta.sourceName,
      lastSyncTimestamp: initialData.meta.lastSyncTimestamp,
      googleSheetUrl: initialData.meta.googleSheetUrl,
      totalServicesCount: matrix.length,
      totalPricePointsCount: totalCombinations,
      availablePricesCount: availablePrices,
    };
  }, [matrix, records, initialData]);

  // Dynamic header titles based on active tab
  const tabDetails = useMemo(() => {
    switch (activeTab) {
      case 'transport':
        return {
          title: 'Transportation Schedule',
          description: 'Official bus routes, student pickup points, GPS map pins, and timetables for Al Quoz and DIC centres.',
        };
      case 'ai-transport-finder':
        return {
          title: 'AI Smart Transportation Finder',
          description: 'Locate your nearest official Eco Drive bus pickup station anywhere in Dubai, inspect walking distances, and track the next live departure.',
        };
      case 'branches':
        return {
          title: 'Branch and Location',
          description: 'Official Eco Drive branch network across Dubai, traffic zone conditions, road training restrictions, and live availability.',
        };
      case 'branch-info':
        return {
          title: 'Branch Information',
          description: 'Search, filter, and manage official Eco Drive registration offices, contact numbers, and locations.',
        };
      case 'instructors':
        return {
          title: 'Instructors',
          description: 'Search, filter, and manage Eco Drive driving instructors directly from the imported Excel directory.',
        };
      case 'filter':
      default:
        return {
          title: 'Search by Filter',
          description: 'Multi-criteria tariff lookup combining Category, Fee Type, specific Service, and AED Price Range.',
        };
    }
  }, [activeTab]);

  return (
    <ThemeProvider>
      <AdminAuthProvider onShowToast={showToast}>
        <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#090D16] flex text-[#0F172A] dark:text-slate-100 transition-colors duration-200">
          {/* 1. Desktop Royal Green Sidebar Navigation */}
          <Sidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            dataSource={dataSource}
          />

          {/* 2. Main Content Viewport */}
          <div className="flex-1 flex flex-col min-w-0">
            {gmpQuotaExceeded && (
              <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
                <span>
                  Google Maps Platform quota reached. If you are the app owner, visit{' '}
                  <a
                    href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-semibold text-amber-950 hover:text-amber-800"
                  >
                    maps developer site
                  </a>{' '}
                  for instructions to update your account.
                </span>
              </div>
            )}

            {/* Top Header */}
            <Header
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              dataSource={dataSource}
            />

            {/* Hero Banner Strip (Royal Green & Dark Forest with Official Eco Drive Logo) */}
            <div className="bg-[#064E3B] dark:bg-[#043427] text-white border-b border-[#004d32] dark:border-emerald-900/60 transition-colors duration-200">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start sm:items-center gap-4">
                    <div className="hidden sm:flex items-center justify-center p-2 rounded-xl bg-black/20 border border-white/10 shrink-0">
                      <img
                        src="/assets/eco-drive-logo-white.png"
                        alt="Eco Drive Driving institute"
                        className="h-10 w-auto object-contain"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src =
                            "https://www.ecodrivedubai.com/wp-content/uploads/2026/01/eco-drive-logo_White-01-768x313.png";
                        }}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-xs text-emerald-300 font-semibold tracking-wider">
                        <span>Eco Drive Driving institute</span>
                        <span>·</span>
                        <span>Dubai, UAE</span>
                      </div>
                      <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight mt-1">
                        {tabDetails.title}
                      </h1>
                      <p className="text-xs sm:text-sm text-emerald-100/80 mt-1 max-w-2xl">
                        {tabDetails.description}
                      </p>
                    </div>
                  </div>

                  {/* Status Pill */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="bg-[#004d32]/80 backdrop-blur-xs px-3.5 py-2 rounded-xl text-xs text-emerald-100 flex items-center gap-2 border border-emerald-500/20 shadow-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <span className="block font-semibold text-white">Source of Truth Active</span>
                        <span className="text-[11px] text-emerald-200/70">
                          {dataSource.availablePricesCount} Verified Rates · Decimals Preserved
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Workspace Container */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full">

              {activeTab === 'filter' && (
                <SearchByFilter
                  records={records}
                  matrix={matrix}
                />
              )}

              {activeTab === 'transport' && (
                <TransportationPage />
              )}

              {activeTab === 'ai-transport-finder' && (
                <AISmartTransportFinderPage />
              )}

              {activeTab === 'branches' && (
                <BranchLocationPage />
              )}

              {activeTab === 'branch-info' && (
                <BranchInformationPage onShowToast={showToast} />
              )}

              {activeTab === 'instructors' && (
                <InstructorsPage onShowToast={showToast} />
              )}
            </main>

            {/* Footer */}
            <footer className="bg-white dark:bg-[#0F172A] border-t border-[#E2E8F0] dark:border-slate-800 py-4 mt-auto transition-colors duration-200">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-[#64748B] dark:text-slate-400 gap-2">
                <span className="font-medium text-[#0F172A] dark:text-slate-200">Eco Drive · Eco Drive Driving institute Tariff Search</span>
                <div className="flex items-center gap-4">
                  <span>21 Verified Services</span>
                  <span>·</span>
                  <span>All Currency in AED</span>
                </div>
              </div>
            </footer>
          </div>

          {/* Toast Notification */}
          {toast && (
            <div
              role="status"
              aria-live="polite"
              className={`fixed bottom-5 right-5 z-[90] px-4 py-3 rounded-xl shadow-xl border text-xs font-semibold flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-200 max-w-sm ${
                toast.variant === 'error'
                  ? 'bg-rose-700 dark:bg-rose-950 text-white border-rose-500 dark:border-rose-700'
                  : toast.variant === 'info'
                  ? 'bg-slate-800 dark:bg-slate-900 text-white border-slate-600 dark:border-slate-700'
                  : 'bg-[#064E3B] dark:bg-emerald-950 text-white border-[#006B45] dark:border-emerald-700'
              }`}
            >
              {toast.variant === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-200 shrink-0" />
              ) : toast.variant === 'info' ? (
                <Info className="w-4 h-4 text-sky-300 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
              <span>{toast.message}</span>
            </div>
          )}
        </div>
      </AdminAuthProvider>
    </ThemeProvider>
  );
}
