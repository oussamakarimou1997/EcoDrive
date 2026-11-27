import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Bus,
  MapPin,
  Clock,
  Search,
  X,
  ExternalLink,
  Users,
  Calendar,
  Compass,
  AlertCircle,
  Building2,
  Printer,
  ChevronDown,
  Check,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import { CenterId, TransportRoute, TransportStop } from '../types/transportation';
import { TRANSPORT_CENTERS, TRANSPORT_ROUTES } from '../data/transportationData';

import { useAdminAuth } from '../context/AdminAuthContext';

type TransportRow = Record<string, string | number | null>;
type TransportSnapshot = Record<string, TransportRow[]>;
function TransportationManager({onClose}:{onClose:()=>void}) {
  const auth = useAdminAuth();
  const [center,setCenter]=useState<CenterId>('al_quoz');
  const [snapshot,setSnapshot]=useState<TransportSnapshot|null>(null);
  const [revision,setRevision]=useState('');
  const [backups,setBackups]=useState<{id:string;created_at:string;source_filename:string|null}[]>([]);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [dirty,setDirty]=useState(false);
  const [routeId,setRouteId]=useState('');
  const [review,setReview]=useState(false);
  const [pdf,setPdf]=useState<{name:string;url:string}|null>(null);
  const [pdfRoutes,setPdfRoutes]=useState<{code:string;title:string}[]>([]);
  useEffect(()=>{setPdfRoutes([]);},[pdf]);
  async function extractRoutes(){
    if(!pdf)return;
    setBusy(true);setError('');setPdfRoutes([]);
    let doc:any;
    try {
      // Version-pinned PDF.js; PDF bytes are processed locally in the browser.
      const url='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs';
      const lib=await import(/* @vite-ignore */ url);
      lib.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs';
      doc=await lib.getDocument({data:await (await fetch(pdf.url)).arrayBuffer(),isEvalSupported:false}).promise;
      const found=new Map<string,{code:string;title:string}>();
      for(let n=1;n<=doc.numPages;n++){
        const page=await doc.getPage(n);
        const content=await page.getTextContent();
        const lines=new Map<number,{x:number;str:string}[]>();
        for(const item of content.items){
          if(!('str' in item)||!item.str.trim())continue;
          const y=Math.round(item.transform[5]*2)/2;
          const line=lines.get(y)||[];
          line.push({x:item.transform[4],str:item.str});lines.set(y,line);
        }
        for(const line of lines.values()){
          const value=line.sort((a,b)=>a.x-b.x).map(i=>i.str).join(' ').replace(/\s+/g,' ').trim();
          const match=value.match(/^ROUTE\s+(\d+)\s*[-–—]\s*(.+)$/i);
          if(!match)continue;
          const code='ROUTE '+Number(match[1]),title=match[2].trim();
          if(found.has(code)&&found.get(code)?.title!==title)throw new Error('Conflicting headings for '+code);
          found.set(code,{code,title});
        }
      }
      if(!found.size)throw new Error('No route headings found. Select a text-based schedule PDF.');
      setPdfRoutes([...found.values()].sort((a,b)=>Number(a.code.slice(6))-Number(b.code.slice(6))));
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{try{await doc?.destroy();}finally{setBusy(false);}}
  }
  useEffect(()=>()=>{if(pdf)URL.revokeObjectURL(pdf.url);},[pdf]);
  useEffect(()=>{setPdf(null);},[center,auth.isAuthorized]);
  async function selectPdf(file:File|undefined){
    if(!file)return;
    setError('');
    if(file.size>20*1024*1024){setError('PDF must be smaller than 20 MB.');return;}
    const signature=await file.slice(0,5).text();
    if(signature!=='%PDF-'){setError('Please select a valid PDF file.');return;}
    setPdf({name:file.name,url:URL.createObjectURL(file)});
  }
  const [original,setOriginal]=useState<TransportSnapshot|null>(null);
  const base='/api/transport/admin/'+center;
  const field='w-full min-w-24 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1.5 text-xs';
  const button='rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-semibold disabled:opacity-50';
  const primary=button+' bg-[#064E3B] text-white';
  async function request(url:string,token:string,method='GET',body?:unknown) {
    const res=await fetch(url,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
    const data=await res.json();
    if(!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }
  async function load(token:string) {
    setBusy(true);setError('');
    try {
      const [catalog,history]=await Promise.all([request(base,token),request(base+'/backups',token)]);
      setSnapshot(catalog.snapshot);setOriginal(catalog.snapshot);setRevision(catalog.revision);setBackups(history.backups);
      setRouteId(catalog.snapshot.transport_routes[0]?.id || '');setDirty(false);setReview(false);
    } catch(e){setError(String(e instanceof Error?e.message:e));}
    finally{setBusy(false);}
  }
  useEffect(()=>{setSnapshot(null);setOriginal(null);setBackups([]);setDirty(false);setReview(false);const token=auth.getValidToken();if(token)void load(token);},[center,auth.isAuthorized]);
  const update=(table:string,idx:number,key:string,value:TransportRow[string])=>{
    setSnapshot(old=>old?{...old,[table]:old[table].map((r,i)=>i===idx?{...r,[key]:value}:r)}:old);setDirty(true);setReview(false);
  };
  const change=(fn:(draft:TransportSnapshot)=>void)=>{setSnapshot(old=>{if(!old)return old;const draft=structuredClone(old);fn(draft);return draft;});setDirty(true);setReview(false);};
  const uid=()=>crypto.randomUUID();
  const addRoute=()=>{const id=uid();change(d=>{d.transport_routes.push({id,center_id:center,route_code:'NEW ROUTE',title:'New route',schedule_type:'FULL WEEK SCHEDULE',capacity:24,center_eta_name:center==='dic'?'ECO DRIVE - DIC':'ECO DRIVE AL QUOZ',active:1});});setRouteId(id);};
  const addStop=()=>change(d=>{const id=uid();d.transport_stops.push({id,route_id:routeId,name:'New stop',landmark:'',pin_url:null,latitude:null,longitude:null,position:d.transport_stops.filter(r=>r.route_id===routeId).length,active:1});for(const t of d.transport_trips.filter(r=>r.route_id===routeId))d.transport_stop_times.push({route_id:routeId,trip_id:t.id,stop_id:id,pickup_time:''});});
  const addTrip=()=>change(d=>{const id=uid();d.transport_trips.push({id,route_id:routeId,position:d.transport_trips.filter(r=>r.route_id===routeId).length,eta:null,departure:null,notes:null,active:1});for(const s of d.transport_stops.filter(r=>r.route_id===routeId))d.transport_stop_times.push({route_id:routeId,trip_id:id,stop_id:s.id,pickup_time:''});});
  const remove=(table:string,row:TransportRow)=>change(d=>{
    d[table]=d[table].filter(r=>r.id!==row.id);
    if(table==='transport_routes')for(const key of Object.keys(d).filter(k=>k!==table))d[key]=d[key].filter(r=>r.route_id!==row.id);
    if(table==='transport_stops')d.transport_stop_times=d.transport_stop_times.filter(r=>r.stop_id!==row.id);
    if(table==='transport_trips')d.transport_stop_times=d.transport_stop_times.filter(r=>r.trip_id!==row.id);
  });
  const publish=(backupId?:string)=>auth.requireAdminAuthorization(backupId?'Restore transportation backup':'Publish transportation schedule',async token=>{
    setBusy(true);setError('');
    try{await request(base+(backupId?'/restore':''),token,backupId?'POST':'PUT',backupId?{revision,backupId}:{revision,snapshot});window.location.reload();}
    catch(e){setError(e instanceof Error?e.message:String(e));setBusy(false);}
  });
  const route=snapshot?.transport_routes.find(r=>r.id===routeId);
  const rows=(table:string)=>snapshot?.[table].map((row,index)=>({row,index})).filter(x=>x.row.route_id===routeId)||[];
  const edit=(table:string,index:number,row:TransportRow,key:string,numeric=false)=><label key={key} className="text-xs space-y-1"><span>{key.replaceAll('_',' ')}</span><input className={field} type={numeric?'number':'text'} value={row[key]??''} onChange={e=>update(table,index,key,numeric?(e.target.value===''?null:Number(e.target.value)):(e.target.value===''&&row[key]===null?null:e.target.value))}/></label>;
  return <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F172A] p-4 space-y-4">
    <div className="flex justify-between items-center"><h2 className="font-bold text-lg">Transportation Manager</h2><button className={button} disabled={busy} onClick={()=>{if(!dirty||window.confirm('Discard unsaved changes?'))onClose();}}>Close</button></div>
    {!auth.isAuthorized?<button className={primary} onClick={()=>auth.requireAdminAuthorization('Transportation Manager',()=>{})}>Unlock</button>:<>
    <div className="flex gap-2 flex-wrap">{(['al_quoz','dic'] as CenterId[]).map(c=><button key={c} disabled={busy} className={c===center?primary:button} onClick={()=>{if(c!==center&&(!dirty||window.confirm('Discard unsaved changes?')))setCenter(c);}}>{c==='dic'?'DIC Centre':'Al Quoz Centre'}</button>)}</div>
    {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
    {busy&&<p role="status" className="text-sm">Loading…</p>}
    {!snapshot&&!busy&&<button className={button} onClick={()=>auth.requireAdminAuthorization('Load schedules',load)}>Retry</button>}
    {snapshot&&<fieldset disabled={busy} className="space-y-4">
      <div className="rounded-xl border border-dashed border-emerald-600/50 p-4 space-y-3">
        <h3 className="font-bold">Upload Schedule PDF</h3>
        <label className="inline-block cursor-pointer rounded-lg bg-[#064E3B] text-white px-4 py-2 text-xs font-semibold">
          Choose PDF
          <input type="file" accept=".pdf,application/pdf" className="sr-only" onChange={e=>{void selectPdf(e.target.files?.[0]);e.target.value='';}}/>
        </label>
        {pdf&&<div className="space-y-2"><div className="flex flex-wrap items-center justify-between gap-2 text-xs"><span>{pdf.name}</span><div className="flex gap-2"><a href={pdf.url} target="_blank" rel="noopener noreferrer" className={button}>Open PDF</a><button className={button} onClick={()=>setPdf(null)}>Remove PDF</button></div></div><iframe title="Schedule PDF preview" src={pdf.url} className="w-full h-96 rounded-lg border border-slate-300 dark:border-slate-700"/></div>}
        {pdf&&<button className={primary} onClick={()=>void extractRoutes()}>Extract Routes</button>}
        {pdfRoutes.length>0&&<div className="space-y-2"><h4 className="font-bold text-sm">{pdfRoutes.length} routes found</h4>{pdfRoutes.map(r=><div key={r.code} className="text-xs border-b border-slate-200 dark:border-slate-800 py-2"><strong>{r.code}</strong> — {r.title}</div>)}</div>}
        <p className="text-xs text-slate-500 dark:text-slate-400">Route extraction preview only. Verify the centre and route headings against the PDF. No schedule changes are saved.</p>
      </div>
      <div className="flex gap-2 flex-wrap"><select aria-label="Route" className={field+' max-w-md'} value={routeId} onChange={e=>setRouteId(e.target.value)}><option value="">Select route</option>{snapshot.transport_routes.map(r=><option key={String(r.id)} value={String(r.id)}>{r.route_code} — {r.title}</option>)}</select><button className={button} onClick={addRoute}>+ Route</button></div>
      {route&&<>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">{['route_code','title','schedule_type','capacity','center_eta_name'].map(k=>edit('transport_routes',snapshot.transport_routes.indexOf(route),route,k,k==='capacity'))}<button className={button+' text-red-600'} onClick={()=>{if(window.confirm('Remove this route and all its stops and trips?')){remove('transport_routes',route);setRouteId('');}}}>Remove route</button></div>
      <div className="flex justify-between items-center"><h3 className="font-bold">Stops</h3><button className={button} onClick={addStop}>+ Stop</button></div>
      {rows('transport_stops').map(({row,index})=><div key={String(row.id)} className="grid grid-cols-2 md:grid-cols-4 gap-2 border-t border-slate-200 dark:border-slate-800 pt-2">{['name','landmark','pin_url','latitude','longitude','position'].map(k=>edit('transport_stops',index,row,k,['latitude','longitude','position'].includes(k)))}<button className={button+' text-red-600'} onClick={()=>remove('transport_stops',row)}>Remove stop</button></div>)}
      <div className="flex justify-between items-center"><h3 className="font-bold">Trips & pickup times</h3><button className={button} onClick={addTrip}>+ Trip</button></div>
      {rows('transport_trips').map(({row,index})=><div key={String(row.id)} className="grid grid-cols-2 md:grid-cols-4 gap-2 border-t border-slate-200 dark:border-slate-800 pt-2">{['eta','departure','notes','position'].map(k=>edit('transport_trips',index,row,k,k==='position'))}{rows('transport_stop_times').filter(x=>x.row.trip_id===row.id).map(x=><label key={String(x.row.stop_id)} className="text-xs">{snapshot.transport_stops.find(s=>s.id===x.row.stop_id)?.name}<input className={field} placeholder="7:30AM" value={x.row.pickup_time??''} onChange={e=>update('transport_stop_times',x.index,'pickup_time',e.target.value)}/></label>)}<button className={button+' text-red-600'} onClick={()=>remove('transport_trips',row)}>Remove trip</button></div>)}
      <div className="flex justify-between items-center"><h3 className="font-bold">Centre departures</h3><button className={button} onClick={()=>change(d=>d.transport_departures.push({id:uid(),route_id:routeId,departure_time:'',destination:null,notes:null,position:d.transport_departures.filter(r=>r.route_id===routeId).length,active:1}))}>+ Departure</button></div>
      {rows('transport_departures').map(({row,index})=><div key={String(row.id)} className="grid grid-cols-2 md:grid-cols-4 gap-2">{['departure_time','destination','notes','position'].map(k=>edit('transport_departures',index,row,k,k==='position'))}<button className={button+' text-red-600'} onClick={()=>remove('transport_departures',row)}>Remove departure</button></div>)}
      </>}
      <div className="flex gap-2"><button className={primary} disabled={!dirty} onClick={()=>setReview(true)}>Review changes</button></div>
      {review&&<div className="border rounded-xl p-3 space-y-2"><h3 className="font-bold">Review before publish</h3>{Object.keys(snapshot).map(k=>{const before=original?.[k]||[];const after=snapshot[k];return <p key={k} className="text-xs">{k.replace('transport_','').replaceAll('_',' ')}: {before.length} → {after.length} rows; {after.filter(r=>!before.some(b=>JSON.stringify(b)===JSON.stringify(r))).length} new or changed</p>;})}<button className={primary} onClick={()=>publish()}>Publish</button></div>}
      <h3 className="font-bold">Backups</h3>{backups.length===0&&<p className="text-xs">No backups yet.</p>}{backups.map(b=><div key={b.id} className="flex justify-between items-center gap-2 text-xs"><span>{b.created_at} {b.source_filename||''}</span><button className={button} onClick={()=>{if(window.confirm('Restore this backup? Current published data will be backed up; unsaved edits will be discarded.'))publish(b.id);}}>Restore</button></div>)}
    </fieldset>}
    </>}
  </section>;
}

export const TransportationPage: React.FC = () => {
  const [managerOpen,setManagerOpen]=useState(false);
  const adminAuth=useAdminAuth();
  // Selected Center (default: Al Quoz)
  const [selectedCenterId, setSelectedCenterId] = useState<CenterId>('al_quoz');

  // Selected Route Filter within the chosen center ('all' or routeId)
  const [selectedRouteId, setSelectedRouteId] = useState<string>('all');

  // Search input for stop name, landmark, or area
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Route Combobox dropdown open state & internal search filter
  const [isRouteDropdownOpen, setIsRouteDropdownOpen] = useState(false);
  const [routeSearchTerm, setRouteSearchTerm] = useState('');
  const routeDropdownRef = useRef<HTMLDivElement>(null);

  // Close combobox when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        routeDropdownRef.current &&
        !routeDropdownRef.current.contains(event.target as Node)
      ) {
        setIsRouteDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Selected center details
  const activeCenter = useMemo(() => {
    return (
      TRANSPORT_CENTERS.find((c) => c.id === selectedCenterId) ||
      TRANSPORT_CENTERS[0]
    );
  }, [selectedCenterId]);

  // Routes for current center
  const centerRoutes = useMemo(() => {
    return TRANSPORT_ROUTES.filter((r) => r.centerId === selectedCenterId);
  }, [selectedCenterId]);

  // When center changes, reset route selection & dropdown search
  const handleCenterChange = (centerId: CenterId) => {
    setSelectedCenterId(centerId);
    setSelectedRouteId('all');
    setRouteSearchTerm('');
    setIsRouteDropdownOpen(false);
  };

  // Currently selected route object (if specific route chosen)
  const activeRouteObj = useMemo(() => {
    if (selectedRouteId === 'all') return null;
    return centerRoutes.find((r) => r.id === selectedRouteId) || null;
  }, [centerRoutes, selectedRouteId]);

  // Routes list filtered by combobox search term
  const comboFilteredRoutes = useMemo(() => {
    if (!routeSearchTerm.trim()) return centerRoutes;
    const term = routeSearchTerm.toLowerCase();
    return centerRoutes.filter(
      (r) =>
        r.routeCode.toLowerCase().includes(term) ||
        r.title.toLowerCase().includes(term) ||
        r.stops.some(
          (s) =>
            s.name.toLowerCase().includes(term) ||
            s.landmark.toLowerCase().includes(term)
        )
    );
  }, [centerRoutes, routeSearchTerm]);

  // Filtered routes based on selected route and search query
  const filteredRoutes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return centerRoutes.filter((route) => {
      if (selectedRouteId !== 'all' && route.id !== selectedRouteId) {
        return false;
      }

      if (!query) return true;

      // Match route title or route code
      if (
        route.routeCode.toLowerCase().includes(query) ||
        route.title.toLowerCase().includes(query)
      ) {
        return true;
      }

      // Match stop name or landmark
      const hasMatchingStop = route.stops.some(
        (stop) =>
          stop.name.toLowerCase().includes(query) ||
          stop.landmark.toLowerCase().includes(query)
      );

      return hasMatchingStop;
    });
  }, [centerRoutes, selectedRouteId, searchQuery]);

  // Total daily trips for current view
  const totalDailyTrips = useMemo(() => {
    return filteredRoutes.reduce((acc, r) => acc + r.trips.length, 0);
  }, [filteredRoutes]);

  // Total unique stops count for current view
  const totalUniqueStops = useMemo(() => {
    const stopIds = new Set<string>();
    filteredRoutes.forEach((r) =>
      r.stops.forEach((s) => stopIds.add(s.name.toLowerCase()))
    );
    return stopIds.size;
  }, [filteredRoutes]);

  // Reset all filters for this center
  const handleResetFilters = () => {
    setSelectedRouteId('all');
    setSearchQuery('');
    setRouteSearchTerm('');
    setIsRouteDropdownOpen(false);
  };

  // Print schedule
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end print:hidden"><button className="rounded-xl bg-[#064E3B] text-white px-4 py-2 text-xs font-bold" onClick={()=>adminAuth.requireAdminAuthorization('Transportation Manager',()=>setManagerOpen(true))}>Manage Transportation</button></div>
      {managerOpen&&<TransportationManager onClose={()=>setManagerOpen(false)}/>}
      {/* 1. Center Selection Tabs (Al Quoz Centre vs Dubai Industrial City Centre) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TRANSPORT_CENTERS.map((center) => {
          const isSelected = selectedCenterId === center.id;
          return (
            <button
              key={center.id}
              onClick={() => handleCenterChange(center.id)}
              className={`text-left p-5 rounded-2xl border transition-all relative overflow-hidden group ${
                isSelected
                  ? 'bg-gradient-to-br from-[#064E3B] to-[#006B45] text-white border-[#006B45] shadow-md ring-2 ring-[#006B45]/20'
                  : 'bg-white dark:bg-[#0F172A] hover:bg-slate-50 dark:hover:bg-slate-900 text-[#0F172A] dark:text-slate-100 border-[#E2E8F0] dark:border-slate-800 shadow-xs'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${
                      isSelected
                        ? 'bg-white/10 text-emerald-200 border border-white/20'
                        : 'bg-[#F0FDF4] dark:bg-emerald-950/60 text-[#006B45] dark:text-emerald-400 border border-[#D1FAE5] dark:border-emerald-800/70'
                    }`}
                  >
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          isSelected
                            ? 'bg-emerald-400/20 text-emerald-200 border border-emerald-400/30'
                            : 'bg-[#F0FDF4] dark:bg-emerald-950/60 text-[#006B45] dark:text-emerald-300 border border-[#D1FAE5] dark:border-emerald-800/70'
                        }`}
                      >
                        {center.routesCount} Routes Available
                      </span>
                    </div>
                    <h3
                      className={`text-base sm:text-lg font-bold tracking-tight mt-1 ${
                        isSelected ? 'text-white' : 'text-[#0F172A] dark:text-slate-100'
                      }`}
                    >
                      {center.name}
                    </h3>
                  </div>
                </div>

                {isSelected && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-400 text-[#064E3B] text-[11px] font-bold shadow-2xs">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Selected</span>
                  </span>
                )}
              </div>

              <p
                className={`mt-3 text-xs leading-relaxed ${
                  isSelected ? 'text-emerald-100/90' : 'text-[#64748B] dark:text-slate-400'
                }`}
              >
                {center.description}
              </p>

              <div
                className={`mt-4 pt-3 border-t flex items-center justify-between text-xs ${
                  isSelected
                    ? 'border-white/10 text-emerald-200'
                    : 'border-[#E2E8F0] dark:border-slate-800 text-[#64748B] dark:text-slate-400'
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{center.locationArea}</span>
                </div>
                <span className="font-semibold shrink-0">Daily 7 Days</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* 2. Modern Filter Bar: Clean Route Dropdown / Combo-Box + Search */}
      <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-[#E2E8F0] dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#F0FDF4] dark:bg-emerald-950/60 text-[#006B45] dark:text-emerald-400 flex items-center justify-center border border-[#D1FAE5] dark:border-emerald-800/70">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#0F172A] dark:text-slate-100">
                Transportation Filters
              </h2>
              <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                Filter by Route or search specific pickup stops for{' '}
                <span className="font-semibold text-[#006B45] dark:text-emerald-400">
                  {activeCenter.shortName}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {(selectedRouteId !== 'all' || searchQuery) && (
              <button
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#64748B] dark:text-slate-300 hover:text-[#0F172A] dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                title="Reset filters"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#006B45] dark:text-emerald-400" />
                <span className="hidden sm:inline">Reset Filters</span>
              </button>
            )}

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#F0FDF4] dark:bg-emerald-950/60 text-[#006B45] dark:text-emerald-300 border border-[#D1FAE5] dark:border-emerald-800/70 hover:bg-[#D1FAE5] dark:hover:bg-emerald-900/60 transition-colors"
              title="Print schedule"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* Filter Inputs Grid: Route Dropdown Combo-box + Search Bar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-start">
          {/* A. Clean Modern Route Combo-Box (Col 1-7) */}
          <div className="md:col-span-7 relative" ref={routeDropdownRef}>
            <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-200 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Bus className="w-3.5 h-3.5 text-[#006B45] dark:text-emerald-400" />
                <span>Select Route</span>
              </span>
              <span className="text-[10px] font-semibold text-[#64748B] dark:text-slate-400">
                {centerRoutes.length} Available in {activeCenter.shortName}
              </span>
            </label>

            {/* Combobox Trigger Button */}
            <button
              type="button"
              onClick={() => setIsRouteDropdownOpen(!isRouteDropdownOpen)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 bg-[#F8FAFC] dark:bg-slate-900 border rounded-xl text-left transition-all text-xs sm:text-sm ${
                isRouteDropdownOpen
                  ? 'border-[#006B45] ring-2 ring-[#006B45]/20 bg-white dark:bg-slate-800'
                  : selectedRouteId !== 'all'
                  ? 'border-[#006B45] bg-[#F0FDF4]/40 dark:bg-emerald-950/30 font-medium'
                  : 'border-[#CBD5E1] dark:border-slate-700 hover:border-[#94A3B8] dark:hover:border-slate-600 hover:bg-white dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate flex-1 min-w-0 pr-2">
                {activeRouteObj ? (
                  <>
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-[#006B45] text-white shrink-0 shadow-2xs">
                      {activeRouteObj.routeCode}
                    </span>
                    <span className="truncate font-semibold text-[#0F172A] dark:text-slate-100">
                      {activeRouteObj.title}
                    </span>
                    <span className="hidden sm:inline-block text-[11px] px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-[#475569] dark:text-slate-300 shrink-0">
                      {activeRouteObj.trips.length} Trips • {activeRouteObj.capacity} Pax
                    </span>
                  </>
                ) : (
                  <>
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-slate-200 dark:bg-slate-700 text-[#475569] dark:text-slate-200 shrink-0">
                      ALL
                    </span>
                    <span className="font-semibold text-[#0F172A] dark:text-slate-100">
                      All Routes ({centerRoutes.length} Lines)
                    </span>
                  </>
                )}
              </div>
              <ChevronDown
                className={`w-4 h-4 text-[#64748B] dark:text-slate-400 shrink-0 transition-transform duration-200 ${
                  isRouteDropdownOpen ? 'rotate-180 text-[#006B45] dark:text-emerald-400' : ''
                }`}
              />
            </button>

            {/* Combobox Dropdown Menu */}
            {isRouteDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-white dark:bg-[#0F172A] rounded-xl border border-[#CBD5E1] dark:border-slate-700 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                {/* Search inside combobox */}
                <div className="p-2 border-b border-[#E2E8F0] dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={routeSearchTerm}
                      onChange={(e) => setRouteSearchTerm(e.target.value)}
                      placeholder="Type route name or stop (e.g. Route 1, Sonapur)..."
                      className="w-full pl-8 pr-7 py-1.5 text-xs bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 rounded-lg text-[#0F172A] dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#006B45] focus:border-[#006B45]"
                      autoFocus
                    />
                    {routeSearchTerm && (
                      <button
                        onClick={() => setRouteSearchTerm('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-slate-200"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Dropdown Options List */}
                <div className="max-h-64 overflow-y-auto py-1 divide-y divide-[#F1F5F9] dark:divide-slate-800">
                  {/* Option: All Routes */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRouteId('all');
                      setIsRouteDropdownOpen(false);
                      setRouteSearchTerm('');
                    }}
                    className={`w-full text-left px-3.5 py-2.5 text-xs flex items-center justify-between transition-colors ${
                      selectedRouteId === 'all'
                        ? 'bg-[#F0FDF4] dark:bg-emerald-950/50 text-[#006B45] dark:text-emerald-300 font-bold'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-[#0F172A] dark:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          selectedRouteId === 'all'
                            ? 'bg-[#006B45] text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-[#475569] dark:text-slate-300'
                        }`}
                      >
                        ALL
                      </span>
                      <div>
                        <span className="font-semibold block">
                          All Routes in {activeCenter.shortName}
                        </span>
                        <span className="text-[10px] text-[#64748B] dark:text-slate-400">
                          Show all {centerRoutes.length} lines simultaneously
                        </span>
                      </div>
                    </div>
                    {selectedRouteId === 'all' && (
                      <Check className="w-4 h-4 text-[#006B45] dark:text-emerald-400 shrink-0" />
                    )}
                  </button>

                  {/* Individual Routes */}
                  {comboFilteredRoutes.map((route) => {
                    const isSelected = selectedRouteId === route.id;
                    return (
                      <button
                        key={route.id}
                        type="button"
                        onClick={() => {
                          setSelectedRouteId(route.id);
                          setIsRouteDropdownOpen(false);
                          setRouteSearchTerm('');
                        }}
                        className={`w-full text-left px-3.5 py-2.5 text-xs flex items-center justify-between gap-2 transition-colors ${
                          isSelected
                            ? 'bg-[#F0FDF4] dark:bg-emerald-950/50 text-[#006B45] dark:text-emerald-300 font-bold'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-[#0F172A] dark:text-slate-200'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                isSelected
                                  ? 'bg-[#006B45] text-white'
                                  : 'bg-slate-200 dark:bg-slate-700 text-[#0F172A] dark:text-slate-200'
                              }`}
                            >
                              {route.routeCode}
                            </span>
                            <span className="text-[10px] text-[#64748B] dark:text-slate-400">
                              • {route.trips.length} Trips • {route.capacity} Pax
                            </span>
                          </div>
                          <p className="truncate font-semibold text-[#0F172A] dark:text-slate-100">
                            {route.title}
                          </p>
                          <p className="text-[10px] text-[#64748B] dark:text-slate-400 truncate mt-0.5">
                            {route.stops.map((s) => s.name).join(' → ')}
                          </p>
                        </div>
                        {isSelected && (
                          <Check className="w-4 h-4 text-[#006B45] dark:text-emerald-400 shrink-0 ml-1" />
                        )}
                      </button>
                    );
                  })}

                  {comboFilteredRoutes.length === 0 && (
                    <div className="p-4 text-center text-xs text-[#64748B] dark:text-slate-400">
                      No routes match &quot;{routeSearchTerm}&quot;
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* B. Search Input by Stop / Landmark / Area (Col 8-12) */}
          <div className="md:col-span-5 relative">
            <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-200 mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#006B45] dark:text-emerald-400" />
              <span>Search Stop, Landmark, or Area</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#64748B]">
                <Search className="w-4 h-4 text-[#006B45] dark:text-emerald-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g. Abu Hail, BurJuman, Sonapur, Nesto..."
                className="w-full pl-9 pr-9 py-2.5 text-xs sm:text-sm bg-[#F8FAFC] dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded-xl text-[#0F172A] dark:text-slate-100 placeholder-[#94A3B8] dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006B45] focus:border-[#006B45] transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-slate-200"
                  title="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* C. Active Route Summary Pill (When a specific route is selected) */}
        {activeRouteObj && (
          <div className="pt-2 border-t border-[#E2E8F0] dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-[#64748B] dark:text-slate-400">Filtered by:</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F0FDF4] dark:bg-emerald-950/60 text-[#064E3B] dark:text-emerald-300 font-bold border border-[#D1FAE5] dark:border-emerald-800/70">
                <Bus className="w-3.5 h-3.5 text-[#006B45] dark:text-emerald-400" />
                <span>{activeRouteObj.routeCode}: {activeRouteObj.title}</span>
              </span>
              <span className="text-[11px] text-[#64748B] dark:text-slate-400">
                ({activeRouteObj.trips.length} Departures • {activeRouteObj.capacity} Seater Coach)
              </span>
            </div>
            <button
              onClick={() => setSelectedRouteId('all')}
              className="text-xs text-[#006B45] dark:text-emerald-400 hover:underline font-semibold flex items-center gap-1"
            >
              <span>Show All {centerRoutes.length} Routes</span>
            </button>
          </div>
        )}
      </div>

      {/* 3. Center Quick Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-[#0F172A] p-3.5 rounded-xl border border-[#E2E8F0] dark:border-slate-800 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#F0FDF4] dark:bg-emerald-950/60 text-[#006B45] dark:text-emerald-400 border border-[#D1FAE5] dark:border-emerald-800/70 flex items-center justify-center shrink-0">
            <Bus className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 block">
              Displayed Lines
            </span>
            <span className="text-base font-bold text-[#0F172A] dark:text-slate-100">
              {filteredRoutes.length} of {centerRoutes.length} Routes
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0F172A] p-3.5 rounded-xl border border-[#E2E8F0] dark:border-slate-800 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#F0FDF4] dark:bg-emerald-950/60 text-[#006B45] dark:text-emerald-400 border border-[#D1FAE5] dark:border-emerald-800/70 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 block">
              Scheduled Trips
            </span>
            <span className="text-base font-bold text-[#0F172A] dark:text-slate-100">
              {totalDailyTrips} Departures
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0F172A] p-3.5 rounded-xl border border-[#E2E8F0] dark:border-slate-800 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#F0FDF4] dark:bg-emerald-950/60 text-[#006B45] dark:text-emerald-400 border border-[#D1FAE5] dark:border-emerald-800/70 flex items-center justify-center shrink-0">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 block">
              Active Stations
            </span>
            <span className="text-base font-bold text-[#0F172A] dark:text-slate-100">
              {totalUniqueStops} Official Stops
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0F172A] p-3.5 rounded-xl border border-[#E2E8F0] dark:border-slate-800 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#F0FDF4] dark:bg-emerald-950/60 text-[#006B45] dark:text-emerald-400 border border-[#D1FAE5] dark:border-emerald-800/70 flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 block">
              Operating Days
            </span>
            <span className="text-base font-bold text-[#0F172A] dark:text-slate-100">
              7 Days / Full Week
            </span>
          </div>
        </div>
      </div>

      {/* Advisory Notice */}
      <div className="bg-[#F0FDF4] dark:bg-emerald-950/40 border border-[#D1FAE5] dark:border-emerald-800/70 rounded-xl p-3.5 flex items-start gap-3 text-xs text-[#064E3B] dark:text-emerald-200">
        <AlertCircle className="w-4 h-4 text-[#059669] dark:text-emerald-400 shrink-0 mt-0.5" />
        <div className="flex-1 leading-relaxed">
          <span className="font-bold">Student Guidance:</span> Eco Drive provides complimentary transportation for registered students. Please arrive at your selected pickup point at least <strong>5 to 10 minutes</strong> before the scheduled departure time. Click the location links below to open the exact Google Maps navigation pin.
        </div>
      </div>

      {/* 4. Filtered Route Schedules */}
      {filteredRoutes.length === 0 ? (
        <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-[#E2E8F0] dark:border-slate-800 p-12 text-center shadow-xs">
          <Compass className="w-12 h-12 text-[#94A3B8] dark:text-slate-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-[#0F172A] dark:text-slate-100">
            No Matching Routes or Stops Found
          </h3>
          <p className="text-xs text-[#64748B] dark:text-slate-400 max-w-md mx-auto mt-1">
            No route matches your filter in {activeCenter.name}. Try selecting
            &quot;All Routes&quot; or clearing your search term.
          </p>
          <button
            onClick={handleResetFilters}
            className="mt-4 px-4 py-2 bg-[#006B45] text-white text-xs font-semibold rounded-xl hover:bg-[#064E3B] transition-colors"
          >
            Clear All Filters
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredRoutes.map((route) => {
            return (
              <RouteScheduleCard
                key={route.id}
                route={route}
                searchQuery={searchQuery}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Single Route Card with interactive Stops timeline & Tabular Timetable
// ============================================================================
interface RouteScheduleCardProps {
  route: TransportRoute;
  searchQuery: string;
}

const RouteScheduleCard: React.FC<RouteScheduleCardProps> = ({
  route,
  searchQuery,
}) => {
  // Helper to highlight query matches
  const highlightMatch = (text: string) => {
    if (!searchQuery.trim()) return text;
    const regex = new RegExp(`(${searchQuery.trim()})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 dark:bg-amber-400 text-[#0F172A] rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-xs overflow-hidden transition-all hover:border-[#CBD5E1] dark:hover:border-slate-700">
      {/* Route Header Banner */}
      <div className="bg-[#064E3B] dark:bg-[#043427] text-white p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider bg-white/20 text-white border border-white/20">
              {route.routeCode}
            </span>
            <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-400/20 text-emerald-200 border border-emerald-400/30">
              {route.scheduleType}
            </span>
            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-black/20 text-emerald-100 border border-white/10">
              <Users className="w-3 h-3 text-emerald-300" />
              <span>{route.capacity} Passengers Capacity</span>
            </span>
          </div>
          <h2 className="text-base sm:text-lg font-bold tracking-tight text-white">
            {highlightMatch(route.title)}
          </h2>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="bg-[#004d32] px-3 py-1.5 rounded-xl border border-emerald-500/20 text-xs text-right">
            <span className="block text-[10px] text-emerald-200/70 uppercase font-semibold">Total Trips</span>
            <span className="text-sm font-bold text-white">{route.trips.length} Departures</span>
          </div>
        </div>
      </div>

      {/* Stops Timeline / Navigation Links */}
      <div className="bg-[#F8FAFC] dark:bg-slate-900/70 border-b border-[#E2E8F0] dark:border-slate-800 p-4 sm:px-5">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400 mb-2 flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-[#006B45] dark:text-emerald-400" />
          <span>Pick-up Stations & Precise GPS Pins:</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {route.stops.map((stop: TransportStop, idx: number) => {
            return (
              <div
                key={stop.id}
                className="bg-white dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-slate-800 rounded-xl p-3 flex flex-col justify-between gap-2 shadow-2xs hover:border-[#006B45]/40 dark:hover:border-emerald-500/50 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-[#475569] dark:text-slate-300 rounded">
                      Stop {idx + 1}
                    </span>
                    {stop.pinUrl && (
                      <span className="text-[9px] font-semibold text-[#006B45] dark:text-emerald-400 flex items-center gap-0.5">
                        <MapPin className="w-2.5 h-2.5" />
                        <span>GPS Active</span>
                      </span>
                    )}
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold text-[#0F172A] dark:text-slate-100 leading-snug">
                    {highlightMatch(stop.name)}
                  </h3>
                  <p className="text-[11px] text-[#64748B] dark:text-slate-400 mt-0.5 line-clamp-2">
                    {highlightMatch(stop.landmark)}
                  </p>
                </div>

                {stop.pinUrl ? (
                  <a
                    href={stop.pinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#F0FDF4] dark:bg-emerald-950/60 hover:bg-[#D1FAE5] dark:hover:bg-emerald-900/60 text-[#006B45] dark:text-emerald-300 text-[11px] font-semibold border border-[#D1FAE5] dark:border-emerald-800/70 transition-colors mt-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Open in Google Maps</span>
                  </a>
                ) : (
                  <span className="text-[10px] text-[#94A3B8] dark:text-slate-500 italic mt-1">
                    Designated stop at {stop.name}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Schedule Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-[#F1F5F9] dark:bg-slate-900 border-b border-[#E2E8F0] dark:border-slate-800 text-[#475569] dark:text-slate-300 font-bold text-[11px] uppercase tracking-wider">
              <th className="py-3 px-4 w-16 text-center">Trip #</th>
              {route.stops.map((stop) => (
                <th key={stop.id} className="py-3 px-4 min-w-[130px]">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[#006B45] dark:text-emerald-400" />
                    <span className="truncate">{stop.name}</span>
                  </div>
                  <span className="block text-[9px] font-normal text-[#64748B] dark:text-slate-400 lowercase">
                    pickup
                  </span>
                </th>
              ))}
              <th className="py-3 px-4 bg-[#ECFDF5] dark:bg-emerald-950/60 text-[#064E3B] dark:text-emerald-200 min-w-[140px]">
                <div className="flex items-center gap-1 font-extrabold">
                  <MapPin className="w-3 h-3 text-[#059669] dark:text-emerald-400" />
                  <span>ETA {route.centerEtaName}</span>
                </div>
                <span className="block text-[9px] font-normal text-[#064E3B]/70 dark:text-emerald-300/70">
                  arrival at institute
                </span>
              </th>
              <th className="py-3 px-4 bg-[#F0FDF4] dark:bg-emerald-950/40 text-[#064E3B] dark:text-emerald-200 min-w-[140px]">
                <div className="flex items-center gap-1 font-extrabold">
                  <Bus className="w-3 h-3 text-[#059669] dark:text-emerald-400" />
                  <span>DEP {route.centerEtaName}</span>
                </div>
                <span className="block text-[9px] font-normal text-[#064E3B]/70 dark:text-emerald-300/70">
                  return departure
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0] dark:divide-slate-800">
            {route.trips.map((trip, idx) => {
              const isEven = idx % 2 === 0;
              return (
                <tr
                  key={trip.id}
                  className={`hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 transition-colors ${
                    isEven ? 'bg-white dark:bg-[#0F172A]' : 'bg-[#FAFAFA] dark:bg-slate-900/40'
                  }`}
                >
                  <td className="py-3 px-4 font-bold text-center text-[#64748B] dark:text-slate-400">
                    <span className="inline-block w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-[#0F172A] dark:text-slate-200 leading-6 text-[11px]">
                      {idx + 1}
                    </span>
                  </td>

                  {/* Pickup times for each stop */}
                  {route.stops.map((stop) => {
                    const time = trip.stopTimes[stop.id];
                    return (
                      <td key={stop.id} className="py-3 px-4 font-medium text-[#0F172A] dark:text-slate-100">
                        {time ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[#0F172A] dark:text-slate-100 font-semibold text-[11px]">
                            {time}
                          </span>
                        ) : (
                          <span className="text-[#94A3B8] dark:text-slate-500">—</span>
                        )}
                      </td>
                    );
                  })}

                  {/* ETA at Eco Drive */}
                  <td className="py-3 px-4 bg-[#ECFDF5]/50 dark:bg-emerald-950/30 font-bold text-[#064E3B] dark:text-emerald-200">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#D1FAE5] dark:bg-emerald-900/60 text-[#064E3B] dark:text-emerald-200 text-xs">
                      {trip.eta}
                    </span>
                  </td>

                  {/* Departure from Eco Drive */}
                  <td className="py-3 px-4 bg-[#F0FDF4]/50 dark:bg-emerald-950/20 font-bold text-[#064E3B] dark:text-emerald-200">
                    <div className="flex flex-col">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#006B45] text-white text-xs w-max shadow-2xs">
                        {trip.departure}
                      </span>
                      {trip.notes && (
                        <span className="text-[10px] text-[#059669] dark:text-emerald-400 font-medium mt-1">
                          {trip.notes}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
