import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {searchDubaiAddress, reverseDubaiAddress} from '../services/openMapGeocoding';
import {
  Sparkles,
  MapPin,
  Navigation,
  Bus,
  Clock,
  ExternalLink,
  RotateCcw,
  Compass,
  AlertCircle,
  CheckCircle2,
  Map as MapIcon,
  LocateFixed,
  Footprints,
  Ruler,
  ArrowRight,
  Calendar,
  Info,
  Loader2,
  Eye,
  Building2,
  Lock,
  GitBranch,
} from 'lucide-react';
import { TRANSPORT_ROUTES } from '../data/transportationData';
import {
  AIRecommendationResponse,
  BranchCode,
  ResolvedPinsResponse,
  SmartTransportFilters,
  StationMatchType,
  StudentLocation,
  TransportStation,
  WalkingRouteInfo,
} from '../types/smartTransport';
import {
  BRANCH_META,
  buildExactStationResult,
  buildGoogleMapsDirectionsUrl,
  buildStationsFromSource,
  computeNextBus,
  filterAndRankStations,
  formatCountdownMinutes,
  formatDurationMinutes,
  formatStraightLineDistance,
  formatWalkingDistance,
  getDubaiNow,
  getSameRouteStations,
  getTimePeriodLabel,
  matchOfficialStationQuery,
} from '../utils/transportFinderUtils';
import { AddressAutocompleteInput } from './AddressAutocompleteInput';
import { SmartTransportMap } from './SmartTransportMap';
import { StationDetailsModal } from './StationDetailsModal';

const DEFAULT_FILTERS: SmartTransportFilters = {
  preferredStationId: 'all',
  timePeriod: 'all',
  operatingDay: 'today',
  maxDistanceKm: null,
};


