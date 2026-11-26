import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { createRoot } from 'react-dom/client';
import { Bus, Building2, Navigation, ExternalLink } from 'lucide-react';
import type { LatLng, StudentLocation, TransportStation, RankedStationResult } from '../types/smartTransport';
import { buildGoogleMapsDirectionsUrl } from '../utils/transportFinderUtils';

interface CenterPin { id: 'al_quoz' | 'dic'; lat: number; lng: number; label: string; pinUrl?: string }
interface Props {
  map: maplibregl.Map | null;
  studentLocation: StudentLocation | null;
  allMappedStations: TransportStation[];
  nearestStation: RankedStationResult | null;
  selectedStationId: string | null;
  schoolCenters: CenterPin[];
  isPickerMode: boolean;
  focusStationTrigger?: number;
  onDragLocation: (point: LatLng) => void;
  onSelectStationFromMap: (id: string) => void;
  onOpenStationDetails: (station: TransportStation) => void;
}

const valid = (p: LatLng | null): p is LatLng => !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;

export function OpenMapMarkers(props: Props) {
  const latest = useRef(props);
  useEffect(() => { latest.current = props; }, [props]);
  const { map, studentLocation, allMappedStations, nearestStation, selectedStationId, schoolCenters, isPickerMode, focusStationTrigger } = props;
  const popups = useRef(new Map<string, maplibregl.Popup>());
  useEffect(() => {
    if (!map) return;
    const cleanups: (() => void)[] = [];
    for (const station of allMappedStations) {
      if (!valid(station.coordinates)) continue;
      const nearest = !isPickerMode && nearestStation?.station.id === station.id;
      const selected = !isPickerMode && selectedStationId === station.id;
      const el = document.createElement('button');
      el.type = 'button'; el.title = station.name; el.setAttribute('aria-label', station.name);
      el.className = nearest ? 'flex items-center gap-1 rounded-full bg-[#064E3B] px-2 py-1 text-[11px] font-bold text-white border-2 border-emerald-300 shadow-lg whitespace-nowrap' : `flex items-center justify-center w-8 h-8 rounded-full border-2 shadow-md ${selected ? 'bg-[#006B45] text-white border-white' : 'bg-white text-[#064E3B] border-[#006B45]'}`;
      const root = createRoot(el);
      root.render(<><Bus size={16}/>{nearest && <span>Nearest: {station.name}</span>}</>);
      const content = document.createElement('div');
      const popupRoot = createRoot(content);
      popupRoot.render(<div className="p-1 max-w-[260px] text-slate-900">
        <div className="text-[10px] font-bold text-[#006B45]">{station.routes.map(r => r.routeCode).join(' · ')}</div>
        <h4 className="text-sm font-bold text-[#064E3B]">{station.name}</h4>
        <p className="text-xs text-slate-600">{station.landmarks[0]}</p>
        <p className="mt-2 text-[10px] font-bold">Scheduled Pickups ({station.departures.length} trips)</p>
        <div className="flex flex-wrap gap-1">{station.departures.slice(0,6).map((d,i) => <span key={`${d.tripId}-${i}`} className="rounded bg-slate-100 px-1 text-[10px] font-mono">{d.pickupTime}</span>)}{station.departures.length > 6 && <span className="text-[10px]">+{station.departures.length-6} more</span>}</div>
        <div className="mt-2 flex gap-2"><button type="button" className="rounded bg-[#006B45] px-2 py-1 text-xs text-white" onClick={() => latest.current.onOpenStationDetails(station)}>Full Schedule</button><a className="text-xs text-[#006B45]" href={buildGoogleMapsDirectionsUrl(studentLocation, station)} target="_blank" rel="noopener noreferrer">Directions</a></div>
      </div>);
      const popup = new maplibregl.Popup({offset: 20}).setDOMContent(content).setLngLat([station.coordinates.lng, station.coordinates.lat]);
      const marker = new maplibregl.Marker({element:el}).setLngLat([station.coordinates.lng,station.coordinates.lat]).addTo(map);
      popups.current.set(station.id,popup);
      const click = (e: MouseEvent) => { e.stopPropagation(); popups.current.forEach(p => p.remove()); popup.addTo(map); latest.current.onSelectStationFromMap(station.id); };
      el.addEventListener('click',click);
      cleanups.push(() => { el.removeEventListener('click',click); popup.remove(); marker.remove(); popups.current.delete(station.id); queueMicrotask(() => {root.unmount(); popupRoot.unmount();}); });
    }
    for (const center of schoolCenters) {
      if (!valid(center)) continue;
      const el = document.createElement('button'); el.type='button'; el.setAttribute('aria-label',center.label);
      el.className='flex items-center gap-1 rounded-lg bg-amber-500 px-2 py-1 text-[10px] font-bold text-slate-950 border-2 border-white shadow';
      const root=createRoot(el); root.render(<><Building2 size={14}/>{center.id==='al_quoz'?'Al Quoz Centre':'DIC Centre'}</>);
      const content=document.createElement('div'); const popupRoot=createRoot(content);
      popupRoot.render(<div className="text-slate-900"><h4 className="font-bold">{center.label}</h4>{center.pinUrl && <a href={center.pinUrl} target="_blank" rel="noopener noreferrer" className="flex gap-1 text-xs text-[#006B45]"><ExternalLink size={12}/>Open Centre in Google Maps</a>}</div>);
      const popup=new maplibregl.Popup({offset:20}).setDOMContent(content);
      const marker=new maplibregl.Marker({element:el}).setLngLat([center.lng,center.lat]).setPopup(popup).addTo(map);
      cleanups.push(()=>{popup.remove();marker.remove();queueMicrotask(()=>{root.unmount();popupRoot.unmount();});});
    }
    return ()=>cleanups.forEach(fn=>fn());
  }, [map, allMappedStations, nearestStation?.station.id, selectedStationId, schoolCenters, isPickerMode, studentLocation?.lat, studentLocation?.lng]);
  useEffect(()=>{
    if (!map || !valid(studentLocation)) return;
    const el=document.createElement('div'); el.className='flex items-center gap-1 rounded-full bg-blue-600 px-2 py-1 text-white text-xs font-bold border-2 border-white shadow cursor-grab';
    const root=createRoot(el);root.render(<><Navigation size={14}/>Your Location</>);
    const marker=new maplibregl.Marker({element:el,draggable:true}).setLngLat([studentLocation.lng,studentLocation.lat]).addTo(map);
    const drag=()=>{const p=marker.getLngLat();latest.current.onDragLocation({lat:p.lat,lng:p.lng});};
    marker.on('dragend',drag);
    return ()=>{marker.off('dragend',drag);marker.remove();queueMicrotask(()=>root.unmount());};
  },[map,studentLocation?.lat,studentLocation?.lng]);
  useEffect(()=>{
    const station=nearestStation?.station;
    if (!map || !focusStationTrigger || isPickerMode || !station || !valid(station.coordinates)) return;
    map.easeTo({center:[station.coordinates.lng,station.coordinates.lat],zoom:15});
    popups.current.get(station.id)?.addTo(map);
  },[map,focusStationTrigger,nearestStation?.station.id,isPickerMode]);
  return null;
}
