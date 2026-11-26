import React, { useEffect, useRef, useState } from 'react';
import { Search, MapPin, X, Loader2 } from 'lucide-react';
import type { StudentLocation } from '../types/smartTransport';
import { searchDubaiAddress } from '../services/openMapGeocoding';
interface AddressAutocompleteInputProps {
  value: string;
  onChange: (val: string) => void;
  onSelectLocation: (loc: StudentLocation, autoFind?: boolean) => void;
  placeholder?: string;
  autoTriggerFindOnSelect?: boolean;
  compact?: boolean;
}
export const AddressAutocompleteInput: React.FC<AddressAutocompleteInputProps> = ({ value, onChange, onSelectLocation, placeholder = 'Enter your residential area, building, street, or address in Dubai...', autoTriggerFindOnSelect = false, compact = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = useRef('');
  const [suggestions, setSuggestions] = useState<StudentLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!containerRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  useEffect(() => {
    setSuggestions([]); setError(''); setLoading(false);
    if (value.trim().length < 3 || selected.current === value) return;
    const controller = new AbortController();
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const results = await searchDubaiAddress(value, controller.signal);
        if (controller.signal.aborted) return;
        setSuggestions(results);
        if (!results.length) setError('No matching Dubai address. Try a landmark or choose on the map.');
      } catch { if (!controller.signal.aborted) setError('Address search unavailable. Use GPS or choose on the map.'); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 700);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [value, retry]);
  function select(loc: StudentLocation) {
    selected.current = loc.label; setOpen(false); setSuggestions([]); setError(''); onChange(loc.label); onSelectLocation(loc, autoTriggerFindOnSelect);
  }
  return <div ref={containerRef} className="relative w-full">
    <div className="relative">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#006B45] dark:text-emerald-400" />
      <input type="text" value={value} placeholder={placeholder} aria-label="Enter Dubai address or area" aria-expanded={open && suggestions.length > 0} onFocus={() => setOpen(true)} onChange={e => { selected.current = ''; setOpen(true); setSuggestions([]); onChange(e.target.value); }} onKeyDown={e => { if (e.key === 'Escape') setOpen(false); if (e.key === 'Enter') { e.preventDefault(); setOpen(true); if (suggestions.length === 1) select(suggestions[0]); else if (!suggestions.length && !loading) { selected.current = ''; setRetry(n => n + 1); } } }} className={`w-full pl-10 pr-20 bg-[#F8FAFC] dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded-xl text-[#0F172A] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#006B45] ${compact ? 'py-2 text-xs' : 'py-3 text-xs sm:text-sm'}`} />
      <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center gap-1">{loading && <Loader2 className="w-4 h-4 animate-spin text-[#006B45]" />}{value && <button type="button" aria-label="Clear address" onClick={() => { selected.current = ''; onChange(''); setOpen(false); setSuggestions([]); setError(''); }}><X className="w-4 h-4 text-slate-400" /></button>}</div>
    </div>
    {open && suggestions.length > 0 && <ul className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-xl shadow-xl max-h-72 overflow-y-auto">{suggestions.map((loc, i) => <li key={`${loc.lat}-${loc.lng}-${i}`}><button type="button" onClick={() => select(loc)} className="w-full text-left px-3.5 py-2.5 flex items-start gap-2.5 hover:bg-emerald-50 dark:hover:bg-emerald-950"><MapPin className="w-4 h-4 shrink-0 text-[#006B45]" /><span className="text-xs sm:text-sm dark:text-slate-100">{loc.label}</span></button></li>)}</ul>}
    {error && <p role="status" className="mt-1.5 text-xs text-amber-700 dark:text-amber-300">{error}</p>}
  </div>;
};
