import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Map as GoogleMap,
  AdvancedMarker,
  InfoWindow,
  Pin,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  Bus,
  Building2,
  MapPin,
  Navigation,
  ExternalLink,
  Check,
  X,
  Crosshair,
  Move,
  Eye,
} from 'lucide-react';
import {
  LatLng,
  RankedStationResult,
  StudentLocation,
  TransportStation,
  WalkingRouteInfo,
} from '../types/smartTransport';
import {
  DUBAI_DEFAULT_CENTER,
  buildGoogleMapsDirectionsUrl,
  formatStraightLineDistance,
} from '../utils/transportFinderUtils';
import { AddressAutocompleteInput } from './AddressAutocompleteInput';

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

function isQuotaRejection(err: unknown): boolean {
  const msg = String(err instanceof Error ? err.message : err || '');
  return (
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('OVER_QUERY_LIMIT') ||
    msg.includes('429')
  );
}

// ---------------------------------------------------------------------------
// Walking Route Polyline & Distance/Duration Calculator (Routes JS SDK)
// ---------------------------------------------------------------------------
interface WalkingRouteOverlayProps {
  origin: LatLng | null;
  destination: LatLng | null;
  onRouteUpdate: (info: WalkingRouteInfo) => void;
}

const WalkingRouteOverlay: React.FC<WalkingRouteOverlayProps> = ({
  origin,
  destination,
  onRouteUpdate,
}) => {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    if (!origin || !destination) {
      onRouteUpdate({ status: 'idle' });
      return;
    }

    if (!routesLib || !map) {
      return;
    }

    let cancelled = false;
    onRouteUpdate({ status: 'loading' });

    const request: google.maps.routes.ComputeRoutesRequest = {
      origin: { lat: origin.lat, lng: origin.lng },
      destination: { lat: destination.lat, lng: destination.lng },
      travelMode: 'WALKING',
      fields: ['path', 'distanceMeters', 'durationMillis', 'viewport'],
    };

    routesLib.Route.computeRoutes(request)
      .then(({ routes }) => {
        if (cancelled) return;
        if (!routes || routes.length === 0) {
          onRouteUpdate({
            status: 'unavailable',
            reason: 'Walking directions are unavailable between these points.',
          });
          return;
        }

        const primaryRoute = routes[0];
        const newPolylines = primaryRoute.createPolylines({
          polylineOptions: {
            strokeColor: '#059669',
            strokeOpacity: 0.9,
            strokeWeight: 5,
          },
        });
        newPolylines.forEach((poly) => poly.setMap(map));
        polylinesRef.current = newPolylines;

        if (primaryRoute.viewport) {
          map.fitBounds(primaryRoute.viewport, { top: 60, right: 50, bottom: 60, left: 50 });
        }

        onRouteUpdate({
          status: 'available',
          distanceMeters: primaryRoute.distanceMeters,
          durationMillis: primaryRoute.durationMillis ?? undefined,
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (isQuotaRejection(err)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        onRouteUpdate({
          status: 'unavailable',
          reason: 'Walking route could not be computed; straight-line distance is shown.',
        });
      });

    return () => {
      cancelled = true;
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [routesLib, map, origin?.lat, origin?.lng, destination?.lat, destination?.lng, onRouteUpdate]);

  return null;
};

// ---------------------------------------------------------------------------
// Camera Auto-Fitter Helper
// ---------------------------------------------------------------------------
interface CameraControllerProps {
  studentLocation: StudentLocation | null;
  nearestStation: RankedStationResult | null;
  allMappedStations: TransportStation[];
  fitTrigger: number;
  fitAllTrigger: number;
}

const CameraController: React.FC<CameraControllerProps> = ({
  studentLocation,
  nearestStation,
  allMappedStations,
  fitTrigger,
  fitAllTrigger,
}) => {
  const map = useMap();

  useEffect(() => {
    if (!map || fitTrigger === 0) return;
    if (studentLocation && nearestStation?.station.coordinates) {
      const bounds = new google.maps.LatLngBounds();
      bounds.extend({ lat: studentLocation.lat, lng: studentLocation.lng });
      bounds.extend(nearestStation.station.coordinates);
      map.fitBounds(bounds, { top: 70, right: 60, bottom: 70, left: 60 });
    } else if (studentLocation) {
      map.panTo({ lat: studentLocation.lat, lng: studentLocation.lng });
      map.setZoom(14);
    }
  }, [map, fitTrigger, studentLocation, nearestStation]);

  useEffect(() => {
    if (!map || fitAllTrigger === 0 || allMappedStations.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    if (studentLocation) bounds.extend({ lat: studentLocation.lat, lng: studentLocation.lng });
    allMappedStations.forEach((s) => {
      if (s.coordinates) bounds.extend(s.coordinates);
    });
    map.fitBounds(bounds, 50);
  }, [map, fitAllTrigger, allMappedStations, studentLocation]);

  return null;
};

interface CameraFocusStationProps {
  station: TransportStation | null;
  focusStationTrigger: number;
}

const CameraFocusStation: React.FC<CameraFocusStationProps> = ({
  station,
  focusStationTrigger,
}) => {
  const map = useMap();

  useEffect(() => {
    if (!map || focusStationTrigger === 0 || !station?.coordinates) return;
    map.panTo(station.coordinates);
    map.setZoom(15);
  }, [map, focusStationTrigger, station]);

  return null;
};

// ---------------------------------------------------------------------------
// Interactive Station Marker Wrapper (for InfoWindow Anchoring)
// ---------------------------------------------------------------------------
interface StationMarkerProps {
  station: TransportStation;
  isNearest: boolean;
  isSelected: boolean;
  registerMarker: (stationId: string, marker: google.maps.marker.AdvancedMarkerElement | null) => void;
  onSelect: (station: TransportStation, marker: google.maps.marker.AdvancedMarkerElement) => void;
}

const StationMarker: React.FC<StationMarkerProps> = ({
  station,
  isNearest,
  isSelected,
  registerMarker,
  onSelect,
}) => {
  const [markerInstance, setMarkerInstance] =
    useState<google.maps.marker.AdvancedMarkerElement | null>(null);

  const markerRef = useCallback(
    (m: google.maps.marker.AdvancedMarkerElement | null) => {
      setMarkerInstance(m);
      registerMarker(station.id, m);
    },
    [registerMarker, station.id]
  );

  if (!station.coordinates) return null;

  const zIndex = isNearest ? 900 : isSelected ? 800 : 200;

  return (
    <AdvancedMarker
      ref={markerRef}
      position={station.coordinates}
      zIndex={zIndex}
      title={`${station.name} (${station.centerName})`}
      onClick={() => {
        if (markerInstance) {
          onSelect(station, markerInstance);
        }
      }}
    >
      {isNearest ? (
        <div className="flex flex-col items-center cursor-pointer group">
          <div className="px-2.5 py-1 rounded-full bg-[#064E3B] text-white text-[11px] font-bold shadow-lg border-2 border-emerald-300 flex items-center gap-1 whitespace-nowrap">
            <Bus className="w-3.5 h-3.5 text-emerald-300" />
            <span>Nearest: {station.name}</span>
          </div>
          <div className="w-3 h-3 bg-[#064E3B] border-r-2 border-b-2 border-emerald-300 rotate-45 -mt-1.5" />
        </div>
      ) : (
        <div
          className={`flex items-center justify-center w-8 h-8 rounded-full shadow-md border-2 transition-transform hover:scale-110 cursor-pointer ${
            isSelected
              ? 'bg-[#006B45] text-white border-white ring-2 ring-[#006B45]'
              : 'bg-white text-[#064E3B] border-[#006B45]'
          }`}
        >
          <Bus className="w-4 h-4" />
        </div>
      )}
    </AdvancedMarker>
  );
};

// ---------------------------------------------------------------------------
// School Center Marker Wrapper
// ---------------------------------------------------------------------------
interface SchoolMarkerProps {
  center: CenterPin;
  onSelect: (center: CenterPin, marker: google.maps.marker.AdvancedMarkerElement) => void;
}

const SchoolMarker: React.FC<SchoolMarkerProps> = ({ center, onSelect }) => {
  const [markerInstance, setMarkerInstance] =
    useState<google.maps.marker.AdvancedMarkerElement | null>(null);
  const markerRef = useCallback((m: google.maps.marker.AdvancedMarkerElement | null) => {
    setMarkerInstance(m);
  }, []);

  return (
    <AdvancedMarker
      ref={markerRef}
      position={{ lat: center.lat, lng: center.lng }}
      zIndex={700}
      title={center.label}
      onClick={() => {
        if (markerInstance) {
          onSelect(center, markerInstance);
        }
      }}
    >
      <div className="flex flex-col items-center cursor-pointer">
        <div className="px-2 py-1 rounded-lg bg-amber-500 text-slate-950 text-[10px] font-extrabold shadow-md border-2 border-white flex items-center gap-1 whitespace-nowrap">
          <Building2 className="w-3 h-3" />
          <span>{center.id === 'al_quoz' ? 'Al Quoz Centre' : 'DIC Centre'}</span>
        </div>
        <div className="w-2.5 h-2.5 bg-amber-500 border-r-2 border-b-2 border-white rotate-45 -mt-1.5" />
      </div>
    </AdvancedMarker>
  );
};

// ---------------------------------------------------------------------------
// Main Interactive Map Component
// ---------------------------------------------------------------------------
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
  const [draftPick, setDraftPick] = useState<StudentLocation | null>(studentLocation);
  const [pickerSearchText, setPickerSearchText] = useState('');
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);

  const [activeInfoStation, setActiveInfoStation] = useState<TransportStation | null>(null);
  const [activeInfoCenter, setActiveInfoCenter] = useState<CenterPin | null>(null);
  const [infoAnchor, setInfoAnchor] = useState<google.maps.marker.AdvancedMarkerElement | null>(
    null
  );

  const stationMarkersRef = useRef<
    Record<string, google.maps.marker.AdvancedMarkerElement | null>
  >({});

  const registerMarker = useCallback(
    (stationId: string, marker: google.maps.marker.AdvancedMarkerElement | null) => {
      stationMarkersRef.current[stationId] = marker;
    },
    []
  );

  const [fitTrigger, setFitTrigger] = useState(0);
  const [fitAllTrigger, setFitAllTrigger] = useState(0);

  // Clear InfoWindow whenever branch stations list changes
  useEffect(() => {
    setActiveInfoStation(null);
    setActiveInfoCenter(null);
    setInfoAnchor(null);
  }, [allMappedStations]);

  // Handle programmatic "Show on Map" focus trigger
  useEffect(() => {
    if (focusStationTrigger === 0 || !nearestStation?.station) return;
    const st = nearestStation.station;
    const marker = stationMarkersRef.current[st.id];
    setActiveInfoCenter(null);
    setActiveInfoStation(st);
    if (marker) {
      setInfoAnchor(marker);
    }
  }, [focusStationTrigger, nearestStation]);

  // Sync draft pick when opening picker mode or when studentLocation changes externally
  useEffect(() => {
    if (studentLocation) {
      setDraftPick(studentLocation);
    } else if (isPickerMode && !draftPick) {
      setDraftPick({
        lat: DUBAI_DEFAULT_CENTER.lat,
        lng: DUBAI_DEFAULT_CENTER.lng,
        label: 'Selected Point in Dubai (Drag pin or click map to adjust)',
        source: 'map',
      });
    }
  }, [isPickerMode, studentLocation]);

  // Refit map when nearest station or student location updates outside picker mode
  useEffect(() => {
    if (!isPickerMode && studentLocation) {
      setFitTrigger((c) => c + 1);
    }
  }, [isPickerMode, studentLocation?.lat, studentLocation?.lng, nearestStation?.station.id]);

  const reverseGeocodeCoords = useCallback(async (lat: number, lng: number) => {
    setIsReverseGeocoding(true);
    setDraftPick({
      lat,
      lng,
      label: `Locating area (${lat.toFixed(5)}, ${lng.toFixed(5)})...`,
      source: 'map',
    });

    try {
      const resp = await fetch(`/api/maps/reverse-geocode?lat=${lat}&lng=${lng}`);
      const data = (await resp.json()) as {
        quotaExceeded?: boolean;
        formattedAddress?: string;
        areaName?: string;
      };
      if (resp.status === 429 || data.quotaExceeded) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      }
      setDraftPick({
        lat,
        lng,
        label: data.formattedAddress || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        areaName: data.areaName,
        source: 'map',
      });
    } catch {
      setDraftPick({
        lat,
        lng,
        label: `${lat.toFixed(5)}, ${lng.toFixed(5)} (Dubai, UAE)`,
        source: 'map',
      });
    } finally {
      setIsReverseGeocoding(false);
    }
  }, []);

  const handleMapClick = useCallback(
    (e: { detail: { latLng?: { lat: number; lng: number } | null } }) => {
      setActiveInfoStation(null);
      setActiveInfoCenter(null);
      setInfoAnchor(null);

      if (!isPickerMode) return;
      const latLng = e.detail?.latLng;
      if (!latLng) return;
      void reverseGeocodeCoords(latLng.lat, latLng.lng);
    },
    [isPickerMode, reverseGeocodeCoords]
  );

  const handleStudentMarkerDragEnd = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      if (isPickerMode) {
        void reverseGeocodeCoords(lat, lng);
      } else {
        // Also allow fine-tuning directly from the main map!
        void (async () => {
          try {
            const resp = await fetch(`/api/maps/reverse-geocode?lat=${lat}&lng=${lng}`);
            const data = (await resp.json()) as {
              formattedAddress?: string;
              areaName?: string;
            };
            onConfirmPickedLocation({
              lat,
              lng,
              label: data.formattedAddress || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
              areaName: data.areaName,
              source: 'map',
            });
          } catch {
            onConfirmPickedLocation({
              lat,
              lng,
              label: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
              source: 'map',
            });
          }
        })();
      }
    },
    [isPickerMode, reverseGeocodeCoords, onConfirmPickedLocation]
  );

  const activeStudentPoint = isPickerMode ? draftPick : studentLocation;

  // Determine the destination station for walking route polyline
  const routeTargetStation =
    !isPickerMode && nearestStation?.station.coordinates
      ? nearestStation.station
      : null;

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
                  setDraftPick(loc);
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
                disabled={!draftPick}
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

      {/* Map Canvas (Explicit height required per CF2) */}
      <div className="relative w-full h-[420px] sm:h-[500px] bg-slate-100 dark:bg-slate-900">
        <GoogleMap
          mapId="DEMO_MAP_ID"
          defaultCenter={DUBAI_DEFAULT_CENTER}
          defaultZoom={11}
          gestureHandling="greedy"
          streetViewControl={false}
          mapTypeControl={true}
          fullscreenControl={true}
          onClick={handleMapClick}
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          style={{ width: '100%', height: '100%' }}
        >
          <CameraController
            studentLocation={activeStudentPoint}
            nearestStation={isPickerMode ? null : nearestStation}
            allMappedStations={allMappedStations}
            fitTrigger={fitTrigger}
            fitAllTrigger={fitAllTrigger}
          />

          <CameraFocusStation
            station={nearestStation?.station || null}
            focusStationTrigger={focusStationTrigger}
          />

          {/* Walking Route Polyline between Student Location and Nearest Stop */}
          {!isPickerMode && studentLocation && routeTargetStation?.coordinates && (
            <WalkingRouteOverlay
              origin={{ lat: studentLocation.lat, lng: studentLocation.lng }}
              destination={routeTargetStation.coordinates}
              onRouteUpdate={onWalkingRouteUpdate}
            />
          )}

          {/* Student Location Marker (Draggable) */}
          {activeStudentPoint && (
            <AdvancedMarker
              position={{ lat: activeStudentPoint.lat, lng: activeStudentPoint.lng }}
              draggable={true}
              onDragEnd={handleStudentMarkerDragEnd}
              zIndex={1000}
              title={`Your Location: ${activeStudentPoint.label}`}
            >
              <div className="flex flex-col items-center cursor-grab active:cursor-grabbing">
                <div className="px-2.5 py-1 rounded-full bg-blue-600 text-white text-[11px] font-bold shadow-lg border-2 border-white flex items-center gap-1 whitespace-nowrap">
                  <Navigation className="w-3 h-3 fill-current" />
                  <span>Your Location</span>
                </div>
                <div className="w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-md -mt-1 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                </div>
              </div>
            </AdvancedMarker>
          )}

          {/* Eco Drive Bus Pickup Stations */}
          {allMappedStations.map((station) => (
            <StationMarker
              key={station.id}
              station={station}
              isNearest={!isPickerMode && nearestStation?.station.id === station.id}
              isSelected={!isPickerMode && selectedStationId === station.id}
              registerMarker={registerMarker}
              onSelect={(st, marker) => {
                setActiveInfoCenter(null);
                setActiveInfoStation(st);
                setInfoAnchor(marker);
                onSelectStationFromMap(st.id);
              }}
            />
          ))}

          {/* Eco Drive Driving School Centres */}
          {schoolCenters.map((center) => (
            <SchoolMarker
              key={center.id}
              center={center}
              onSelect={(c, marker) => {
                setActiveInfoStation(null);
                setActiveInfoCenter(c);
                setInfoAnchor(marker);
              }}
            />
          ))}

          {/* Station InfoWindow */}
          {activeInfoStation && infoAnchor && (
            <InfoWindow
              anchor={infoAnchor}
              onCloseClick={() => {
                setActiveInfoStation(null);
                setInfoAnchor(null);
              }}
            >
              <div className="p-1 max-w-[260px] text-[#0F172A]">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="px-1.5 py-0.5 rounded bg-[#F0FDF4] text-[#006B45] text-[10px] font-bold border border-[#D1FAE5]">
                    {activeInfoStation.routes.map((r) => r.routeCode).join(' · ')}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-[#064E3B] leading-snug">
                  {activeInfoStation.name}
                </h4>
                <p className="text-[11px] text-[#64748B] mt-0.5">
                  {activeInfoStation.landmarks[0]}
                </p>

                {studentLocation && activeInfoStation.coordinates && (
                  <p className="text-[11px] font-semibold text-[#006B45] mt-1.5">
                    Straight-line distance:{' '}
                    {formatStraightLineDistance(
                      // Inline quick Haversine display using coordinates
                      (() => {
                        const R = 6371;
                        const toRad = (d: number) => (d * Math.PI) / 180;
                        const dLat = toRad(activeInfoStation.coordinates!.lat - studentLocation.lat);
                        const dLng = toRad(activeInfoStation.coordinates!.lng - studentLocation.lng);
                        const a =
                          Math.sin(dLat / 2) ** 2 +
                          Math.cos(toRad(studentLocation.lat)) *
                            Math.cos(toRad(activeInfoStation.coordinates!.lat)) *
                            Math.sin(dLng / 2) ** 2;
                        return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
                      })()
                    )}
                  </p>
                )}

                <div className="mt-2 pt-2 border-t border-slate-200">
                  <span className="block text-[10px] font-bold uppercase text-[#64748B] mb-1">
                    Scheduled Pickups ({activeInfoStation.departures.length} trips):
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {activeInfoStation.departures.slice(0, 6).map((d) => (
                      <span
                        key={`${d.tripId}-${d.pickupTime}`}
                        className="px-1.5 py-0.5 rounded bg-slate-100 text-[#0F172A] font-mono text-[10px] font-semibold"
                      >
                        {d.pickupTime}
                      </span>
                    ))}
                    {activeInfoStation.departures.length > 6 && (
                      <span className="text-[10px] text-[#64748B]">
                        +{activeInfoStation.departures.length - 6} more
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenStationDetails(activeInfoStation)}
                    className="px-2.5 py-1 rounded-lg bg-[#006B45] text-white text-[11px] font-semibold hover:bg-[#064E3B]"
                  >
                    Full Schedule
                  </button>
                  <a
                    href={buildGoogleMapsDirectionsUrl(studentLocation, activeInfoStation)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#F0FDF4] text-[#006B45] border border-[#D1FAE5] text-[11px] font-semibold"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Directions</span>
                  </a>
                </div>
              </div>
            </InfoWindow>
          )}

          {/* School Center InfoWindow */}
          {activeInfoCenter && infoAnchor && (
            <InfoWindow
              anchor={infoAnchor}
              onCloseClick={() => {
                setActiveInfoCenter(null);
                setInfoAnchor(null);
              }}
            >
              <div className="p-1 max-w-[230px] text-[#0F172A]">
                <span className="inline-block px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-bold mb-1">
                  Eco Drive Training Destination
                </span>
                <h4 className="text-sm font-bold text-[#064E3B]">{activeInfoCenter.label}</h4>
                {activeInfoCenter.pinUrl && (
                  <a
                    href={activeInfoCenter.pinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#006B45] hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Open Centre in Google Maps</span>
                  </a>
                )}
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </div>

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
