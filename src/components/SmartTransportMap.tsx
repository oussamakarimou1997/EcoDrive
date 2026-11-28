import React, {useEffect,useRef,useState} from 'react';
import {LngLatBounds, type Map as LibreMap} from 'maplibre-gl';
import {MapPin,Check,X,Crosshair,Move,Eye} from 'lucide-react';
import type {LatLng,RankedStationResult,StudentLocation,TransportStation,WalkingRouteInfo} from '../types/smartTransport';
import {DUBAI_DEFAULT_CENTER} from '../utils/transportFinderUtils';
import {AddressAutocompleteInput} from './AddressAutocompleteInput';
import {OpenMapCanvas} from './OpenMapCanvas';
import {OpenMapMarkers} from './OpenMapMarkers';
import {OpenWalkingRouteOverlay} from './OpenWalkingRouteOverlay';
import {reverseDubaiAddress} from '../services/openMapGeocoding';
interface CenterPin {
  id: 'al_quoz' | 'dic';
  lat: number;
  lng: number;
  label: string;
  pinUrl?: string;
}

interface SmartTransportMapProps {
  studentLocation: StudentLocation | null;
  allMappedStations: TransportStation[];
  nearestStation: RankedStationResult | null;
  selectedStationId: string | null;
  focusStationTrigger?: number;
  schoolCenters: CenterPin[];
  isPickerMode: boolean;
  onClosePickerMode: () => void;
  onConfirmPickedLocation: (loc: StudentLocation) => void;
  onSelectStationFromMap: (stationId: string) => void;
  onWalkingRouteUpdate: (info: WalkingRouteInfo) => void;
  onOpenStationDetails: (station: TransportStation) => void;
}

