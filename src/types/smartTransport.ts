import { CenterId } from './transportation';

export interface LatLng {
  lat: number;
  lng: number;
}

export type LocationInputSource = 'autocomplete' | 'map' | 'geolocation' | 'quick-area';

export interface StudentLocation {
  lat: number;
  lng: number;
  label: string;
  areaName?: string;
  source: LocationInputSource;
}

export type TimePeriod = 'morning' | 'afternoon' | 'evening';

export interface StationDeparture {
  tripId: string;
  routeId: string;
  routeCode: string;
  routeTitle: string;
  centerId: CenterId;
  centerName: string;
  destinationName: string;
  scheduleType: string;
  capacity: number;
  pickupTime: string; // Preserved original time format from source
  minutesFromMidnight: number;
  period: TimePeriod;
  etaAtCentre: string;
  returnDeparture: string;
  notes?: string;
}

export interface StationRouteRef {
  routeId: string;
  routeCode: string;
  routeTitle: string;
  centerId: CenterId;
  centerName: string;
  destinationName: string;
  scheduleType: string;
  capacity: number;
  stopId: string;
  landmark: string;
  pinUrl?: string;
}

export type BranchCode = 'DIC' | 'AL_QUOZ';

export interface TransportStation {
  id: string;
  branchCode: BranchCode;
  centerId: CenterId;
  centerName: string;
  name: string;
  areaLabel: string;
  landmarks: string[];
  pinUrls: string[];
  primaryPinUrl?: string;
  coordinates: LatLng | null;
  hasCoordinates: boolean;
  routes: StationRouteRef[];
  departures: StationDeparture[];
}

export interface RankedStationResult {
  station: TransportStation;
  straightLineKm: number;
  filteredDepartures: StationDeparture[];
}

export interface WalkingRouteInfo {
  status: 'idle' | 'loading' | 'available' | 'unavailable';
  distanceMeters?: number;
  durationMillis?: number;
  reason?: string;
}

export interface NextBusInfo {
  departure: StationDeparture;
  minutesRemaining: number;
  isToday: boolean;
  isNextDayRollover: boolean;
  operatingDayLabel: string;
}

export type OperatingDayOption =
  | 'today'
  | 'Sunday'
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday';

export type TimeFilterOption = 'all' | 'morning' | 'afternoon' | 'evening';

export interface SmartTransportFilters {
  preferredStationId: 'all' | string;
  timePeriod: TimeFilterOption;
  operatingDay: OperatingDayOption;
  maxDistanceKm: number | null;
}

export interface ResolvedPinsResponse {
  pins: Record<string, LatLng | null>;
  centers: Record<
    CenterId,
    { lat: number; lng: number; label: string; pinUrl?: string } | null
  >;
}

export interface AIRecommendationResponse {
  headline: string;
  recommendations: string[];
  alternativeTip: string;
  arrivalReminder: string;
}
