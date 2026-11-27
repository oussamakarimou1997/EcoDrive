import { TRANSPORT_CENTERS, TRANSPORT_ROUTES } from '../data/transportationData';
import { CenterId } from '../types/transportation';
import {
  BranchCode,
  LatLng,
  NextBusInfo,
  OperatingDayOption,
  RankedStationResult,
  SameRouteLineInfo,
  SmartTransportFilters,
  StationDeparture,
  TimePeriod,
  TransportStation,
} from '../types/smartTransport';

export const BRANCH_META: Record<
  BranchCode,
  {
    code: BranchCode;
    centerId: CenterId;
    badgeLabel: string;
    title: string;
    subtitle: string;
    shortName: string;
    locationArea: string;
  }
> = {
  DIC: {
    code: 'DIC',
    centerId: 'dic',
    badgeLabel: 'Branch 1',
    title: 'DIC – Dubai Industrial City',
    subtitle: 'Dubai Industrial City Branch',
    shortName: 'DIC Centre',
    locationArea: 'Dubai Industrial City, Saih Shuaib 2, Dubai',
  },
  AL_QUOZ: {
    code: 'AL_QUOZ',
    centerId: 'al_quoz',
    badgeLabel: 'Branch 2',
    title: 'Al Quoz',
    subtitle: 'Al Quoz Branch',
    shortName: 'Al Quoz Centre',
    locationArea: 'Al Quoz Industrial Area 3, Dubai',
  },
};

export function centerIdToBranchCode(centerId: CenterId): BranchCode {
  return centerId === 'dic' ? 'DIC' : 'AL_QUOZ';
}

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export const DUBAI_DEFAULT_CENTER: LatLng = { lat: 25.1972, lng: 55.2744 };

export const QUICK_DUBAI_AREAS: Array<{ label: string; query: string }> = [
  { label: 'Dubai Marina', query: 'Dubai Marina, Dubai, UAE' },
  { label: 'International City', query: 'International City, Dubai, UAE' },
  { label: 'Al Barsha', query: 'Al Barsha, Dubai, UAE' },
  { label: 'Business Bay', query: 'Business Bay, Dubai, UAE' },
  { label: 'Deira', query: 'Deira, Dubai, UAE' },
  { label: 'Al Rigga', query: 'Al Rigga, Dubai, UAE' },
  { label: 'Jumeirah', query: 'Jumeirah, Dubai, UAE' },
  { label: 'Discovery Gardens', query: 'Discovery Gardens, Dubai, UAE' },
  { label: 'Dubai Silicon Oasis', query: 'Dubai Silicon Oasis, Dubai, UAE' },
];

/**
 * Parses time strings like "5:30AM", "12:20PM", "11:15PM" into minutes from midnight.
 * Returns null if the string cannot be reliably parsed.
 */
export function parseTimeToMinutes(timeStr: string): number | null {
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;

  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const period = match[3].toUpperCase();

  if (period === 'AM') {
    if (hour === 12) hour = 0;
  } else if (period === 'PM') {
    if (hour < 12) hour += 12;
  }

  return hour * 60 + minute;
}

export function getTimePeriod(minutesFromMidnight: number): TimePeriod {
  if (minutesFromMidnight < 12 * 60) return 'morning';
  if (minutesFromMidnight < 17 * 60) return 'afternoon';
  return 'evening';
}

export function getTimePeriodLabel(period: TimePeriod): string {
  switch (period) {
    case 'morning':
      return 'Morning';
    case 'afternoon':
      return 'Afternoon';
    case 'evening':
      return 'Evening';
  }
}

/**
 * Great-circle Haversine straight-line distance in kilometers.
 */
