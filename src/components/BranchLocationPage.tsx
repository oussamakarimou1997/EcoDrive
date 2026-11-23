import React, { useState, useMemo, useEffect } from 'react';
import {
  MapPin,
  ExternalLink,
  Search,
  X,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RotateCcw,
  Info,
  Car,
  Compass,
  Building2,
  Calendar,
  HelpCircle,
} from 'lucide-react';
import { TrafficZone, CustomCheckResult } from '../types/branches';
import {
  BRANCHES_DATA,
  evaluateBranchAvailability,
  evaluateBranchCustomCheck,
  getDubaiTimeInfo,
} from '../data/branchesData';

export const BranchLocationPage: React.FC = () => {
  // 1. Live Time State in Dubai
  const [currentDubaiTime, setCurrentDubaiTime] = useState<Date>(() => new Date());
  const [simulationMode, setSimulationMode] = useState<'live' | 'restricted_test'>('live');

  // Update clock every 5 seconds when in live mode
  useEffect(() => {
    if (simulationMode !== 'live') return;

    const interval = setInterval(() => {
      setCurrentDubaiTime(new Date());
    }, 5000);

    return () => clearInterval(interval);
  }, [simulationMode]);

  // Set test time presets: Keep ONLY Live Now and Test 6 - 8PM window
  const handleSetOption = (option: 'live' | 'restricted_test') => {
    setSimulationMode(option);

    if (option === 'live') {
      setCurrentDubaiTime(new Date());
    } else if (option === 'restricted_test') {
      // Set to a Monday at 19:15 (7:15 PM) in Dubai (UTC+4 -> 15:15 UTC)
      const testDate = new Date();
      const day = testDate.getDay();
      const diff = testDate.getDate() - day + (day === 0 ? -6 : 1); // Monday
      testDate.setDate(diff);
      testDate.setUTCHours(15, 15, 0, 0);
      setCurrentDubaiTime(testDate);
    }
  };

  // 2. Custom Branch Availability Checker State
  const [showCustomChecker, setShowCustomChecker] = useState<boolean>(true);
  const [customBranchId, setCustomBranchId] = useState<string>('b2'); // Default to Deira City Center

  // Helper to format today's date in YYYY-MM-DD
  const todayStr = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const [customDate, setCustomDate] = useState<string>(todayStr);
  const [customTime, setCustomTime] = useState<string>('19:00'); // Default: 7:00 PM
  const [customResult, setCustomResult] = useState<CustomCheckResult | null>(null);

  // Evaluate Custom Check
  const handleRunCustomCheck = (
    branchIdToUse = customBranchId,
    dateToUse = customDate,
    timeToUse = customTime
  ) => {
    const branch = BRANCHES_DATA.find((b) => b.id === branchIdToUse) || BRANCHES_DATA[0];
    const result = evaluateBranchCustomCheck(branch, dateToUse, timeToUse);
    setCustomResult(result);
  };

  // Run initial custom check on mount
  useEffect(() => {
    handleRunCustomCheck('b2', todayStr, '19:00');
  }, [todayStr]);

  // 3. Filter States for Main Table
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedZone, setSelectedZone] = useState<'All' | TrafficZone>('All');
  const [selectedAvailability, setSelectedAvailability] = useState<
    'All' | 'AVAILABLE' | 'NOT_AVAILABLE'
  >('All');
  const [selectedRestriction, setSelectedRestriction] = useState<
    'All' | 'WithRestrictions' | 'NoRestrictions'
  >('All');

  // Reset all table filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedZone('All');
    setSelectedAvailability('All');
    setSelectedRestriction('All');
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedZone !== 'All' ||
    selectedAvailability !== 'All' ||
    selectedRestriction !== 'All';

  // 4. Computed status for all branches based on the evaluated time
  const evaluatedBranches = useMemo(() => {
    return BRANCHES_DATA.map((branch) => {
      const live = evaluateBranchAvailability(branch, currentDubaiTime);
      return {
        ...branch,
        live,
      };
    });
  }, [currentDubaiTime]);

  // Overall Statistics across all 39 branches
  const stats = useMemo(() => {
    const total = evaluatedBranches.length;
    const available = evaluatedBranches.filter((b) => b.live.status === 'AVAILABLE').length;
    const notAvailable = total - available;
    const withRestrictions = evaluatedBranches.filter((b) => b.hasRestrictions).length;
    const noRestrictions = total - withRestrictions;
    const greenCount = evaluatedBranches.filter((b) => b.zone === 'Green').length;
    const yellowCount = evaluatedBranches.filter((b) => b.zone === 'Yellow').length;
    const redCount = evaluatedBranches.filter((b) => b.zone === 'Red').length;

    return {
      total,
      available,
      notAvailable,
      withRestrictions,
      noRestrictions,
      greenCount,
      yellowCount,
      redCount,
    };
  }, [evaluatedBranches]);

  // Filtered branches list
  const filteredBranches = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return evaluatedBranches.filter((item) => {
      // 1. Search Query
      if (query && !item.name.toLowerCase().includes(query)) {
        return false;
      }

      // 2. Zone Filter
      if (selectedZone !== 'All' && item.zone !== selectedZone) {
        return false;
      }

      // 3. Availability Filter
      if (selectedAvailability !== 'All' && item.live.status !== selectedAvailability) {
        return false;
      }

      // 4. Restriction Filter
      if (selectedRestriction === 'WithRestrictions' && !item.hasRestrictions) {
        return false;
      }
      if (selectedRestriction === 'NoRestrictions' && item.hasRestrictions) {
        return false;
      }

      return true;
    });
  }, [evaluatedBranches, searchQuery, selectedZone, selectedAvailability, selectedRestriction]);

  // Dubai Time Display Strings
  const timeInfo = useMemo(() => getDubaiTimeInfo(currentDubaiTime), [currentDubaiTime]);

  // Selected custom branch object
  const selectedCustomBranch = useMemo(() => {
    return BRANCHES_DATA.find((b) => b.id === customBranchId) || BRANCHES_DATA[0];
  }, [customBranchId]);

  return (
    <div className="space-y-6">
      {/* 1. Live Dubai Time Banner & EXACT 5 Testing Options */}
      <div className="bg-gradient-to-r from-[#064E3B] to-[#006B45] text-white rounded-2xl p-4 sm:p-5 shadow-sm border border-emerald-400/20">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/20">
              <Clock className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-400/20 text-emerald-200 border border-emerald-400/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Dubai Time (Asia/Dubai)
                </span>
                {simulationMode !== 'live' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-400/20 text-amber-200 border border-amber-400/30">
                    Simulation Active
                  </span>
                )}
              </div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white mt-0.5">
                {timeInfo.fullStr}
              </h2>
            </div>
          </div>

          {/* Top Availability Test Bar: Keep ONLY Live Now and Test 6 - 8PM window */}
          <div className="flex items-center gap-1.5 self-start lg:self-auto shrink-0 bg-black/25 p-1.5 rounded-xl border border-white/10">
            {/* Option 1: Live Now */}
            <button
              onClick={() => handleSetOption('live')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                simulationMode === 'live'
                  ? 'bg-emerald-400 text-[#064E3B] shadow-2xs font-bold'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
              title="Reset to current live Dubai time"
            >
              Live Now
            </button>

            {/* Option 2: Test 6 - 8PM window */}
            <button
              onClick={() => handleSetOption('restricted_test')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                simulationMode === 'restricted_test'
                  ? 'bg-rose-500 text-white shadow-2xs font-bold'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
              title="Test Mon–Thu 6:00 PM to 8:00 PM restricted window (21 branches Not Available)"
            >
              Test 6 - 8PM window
            </button>
          </div>
        </div>
      </div>

      {/* 2. Custom Branch Availability Checker Section */}
      {showCustomChecker && (
        <div
          className="bg-white dark:bg-[#0F172A] rounded-2xl border-2 border-[#006B45]/30 dark:border-emerald-700/50 p-5 shadow-sm space-y-5 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          {/* Section Header */}
          <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#F0FDF4] dark:bg-emerald-950/60 text-[#006B45] dark:text-emerald-400 flex items-center justify-center border border-[#D1FAE5] dark:border-emerald-800/70 shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[#0F172A] dark:text-slate-100 tracking-tight">
                  Check Branch Availability
                </h3>
                <p className="text-xs text-[#64748B] dark:text-slate-400">
                  Select any branch, future calendar date, and specific time to verify road training eligibility in Dubai timezone (GST / UTC+4).
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-block text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800/70">
                Independent Check • Does not affect Live status
              </span>
            </div>
          </div>

          {/* Input Controls Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end">
            {/* Control 1: Select Branch Dropdown (Col 1-5) */}
            <div className="md:col-span-5">
              <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-200 mb-1.5">
                Select Branch ({BRANCHES_DATA.length} Available)
              </label>
              <select
                value={customBranchId}
                onChange={(e) => setCustomBranchId(e.target.value)}
                className="w-full px-3 py-2.5 text-xs bg-[#F8FAFC] dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded-xl text-[#0F172A] dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006B45] focus:border-[#006B45] font-semibold truncate"
              >
                {BRANCHES_DATA.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.zone} Zone{b.hasRestrictions ? ' • Restricted Mon-Thu 6-8pm' : ''})
                  </option>
                ))}
              </select>
            </div>

            {/* Control 2: Select Date Picker (Col 6-8) */}
            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-200 mb-1.5">
                Select Date
              </label>
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="w-full px-3 py-2.5 text-xs bg-[#F8FAFC] dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded-xl text-[#0F172A] dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006B45] focus:border-[#006B45] font-semibold"
              />
            </div>

            {/* Control 3: Select Time (Col 9-10) */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-200 mb-1.5">
                Select Time
              </label>
              <input
                type="time"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                className="w-full px-3 py-2.5 text-xs bg-[#F8FAFC] dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded-xl text-[#0F172A] dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006B45] focus:border-[#006B45] font-semibold"
              />
            </div>

            {/* Control 4: Check Availability Submit Button (Col 11-12) */}
            <div className="md:col-span-2">
              <button
                type="button"
                onClick={() => handleRunCustomCheck(customBranchId, customDate, customTime)}
                className="w-full py-2.5 px-4 bg-[#006B45] hover:bg-[#064E3B] text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                <span>Check Availability</span>
              </button>
            </div>
          </div>

          {/* Evaluation Result Display */}
          {customResult && (
            <div
              className={`rounded-xl border p-4.5 transition-all ${
                customResult.status === 'AVAILABLE'
                  ? 'bg-[#F0FDF4] dark:bg-emerald-950/40 border-[#A7F3D0] dark:border-emerald-800/70'
                  : customResult.status === 'NOT_AVAILABLE'
                  ? 'bg-[#FFF1F2] dark:bg-rose-950/40 border-[#FECDD3] dark:border-rose-800/70'
                  : 'bg-[#FFFBEB] dark:bg-amber-950/40 border-[#FDE68A] dark:border-amber-800/70'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b pb-3 mb-3.5 border-black/10 dark:border-white/10">
                <div className="flex items-center gap-3">
                  {/* Status Badge */}
                  {customResult.status === 'AVAILABLE' && (
                    <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white font-extrabold text-sm shadow-xs">
                      <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                      <span>AVAILABLE</span>
                    </span>
                  )}
                  {customResult.status === 'NOT_AVAILABLE' && (
                    <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 text-white font-extrabold text-sm shadow-xs">
                      <AlertTriangle className="w-4 h-4 stroke-[2.5]" />
                      <span>NOT AVAILABLE</span>
                    </span>
                  )}
                  {customResult.status === 'MANUAL_CONFIRMATION_REQUIRED' && (
                    <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 text-white font-extrabold text-sm shadow-xs">
                      <HelpCircle className="w-4 h-4 stroke-[2.5]" />
                      <span>MANUAL CONFIRMATION REQUIRED</span>
                    </span>
                  )}

                  <div>
                    <h4 className="text-sm font-extrabold text-[#0F172A] dark:text-slate-100">
                      {customResult.branch.name}
                    </h4>
                    <span className="text-[11px] text-[#64748B] dark:text-slate-400">
                      Traffic Classification:{' '}
                      <strong className="text-[#0F172A] dark:text-slate-100">{customResult.branch.zone} Zone</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={customResult.branch.locationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 text-[#006B45] dark:text-emerald-400 text-xs font-semibold border border-[#CBD5E1] dark:border-slate-700 hover:border-[#006B45] transition-colors shadow-2xs"
                  >
                    <MapPin className="w-3.5 h-3.5 text-[#006B45] dark:text-emerald-400" />
                    <span>View Location Map</span>
                    <ExternalLink className="w-3 h-3 text-[#64748B] dark:text-slate-400" />
                  </a>
                </div>
              </div>

              {/* Result Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div className="bg-white/80 dark:bg-slate-900/80 rounded-lg p-2.5 border border-black/5 dark:border-slate-800">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                    Target Weekday & Date
                  </span>
                  <span className="font-extrabold text-[#0F172A] dark:text-slate-100 mt-0.5 block">
                    {customResult.selectedWeekday}
                  </span>
                  <span className="text-[11px] text-[#64748B] dark:text-slate-400">
                    {customResult.selectedDateFormatted}
                  </span>
                </div>

                <div className="bg-white/80 dark:bg-slate-900/80 rounded-lg p-2.5 border border-black/5 dark:border-slate-800">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                    Target Time (Dubai GST)
                  </span>
                  <span className="font-extrabold text-[#0F172A] dark:text-slate-100 mt-0.5 block">
                    {customResult.selectedTimeFormatted}
                  </span>
                  <span className="text-[11px] text-[#64748B] dark:text-slate-400">
                    Asia/Dubai (UTC+4)
                  </span>
                </div>

                <div className="sm:col-span-2 bg-white/80 dark:bg-slate-900/80 rounded-lg p-2.5 border border-black/5 dark:border-slate-800">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                    Original Comment / Restriction
                  </span>
                  <span
                    className={`font-bold mt-0.5 block ${
                      customResult.branch.hasRestrictions ? 'text-amber-900 dark:text-amber-300' : 'text-[#64748B] dark:text-slate-400 italic'
                    }`}
                  >
                    {customResult.comment}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Key Metrics & Zone Guidance Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        <div className="bg-white dark:bg-[#0F172A] p-3.5 rounded-xl border border-[#E2E8F0] dark:border-slate-800 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#F0FDF4] dark:bg-emerald-950/60 text-[#006B45] dark:text-emerald-400 border border-[#D1FAE5] dark:border-emerald-800/70 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 block">Total Branches</span>
            <span className="text-base font-extrabold text-[#0F172A] dark:text-slate-100">{stats.total} Locations</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0F172A] p-3.5 rounded-xl border border-[#E2E8F0] dark:border-slate-800 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/70 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 block">Available Now</span>
            <span className="text-base font-extrabold text-emerald-700 dark:text-emerald-400">{stats.available} Branches</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0F172A] p-3.5 rounded-xl border border-[#E2E8F0] dark:border-slate-800 shadow-2xs flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
              stats.notAvailable > 0
                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/70'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700'
            }`}
          >
            <AlertTriangle
              className={`w-5 h-5 ${stats.notAvailable > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400 dark:text-slate-500'}`}
            />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 block">Not Available</span>
            <span
              className={`text-base font-extrabold ${
                stats.notAvailable > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-[#64748B] dark:text-slate-400'
              }`}
            >
              {stats.notAvailable} Restricted
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0F172A] p-3.5 rounded-xl border border-[#E2E8F0] dark:border-slate-800 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/70 flex items-center justify-center shrink-0">
            <Info className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 block">With Restrictions</span>
            <span className="text-base font-extrabold text-[#0F172A] dark:text-slate-100">{stats.withRestrictions} Branches</span>
          </div>
        </div>

        <div className="col-span-2 sm:col-span-4 lg:col-span-1 bg-white dark:bg-[#0F172A] p-3.5 rounded-xl border border-[#E2E8F0] dark:border-slate-800 shadow-2xs flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 text-[#0F172A] dark:text-slate-100 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
            <Car className="w-5 h-5 text-[#006B45] dark:text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 block">Traffic Zones</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" title="Green: Low traffic" />
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">{stats.greenCount}</span>
              <span className="text-[#CBD5E1] dark:text-slate-700">|</span>
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400" title="Yellow: Moderate traffic" />
              <span className="text-xs font-bold text-amber-700 dark:text-amber-400">{stats.yellowCount}</span>
              <span className="text-[#CBD5E1] dark:text-slate-700">|</span>
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-500" title="Red: Heavy traffic" />
              <span className="text-xs font-bold text-rose-700 dark:text-rose-400">{stats.redCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Traffic Zone Classification Legend Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-[#F0FDF4] dark:bg-emerald-950/40 border border-[#D1FAE5] dark:border-emerald-800/70 rounded-xl p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center shrink-0 font-bold text-xs shadow-2xs">
            GRN
          </div>
          <div className="text-xs">
            <div className="font-bold text-[#064E3B] dark:text-emerald-200 flex items-center gap-1.5">
              <span>GREEN ZONE — Low Traffic</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-200 dark:bg-emerald-900/80 text-[#064E3B] dark:text-emerald-200 font-semibold">
                {stats.greenCount} Branches
              </span>
            </div>
          </div>
        </div>

        <div className="bg-[#FEFCE8] dark:bg-amber-950/40 border border-[#FEF08A] dark:border-amber-800/70 rounded-xl p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-400 text-amber-950 flex items-center justify-center shrink-0 font-bold text-xs shadow-2xs">
            YEL
          </div>
          <div className="text-xs">
            <div className="font-bold text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
              <span>YELLOW ZONE — Moderate Traffic</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-200 dark:bg-amber-900/80 text-amber-950 dark:text-amber-200 font-semibold">
                {stats.yellowCount} Branches
              </span>
            </div>
          </div>
        </div>

        <div className="bg-[#FFF1F2] dark:bg-rose-950/40 border border-[#FECDD3] dark:border-rose-800/70 rounded-xl p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-rose-500 text-white flex items-center justify-center shrink-0 font-bold text-xs shadow-2xs">
            RED
          </div>
          <div className="text-xs">
            <div className="font-bold text-rose-950 dark:text-rose-200 flex items-center gap-1.5">
              <span>RED ZONE — Heavy Traffic</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-200 dark:bg-rose-900/80 text-rose-950 dark:text-rose-200 font-semibold">
                {stats.redCount} Branches
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Search and Combined Filter Bar for Table */}
      <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-[#E2E8F0] dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-[#E2E8F0] dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#F0FDF4] dark:bg-emerald-950/60 text-[#006B45] dark:text-emerald-400 flex items-center justify-center border border-[#D1FAE5] dark:border-emerald-800/70">
              <Filter className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#0F172A] dark:text-slate-100">Filter Branches</h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#64748B] dark:text-slate-400">
              Showing <strong className="text-[#0F172A] dark:text-slate-100">{filteredBranches.length}</strong> of {stats.total} branches
            </span>
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#64748B] dark:text-slate-300 hover:text-[#0F172A] dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                title="Reset all filters"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#006B45] dark:text-emerald-400" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Filter 1: Branch Name Search */}
          <div>
            <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-200 mb-1.5">
              Search Branch Name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#64748B]">
                <Search className="w-3.5 h-3.5 text-[#006B45] dark:text-emerald-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type branch name (e.g. Deira, Al Qouz)..."
                className="w-full pl-9 pr-8 py-2 text-xs bg-[#F8FAFC] dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded-xl text-[#0F172A] dark:text-slate-100 placeholder-[#94A3B8] dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006B45] focus:border-[#006B45] transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Filter 2: Traffic Zone */}
          <div>
            <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-200 mb-1.5">
              Traffic Zone
            </label>
            <select
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value as any)}
              className="w-full px-3 py-2 text-xs bg-[#F8FAFC] dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded-xl text-[#0F172A] dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006B45] focus:border-[#006B45] font-medium"
            >
              <option value="All">All Traffic Zones ({stats.total})</option>
              <option value="Green">🟢 Green Zone — Low Traffic ({stats.greenCount})</option>
              <option value="Yellow">🟡 Yellow Zone — Moderate Traffic ({stats.yellowCount})</option>
              <option value="Red">🔴 Red Zone — Heavy Traffic ({stats.redCount})</option>
            </select>
          </div>

          {/* Filter 3: Live Availability */}
          <div>
            <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-200 mb-1.5">
              Live Availability Status
            </label>
            <select
              value={selectedAvailability}
              onChange={(e) => setSelectedAvailability(e.target.value as any)}
              className="w-full px-3 py-2 text-xs bg-[#F8FAFC] dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded-xl text-[#0F172A] dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006B45] focus:border-[#006B45] font-medium"
            >
              <option value="All">All Availability ({stats.total})</option>
              <option value="AVAILABLE">✅ Available Now ({stats.available})</option>
              <option value="NOT_AVAILABLE">⛔ Not Available Now ({stats.notAvailable})</option>
            </select>
          </div>

          {/* Filter 4: Comment / Restrictions */}
          <div>
            <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-200 mb-1.5">
              Comment / Restrictions
            </label>
            <select
              value={selectedRestriction}
              onChange={(e) => setSelectedRestriction(e.target.value as any)}
              className="w-full px-3 py-2 text-xs bg-[#F8FAFC] dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded-xl text-[#0F172A] dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006B45] focus:border-[#006B45] font-medium"
            >
              <option value="All">All Branches ({stats.total})</option>
              <option value="WithRestrictions">Branches with restrictions ({stats.withRestrictions})</option>
              <option value="NoRestrictions">Branches without restrictions ({stats.noRestrictions})</option>
            </select>
          </div>
        </div>
      </div>

      {/* 6. Branches List / Table */}
      {filteredBranches.length === 0 ? (
        <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-[#E2E8F0] dark:border-slate-800 p-12 text-center shadow-xs">
          <Compass className="w-12 h-12 text-[#94A3B8] dark:text-slate-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-[#0F172A] dark:text-slate-100">No Matching Branches Found</h3>
          <p className="text-xs text-[#64748B] dark:text-slate-400 max-w-md mx-auto mt-1">
            No branch matches your selected filters. Try searching for a different branch name, choosing &quot;All Zones&quot;, or resetting your filters.
          </p>
          <button
            onClick={handleResetFilters}
            className="mt-4 px-4 py-2 bg-[#006B45] text-white text-xs font-semibold rounded-xl hover:bg-[#064E3B] transition-colors"
          >
            Reset All Filters
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#F8FAFC] dark:bg-slate-900 border-b border-[#E2E8F0] dark:border-slate-800 text-[#475569] dark:text-slate-300 font-bold text-[11px] uppercase tracking-wider">
                  <th className="py-3.5 px-4 w-12 text-center">#</th>
                  <th className="py-3.5 px-4 min-w-[200px]">Branch Name</th>
                  <th className="py-3.5 px-4 min-w-[140px]">Traffic Zone</th>
                  <th className="py-3.5 px-4 min-w-[150px]">Location (Google Maps)</th>
                  <th className="py-3.5 px-4 min-w-[320px]">
                    <div className="flex items-center gap-1.5 text-[#0F172A] dark:text-slate-100">
                      <Info className="w-3.5 h-3.5 text-[#006B45] dark:text-emerald-400" />
                      <span>Comment / Operational Restrictions</span>
                    </div>
                  </th>
                  <th className="py-3.5 px-4 min-w-[180px] bg-slate-50 dark:bg-slate-900/90">Live Availability</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] dark:divide-slate-800">
                {filteredBranches.map((item, idx) => {
                  const isRestrictedNow = item.live.status === 'NOT_AVAILABLE';
                  const hasRestrictions = item.hasRestrictions;

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors ${
                        isRestrictedNow
                          ? 'bg-rose-50/60 dark:bg-rose-950/30 hover:bg-rose-50 dark:hover:bg-rose-950/45 border-l-4 border-l-rose-500'
                          : idx % 2 === 0
                          ? 'bg-white dark:bg-[#0F172A] hover:bg-emerald-50/30 dark:hover:bg-emerald-950/30'
                          : 'bg-[#FAFAFA] dark:bg-slate-900/40 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/30'
                      }`}
                    >
                      {/* Index */}
                      <td className="py-3.5 px-4 text-center text-[#64748B] dark:text-slate-400 font-semibold">
                        <span className="inline-block w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-[#475569] dark:text-slate-300 leading-6 text-[11px]">
                          {idx + 1}
                        </span>
                      </td>

                      {/* Branch Name */}
                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-[#0F172A] dark:text-slate-100 text-sm flex items-center gap-1.5">
                          <span>{item.name}</span>
                        </div>
                        <span className="text-[10px] text-[#64748B] dark:text-slate-400 flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3 h-3 text-[#94A3B8] dark:text-slate-500" />
                          <span>Eco Drive Dubai Branch</span>
                        </span>
                      </td>

                      {/* Traffic Zone */}
                      <td className="py-3.5 px-4">
                        {item.zone === 'Green' && (
                          <div className="inline-flex flex-col">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#F0FDF4] dark:bg-emerald-950/60 text-[#064E3B] dark:text-emerald-300 border border-[#D1FAE5] dark:border-emerald-800/70 font-bold text-xs w-max">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              <span>GREEN ZONE</span>
                            </span>
                            <span className="text-[10px] text-[#064E3B]/80 dark:text-emerald-300/80 font-medium mt-0.5">
                              Low Traffic • Comfortable
                            </span>
                          </div>
                        )}
                        {item.zone === 'Yellow' && (
                          <div className="inline-flex flex-col">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/70 font-bold text-xs w-max">
                              <span className="w-2 h-2 rounded-full bg-amber-500" />
                              <span>YELLOW ZONE</span>
                            </span>
                            <span className="text-[10px] text-amber-800/80 dark:text-amber-300/80 font-medium mt-0.5">
                              Moderate Traffic
                            </span>
                          </div>
                        )}
                        {item.zone === 'Red' && (
                          <div className="inline-flex flex-col">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/70 font-bold text-xs w-max">
                              <span className="w-2 h-2 rounded-full bg-rose-500" />
                              <span>RED ZONE</span>
                            </span>
                            <span className="text-[10px] text-rose-800/80 dark:text-rose-300/80 font-medium mt-0.5">
                              Heavy Traffic Movement
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Location Link */}
                      <td className="py-3.5 px-4">
                        <a
                          href={item.locationUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#F8FAFC] dark:bg-slate-800 hover:bg-[#F0FDF4] dark:hover:bg-emerald-950/60 text-[#006B45] dark:text-emerald-400 border border-[#CBD5E1] dark:border-slate-700 hover:border-[#006B45] font-semibold text-xs transition-colors shadow-2xs group"
                          title={`Open ${item.name} in Google Maps`}
                        >
                          <MapPin className="w-3.5 h-3.5 text-[#006B45] dark:text-emerald-400 group-hover:scale-110 transition-transform" />
                          <span>Google Maps Pin</span>
                          <ExternalLink className="w-3 h-3 text-[#64748B] dark:text-slate-400 group-hover:text-[#006B45] dark:group-hover:text-emerald-400" />
                        </a>
                      </td>

                      {/* Comment / Operational Restrictions */}
                      <td className="py-3.5 px-4">
                        {hasRestrictions ? (
                          <div className="p-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 text-amber-950 dark:text-amber-200">
                            <div className="flex items-start gap-1.5">
                              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                              <div className="leading-snug">
                                <span className="font-bold text-xs text-amber-900 dark:text-amber-200 block">
                                  {item.comment}
                                </span>
                                <span className="text-[10px] text-amber-800/90 dark:text-amber-300/80 font-medium block mt-0.5">
                                  Applies Monday to Thursday between 6:00 PM and 8:00 PM
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[#64748B] dark:text-slate-400">
                            <span className="font-medium text-xs italic text-[#64748B] dark:text-slate-500">
                              No restrictions specified
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Live Availability */}
                      <td className={`py-3.5 px-4 ${isRestrictedNow ? 'bg-rose-50/80 dark:bg-rose-950/40' : 'bg-slate-50/50 dark:bg-slate-900/50'}`}>
                        {isRestrictedNow ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-600 text-white font-extrabold text-xs shadow-2xs animate-pulse">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>NOT AVAILABLE</span>
                            </span>
                            <p className="text-[10px] text-rose-700 dark:text-rose-300 font-semibold leading-tight">
                              {item.live.reason}
                            </p>
                          </div>
                        ) : item.live.status === 'MANUAL_CONFIRMATION_REQUIRED' ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500 text-white font-extrabold text-xs shadow-2xs">
                              <HelpCircle className="w-3.5 h-3.5" />
                              <span>CONFIRMATION REQ.</span>
                            </span>
                            <p className="text-[10px] text-amber-800 dark:text-amber-300 font-medium leading-tight">
                              {item.live.reason}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-extrabold text-xs shadow-2xs">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>AVAILABLE</span>
                            </span>
                            <p className="text-[10px] text-emerald-800 dark:text-emerald-300 font-medium leading-tight">
                              {item.live.reason}
                            </p>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="p-4 bg-[#F8FAFC] dark:bg-slate-900 border-t border-[#E2E8F0] dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs text-[#64748B] dark:text-slate-400 gap-2">
            <span>
              All 39 branches verified from official Eco Drive Driving Institute records.
            </span>
            <div className="flex items-center gap-3">
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                🟢 {stats.available} Available
              </span>
              <span>•</span>
              <span className="font-semibold text-rose-600 dark:text-rose-400">
                🔴 {stats.notAvailable} Not Available
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