export const SmartTransportMap: React.FC<SmartTransportMapProps> = ({
  studentLocation,
  allMappedStations,
  nearestStation,
  selectedStationId,
  focusStationTrigger = 0,
  schoolCenters,
  isPickerMode,
  onClosePickerMode,
  onConfirmPickedLocation,
  onSelectStationFromMap,
  onWalkingRouteUpdate,
  onOpenStationDetails,
}) => {
  const [map, setMap] = useState<LibreMap | null>(null);
  const [draftPick, setDraftPick] = useState<StudentLocation | null>(studentLocation);
  const [pickerSearchText, setPickerSearchText] = useState('');
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [fitTrigger, setFitTrigger] = useState(0);
  const [fitAllTrigger, setFitAllTrigger] = useState(0);
  const request = useRef<AbortController | null>(null);
  useEffect(() => { request.current?.abort(); setIsReverseGeocoding(false); if (isPickerMode) setDraftPick(studentLocation); return () => request.current?.abort(); }, [isPickerMode, studentLocation]);
  const activeStudentPoint = isPickerMode ? draftPick : studentLocation;
  const pick = async (point: LatLng) => {
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    if (isPickerMode) { setDraftPick({...point, label: `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`, source:'map'}); setIsReverseGeocoding(true); }
    try { const loc = await reverseDubaiAddress(point.lat, point.lng, 'map', controller.signal); if (!controller.signal.aborted) { if (isPickerMode) setDraftPick(loc); else onConfirmPickedLocation(loc); } }
    catch { /* aborted lookup */ } finally { if (!controller.signal.aborted) setIsReverseGeocoding(false); }
  };
  useEffect(() => {
    if (!map || !activeStudentPoint) return;
    const bounds = new LngLatBounds().extend([activeStudentPoint.lng, activeStudentPoint.lat]);
    const target = !isPickerMode && nearestStation?.station.coordinates;
    if (target) bounds.extend([target.lng,target.lat]);
    map.fitBounds(bounds,{padding:65,maxZoom:15,duration:500});
  },[map,fitTrigger,isPickerMode,studentLocation?.lat,studentLocation?.lng,nearestStation?.station.id]);
  useEffect(() => {
    if (!map || !fitAllTrigger) return;
    const bounds = new LngLatBounds();
    allMappedStations.forEach(s => { if(s.coordinates) bounds.extend([s.coordinates.lng,s.coordinates.lat]); });
    if(studentLocation) bounds.extend([studentLocation.lng,studentLocation.lat]);
    if(!bounds.isEmpty()) map.fitBounds(bounds,{padding:50,maxZoom:15});
  },[map,fitAllTrigger]);
  return (
    <div
      className={`bg-white dark:bg-[#0F172A] rounded-2xl border overflow-hidden shadow-xs transition-all ${
        isPickerMode
          ? 'border-[#006B45] ring-2 ring-[#006B45]/25'
          : 'border-[#E2E8F0] dark:border-slate-800'
      }`}
    >
      {/* Map Header & Controls */}
      <div className="p-4 sm:px-5 border-b border-[#E2E8F0] dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-900/90 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#064E3B] text-white flex items-center justify-center">
              <MapPin className="w-4 h-4 text-emerald-300" />
            </div>
            <h2 className="text-sm sm:text-base font-bold text-[#0F172A] dark:text-slate-100">
              {isPickerMode
                ? 'Choose Your Location on the Dubai Map'
                : 'Interactive Dubai Transit Map'}
            </h2>
          </div>
          <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
            {isPickerMode
              ? 'Click anywhere on the map, search a landmark below, or drag the blue pin to set your exact pickup starting point.'
              : 'View your location, the nearest Eco Drive stop, walking route, nearby pickup stations, and Eco Drive training centres.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isPickerMode && (
            <>
              {studentLocation && nearestStation && (
                <button
                  type="button"
                  onClick={() => setFitTrigger((c) => c + 1)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#F0FDF4] dark:bg-emerald-950/60 text-[#006B45] dark:text-emerald-300 border border-[#D1FAE5] dark:border-emerald-800/70 hover:bg-[#D1FAE5] dark:hover:bg-emerald-900/60 transition-colors"
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  <span>Focus Route</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setFitAllTrigger((c) => c + 1)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 text-[#0F172A] dark:text-slate-100 border border-[#CBD5E1] dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                <Eye className="w-3.5 h-3.5 text-[#006B45] dark:text-emerald-400" />
                <span>Show All Stops</span>
              </button>
            </>
          )}
          {isPickerMode && (
            <button
              type="button"
              onClick={onClosePickerMode}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 text-[#64748B] dark:text-slate-300 border border-[#CBD5E1] dark:border-slate-700 hover:text-[#0F172A] dark:hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cancel Map Picker</span>
            </button>
          )}
        </div>
      </div>

      {/* Picker Mode Toolbar: Search Landmark + Confirm Selected Point */}
      {isPickerMode && (
        <div className="p-4 bg-[#F0FDF4] dark:bg-emerald-950/40 border-b border-[#D1FAE5] dark:border-emerald-800/70 space-y-3">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
            <div className="lg:col-span-6">
              <AddressAutocompleteInput
                value={pickerSearchText}
                onChange={setPickerSearchText}
                placeholder="Jump map to a Dubai area or landmark (e.g. BurJuman, Marina)..."
                compact
                onSelectLocation={(loc) => {
                  request.current?.abort(); setIsReverseGeocoding(false); setDraftPick(loc);
                  map?.flyTo({center:[loc.lng,loc.lat],zoom:15});
                  setFitTrigger((c) => c + 1);
                }}
              />
            </div>

            <div className="lg:col-span-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white dark:bg-[#0F172A] px-3.5 py-2.5 rounded-xl border border-[#D1FAE5] dark:border-emerald-800/70">
              <div className="min-w-0 flex-1">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-[#006B45] dark:text-emerald-400">
                  Selected Pin Location
                </span>
                <span className="block text-xs font-semibold text-[#0F172A] dark:text-slate-100 truncate">
                  {isReverseGeocoding
                    ? 'Resolving Dubai address...'
                    : draftPick?.label || 'Click on the map to drop your pin'}
                </span>
              </div>
              <button
                type="button"
                disabled={!draftPick || isReverseGeocoding}
                onClick={() => {
                  if (draftPick) {
                    onConfirmPickedLocation(draftPick);
                    onClosePickerMode();
                  }
                }}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#006B45] hover:bg-[#064E3B] disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-colors shrink-0"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Confirm Selected Location</span>
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-[#064E3B] dark:text-emerald-300">
            <Move className="w-3.5 h-3.5 text-[#059669] dark:text-emerald-400 shrink-0" />
            <span>
              Tip: Click anywhere in Dubai or drag the blue <strong>Your Location</strong> pin to fine-tune your exact building or street corner.
            </span>
          </div>
        </div>
      )}

      <OpenMapCanvas center={DUBAI_DEFAULT_CENTER} onReady={setMap} onPick={pick} pickerMode={isPickerMode}/>
      <OpenMapMarkers map={map} studentLocation={activeStudentPoint} allMappedStations={allMappedStations} nearestStation={nearestStation} selectedStationId={selectedStationId} schoolCenters={schoolCenters} isPickerMode={isPickerMode} focusStationTrigger={focusStationTrigger} onDragLocation={pick} onSelectStationFromMap={onSelectStationFromMap} onOpenStationDetails={onOpenStationDetails}/>
      <OpenWalkingRouteOverlay map={map} origin={isPickerMode ? null : studentLocation} destination={isPickerMode ? null : nearestStation?.station.coordinates ?? null} onRouteUpdate={onWalkingRouteUpdate}/>
      {/* Map Legend */}
      <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900 border-t border-[#E2E8F0] dark:border-slate-800 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#475569] dark:text-slate-300">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-blue-600 border border-white shadow-2xs inline-block" />
          <span className="font-medium">Your Location (Draggable)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#064E3B] border border-emerald-300 inline-block" />
          <span className="font-medium">Nearest Pickup Station</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-white dark:bg-slate-200 border-2 border-[#006B45] dark:border-emerald-400 inline-block" />
          <span className="font-medium">Other Pickup Stations</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-amber-500 border border-white inline-block" />
          <span className="font-medium">Eco Drive Training Centres</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-5 h-1 bg-[#059669] dark:bg-emerald-400 rounded-full inline-block" />
          <span className="font-medium">Walking Route</span>
        </div>
      </div>
    </div>
  );
};