export function calculateHaversineKm(a: LatLng, b: LatLng): number {
  const R = 6371; // Earth radius in km
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatStraightLineDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(2)} km`;
}

export function formatWalkingDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
}

export function formatDurationMinutes(durationMillis: number): string {
  const totalMins = Math.max(1, Math.round(durationMillis / 60000));
  if (totalMins < 60) {
    return `${totalMins} min${totalMins === 1 ? '' : 's'}`;
  }
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return mins > 0 ? `${hrs} hr ${mins} min` : `${hrs} hr`;
}

export function formatCountdownMinutes(totalMinutes: number): string {
  if (totalMinutes <= 0) return 'Departing now';
  if (totalMinutes < 60) {
    return `in ${totalMinutes} min${totalMinutes === 1 ? '' : 's'}`;
  }
  const hrs = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return mins > 0 ? `in ${hrs} hr ${mins} min` : `in ${hrs} hr`;
}

/**
 * Current local time and weekday in Asia/Dubai (GST / UTC+4).
 */
export function getDubaiNow(now: Date = new Date()): {
  weekday: (typeof WEEKDAYS)[number];
  minutesFromMidnight: number;
  formattedTime: string;
  formattedDate: string;
} {
  const weekdayStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dubai',
    weekday: 'long',
  }).format(now);

  const time24 = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dubai',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  }).format(now);

  const [hStr, mStr] = time24.split(':');
  const hour = parseInt(hStr, 10) % 24;
  const minute = parseInt(mStr || '0', 10);

  const formattedTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dubai',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(now);

  const formattedDate = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dubai',
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(now);

  const weekday = (WEEKDAYS.find((d) => d === weekdayStr) || 'Monday') as (typeof WEEKDAYS)[number];

  return {
    weekday,
    minutesFromMidnight: hour * 60 + minute,
    formattedTime,
    formattedDate,
  };
}

function getNextWeekday(currentWeekday: string): string {
  const idx = WEEKDAYS.indexOf(currentWeekday as (typeof WEEKDAYS)[number]);
  if (idx === -1) return 'Tomorrow';
  return WEEKDAYS[(idx + 1) % 7];
}

/**
 * Checks if a route scheduleType string supports a given weekday.
 * Preserves source truth: "FULL WEEK SCHEDULE" operates 7 days/week.
 */
export function doesScheduleOperateOnDay(scheduleType: string, dayName: string): boolean {
  const upper = scheduleType.toUpperCase();
  if (upper.includes('FULL WEEK') || upper.includes('DAILY') || upper.includes('7 DAYS')) {
    return true;
  }
  return upper.includes(dayName.toUpperCase());
}

/**
 * Normalizes stop name for grouping physical pickup stations WITHIN the same branch only.
 * Stations from DIC and AL_QUOZ never merge so schedules and pins remain strictly branch-specific.
 */
function normalizeStationGroupKey(
  branchCode: BranchCode,
  stopName: string,
  landmark: string,
  coords: LatLng | null
): string {
  const cleanName = stopName
    .toLowerCase()
    .replace(/\bbranch\b/g, '')
    .replace(/\bdeira city center\b/g, 'deira city centre')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleanName.includes('garmin')) {
    return `${branchCode}__${cleanName}__${landmark.toLowerCase().slice(0, 18)}`;
  }

  if (coords) {
    return `${branchCode}__${cleanName}__${coords.lat.toFixed(3)}_${coords.lng.toFixed(3)}`;
  }

  return `${branchCode}__${cleanName}__nocoord`;
}

/**
 * Builds the authoritative station directory directly from TRANSPORT_ROUTES and resolved pin coordinates.
 * Each station carries a strict branch identifier ('DIC' or 'AL_QUOZ') and never mixes branch data.
 */
export function buildStationsFromSource(
  resolvedPins: Record<string, LatLng | null>
): TransportStation[] {
  const centerLookup: Record<CenterId, string> = {
    al_quoz:
      TRANSPORT_CENTERS.find((c) => c.id === 'al_quoz')?.name || 'Al Quoz Centre',
    dic:
      TRANSPORT_CENTERS.find((c) => c.id === 'dic')?.name ||
      'Dubai Industrial City (DIC) Centre',
  };

  const stationMap: Record<string, TransportStation> = {};

  for (const route of TRANSPORT_ROUTES) {
    const branchCode = centerIdToBranchCode(route.centerId);
    const centerName = centerLookup[route.centerId];

    for (const stop of route.stops) {
      const coords = typeof stop.latitude === 'number' && typeof stop.longitude === 'number' && Number.isFinite(stop.latitude) && Number.isFinite(stop.longitude) && stop.latitude >= 22.5 && stop.latitude <= 26.5 && stop.longitude >= 51 && stop.longitude <= 56.5
        ? { lat: stop.latitude, lng: stop.longitude }
        : stop.pinUrl ? resolvedPins[stop.pinUrl] ?? null : null;
      const groupKey = normalizeStationGroupKey(branchCode, stop.name, stop.landmark, coords);

      if (!stationMap[groupKey]) {
        stationMap[groupKey] = {
          id: groupKey,
          branchCode,
          centerId: route.centerId,
          centerName,
          name: stop.name.replace(/\s+Branch$/i, ''),
          areaLabel: stop.name,
          landmarks: [],
          pinUrls: [],
          primaryPinUrl: stop.pinUrl,
          coordinates: coords,
          hasCoordinates: coords !== null,
          routes: [],
          departures: [],
        };
      }

      const station = stationMap[groupKey];

      if (!station.landmarks.includes(stop.landmark)) {
        station.landmarks.push(stop.landmark);
      }
      if (stop.pinUrl && !station.pinUrls.includes(stop.pinUrl)) {
        station.pinUrls.push(stop.pinUrl);
        if (!station.primaryPinUrl) station.primaryPinUrl = stop.pinUrl;
      }
      if (!station.coordinates && coords) {
        station.coordinates = coords;
        station.hasCoordinates = true;
      }

      station.routes.push({
        routeId: route.id,
        routeCode: route.routeCode,
        routeTitle: route.title,
        centerId: route.centerId,
        centerName,
        destinationName: route.centerEtaName,
        scheduleType: route.scheduleType,
        capacity: route.capacity,
        stopId: stop.id,
        landmark: stop.landmark,
        pinUrl: stop.pinUrl,
      });

      // Extract every trip departure for this stop from the source route
      for (const trip of route.trips) {
        const pickupTime = trip.stopTimes[stop.id];
        if (!pickupTime) continue;

        const mins = parseTimeToMinutes(pickupTime);
        if (mins === null) continue;

        station.departures.push({
          tripId: trip.id,
          routeId: route.id,
          routeCode: route.routeCode,
          routeTitle: route.title,
          centerId: route.centerId,
          centerName,
          destinationName: route.centerEtaName,
          scheduleType: route.scheduleType,
          capacity: route.capacity,
          pickupTime,
          minutesFromMidnight: mins,
          period: getTimePeriod(mins),
          etaAtCentre: trip.eta,
          returnDeparture: route.departures ? (route.departures.map(d => d.time + (d.destination ? ' ' + d.destination : '')).join(' / ') || '—') : trip.departure,
          notes: route.departures ? undefined : trip.notes,
        });
      }
    }
  }

  // Sort departures chronologically for each station
  return Object.values(stationMap).map((station) => ({
    ...station,
    departures: [...station.departures].sort(
      (a, b) => a.minutesFromMidnight - b.minutesFromMidnight
    ),
  }));
}

/**
 * Filters departures for a station based on selected branch, time period, and operating day.
 */
export function filterStationDepartures(
  departures: StationDeparture[],
  selectedBranch: BranchCode,
  filters: SmartTransportFilters,
  effectiveWeekday: string
): StationDeparture[] {
  const targetCenterId = BRANCH_META[selectedBranch].centerId;
  return departures.filter((dep) => {
    if (dep.centerId !== targetCenterId) {
      return false;
    }
    if (filters.timePeriod !== 'all' && dep.period !== filters.timePeriod) {
      return false;
    }
    if (!doesScheduleOperateOnDay(dep.scheduleType, effectiveWeekday)) {
      return false;
    }
    return true;
  });
}

/**
 * Ranks coordinate-verified stations belonging STRICTLY to selectedBranch by Haversine distance
 * from studentLocation. Returns empty lists if selectedBranch is null.
 */
export function filterAndRankStations(
  stations: TransportStation[],
  selectedBranch: BranchCode | null,
  studentLocation: LatLng | null,
  filters: SmartTransportFilters,
  dubaiNowWeekday: string
): {
  ranked: RankedStationResult[];
  unmappedStations: TransportStation[];
} {
  if (!selectedBranch) {
    return { ranked: [], unmappedStations: [] };
  }

  const branchStations = stations.filter((s) => s.branchCode === selectedBranch);
  const unmappedStations = branchStations.filter((s) => !s.hasCoordinates || !s.coordinates);

  if (!studentLocation) {
    return { ranked: [], unmappedStations };
  }

  const effectiveWeekday =
    filters.operatingDay === 'today' ? dubaiNowWeekday : filters.operatingDay;

  const mapped: RankedStationResult[] = [];

  for (const station of branchStations) {
    if (!station.hasCoordinates || !station.coordinates) continue;

    if (
      filters.preferredStationId !== 'all' &&
      station.id !== filters.preferredStationId
    ) {
      continue;
    }

    const straightLineKm = calculateHaversineKm(studentLocation, station.coordinates);

    if (
      filters.maxDistanceKm !== null &&
      straightLineKm > filters.maxDistanceKm
    ) {
      continue;
    }

    const filteredDepartures = filterStationDepartures(
      station.departures,
      selectedBranch,
      filters,
      effectiveWeekday
    );

    if (filters.timePeriod !== 'all' && filteredDepartures.length === 0) {
      continue;
    }

    mapped.push({
      station,
      straightLineKm,
      filteredDepartures,
    });
  }

  mapped.sort((a, b) => a.straightLineKm - b.straightLineKm);

  return { ranked: mapped, unmappedStations };
}

/**
 * Normalizes station / place names for strict canonical matching against official Eco Drive stops.
 * Never fuzzy-matches different neighborhoods (e.g. "Al Rigga" will NEVER match "Burjuman" or "Union").
 */
export function normalizeStationNameText(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[,().\-_/]+/g, ' ')
    .replace(/\b(united arab emirates|uae|dubai|sharjah)\b/g, ' ')
    .replace(/\b(bus station|metro station|bus stop|station|stop|metro|branch)\b/g, ' ')
    .replace(/\bcenter\b/g, 'centre')
    .replace(/\bbur\s+juman\b/g, 'burjuman')
    .replace(/\bsatwa\s+bus\b/g, 'satwa')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Matches a user-typed query ONLY when it unambiguously names an official Eco Drive pickup stop
 * in the selected branch. Returns null for non-stop areas such as "Al Rigga".
 */
export function matchOfficialStationQuery(
  query: string,
  stations: TransportStation[],
  selectedBranch: BranchCode | null
): TransportStation | null {
  if (!selectedBranch) return null;
  const normalizedQuery = normalizeStationNameText(query);
  if (!normalizedQuery || normalizedQuery.length < 3) return null;

  const branchStations = stations.filter((s) => s.branchCode === selectedBranch);

  // 1. Exact raw name match (case-insensitive)
  const rawLower = query.trim().toLowerCase();
  const exactRaw = branchStations.find(
    (s) => s.name.trim().toLowerCase() === rawLower || s.areaLabel.trim().toLowerCase() === rawLower
  );
  if (exactRaw) return exactRaw;

  // 2. Canonical normalized match (e.g. "Union Metro Station" -> "Union", "Deira City Centre" -> "Deira City Center")
  const canonicalMatches = branchStations.filter((s) => {
    const normStop = normalizeStationNameText(s.name);
    if (!normStop) return false;
    return normStop === normalizedQuery;
  });

  if (canonicalMatches.length >= 1) {
    return canonicalMatches.find((s) => s.hasCoordinates) || canonicalMatches[0];
  }

  return null;
}

/**
 * Builds a RankedStationResult for an explicitly selected station WITHOUT replacing it
 * with another station even if filters would exclude it or if it lacks GPS coordinates.
 */
export function buildExactStationResult(
  station: TransportStation,
  selectedBranch: BranchCode,
  studentLocation: LatLng | null,
  filters: SmartTransportFilters,
  dubaiNowWeekday: string
): RankedStationResult {
  const effectiveWeekday =
    filters.operatingDay === 'today' ? dubaiNowWeekday : filters.operatingDay;

  const filteredDepartures = filterStationDepartures(
    station.departures,
    selectedBranch,
    filters,
    effectiveWeekday
  );

  const straightLineKm =
    studentLocation && station.coordinates
      ? calculateHaversineKm(studentLocation, station.coordinates)
      : 0;

  return {
    station,
    straightLineKm,
    filteredDepartures,
  };
}

/**
 * Extracts all stations sharing the same official bus route / transportation line(s)
 * as the given station within selectedBranch, preserving exact route stop sequence.
 */
export function getSameRouteStations(
  station: TransportStation,
  selectedBranch: BranchCode,
  allStations: TransportStation[]
): SameRouteLineInfo[] {
  const targetCenterId = BRANCH_META[selectedBranch].centerId;
  const branchStations = allStations.filter((s) => s.branchCode === selectedBranch);
  const stationStopIds = new Set(station.routes.map((r) => r.stopId));
  const stationRouteIds = new Set(station.routes.map((r) => r.routeId));

  const lines: SameRouteLineInfo[] = [];

  for (const route of TRANSPORT_ROUTES) {
    if (route.centerId !== targetCenterId) continue;
    if (!stationRouteIds.has(route.id)) continue;

    let currentStopIndex = -1;
    const stops = route.stops.map((stop, idx) => {
      const isCurrent = stationStopIds.has(stop.id) || stop.name.trim().toLowerCase() === station.name.trim().toLowerCase();
      if (isCurrent && currentStopIndex === -1) {
        currentStopIndex = idx;
      }

      const matchedStation =
        branchStations.find((st) => st.routes.some((r) => r.stopId === stop.id)) ||
        branchStations.find(
          (st) =>
            normalizeStationNameText(st.name) === normalizeStationNameText(stop.name)
        ) ||
        null;

      const sampleTimes = route.trips
        .map((t) => t.stopTimes[stop.id])
        .filter((val): val is string => Boolean(val));

      return {
        stopId: stop.id,
        stationId: matchedStation?.id || null,
        name: stop.name.replace(/\s+Branch$/i, ''),
        landmark: stop.landmark,
        isCurrent,
        hasCoordinates: Boolean(matchedStation?.hasCoordinates),
        sampleTimes,
      };
    });

    lines.push({
      routeId: route.id,
      routeCode: route.routeCode,
      routeTitle: route.title,
      scheduleType: route.scheduleType,
      capacity: route.capacity,
      destinationName: route.centerEtaName,
      currentStopIndex,
      stops,
    });
  }

  return lines;
}

/**
 * Computes the next upcoming bus for a list of chronologically sorted departures.
 * Uses real Dubai local time when operatingDay is 'today'.
 */
export function computeNextBus(
  departures: StationDeparture[],
  operatingDay: OperatingDayOption,
  dubaiNow: { weekday: string; minutesFromMidnight: number }
): NextBusInfo | null {
  if (departures.length === 0) return null;

  const sorted = [...departures].sort(
    (a, b) => a.minutesFromMidnight - b.minutesFromMidnight
  );

  if (operatingDay !== 'today') {
    return {
      departure: sorted[0],
      minutesRemaining: 0,
      isToday: false,
      isNextDayRollover: false,
      operatingDayLabel: operatingDay,
    };
  }

  const upcomingToday = sorted.find(
    (d) => d.minutesFromMidnight > dubaiNow.minutesFromMidnight
  );

  if (upcomingToday) {
    return {
      departure: upcomingToday,
      minutesRemaining: upcomingToday.minutesFromMidnight - dubaiNow.minutesFromMidnight,
      isToday: true,
      isNextDayRollover: false,
      operatingDayLabel: dubaiNow.weekday,
    };
  }

  // All buses for today have already departed -> check next operating day
  const tomorrowName = getNextWeekday(dubaiNow.weekday);
  const nextDayDep = sorted.find((d) =>
    doesScheduleOperateOnDay(d.scheduleType, tomorrowName)
  );

  if (!nextDayDep) return null;

  const minutesUntilMidnight = 24 * 60 - dubaiNow.minutesFromMidnight;
  return {
    departure: nextDayDep,
    minutesRemaining: minutesUntilMidnight + nextDayDep.minutesFromMidnight,
    isToday: false,
    isNextDayRollover: true,
    operatingDayLabel: tomorrowName,
  };
}

/**
 * Builds an official Google Maps Directions URL from the student's selected location
 * to the pickup station's coordinates (or falls back to the station's official pinUrl).
 */
export function buildGoogleMapsDirectionsUrl(
  origin: LatLng | null,
  station: TransportStation
): string {
  if (origin && station.coordinates) {
    return `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${station.coordinates.lat},${station.coordinates.lng}&travelmode=walking`;
  }
  if (station.primaryPinUrl) {
    return station.primaryPinUrl;
  }
  if (station.coordinates) {
    return `https://www.google.com/maps/search/?api=1&query=${station.coordinates.lat},${station.coordinates.lng}`;
  }
  return 'https://www.google.com/maps';
}
