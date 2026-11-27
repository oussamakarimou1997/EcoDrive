import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Header, ActiveTab } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { PricesPage, PricesSummaryStats } from './components/PricesPage';
import { TransportationPage } from './components/TransportationPage';
import { AISmartTransportFinderPage } from './components/AISmartTransportFinderPage';
import { BranchLocationPage } from './components/BranchLocationPage';
import { BranchInformationPage } from './components/BranchInformationPage';
import { InstructorsPage } from './components/InstructorsPage';
import { fetchPricesDataset } from './services/pricesService';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { ThemeProvider } from './context/ThemeContext';
import { AdminAuthProvider, ToastVariant } from './context/AdminAuthContext';

import { TRANSPORT_CENTERS, TRANSPORT_ROUTES } from './data/transportationData';
import type { TransportRoute } from './types/transportation';

export default function App() {
  const [transportStatus, setTransportStatus] = useState<'loading'|'live'|'fallback'>('loading');
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 5000);
    fetch('/api/transport/catalog', {signal:controller.signal, cache:'no-store'})
      .then(async res => {
        if (!res.ok) throw new Error('Catalog unavailable');
        const data = await res.json() as {routes:TransportRoute[]};
        if (!Array.isArray(data.routes) || !['dic','al_quoz'].every(c=>data.routes.some(r=>r.centerId===c)) ||
            !data.routes.every(r=>typeof r.id==='string' && Array.isArray(r.stops) && r.stops.length && Array.isArray(r.trips) && r.trips.length)) throw new Error('Invalid catalog');
        if (!active) return;
        TRANSPORT_ROUTES.splice(0,TRANSPORT_ROUTES.length,...data.routes);
        for (const center of TRANSPORT_CENTERS) {
          const routes = data.routes.filter(r=>r.centerId===center.id);
          const names = [...new Set(routes.flatMap(r=>r.stops.map(s=>s.name)))];
          center.routesCount=routes.length;
          center.badge=routes.length+' Routes • '+names.length+' Key Stops';
          center.description='Serving '+names.join(', ')+'.';
        }
        setTransportStatus('live');
      })
      .catch(()=>{if(active) setTransportStatus('fallback');})
      .finally(()=>window.clearTimeout(timer));
    return ()=>{active=false;controller.abort();window.clearTimeout(timer);};
  }, []);

  // Navigation tab state (prices | transport | ai-transport-finder | branches | branch-info | instructors)
  const [activeTab, setActiveTab] = useState<ActiveTab>('prices');

  // Persistent Prices summary loaded from Cloudflare D1
  const [pricesStats, setPricesStats] = useState<PricesSummaryStats>({
    totalCount: 0,
    validCount: 0,
    categoriesCount: 0,
    fileName: 'Cloudflare D1 Catalog',
    importedAt: '',
  });

  useEffect(() => {
    let active = true;
    fetchPricesDataset()
      .then((dataset) => {
        if (!active) return;
        const validCount = dataset.records.filter((r) => r.priceStatus === 'valid').length;
        const categoriesCount = new Set(
          dataset.records.map((r) => r.category.trim()).filter(Boolean)
        ).size;
        setPricesStats({
          totalCount: dataset.records.length,
          validCount,
          categoriesCount,
          fileName: dataset.fileName,
          importedAt: dataset.importedAt,
        });
      })
      .catch(() => {
        // Non-blocking: PricesPage will surface detailed D1 load status
      });
    return () => {
      active = false;
    };
  }, []);

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

  // Dynamic header titles based on active tab
  const tabDetails = useMemo(() => {
    switch (activeTab) {
      case 'transport':
        return {
          title: 'Transportation Schedule',
          description:
            'Official bus routes, student pickup points, GPS map pins, and timetables for Al Quoz and DIC centres.',
        };
      case 'ai-transport-finder':
        return {
          title: 'AI Smart Transportation Finder',
          description:
            'Locate your nearest official Eco Drive bus pickup station anywhere in Dubai, inspect walking distances, and track the next live departure.',
        };
      case 'branches':
        return {
          title: 'Branch and Location',
          description:
            'Official Eco Drive branch network across Dubai, traffic zone conditions, road training restrictions, and live availability.',
        };
      case 'branch-info':
        return {
          title: 'Branch Information',
          description:
            'Search, filter, and manage official Eco Drive registration offices, contact numbers, and locations.',
        };
      case 'instructors':
        return {
          title: 'Instructors',
          description:
            'Search, filter, and manage Eco Drive driving instructors directly from the imported Excel directory.',
        };
      case 'prices':
      default:
        return {
          title: 'Prices',
          description:
            'Cloudflare D1 persistent course tariffs, category filtering, Excel multi-sheet import, and instant price lookup.',
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
            pricesStats={pricesStats}
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
              pricesStats={pricesStats}
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
                            'https://www.ecodrivedubai.com/wp-content/uploads/2026/01/eco-drive-logo_White-01-768x313.png';
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
                        <span className="block font-semibold text-white">Cloudflare D1 Active</span>
                        <span className="text-[11px] text-emerald-200/70">
                          {pricesStats.totalCount > 0
                            ? `${pricesStats.validCount} Valid Prices · ${pricesStats.categoriesCount} Categories`
                            : 'Ready for Excel Price Import'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Workspace Container */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full">
              {activeTab === 'prices' && (
                <PricesPage
                  onShowToast={showToast}
                  onDatasetStatsChange={setPricesStats}
                />
              )}

              {(activeTab === 'transport' || activeTab === 'ai-transport-finder') && transportStatus !== 'live' && (
                <div role="status" className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  {transportStatus === 'loading' ? 'Loading transportation schedules…' : 'Live schedules unavailable. Showing saved schedules; confirm times before travel.'}
                </div>
              )}
              {activeTab === 'transport' && transportStatus !== 'loading' && <TransportationPage />}

              {activeTab === 'ai-transport-finder' && transportStatus !== 'loading' && <AISmartTransportFinderPage />}

              {activeTab === 'branches' && <BranchLocationPage />}

              {activeTab === 'branch-info' && (
                <BranchInformationPage onShowToast={showToast} />
              )}

              {activeTab === 'instructors' && <InstructorsPage onShowToast={showToast} />}
            </main>

            {/* Footer */}
            <footer className="bg-white dark:bg-[#0F172A] border-t border-[#E2E8F0] dark:border-slate-800 py-4 mt-auto transition-colors duration-200">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-[#64748B] dark:text-slate-400 gap-2">
                <span className="font-medium text-[#0F172A] dark:text-slate-200">
                  Eco Drive · Eco Drive Driving institute Operations &amp; Prices Portal
                </span>
                <div className="flex items-center gap-4">
                  <span>
                    {pricesStats.totalCount > 0
                      ? `${pricesStats.totalCount} D1 Price Records`
                      : 'Prices Catalog (D1)'}
                  </span>
                  <span>·</span>
                  <span>Dubai, UAE</span>
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