const AISmartTransportFinderContent: React.FC = () => {


  // 1. Source-of-truth resolved pin coordinates from Express backend
  const [pinsData, setPinsData] = useState<ResolvedPinsResponse>({
    pins: {},
    centers: { al_quoz: null, dic: null },
  });
  const [pinsLoading, setPinsLoading] = useState(true);
  const [pinsError, setPinsError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setPinsLoading(true);
    fetch('/api/transport/resolved-pins')
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load station coordinates.');
        return (await res.json()) as ResolvedPinsResponse;
      })
      .then((data) => {
        if (!active) return;
        setPinsData(data);
        setPinsError(null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setPinsError(
          err instanceof Error ? err.message : 'Unable to resolve bus station GPS coordinates.'
        );
      })
      .finally(() => {
        if (active) setPinsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Build stations directly from TRANSPORT_ROUTES (each station strictly tagged with DIC or AL_QUOZ)
  const allStations = useMemo(() => buildStationsFromSource(pinsData.pins), [pinsData.pins]);

  // Dynamic route & stop counts per branch directly from source data
  const branchStats = useMemo(() => {
    const dicRoutes = TRANSPORT_ROUTES.filter((r) => r.centerId === 'dic').length;
    const aqRoutes = TRANSPORT_ROUTES.filter((r) => r.centerId === 'al_quoz').length;
    const dicStops = allStations.filter((s) => s.branchCode === 'DIC' && s.hasCoordinates).length;
    const aqStops = allStations.filter((s) => s.branchCode === 'AL_QUOZ' && s.hasCoordinates).length;
    return {
      DIC: { routes: dicRoutes, gpsStops: dicStops },
      AL_QUOZ: { routes: aqRoutes, gpsStops: aqStops },
    };
  }, [allStations]);

  // 2. Live Dubai clock (updates every 30s)
  const [dubaiNow, setDubaiNow] = useState(() => getDubaiNow());
  useEffect(() => {
    const id = window.setInterval(() => {
      setDubaiNow(getDubaiNow());
    }, 30000);
    return () => window.clearInterval(id);
  }, []);

  // 3. Mandatory Step 1: Destination Branch Selection (NEVER auto-selected)
  const [selectedBranch, setSelectedBranch] = useState<BranchCode | null>(null);

  // 4. Step 2: Residential Location OR Exact Official Station Selection State
  const [addressInput, setAddressInput] = useState('');
  const [pendingLocation, setPendingLocation] = useState<StudentLocation | null>(null);
  const [activeLocation, setActiveLocation] = useState<StudentLocation | null>(null);
  const [exactStationId, setExactStationId] = useState<string | null>(null);
  const [activeMatchType, setActiveMatchType] = useState<StationMatchType>('area_no_exact_station');
  const [hasSearched, setHasSearched] = useState(false);
  const [searchBusy, setSearchBusy] = useState(false);

  const [isPickerMode, setIsPickerMode] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // 5. Branch-Scoped Refinement Filters & Optional Inspected Alternative State
  const [filters, setFilters] = useState<SmartTransportFilters>(DEFAULT_FILTERS);
  const [overrideStationId, setOverrideStationId] = useState<string | null>(null);
  const [modalStation, setModalStation] = useState<TransportStation | null>(null);
  const [focusStationTrigger, setFocusStationTrigger] = useState(0);

  // 6. Walking Route Info (updated by SmartTransportMap WalkingRouteOverlay)
  const [walkingRouteInfo, setWalkingRouteInfo] = useState<WalkingRouteInfo>({ status: 'idle' });

  // 7. AI Recommendations State
  const [aiRefreshNonce, setAiRefreshNonce] = useState(0);
  const [aiData, setAiData] = useState<AIRecommendationResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiEnhanced, setAiEnhanced] = useState(false);
  const aiCooldownUntil = useRef(0);
  const aiCache = useRef(new Map<string, { expiresAt: number; insights: string[] }>());
  const [aiCacheHit, setAiCacheHit] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const step2SectionRef = useRef<HTMLElement>(null);
  const mapSectionRef = useRef<HTMLDivElement>(null);
  const resultsSectionRef = useRef<HTMLDivElement>(null);
  const scheduleSectionRef = useRef<HTMLElement>(null);

  // All stations belonging STRICTLY to selectedBranch (never mixes DIC & AL_QUOZ)
  const allBranchStations = useMemo(() => {
    if (!selectedBranch) return [];
    return allStations.filter((s) => s.branchCode === selectedBranch);
  }, [allStations, selectedBranch]);

  const branchMappedStations = useMemo(() => {
    return allBranchStations.filter((s) => s.hasCoordinates && s.coordinates !== null);
  }, [allBranchStations]);

  // School centre pin for ONLY the selected branch
  const schoolCenters = useMemo(() => {
    if (!selectedBranch) return [];
    if (selectedBranch === 'AL_QUOZ' && pinsData.centers.al_quoz) {
      return [{ id: 'al_quoz' as const, ...pinsData.centers.al_quoz }];
    }
    if (selectedBranch === 'DIC' && pinsData.centers.dic) {
      return [{ id: 'dic' as const, ...pinsData.centers.dic }];
    }
    return [];
  }, [selectedBranch, pinsData.centers]);

  const exactSelectedStation = useMemo(() => {
    if (!exactStationId || !selectedBranch) return null;
    return allBranchStations.find((s) => s.id === exactStationId) || null;
  }, [exactStationId, selectedBranch, allBranchStations]);

  // Anchor coordinates for distance calculations (student's location OR exact station's coordinates)
  const distanceOrigin = useMemo(() => {
    if (!hasSearched) return null;
    if (activeLocation) return { lat: activeLocation.lat, lng: activeLocation.lng };
    if (exactSelectedStation?.coordinates) return exactSelectedStation.coordinates;
    return null;
  }, [hasSearched, activeLocation, exactSelectedStation]);

  // Compute ranked stations strictly scoped to selectedBranch (for optional nearby alternatives)
  const { ranked, unmappedStations } = useMemo(() => {
    const alternativeFilters: SmartTransportFilters =
      exactStationId && activeMatchType === 'exact_station'
        ? { ...filters, preferredStationId: 'all' }
        : filters;

    return filterAndRankStations(
      allStations,
      selectedBranch,
      distanceOrigin,
      alternativeFilters,
      dubaiNow.weekday
    );
  }, [
    allStations,
    selectedBranch,
    distanceOrigin,
    filters,
    exactStationId,
    activeMatchType,
    dubaiNow.weekday,
  ]);

  // Primary station result:
  // - If user explicitly selected an exact station (e.g. Union, Burjuman, Abu Hail), NEVER replace it.
  // - Otherwise (e.g. Al Rigga), show the user-inspected alternative or closest verified alternative.
  const primaryResult = useMemo(() => {
    if (!selectedBranch || !hasSearched) return null;

    if (overrideStationId) {
      const altMatch = ranked.find((r) => r.station.id === overrideStationId);
      if (altMatch) return altMatch;
      const rawAlt = allBranchStations.find((s) => s.id === overrideStationId);
      if (rawAlt) {
        return buildExactStationResult(rawAlt, selectedBranch, distanceOrigin, filters, dubaiNow.weekday);
      }
    }

    if (activeMatchType === 'exact_station' && exactSelectedStation) {
      return buildExactStationResult(
        exactSelectedStation,
        selectedBranch,
        activeLocation,
        filters,
        dubaiNow.weekday
      );
    }

    return ranked[0] || null;
  }, [
    selectedBranch,
    hasSearched,
    overrideStationId,
    ranked,
    allBranchStations,
    activeMatchType,
    exactSelectedStation,
    distanceOrigin,
    activeLocation,
    filters,
    dubaiNow.weekday,
  ]);

  const isViewingExactStation = Boolean(
    primaryResult &&
      activeMatchType === 'exact_station' &&
      exactSelectedStation &&
      primaryResult.station.id === exactSelectedStation.id &&
      !overrideStationId
  );

  const closestOverallResult = ranked[0] || null;

  // Same-route stations strictly along the same official bus line(s)
  const sameRouteLines = useMemo(() => {
    if (!primaryResult || !selectedBranch) return [];
    return getSameRouteStations(primaryResult.station, selectedBranch, allStations);
  }, [primaryResult, selectedBranch, allStations]);

  // Next 3 closest optional nearby alternative stops belonging ONLY to selectedBranch
  const otherNearbyResults = useMemo(() => {
    if (!primaryResult) return [];
    return ranked.filter((r) => r.station.id !== primaryResult.station.id).slice(0, 3);
  }, [ranked, primaryResult]);

  // Effective day label for schedule & next bus
  const effectiveWeekday =
    filters.operatingDay === 'today' ? dubaiNow.weekday : filters.operatingDay;

  const nextBus = useMemo(() => {
    if (!primaryResult) return null;
    return computeNextBus(primaryResult.filteredDepartures, filters.operatingDay, dubaiNow);
  }, [primaryResult, filters.operatingDay, dubaiNow]);

  // Handle Step 1 Branch Selection / Switching
  // When switching DIC <-> AL_QUOZ, immediately purge all previous branch results & station selections
  const handleSelectBranch = (branch: BranchCode) => {
    if (selectedBranch === branch) return;
    setSelectedBranch(branch);
    setExactStationId(null);
    setActiveMatchType('area_no_exact_station');
    setOverrideStationId(null);
    setFilters((f) => ({ ...f, preferredStationId: 'all' }));
    setWalkingRouteInfo({ status: 'idle' });
    setAiData(null);
    setAiError(null);
    setValidationError(null);
    setGeoError(null);
  };

  // Resolve free-text area query only when user didn't already pick a suggestion or exact station
  const resolveAreaTextToLocation = useCallback(async (rawQuery: string): Promise<StudentLocation | null> => {
    try { return (await searchDubaiAddress(rawQuery))[0] ?? null; }
    catch { return null; }
  }, []);

  // Direct Official Station selection (strictly preserves selected station)
  const handleSelectDirectOfficialStation = useCallback(
    (station: TransportStation, autoRun = true) => {
      setExactStationId(station.id);
      setActiveMatchType('exact_station');
      setOverrideStationId(null);
      setFilters((f) => ({ ...f, preferredStationId: station.id }));
      setAddressInput(station.name);
      setValidationError(null);
      setGeoError(null);

      const stationLoc: StudentLocation | null = station.coordinates
        ? {
            lat: station.coordinates.lat,
            lng: station.coordinates.lng,
            label: `${station.name} (Official Eco Drive Station)`,
            areaName: station.name,
            source: 'autocomplete',
          }
        : null;

      setPendingLocation(stationLoc);

      if (autoRun) {
        setActiveLocation(stationLoc);
        setWalkingRouteInfo({ status: 'idle' });
        setAiData(null);
        setAiError(null);
        setHasSearched(true);
        setAiRefreshNonce((n) => n + 1);
        window.setTimeout(() => {
          resultsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    },
    []
  );

  // Validate and trigger branch-specific search (Step 3)
  const runBranchValidatedSearch = useCallback(
    async (locCandidate?: StudentLocation | null) => {
      if (!selectedBranch) {
        setValidationError('Please select your preferred Eco Drive branch first.');
        setHasSearched(false);
        return;
      }

      // Check if typed query or explicit station picker selected an official station
      const typedStationMatch =
        !locCandidate && addressInput.trim()
          ? matchOfficialStationQuery(addressInput, allStations, selectedBranch)
          : null;

      const resolvedExactStation =
        exactSelectedStation ||
        typedStationMatch ||
        (filters.preferredStationId !== 'all'
          ? allBranchStations.find((s) => s.id === filters.preferredStationId) || null
          : null);

      let target = locCandidate ?? pendingLocation ?? activeLocation;

      // If user typed an address/area (e.g. "Al Rigga") without clicking dropdown, resolve it now
      if (!target && addressInput.trim() && !resolvedExactStation) {
        setSearchBusy(true);
        setValidationError(null);
        const resolved = await resolveAreaTextToLocation(addressInput);
        setSearchBusy(false);
        if (resolved) {
          target = resolved;
          setPendingLocation(resolved);
          setAddressInput(resolved.label);
        }
      }

      // Exact station without needing residential address coordinates
      if (resolvedExactStation) {
        setValidationError(null);
        setGeoError(null);
        setExactStationId(resolvedExactStation.id);
        setActiveMatchType('exact_station');
        setOverrideStationId(null);
        if (!target && resolvedExactStation.coordinates) {
          target = {
            lat: resolvedExactStation.coordinates.lat,
            lng: resolvedExactStation.coordinates.lng,
            label: `${resolvedExactStation.name} (Official Eco Drive Station)`,
            areaName: resolvedExactStation.name,
            source: 'autocomplete',
          };
          setPendingLocation(target);
        }
        setActiveLocation(target || null);
        setWalkingRouteInfo({ status: 'idle' });
        setAiData(null);
        setAiError(null);
        setHasSearched(true);
        setAiRefreshNonce((n) => n + 1);
        window.setTimeout(() => {
          resultsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
        return;
      }

      if (!target) {
        setValidationError(
          addressInput.trim()
            ? `Could not verify reliable Dubai coordinates for "${addressInput.trim()}". Please select a suggestion from the dropdown, pick your point on the map, or select an official Eco Drive station directly.`
            : 'Please enter your residential address, pick a location on the map, or choose an official Eco Drive station.'
        );
        setHasSearched(false);
        return;
      }

      // Check if selected place label itself matches an official station
      const locationStationMatch = matchOfficialStationQuery(
        target.areaName || target.label,
        allStations,
        selectedBranch
      );

      setValidationError(null);
      setGeoError(null);
      setActiveLocation(target);
      setOverrideStationId(null);
      if (locationStationMatch) {
        setExactStationId(locationStationMatch.id);
        setActiveMatchType('exact_station');
      } else {
        setExactStationId(null);
        setActiveMatchType('area_no_exact_station');
      }
      setWalkingRouteInfo({ status: 'idle' });
      setAiData(null);
      setAiError(null);
      setHasSearched(true);
      setAiRefreshNonce((n) => n + 1);
      window.setTimeout(() => {
        resultsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    },
    [
      selectedBranch,
      addressInput,
      allStations,
      allBranchStations,
      exactSelectedStation,
      filters.preferredStationId,
      pendingLocation,
      activeLocation,
      resolveAreaTextToLocation,
    ]
  );

  // Option B: Choose on Map
  const handleOpenMapPicker = () => {
    if (!selectedBranch) {
      setValidationError('Please select your preferred Eco Drive branch first.');
      return;
    }
    setIsPickerMode(true);
    setValidationError(null);
    setGeoError(null);
    window.setTimeout(() => {
      mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  };

  // Option C: Use My Current Location (explicit user permission)
  const handleUseCurrentLocation = () => {
    if (!selectedBranch) {
      setValidationError('Please select your preferred Eco Drive branch first.');
      return;
    }
    if (!navigator.geolocation) {
      setGeoError(
        'Browser geolocation is not supported on this device. Please enter an address or pick a point on the map.'
      );
      return;
    }

    setGeoLoading(true);
    setGeoError(null);
    setValidationError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        let label = `${lat.toFixed(5)}, ${lng.toFixed(5)} (Current Location)`;
        let areaName = 'Current Location';

        try {
          const result = await reverseDubaiAddress(lat,lng,'geolocation');
          label = result.label; areaName = result.areaName || areaName;
        } catch {
          // Keep coordinate label if reverse geocode fails
        }

        const loc: StudentLocation = {
          lat,
          lng,
          label,
          areaName,
          source: 'geolocation',
        };
        setPendingLocation(loc);
        setAddressInput(label);
        setGeoLoading(false);
        if (hasSearched) {
          setActiveLocation(loc);
          setOverrideStationId(null);
        }
      },
      (err) => {
        setGeoLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGeoError(
            'Location permission was declined. You can enter your residential address above or click "Choose on Map".'
          );
        } else {
          setGeoError(
            'Unable to retrieve your current GPS position. Please enter your Dubai address or choose on the map.'
          );
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  // Reset refinement filters while keeping selected branch active
  const handleResetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setOverrideStationId(null);
    if (activeMatchType === 'exact_station' && !activeLocation) {
      setExactStationId(null);
      setHasSearched(false);
    }
  };

  // Fetch AI Recommendations strictly for the selected branch & verified result
  useEffect(() => {
    if (!selectedBranch || !hasSearched || pinsLoading) return;
    if (!activeLocation && !exactSelectedStation) return;
    if (walkingRouteInfo.status === 'loading') return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setAiLoading(true);
      setAiError(null);

      const branchMeta = BRANCH_META[selectedBranch];
      const payload = {
        studentLocation: {
          label: activeLocation?.label || exactSelectedStation?.name || 'Official Station Selection',
          lat: activeLocation?.lat ?? exactSelectedStation?.coordinates?.lat ?? null,
          lng: activeLocation?.lng ?? exactSelectedStation?.coordinates?.lng ?? null,
        },
        matchStatus: isViewingExactStation ? ('exact_station' as const) : ('area_no_exact_station' as const),
        selectedStationName: isViewingExactStation ? exactSelectedStation?.name : undefined,
        dubaiTime: {
          weekday: dubaiNow.weekday,
          formattedTime: dubaiNow.formattedTime,
        },
        selectedDay: effectiveWeekday,
        nearestStation: primaryResult
          ? {
              name: primaryResult.station.name,
              landmarks: primaryResult.station.landmarks,
              hasCoordinates: primaryResult.station.hasCoordinates,
              straightLineKm: primaryResult.station.coordinates
                ? Number(primaryResult.straightLineKm.toFixed(2))
                : null,
              walkingDistanceMeters:
                walkingRouteInfo.status === 'available'
                  ? walkingRouteInfo.distanceMeters ?? null
                  : null,
              walkingDurationMinutes:
                walkingRouteInfo.status === 'available' && walkingRouteInfo.durationMillis
                  ? Math.max(1, Math.round(walkingRouteInfo.durationMillis / 60000))
                  : null,
              branchesServed: [branchMeta.title],
              operatingDays:
                primaryResult.station.routes[0]?.scheduleType || 'FULL WEEK SCHEDULE',
              nextBus: nextBus
                ? {
                    departureTime: nextBus.departure.pickupTime,
                    minutesRemaining: nextBus.minutesRemaining,
                    isNextDay: nextBus.isNextDayRollover,
                    nextDayLabel: nextBus.operatingDayLabel,
                    routeCode: nextBus.departure.routeCode,
                    destination: nextBus.departure.destinationName,
                  }
                : null,
              departures: primaryResult.filteredDepartures.map((d) => ({
                time: d.pickupTime,
                routeCode: d.routeCode,
                destination: d.destinationName,
                etaAtCentre: d.etaAtCentre,
                returnDeparture: d.returnDeparture,
              })),
            }
          : null,
        sameRouteStations: sameRouteLines.map((line) => ({
          routeCode: line.routeCode,
          routeTitle: line.routeTitle,
          stops: line.stops.map((st) => ({
            name: st.name,
            isCurrent: st.isCurrent,
            landmark: st.landmark,
          })),
        })),
        nearbyAlternatives: otherNearbyResults.map((alt) => {
          const altNext = computeNextBus(alt.filteredDepartures, filters.operatingDay, dubaiNow);
          return {
            name: alt.station.name,
            relationship: 'optional_nearby_alternative',
            straightLineKm: Number(alt.straightLineKm.toFixed(2)),
            branchesServed: [branchMeta.title],
            nextDepartureTime: altNext?.departure.pickupTime ?? null,
            departureCount: alt.filteredDepartures.length,
          };
        }),
        activeFilters: {
          branch: branchMeta.title,
          timePeriod: filters.timePeriod,
          maxDistanceKm: filters.maxDistanceKm,
        },
        unmappedStationsCount: unmappedStations.length,
      };

      // Deterministic guidance from the same branch-scoped search result as the schedule.
      // Available immediately, even if Gemini or the network is unavailable.
      const station = payload.nearestStation;
      const recommendations: string[] = [];
      const headline = !station
        ? 'No verified pickup station matches the current filters.'
        : payload.matchStatus === 'exact_station'
          ? 'Selected official pickup station: ' + station.name + '.'
          : 'No exact official station selected for this location. Optional nearby pickup: ' + station.name + '.';
      if (station) {
        recommendations.push('Destination: ' + branchMeta.title + '.');
        if (station.landmarks.length) recommendations.push('Pickup landmark: ' + station.landmarks.join('; ') + '.');
        if (station.straightLineKm !== null) recommendations.push('Straight-line distance: ' + station.straightLineKm + ' km.');
        recommendations.push(station.walkingDistanceMeters !== null
          ? 'Walking distance: ' + station.walkingDistanceMeters + ' m' + (station.walkingDurationMinutes !== null ? '; estimated walking time: ' + station.walkingDurationMinutes + ' min.' : '.')
          : 'Walking route data is unavailable.');
        if (station.nextBus) {
          const bus = station.nextBus;
          recommendations.push('Next pickup: ' + bus.departureTime + ' (' + bus.routeCode + ')' + (bus.isNextDay ? ' — ' + bus.nextDayLabel : '') + '.');
        } else {
          recommendations.push('No next pickup is available under the current filters. Check the schedule or adjust filters.');
        }
        if (station.departures.length) recommendations.push('Scheduled pickups: ' + station.departures.map(d => d.time).join(', ') + '.');
      } else {
        recommendations.push('Try adjusting the distance or time filters within the selected branch.');
      }
      const alternative = payload.nearbyAlternatives[0];
      const local: AIRecommendationResponse = {
        headline,
        recommendations,
        alternativeTip: alternative ? 'Optional nearby alternative: ' + alternative.name + ' (' + alternative.straightLineKm + ' km straight-line).' : 'No additional nearby alternative matches the current filters.',
        arrivalReminder: 'Arrive 5–10 minutes before pickup. ' + (station?.hasCoordinates ? 'Use Open in Google Maps to verify the pickup point.' : 'Verify the pickup location before travelling.'),
      };
      if (!controller.signal.aborted) {
        setAiData(local);
        setAiError(null);
        setAiLoading(false);
      }
      setAiEnhanced(false);
      setAiCacheHit(false);
      if (!station || !station.departures.length || controller.signal.aborted) return;
      // Exact context key includes schedule, branch, location, filters and current bus.
      // Omit countdown and clock from AI input: local guidance owns live timing.
      const aiPayload = { ...payload, dubaiTime: { weekday: payload.dubaiTime.weekday }, nearestStation: { ...station, nextBus: station.nextBus ? { ...station.nextBus, minutesRemaining: undefined } : null } };
      const cacheKey = JSON.stringify(aiPayload);
      const now = Date.now();
      for (const [key, entry] of aiCache.current) if (entry.expiresAt <= now) aiCache.current.delete(key);
      const cached = aiCache.current.get(cacheKey);
      if (cached) {
        setAiData({ ...local, recommendations: [...local.recommendations, ...cached.insights] });
        setAiEnhanced(true);
        setAiCacheHit(true);
        return;
      }
      if (now < aiCooldownUntil.current) return;
      // Keep verified local guidance visible; AI is optional and never replaces schedule facts.
      const timeout = window.setTimeout(() => { aiCooldownUntil.current = Date.now() + 60000; controller.abort(); }, 8000);
      fetch('/api/transport/ai-recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aiPayload),
        signal: controller.signal,
      }).then(async (response) => {
        if (!response.ok) {
          aiCooldownUntil.current = Date.now() + (response.status === 429 ? 300000 : 60000);
          return;
        }
        const data = await response.json() as Partial<AIRecommendationResponse>;
        if (controller.signal.aborted) return;
        if (typeof data.headline !== 'string' || !data.headline.trim() ||
            !Array.isArray(data.recommendations) || !data.recommendations.length ||
            !data.recommendations.every(v => typeof v === 'string' && v.trim()) ||
            typeof data.alternativeTip !== 'string' || typeof data.arrivalReminder !== 'string') return;
        // Keep official facts intact and display AI wording separately.
        const insights = data.recommendations.filter(v => !/\b(?:minutes? remaining|minutes? left|hours? remaining|hours? left|in \d+ (?:minutes?|hours?))\b/i.test(v)).map(v => 'AI insight: ' + v);
        if (!insights.length) return;
        if (aiCache.current.size >= 32) { const oldest = aiCache.current.keys().next().value; if (oldest !== undefined) aiCache.current.delete(oldest); }
        aiCache.current.set(cacheKey, { expiresAt: Date.now() + 300000, insights });
        setAiData({ ...local, recommendations: [...local.recommendations, ...insights] });
        setAiEnhanced(true);
      }).catch(() => {
        if (!controller.signal.aborted) aiCooldownUntil.current = Date.now() + 60000;
      }).finally(() => window.clearTimeout(timeout));

    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    selectedBranch,
    hasSearched,
    activeLocation,
    exactSelectedStation,
    isViewingExactStation,
    sameRouteLines,
    pinsLoading,
    walkingRouteInfo.status,
    walkingRouteInfo.distanceMeters,
    walkingRouteInfo.durationMillis,
    primaryResult?.station.id,
    primaryResult?.filteredDepartures.length,
    filters.timePeriod,
    filters.operatingDay,
    filters.maxDistanceKm,
    effectiveWeekday,
    unmappedStations.length,
    aiRefreshNonce,
  ]);

  const handleWalkingRouteUpdate = useCallback((info: WalkingRouteInfo) => {
    setWalkingRouteInfo(info);
  }, []);

  const hasLocationSelected = Boolean(pendingLocation || activeLocation || exactSelectedStation);
  const currentStep = !selectedBranch
    ? 1
    : !hasLocationSelected
      ? 2
      : !hasSearched
        ? 3
        : 4;

  const selectedBranchMeta = selectedBranch ? BRANCH_META[selectedBranch] : null;

  return (
    <div className="space-y-6">
      {/* Coordinate resolution status alert if any error */}
      {pinsError && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <span>{pinsError}</span>
        </div>
      )}

      {/* =================================================================== */}
      {/* STEP-BY-STEP PROGRESS INDICATOR                                     */}
      {/* =================================================================== */}
      <section className="bg-white dark:bg-[#0F172A] rounded-2xl border border-[#E2E8F0] dark:border-slate-800 p-4 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 flex-1">
            {[
              {
                step: 1,
                title: 'Select Branch',
                sub: selectedBranchMeta ? selectedBranchMeta.shortName : 'DIC or Al Quoz',
                done: Boolean(selectedBranch),
              },
              {
                step: 2,
                title: 'Home Location',
                sub: hasLocationSelected ? 'Location ready' : 'Address or Map',
                done: Boolean(selectedBranch && hasLocationSelected),
              },
              {
                step: 3,
                title: 'Find Bus Stop',
                sub: 'Branch-only search',
                done: hasSearched && Boolean(selectedBranch),
              },
              {
                step: 4,
                title: 'View Schedule',
                sub: 'Live Dubai timings',
                done: hasSearched && Boolean(primaryResult),
              },
            ].map((item) => {
              const isCurrent = currentStep === item.step;
              return (
                <div
                  key={item.step}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-colors ${
                    item.done
                      ? 'bg-[#F0FDF4] dark:bg-emerald-950/50 border-[#D1FAE5] dark:border-emerald-800/70'
                      : isCurrent
                        ? 'bg-white dark:bg-slate-900 border-[#006B45] dark:border-emerald-500 ring-1 ring-[#006B45]/20 dark:ring-emerald-500/20'
                        : 'bg-[#F8FAFC] dark:bg-slate-900/60 border-[#E2E8F0] dark:border-slate-800 opacity-75'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-extrabold shrink-0 ${
                      item.done
                        ? 'bg-[#006B45] text-white'
                        : isCurrent
                          ? 'bg-[#064E3B] text-white'
                          : 'bg-slate-200 dark:bg-slate-800 text-[#64748B] dark:text-slate-400'
                    }`}
                  >
                    {item.done ? <CheckCircle2 className="w-4 h-4" /> : item.step}
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                      Step {item.step}
                    </span>
                    <span className="block text-xs font-bold text-[#0F172A] dark:text-slate-100 truncate">
                      {item.title}
                    </span>
                    <span className="block text-[10px] text-[#006B45] dark:text-emerald-400 font-medium truncate">
                      {item.sub}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Live Dubai Clock */}
          <div className="flex items-center gap-2 bg-[#F8FAFC] dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800 px-3.5 py-2.5 rounded-xl text-xs shrink-0 self-start lg:self-center">
            <Clock className="w-4 h-4 text-[#006B45] dark:text-emerald-400 shrink-0" />
            <div>
              <span className="block text-[10px] font-bold uppercase text-[#64748B] dark:text-slate-400">
                Dubai Local Time (GST)
              </span>
              <span className="font-mono font-bold text-[#0F172A] dark:text-slate-100">
                {dubaiNow.weekday}, {dubaiNow.formattedTime}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* STEP 1: MANDATORY DESTINATION BRANCH SELECTION                      */}
      {/* =================================================================== */}
      <section className="bg-white dark:bg-[#0F172A] rounded-2xl border border-[#E2E8F0] dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E8F0] dark:border-slate-800 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#064E3B] text-emerald-300 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-[#F0FDF4] dark:bg-emerald-950/60 text-[#006B45] dark:text-emerald-300 border border-[#D1FAE5] dark:border-emerald-800/70 text-[10px] font-extrabold uppercase tracking-wider">
                  Step 1 · Required
                </span>
                <span className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400">
                  Choose one destination campus
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-extrabold text-[#0F172A] dark:text-slate-100 mt-1">
                Which Eco Drive Branch Do You Want to Attend?
              </h2>
              <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
                Bus stations and schedules are strictly branch-specific. Select your destination training centre before searching.
              </p>
            </div>
          </div>

          {selectedBranchMeta && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#F0FDF4] dark:bg-emerald-950/60 border border-[#D1FAE5] dark:border-emerald-800/70 text-xs font-bold text-[#064E3B] dark:text-emerald-200 shrink-0">
              <CheckCircle2 className="w-4 h-4 text-[#059669] dark:text-emerald-400" />
              <span>Active Branch: {selectedBranchMeta.title}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(['DIC', 'AL_QUOZ'] as BranchCode[]).map((code) => {
            const meta = BRANCH_META[code];
            const stats = branchStats[code];
            const isSelected = selectedBranch === code;

            return (
              <button
                key={code}
                type="button"
                onClick={() => handleSelectBranch(code)}
                aria-pressed={isSelected}
                className={`text-left p-5 rounded-2xl border-2 transition-all flex flex-col justify-between gap-3 relative ${
                  isSelected
                    ? 'bg-[#F0FDF4] dark:bg-emerald-950/50 border-[#006B45] dark:border-emerald-500 ring-2 ring-[#006B45]/20 dark:ring-emerald-500/20 shadow-sm'
                    : 'bg-white dark:bg-slate-900 border-[#E2E8F0] dark:border-slate-800 hover:border-[#006B45]/50 dark:hover:border-emerald-600/60 hover:bg-slate-50/70 dark:hover:bg-slate-800/70'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                        isSelected
                          ? 'bg-[#006B45] text-white border-[#006B45]'
                          : 'bg-emerald-50 dark:bg-emerald-950/60 text-[#064E3B] dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/70'
                      }`}
                    >
                      {meta.badgeLabel}
                    </span>
                    <span className="text-base sm:text-lg font-extrabold text-[#0F172A] dark:text-slate-100">
                      {meta.title}
                    </span>
                  </div>

                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                      isSelected
                        ? 'bg-[#006B45] text-white'
                        : 'bg-[#F8FAFC] dark:bg-slate-800 text-[#006B45] dark:text-emerald-400 border border-[#E2E8F0] dark:border-slate-700'
                    }`}
                  >
                    {isSelected ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <MapPin className="w-4 h-4" />
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-xs sm:text-sm font-semibold text-[#475569] dark:text-slate-300">
                    {meta.subtitle}
                  </p>
                  <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#006B45] dark:text-emerald-400 shrink-0" />
                    <span>{meta.locationArea}</span>
                  </p>
                </div>

                <div className="pt-3 border-t border-[#E2E8F0]/80 dark:border-slate-800 flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-[#064E3B] dark:text-emerald-300">
                    {stats.routes} Bus Routes · {stats.gpsStops} GPS Pickup Stations
                  </span>
                  <span
                    className={`font-bold ${
                      isSelected ? 'text-[#006B45] dark:text-emerald-400' : 'text-[#64748B] dark:text-slate-400'
                    }`}
                  >
                    {isSelected ? 'Selected Branch' : 'Click to Select'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* =================================================================== */}
      {/* STEP 2 & STEP 3: LOCATION SELECTION + FIND BUTTON + VALIDATION      */}
      {/* =================================================================== */}
      <section
        ref={step2SectionRef}
        className={`rounded-2xl border p-5 sm:p-6 shadow-xs space-y-5 transition-all ${
          selectedBranch
            ? 'bg-white dark:bg-[#0F172A] border-[#E2E8F0] dark:border-slate-800'
            : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E8F0] dark:border-slate-800 pb-4">
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                selectedBranch
                  ? 'bg-[#F0FDF4] dark:bg-emerald-950/60 text-[#006B45] dark:text-emerald-400 border border-[#D1FAE5] dark:border-emerald-800/70'
                  : 'bg-slate-200 dark:bg-slate-800 text-[#64748B] dark:text-slate-400'
              }`}
            >
              {selectedBranch ? <MapPin className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-[#F0FDF4] dark:bg-emerald-950/60 text-[#006B45] dark:text-emerald-300 border border-[#D1FAE5] dark:border-emerald-800/70 text-[10px] font-extrabold uppercase tracking-wider">
                  Step 2 · Location
                </span>
                {selectedBranchMeta && (
                  <span className="text-[11px] font-semibold text-[#064E3B] dark:text-emerald-300">
                    Searching {selectedBranchMeta.shortName} stops only
                  </span>
                )}
              </div>
              <h2 className="text-base sm:text-lg font-extrabold text-[#0F172A] dark:text-slate-100 mt-1">
                Where Do You Live?
              </h2>
              <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
                {selectedBranch
                  ? `Enter your Dubai residential address, pick a spot on the map, or use your current location to find the nearest ${selectedBranchMeta?.title} pickup station.`
                  : 'First select either DIC – Dubai Industrial City or Al Quoz in Step 1 above, then enter your residential area in Dubai.'}
              </p>
            </div>
          </div>
        </div>

        {/* Location Options (unlocked once Step 1 Branch is chosen) */}
        {selectedBranch ? (
          <div className="space-y-3">
            <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-200">
              Enter Residential Address (or Choose on Map / Current Location)
            </label>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
              <div className="lg:col-span-7">
                <AddressAutocompleteInput
                  value={addressInput}
                  onChange={(val) => {
                    setAddressInput(val);
                    setPendingLocation(null);
                    setExactStationId(null);
                    setGeoError(null);
                    setValidationError(null);
                  }}
                  onSelectLocation={(loc) => {
                    const matched = matchOfficialStationQuery(
                      loc.areaName || loc.label,
                      allStations,
                      selectedBranch
                    );
                    setPendingLocation(loc);
                    if (matched) {
                      setExactStationId(matched.id);
                      setActiveMatchType('exact_station');
                      setFilters((f) => ({ ...f, preferredStationId: matched.id }));
                    } else {
                      setExactStationId(null);
                      setActiveMatchType('area_no_exact_station');
                      setFilters((f) => ({ ...f, preferredStationId: 'all' }));
                    }
                    setGeoError(null);
                    setValidationError(null);
                    if (hasSearched) {
                      setActiveLocation(loc);
                      setOverrideStationId(null);
                    }
                  }}
                  placeholder="Enter your residential area, landmark, or station name (e.g. Al Rigga, Union, Burjuman)..."
                  autoTriggerFindOnSelect={false}
                />
              </div>

              <div className="lg:col-span-5 flex flex-wrap sm:flex-nowrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleOpenMapPicker}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#F0FDF4] dark:bg-emerald-950/60 hover:bg-[#D1FAE5] dark:hover:bg-emerald-900/60 text-[#006B45] dark:text-emerald-300 border border-[#D1FAE5] dark:border-emerald-800/70 text-xs font-bold transition-colors whitespace-nowrap"
                >
                  <MapIcon className="w-4 h-4 shrink-0" />
                  <span>Choose on Map</span>
                </button>

                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={geoLoading}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-[#0F172A] dark:text-slate-100 border border-[#CBD5E1] dark:border-slate-700 text-xs font-bold transition-colors whitespace-nowrap disabled:opacity-60"
                >
                  {geoLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#006B45] dark:text-emerald-400 shrink-0" />
                  ) : (
                    <LocateFixed className="w-4 h-4 text-[#006B45] dark:text-emerald-400 shrink-0" />
                  )}
                  <span>{geoLoading ? 'Locating...' : 'Use My Current Location'}</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-dashed border-[#CBD5E1] dark:border-slate-700 flex items-center gap-3 text-xs text-[#475569] dark:text-slate-300">
            <Info className="w-4 h-4 text-[#006B45] dark:text-emerald-400 shrink-0" />
            <span>
              Select <strong className="text-[#0F172A] dark:text-slate-100">Branch 1: DIC – Dubai Industrial City</strong> or{' '}
              <strong className="text-[#0F172A] dark:text-slate-100">Branch 2: Al Quoz</strong> above to unlock address search, map picker, and geolocation.
            </span>
          </div>
        )}

        {/* Selected Summary + Step 3 CTA Button (Find My Nearest Bus Stop) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#E2E8F0] dark:border-slate-800">
          <div className="flex items-center gap-2.5 text-xs min-w-0">
            {!selectedBranch ? (
              <>
                <Info className="w-4 h-4 text-[#64748B] dark:text-slate-400 shrink-0" />
                <span className="text-[#64748B] dark:text-slate-400">
                  Step 1 required: Choose your destination Eco Drive branch above.
                </span>
              </>
            ) : exactSelectedStation ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-[#059669] dark:text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[#64748B] dark:text-slate-400 font-medium">Selected Exact Station: </span>
                  <span className="font-bold text-[#0F172A] dark:text-slate-100 break-words">
                    {exactSelectedStation.name}
                  </span>
                  {exactSelectedStation.coordinates && (
                    <span className="ml-2 font-mono text-[11px] text-[#64748B] dark:text-slate-400">
                      ({exactSelectedStation.coordinates.lat.toFixed(5)},{' '}
                      {exactSelectedStation.coordinates.lng.toFixed(5)})
                    </span>
                  )}
                </div>
              </>
            ) : pendingLocation || activeLocation ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-[#059669] dark:text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[#64748B] dark:text-slate-400 font-medium">Selected Home Location: </span>
                  <span className="font-bold text-[#0F172A] dark:text-slate-100 break-words">
                    {(pendingLocation || activeLocation)?.label}
                  </span>
                  <span className="ml-2 font-mono text-[11px] text-[#64748B] dark:text-slate-400">
                    ({(pendingLocation || activeLocation)!.lat.toFixed(5)},{' '}
                    {(pendingLocation || activeLocation)!.lng.toFixed(5)})
                  </span>
                </div>
              </>
            ) : (
              <>
                <Info className="w-4 h-4 text-[#64748B] dark:text-slate-400 shrink-0" />
                <span className="text-[#64748B] dark:text-slate-400">
                  Enter your Dubai residential address, pick on the map, or select an exact official Eco Drive station.
                </span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => void runBranchValidatedSearch()}
            disabled={pinsLoading || searchBusy}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#006B45] hover:bg-[#064E3B] disabled:opacity-60 text-white text-xs sm:text-sm font-extrabold shadow-sm transition-all shrink-0"
          >
            {pinsLoading || searchBusy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Navigation className="w-4 h-4" />
            )}
            <span>
              {pinsLoading
                ? 'Loading Official Stations...'
                : searchBusy
                  ? 'Resolving Location...'
                  : exactSelectedStation
                    ? 'Show Exact Station Schedule'
                    : 'Find My Nearest Bus Stop'}
            </span>
          </button>
        </div>

        {/* Smart Validation Error */}
        {validationError && (
          <div
            role="alert"
            className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl p-3.5 flex items-start gap-2.5 text-xs font-semibold text-rose-900 dark:text-rose-200"
          >
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Geolocation / Lookup Notice */}
        {geoError && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <span>{geoError}</span>
          </div>
        )}
      </section>

      {/* =================================================================== */}
      {/* STEP 4: BRANCH-SPECIFIC SEARCH RESULTS                              */}
      {/* =================================================================== */}
      {selectedBranch && selectedBranchMeta && hasSearched && (activeLocation || exactSelectedStation) && (
        <div ref={resultsSectionRef} className="space-y-6">

          {!primaryResult ? (
            <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-[#E2E8F0] dark:border-slate-800 p-10 text-center shadow-xs">
              <Compass className="w-12 h-12 text-[#94A3B8] dark:text-slate-500 mx-auto mb-3" />
              <h3 className="text-base font-bold text-[#0F172A] dark:text-slate-100">
                No Matching {selectedBranchMeta.shortName} Bus Stations Found Within Current Filters
              </h3>
              <p className="text-xs text-[#64748B] dark:text-slate-400 max-w-lg mx-auto mt-1">
                No verified {selectedBranchMeta.title} pickup stop matched your active distance or time filters. Reset the filters to view available {selectedBranchMeta.shortName} stations.
              </p>
              <button
                type="button"
                onClick={handleResetFilters}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#006B45] text-white text-xs font-bold hover:bg-[#064E3B] transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            </div>
          ) : (
            <>
              {/* Top 2-Column Highlight: Primary Station Card + Next Available Bus */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Card A: Exact Selected Station OR Closest Optional Nearby Alternative */}
                <div className="lg:col-span-7 bg-white dark:bg-[#0F172A] rounded-2xl border border-[#006B45]/30 dark:border-emerald-800/70 shadow-sm overflow-hidden flex flex-col">
                  <div className="bg-gradient-to-r from-[#064E3B] to-[#006B45] text-white p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-400/20 text-emerald-100 border border-emerald-300/30 text-[11px] font-bold uppercase tracking-wider">
                        <Bus className="w-3.5 h-3.5 text-emerald-300" />
                        <span>
                          {isViewingExactStation
                            ? 'Exact Selected Station'
                            : overrideStationId
                              ? 'Optional Nearby Alternative (Selected)'
                              : 'Optional Nearby Alternative'}
                        </span>
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-white/15 text-white text-[11px] font-bold border border-white/20">
                        {selectedBranchMeta.title}
                      </span>
                    </div>

                    <h3 className="text-xl sm:text-2xl font-extrabold mt-2.5 tracking-tight">
                      {primaryResult.station.name}
                    </h3>
                    <p className="text-xs sm:text-sm text-emerald-100/90 mt-1">
                      {primaryResult.station.landmarks.join(' · ')}
                    </p>
                    {primaryResult.station.coordinates ? (
                      <p className="text-[11px] font-mono text-emerald-200/80 mt-1">
                        Station Coordinates: {primaryResult.station.coordinates.lat.toFixed(5)},{' '}
                        {primaryResult.station.coordinates.lng.toFixed(5)}
                      </p>
                    ) : (
                      <p className="text-[11px] text-amber-200 mt-1">
                        GPS Pin Coordinates: Not listed in official schedule (timetable-verified stop)
                      </p>
                    )}
                  </div>

                  <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                    {/* Clearly Separated Distance Metrics */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3 rounded-xl bg-[#F8FAFC] dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800">
                        <span className="text-[10px] font-bold uppercase text-[#64748B] dark:text-slate-400 flex items-center gap-1">
                          <Ruler className="w-3.5 h-3.5 text-[#006B45] dark:text-emerald-400" />
                          <span>Straight-Line Distance</span>
                        </span>
                        <span className="block font-mono text-base font-extrabold text-[#0F172A] dark:text-slate-100 mt-1">
                          {primaryResult.station.coordinates && activeLocation
                            ? isViewingExactStation &&
                              activeLocation.areaName?.toLowerCase() ===
                                primaryResult.station.name.toLowerCase()
                              ? '0 m (At Station)'
                              : formatStraightLineDistance(primaryResult.straightLineKm)
                            : 'Unavailable'}
                        </span>
                        <span className="block text-[10px] text-[#64748B] dark:text-slate-400">
                          {primaryResult.station.coordinates
                            ? 'Geographic gap to stop'
                            : 'No station GPS pin'}
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-[#F0FDF4] dark:bg-emerald-950/50 border border-[#D1FAE5] dark:border-emerald-800/70">
                        <span className="text-[10px] font-bold uppercase text-[#064E3B] dark:text-emerald-300 flex items-center gap-1">
                          <Footprints className="w-3.5 h-3.5 text-[#006B45] dark:text-emerald-400" />
                          <span>Actual Walking Distance</span>
                        </span>
                        <span className="block font-mono text-base font-extrabold text-[#064E3B] dark:text-emerald-200 mt-1">
                          {walkingRouteInfo.status === 'loading'
                            ? 'Calculating...'
                            : walkingRouteInfo.status === 'available' &&
                                walkingRouteInfo.distanceMeters !== undefined
                              ? formatWalkingDistance(walkingRouteInfo.distanceMeters)
                              : 'Unavailable'}
                        </span>
                        <span className="block text-[10px] text-[#006B45]/80 dark:text-emerald-400/80">
                          {walkingRouteInfo.status === 'available'
                            ? 'OpenRouteService walking path'
                            : walkingRouteInfo.reason || 'Straight-line used'}
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-[#F0FDF4] dark:bg-emerald-950/50 border border-[#D1FAE5] dark:border-emerald-800/70">
                        <span className="text-[10px] font-bold uppercase text-[#064E3B] dark:text-emerald-300 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-[#006B45] dark:text-emerald-400" />
                          <span>Estimated Walking Time</span>
                        </span>
                        <span className="block font-mono text-base font-extrabold text-[#064E3B] dark:text-emerald-200 mt-1">
                          {walkingRouteInfo.status === 'loading'
                            ? 'Calculating...'
                            : walkingRouteInfo.status === 'available' &&
                                walkingRouteInfo.durationMillis
                              ? formatDurationMinutes(walkingRouteInfo.durationMillis)
                              : 'Unavailable'}
                        </span>
                        <span className="block text-[10px] text-[#006B45]/80 dark:text-emerald-400/80">
                          {walkingRouteInfo.status === 'available'
                            ? 'Estimated on foot'
                            : 'Requires pedestrian path'}
                        </span>
                      </div>
                    </div>

                    {/* Selected Branch & Available Pickup Times */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-[#F8FAFC] dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800">
                        <span className="block text-[10px] font-bold uppercase text-[#64748B] dark:text-slate-400">
                          Selected Destination Branch
                        </span>
                        <span className="block font-bold text-[#064E3B] dark:text-emerald-300 mt-0.5">
                          {selectedBranchMeta.title}
                        </span>
                        <span className="block text-[11px] text-[#64748B] dark:text-slate-400 mt-0.5">
                          {primaryResult.station.routes.map((r) => r.routeCode).join(', ')} · 7 Days/Week
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-[#F8FAFC] dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800">
                        <span className="block text-[10px] font-bold uppercase text-[#64748B] dark:text-slate-400 mb-1">
                          Available Pickup Times ({primaryResult.filteredDepartures.length})
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {primaryResult.filteredDepartures.slice(0, 6).map((d, i) => (
                            <span
                              key={`${d.tripId}-${d.pickupTime}-${i}`}
                              className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 font-mono text-[10px] font-bold text-[#0F172A] dark:text-slate-100"
                            >
                              {d.pickupTime}
                            </span>
                          ))}
                          {primaryResult.filteredDepartures.length > 6 && (
                            <span className="text-[10px] text-[#64748B] dark:text-slate-400 self-center font-medium">
                              +{primaryResult.filteredDepartures.length - 6} more
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Three Required Action Buttons: Open in Google Maps, View Full Schedule, Show on Map */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
                      <a
                        href={buildGoogleMapsDirectionsUrl(activeLocation, primaryResult.station)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#006B45] hover:bg-[#064E3B] text-white text-xs font-bold shadow-xs transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                        <span>Open in Google Maps</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => {
                          scheduleSectionRef.current?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start',
                          });
                        }}
                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#F0FDF4] dark:bg-emerald-950/60 hover:bg-[#D1FAE5] dark:hover:bg-emerald-900/60 text-[#006B45] dark:text-emerald-300 border border-[#D1FAE5] dark:border-emerald-800/70 text-xs font-bold transition-colors"
                      >
                        <Calendar className="w-3.5 h-3.5 shrink-0" />
                        <span>View Full Schedule</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setFocusStationTrigger((c) => c + 1);
                          mapSectionRef.current?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'center',
                          });
                        }}
                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-[#0F172A] dark:text-slate-100 border border-[#CBD5E1] dark:border-slate-700 text-xs font-bold transition-colors"
                      >
                        <MapPin className="w-3.5 h-3.5 text-[#006B45] dark:text-emerald-400 shrink-0" />
                        <span>Show on Map</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Card B: Smart Next Available Bus */}
                <div className="lg:col-span-5 bg-white dark:bg-[#0F172A] rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-xs overflow-hidden flex flex-col">
                  <div className="p-4 sm:px-5 bg-[#F8FAFC] dark:bg-slate-900 border-b border-[#E2E8F0] dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-[#006B45] text-white flex items-center justify-center">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-extrabold text-[#0F172A] dark:text-slate-100">
                          Next Available Bus
                        </h3>
                        <span className="text-[11px] text-[#64748B] dark:text-slate-400">
                          Dubai local time ({dubaiNow.formattedTime})
                        </span>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-[#F0FDF4] dark:bg-emerald-950/60 text-[#006B45] dark:text-emerald-300 border border-[#D1FAE5] dark:border-emerald-800/70 text-[11px] font-bold">
                      {filters.operatingDay === 'today' ? 'Live Today' : effectiveWeekday}
                    </span>
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    {nextBus ? (
                      <>
                        <div className="p-4 rounded-2xl bg-[#F0FDF4] dark:bg-emerald-950/50 border border-[#D1FAE5] dark:border-emerald-800/70 space-y-2">
                          {nextBus.isNextDayRollover && (
                            <div className="text-[11px] font-bold text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/70 border border-amber-200 dark:border-amber-800/70 rounded-lg px-2.5 py-1 inline-block">
                              All buses for today have departed — Next service {nextBus.operatingDayLabel}
                            </div>
                          )}

                          <div className="flex items-baseline justify-between gap-3">
                            <div>
                              <span className="block text-[11px] font-bold uppercase text-[#006B45] dark:text-emerald-400">
                                Next Departure Time
                              </span>
                              <span className="font-mono text-3xl font-extrabold text-[#064E3B] dark:text-emerald-200 tracking-tight">
                                {nextBus.departure.pickupTime}
                              </span>
                            </div>
                            {(nextBus.isToday || nextBus.isNextDayRollover) && (
                              <div className="text-right">
                                <span className="block text-[10px] font-bold uppercase text-[#64748B] dark:text-slate-400">
                                  Time Remaining
                                </span>
                                <span className="inline-block px-2.5 py-1 rounded-lg bg-[#006B45] text-white font-mono text-xs font-bold mt-0.5">
                                  {formatCountdownMinutes(nextBus.minutesRemaining)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2.5 text-xs">
                          <div className="flex items-center justify-between py-2 border-b border-[#F1F5F9] dark:border-slate-800">
                            <span className="text-[#64748B] dark:text-slate-400 font-medium">Pickup Station</span>
                            <span className="font-bold text-[#0F172A] dark:text-slate-100">
                              {primaryResult.station.name}
                            </span>
                          </div>
                          <div className="flex items-center justify-between py-2 border-b border-[#F1F5F9] dark:border-slate-800">
                            <span className="text-[#64748B] dark:text-slate-400 font-medium">Route & Capacity</span>
                            <span className="font-bold text-[#0F172A] dark:text-slate-100">
                              {nextBus.departure.routeCode} ({nextBus.departure.capacity} Seater)
                            </span>
                          </div>
                          <div className="flex items-center justify-between py-2 border-b border-[#F1F5F9] dark:border-slate-800">
                            <span className="text-[#64748B] dark:text-slate-400 font-medium">Destination Branch</span>
                            <span className="font-bold text-[#006B45] dark:text-emerald-400">
                              {nextBus.departure.destinationName}
                            </span>
                          </div>
                          <div className="flex items-center justify-between py-2 border-b border-[#F1F5F9] dark:border-slate-800">
                            <span className="text-[#64748B] dark:text-slate-400 font-medium">Arrival ETA at Branch</span>
                            <span className="font-mono font-bold text-[#0F172A] dark:text-slate-100">
                              {nextBus.departure.etaAtCentre}
                            </span>
                          </div>
                          <div className="flex items-center justify-between py-1">
                            <span className="text-[#64748B] dark:text-slate-400 font-medium">Branch Return Departure</span>
                            <span className="font-mono font-semibold text-[#475569] dark:text-slate-300">
                              {nextBus.departure.returnDeparture}
                            </span>
                          </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800 rounded-xl p-3 text-[11px] text-[#475569] dark:text-slate-300 leading-relaxed">
                          Please arrive at <strong className="text-[#0F172A] dark:text-slate-100">{primaryResult.station.landmarks[0]}</strong>{' '}
                          at least <strong className="text-[#0F172A] dark:text-slate-100">5–10 minutes</strong> before {nextBus.departure.pickupTime}.
                        </div>
                      </>
                    ) : (
                      <div className="py-8 text-center text-xs text-[#64748B] dark:text-slate-400">
                        No bus departure matches your selected time-of-day filter at this station.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* AI-POWERED RECOMMENDATIONS (Always visible after search, including empty filter states) */}
          <section className="bg-gradient-to-br from-[#F0FDF4] to-white dark:from-emerald-950/40 dark:to-[#0F172A] rounded-2xl border border-[#D1FAE5] dark:border-emerald-800/70 p-5 shadow-xs space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#064E3B] text-emerald-300 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-[#064E3B] dark:text-emerald-200">
                    Local Smart Assistant ({selectedBranchMeta.shortName})
                  </h3>
                  <p className="text-[11px] text-[#006B45] dark:text-emerald-400">
                    Schedule-based guidance for {selectedBranchMeta.title} · {aiEnhanced ? (aiCacheHit ? 'AI-enhanced · Cached' : 'AI-enhanced') : 'Local guidance'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  disabled={aiLoading}
                  onClick={() => {
                    setAiRefreshNonce((n) => n + 1);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-[#F0FDF4] dark:hover:bg-slate-700 text-[#006B45] dark:text-emerald-300 border border-[#D1FAE5] dark:border-slate-700 text-xs font-bold transition-colors disabled:opacity-60"
                >
                  {aiLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="w-3.5 h-3.5" />
                  )}
                  <span>{aiLoading ? 'Analyzing...' : 'Refresh guidance'}</span>
                </button>
              </div>
            </div>

            {aiLoading ? (
              <div className="flex items-center gap-2.5 text-xs text-[#064E3B] dark:text-emerald-300 py-3">
                <Loader2 className="w-4 h-4 animate-spin text-[#006B45] dark:text-emerald-400 shrink-0" />
                <span>
                  Analyzing nearest {selectedBranchMeta.shortName} stations, walking distance, and live departure times...
                </span>
              </div>
            ) : aiError ? (
              <div className="bg-white/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 rounded-xl p-3.5 text-xs text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">AI Recommendations Unavailable</span>
                    <span>{aiError}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAiRefreshNonce((n) => n + 1)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shrink-0 self-start sm:self-center transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retry AI</span>
                </button>
              </div>
            ) : aiData ? (
              <div className="space-y-3">
                <p className="text-xs sm:text-sm font-bold text-[#0F172A] dark:text-slate-100">
                  {aiData.headline}
                </p>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {aiData.recommendations.map((rec, idx) => (
                    <li
                      key={idx}
                      className="bg-white dark:bg-slate-900 border border-[#D1FAE5] dark:border-emerald-800/70 rounded-xl p-3 text-xs text-[#0F172A] dark:text-slate-100 flex items-start gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4 text-[#059669] dark:text-emerald-400 shrink-0 mt-0.5" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
                  <div className="bg-white/90 dark:bg-slate-900/90 border border-[#E2E8F0] dark:border-slate-800 rounded-xl p-3 text-[#475569] dark:text-slate-300">
                    <strong className="text-[#064E3B] dark:text-emerald-300 block mb-0.5">
                      Nearby {selectedBranchMeta.shortName} Alternative Insight:
                    </strong>
                    <span>{aiData.alternativeTip}</span>
                  </div>
                  <div className="bg-white/90 dark:bg-slate-900/90 border border-[#E2E8F0] dark:border-slate-800 rounded-xl p-3 text-[#475569] dark:text-slate-300">
                    <strong className="text-[#064E3B] dark:text-emerald-300 block mb-0.5">
                      Boarding Reminder:
                    </strong>
                    <span>{aiData.arrivalReminder}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white/80 dark:bg-slate-900/70 border border-[#D1FAE5] dark:border-emerald-800/50 rounded-xl p-3.5 text-xs text-[#475569] dark:text-slate-300 flex items-center justify-between gap-3">
                <span>Click Refresh guidance to update transportation guidance for your selected stop.</span>
              </div>
            )}
          </section>
        </div>
      )}

      {/* =================================================================== */}
      {/* INTERACTIVE DUBAI MAP (Strictly Scoped to Selected Branch)          */}
      {/* =================================================================== */}
      {selectedBranch && (
        <div ref={mapSectionRef}>
          <SmartTransportMap
            studentLocation={hasSearched ? activeLocation : pendingLocation}
            allMappedStations={branchMappedStations}
            nearestStation={
              hasSearched && primaryResult?.station.hasCoordinates ? primaryResult : null
            }
            selectedStationId={overrideStationId || exactStationId}
            focusStationTrigger={focusStationTrigger}
            schoolCenters={schoolCenters}
            isPickerMode={isPickerMode}
            onClosePickerMode={() => setIsPickerMode(false)}
            onConfirmPickedLocation={(loc) => {
              setAddressInput(loc.label);
              setPendingLocation(loc);
              setExactStationId(null);
              setActiveMatchType('area_no_exact_station');
              setFilters((f) => ({ ...f, preferredStationId: 'all' }));
              setValidationError(null);
              if (hasSearched) {
                setActiveLocation(loc);
                setOverrideStationId(null);
              }
            }}
            onSelectStationFromMap={(stationId) => {
              const st = allBranchStations.find((s) => s.id === stationId);
              if (st) {
                handleSelectDirectOfficialStation(st, true);
              }
            }}
            onWalkingRouteUpdate={handleWalkingRouteUpdate}
            onOpenStationDetails={(st) => setModalStation(st)}
          />
        </div>
      )}

      {/* =================================================================== */}
      {/* COMPLETE BUS SCHEDULE – THROUGHOUT THE DAY (Selected Branch Only)   */}
      {/* =================================================================== */}
      {selectedBranch && selectedBranchMeta && hasSearched && primaryResult && (
        <section
          ref={scheduleSectionRef}
          className="bg-white dark:bg-[#0F172A] rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-xs overflow-hidden"
        >
          <div className="p-4 sm:p-5 border-b border-[#E2E8F0] dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-[#0F172A] dark:text-slate-100 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#006B45] dark:text-emerald-400" />
                <span>
                  Complete {selectedBranchMeta.shortName} Bus Schedule — {primaryResult.station.name}
                </span>
              </h3>
              <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
                All official {selectedBranchMeta.title} departures sorted chronologically for{' '}
                <strong className="text-[#0F172A] dark:text-slate-200">{effectiveWeekday}</strong> ·{' '}
                {primaryResult.station.routes[0]?.scheduleType || 'FULL WEEK SCHEDULE'} (Operates 7 Days/Week)
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-lg bg-[#F0FDF4] dark:bg-emerald-950/60 text-[#064E3B] dark:text-emerald-300 font-bold border border-[#D1FAE5] dark:border-emerald-800/70">
                {primaryResult.filteredDepartures.length} Matching Trips
              </span>
              <button
                type="button"
                onClick={() => setModalStation(primaryResult.station)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-[#0F172A] dark:text-slate-100 border border-[#CBD5E1] dark:border-slate-700 font-semibold transition-colors"
              >
                <Eye className="w-3.5 h-3.5 text-[#006B45] dark:text-emerald-400" />
                <span>Station Details</span>
              </button>
            </div>
          </div>

          {primaryResult.filteredDepartures.length === 0 ? (
            <div className="p-10 text-center text-xs text-[#64748B] dark:text-slate-400">
              No {selectedBranchMeta.shortName} bus departures are scheduled at{' '}
              <strong className="text-[#0F172A] dark:text-slate-200">{primaryResult.station.name}</strong> for your selected Departure Time filter ({filters.timePeriod}). Try setting Departure Time to &quot;All Times&quot;.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#F1F5F9] dark:bg-slate-900 border-b border-[#E2E8F0] dark:border-slate-800 text-[#475569] dark:text-slate-300 font-bold text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-4">Pickup Time</th>
                    <th className="py-3 px-4">Period</th>
                    <th className="py-3 px-4">Route</th>
                    <th className="py-3 px-4">Selected Branch</th>
                    <th className="py-3 px-4">ETA at Branch</th>
                    <th className="py-3 px-4">Branch Departure</th>
                    <th className="py-3 px-4">Operating Days</th>
                    <th className="py-3 px-4">Notes / Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] dark:divide-slate-800">
                  {primaryResult.filteredDepartures.map((dep, idx) => {
                    const isNext =
                      nextBus &&
                      nextBus.departure.tripId === dep.tripId &&
                      nextBus.departure.pickupTime === dep.pickupTime &&
                      !nextBus.isNextDayRollover;

                    const hasPassedToday =
                      filters.operatingDay === 'today' &&
                      dep.minutesFromMidnight <= dubaiNow.minutesFromMidnight;

                    return (
                      <tr
                        key={`${dep.tripId}-${dep.pickupTime}-${idx}`}
                        className={`transition-colors ${
                          isNext
                            ? 'bg-[#F0FDF4] dark:bg-emerald-950/40'
                            : idx % 2 === 0
                              ? 'bg-white dark:bg-[#0F172A] hover:bg-slate-50 dark:hover:bg-slate-800/60'
                              : 'bg-[#FAFAFA] dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 font-mono font-extrabold text-xs px-2.5 py-1 rounded-lg ${
                              isNext
                                ? 'bg-[#006B45] text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-[#0F172A] dark:text-slate-100'
                            }`}
                          >
                            {dep.pickupTime}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium text-[#475569] dark:text-slate-300">
                          {getTimePeriodLabel(dep.period)}
                        </td>
                        <td className="py-3 px-4 font-bold text-[#0F172A] dark:text-slate-100">
                          {dep.routeCode}
                        </td>
                        <td className="py-3 px-4 font-semibold text-[#064E3B] dark:text-emerald-300">
                          {dep.destinationName}
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-[#059669] dark:text-emerald-400">
                          {dep.etaAtCentre}
                        </td>
                        <td className="py-3 px-4 font-mono text-[#475569] dark:text-slate-300">
                          {dep.returnDeparture}
                        </td>
                        <td className="py-3 px-4 text-[#475569] dark:text-slate-300">
                          {dep.scheduleType === 'FULL WEEK SCHEDULE'
                            ? 'Daily (7 Days)'
                            : dep.scheduleType}
                        </td>
                        <td className="py-3 px-4 space-y-1">
                          {isNext ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-[#064E3B] dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 text-[11px] font-bold">
                              Next Bus ({formatCountdownMinutes(nextBus.minutesRemaining)})
                            </span>
                          ) : hasPassedToday ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[#64748B] dark:text-slate-400 text-[11px] font-medium">
                              Departed Today
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#F0FDF4] dark:bg-emerald-950/60 text-[#006B45] dark:text-emerald-300 border border-[#D1FAE5] dark:border-emerald-800/70 text-[11px] font-semibold">
                              Available
                            </span>
                          )}
                          {dep.notes && (
                            <span className="block text-[10px] font-semibold text-[#059669] dark:text-emerald-400">
                              Note: {dep.notes}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* =================================================================== */}
      {/* STATIONS ON THE SAME ROUTE / TRANSPORTATION LINE                    */}
      {/* =================================================================== */}
      {selectedBranch && selectedBranchMeta && hasSearched && primaryResult && sameRouteLines.length > 0 && (
        <section className="bg-white dark:bg-[#0F172A] rounded-2xl border border-[#E2E8F0] dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E2E8F0] dark:border-slate-800 pb-3">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#F0FDF4] dark:bg-emerald-950/60 text-[#006B45] dark:text-emerald-400 border border-[#D1FAE5] dark:border-emerald-800/70 flex items-center justify-center shrink-0">
                <GitBranch className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-[#0F172A] dark:text-slate-100">
                  Stations on the Same Route / Transportation Line ({selectedBranchMeta.shortName})
                </h3>
                <p className="text-xs text-[#64748B] dark:text-slate-400">
                  Official stop sequence on the bus line(s) serving{' '}
                  <strong className="text-[#0F172A] dark:text-slate-200">{primaryResult.station.name}</strong>.
                  These are route-line connections, distinct from optional nearby geographic alternatives.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {sameRouteLines.map((line) => (
              <div
                key={line.routeId}
                className="rounded-xl border border-[#E2E8F0] dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-900/70 p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-lg bg-[#064E3B] text-white text-[11px] font-bold">
                      {line.routeCode}
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-[#0F172A] dark:text-slate-100">
                      {line.routeTitle}
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-[#006B45] dark:text-emerald-300">
                    Destination: {line.destinationName} · {line.capacity} Seater
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {line.stops.map((stop, idx) => (
                    <div
                      key={`${line.routeId}-${stop.stopId}`}
                      className={`p-3 rounded-xl border text-xs flex flex-col justify-between gap-2 ${
                        stop.isCurrent
                          ? 'bg-[#F0FDF4] dark:bg-emerald-950/60 border-[#006B45] dark:border-emerald-500 ring-1 ring-[#006B45]/20'
                          : 'bg-white dark:bg-[#0F172A] border-[#E2E8F0] dark:border-slate-800'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                            Stop {idx + 1}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              stop.isCurrent
                                ? 'bg-[#006B45] text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-[#475569] dark:text-slate-300'
                            }`}
                          >
                            {stop.isCurrent ? 'Selected Stop' : 'Same Route'}
                          </span>
                        </div>
                        <div className="font-extrabold text-[#0F172A] dark:text-slate-100">
                          {stop.name}
                        </div>
                        <div className="text-[11px] text-[#64748B] dark:text-slate-400 line-clamp-2">
                          {stop.landmark}
                        </div>
                      </div>

                      {!stop.isCurrent && stop.stationId && (
                        <button
                          type="button"
                          onClick={() => {
                            const matched = allBranchStations.find((s) => s.id === stop.stationId);
                            if (matched) handleSelectDirectOfficialStation(matched, true);
                          }}
                          className="text-left text-[11px] font-bold text-[#006B45] dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
                        >
                          <span>Switch to exact station</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* =================================================================== */}
      {/* OPTIONAL NEARBY ALTERNATIVE STATIONS (Top 3 Closest for Branch)     */}
      {/* =================================================================== */}
      {selectedBranch && selectedBranchMeta && hasSearched && otherNearbyResults.length > 0 && (
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-[#0F172A] dark:text-slate-100">
                Optional Nearby Alternative Stations ({selectedBranchMeta.shortName} Only)
              </h3>
              <p className="text-xs text-[#64748B] dark:text-slate-400">
                Optional {selectedBranchMeta.title} stations ordered strictly by straight-line distance from{' '}
                {activeLocation ? activeLocation.areaName || activeLocation.label : primaryResult?.station.name}.
              </p>
            </div>
            {overrideStationId && (exactSelectedStation || closestOverallResult) && (
              <button
                type="button"
                onClick={() => setOverrideStationId(null)}
                className="text-xs font-bold text-[#006B45] dark:text-emerald-400 hover:underline self-start sm:self-auto"
              >
                {exactSelectedStation
                  ? `Return to Exact Selected Station (${exactSelectedStation.name})`
                  : `Return to Closest ${selectedBranchMeta.shortName} Alternative (${closestOverallResult?.station.name})`}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {otherNearbyResults.map((item) => {
              const { station, straightLineKm, filteredDepartures } = item;
              return (
                <div
                  key={station.id}
                  className="bg-white dark:bg-[#0F172A] rounded-2xl border border-[#E2E8F0] dark:border-slate-800 p-4 shadow-xs flex flex-col justify-between gap-3 hover:border-[#006B45]/40 dark:hover:border-emerald-600/60 transition-colors"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800/70 text-[10px] font-bold uppercase tracking-wide">
                        Optional Nearby Alternative
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[#F0FDF4] dark:bg-emerald-950/60 text-[#006B45] dark:text-emerald-300 border border-[#D1FAE5] dark:border-emerald-800/70 font-mono text-[11px] font-bold">
                        {formatStraightLineDistance(straightLineKm)} straight-line
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between gap-2">
                      <h4 className="text-sm sm:text-base font-extrabold text-[#0F172A] dark:text-slate-100">
                        {station.name}
                      </h4>
                      <span className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 shrink-0">
                        {filteredDepartures.length} trips
                      </span>
                    </div>

                    <p className="text-[11px] text-[#64748B] dark:text-slate-400 line-clamp-2">
                      {station.landmarks[0]}
                    </p>

                    <div className="text-[11px] text-[#064E3B] dark:text-emerald-300 font-semibold">
                      Branch: {station.centerName} ({station.branchCode})
                    </div>

                    <div>
                      <span className="block text-[10px] font-bold uppercase text-[#64748B] dark:text-slate-400 mb-1">
                        Pickup Times:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {filteredDepartures.slice(0, 6).map((d, i) => (
                          <span
                            key={`${d.tripId}-${d.pickupTime}-${i}`}
                            className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[10px] font-semibold text-[#0F172A] dark:text-slate-100"
                          >
                            {d.pickupTime}
                          </span>
                        ))}
                        {filteredDepartures.length > 6 && (
                          <span className="text-[10px] text-[#64748B] dark:text-slate-400 self-center">
                            +{filteredDepartures.length - 6} more
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#E2E8F0] dark:border-slate-800 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setOverrideStationId(station.id);
                        resultsSectionRef.current?.scrollIntoView({
                          behavior: 'smooth',
                          block: 'start',
                        });
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-[#006B45] hover:bg-[#064E3B] text-white text-xs font-bold transition-colors"
                    >
                      <span>View Alternative Schedule</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <a
                      href={buildGoogleMapsDirectionsUrl(activeLocation, station)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center p-2 rounded-xl bg-[#F0FDF4] dark:bg-emerald-950/60 hover:bg-[#D1FAE5] dark:hover:bg-emerald-900/60 text-[#006B45] dark:text-emerald-300 border border-[#D1FAE5] dark:border-emerald-800/70"
                      title="Open Google Maps Location"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* =================================================================== */}
      {/* BRANCH-SCOPED STOPS WITHOUT GPS COORDINATES (DIC Internal Shuttle)  */}
      {/* =================================================================== */}
      {selectedBranch && unmappedStations.length > 0 && (
        <section className="bg-slate-50 dark:bg-slate-900 rounded-2xl border border-[#E2E8F0] dark:border-slate-800 p-4 sm:p-5 space-y-2.5">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-[#64748B] dark:text-slate-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-[#0F172A] dark:text-slate-100">
                {BRANCH_META[selectedBranch].shortName} Stops Without GPS Coordinates ({unmappedStations.length} Internal Shuttle Stops)
              </h4>
              <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
                These {BRANCH_META[selectedBranch].title} shuttle stops do not have Google Maps pin coordinates in the official schedule, so they are excluded from geographic distance comparisons. Click any stop below to inspect its timetable.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {unmappedStations.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setModalStation(st)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 hover:border-[#006B45] dark:hover:border-emerald-500 text-xs font-semibold text-[#0F172A] dark:text-slate-100 transition-colors"
              >
                <MapPin className="w-3.5 h-3.5 text-[#94A3B8] dark:text-slate-400" />
                <span>{st.name}</span>
                <span className="text-[10px] text-[#64748B] dark:text-slate-400">(Location unavailable)</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Station Details Modal */}
      <StationDetailsModal
        station={modalStation}
        straightLineKm={
          modalStation && activeLocation
            ? ranked.find((r) => r.station.id === modalStation.id)?.straightLineKm ?? null
            : null
        }
        studentLocation={activeLocation}
        onClose={() => setModalStation(null)}
      />
    </div>
  );
};

export const AISmartTransportFinderPage: React.FC = () => <AISmartTransportFinderContent />;
