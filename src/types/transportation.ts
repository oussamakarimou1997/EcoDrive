export type CenterId = 'al_quoz' | 'dic';

export interface TransportCenter {
  id: CenterId;
  name: string;
  shortName: string;
  locationArea: string;
  badge: string;
  description: string;
  routesCount: number;
}

export interface TransportStop {
  id: string;
  name: string;
  landmark: string;
  pinUrl?: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface TransportTrip {
  id: string;
  stopTimes: Record<string, string>; // stopId -> time (e.g., "5:30AM")
  eta: string;
  departure: string;
  notes?: string;
}

export interface TransportRoute {
  id: string;
  centerId: CenterId;
  routeCode: string; // e.g. "ROUTE 1", "ROUTE 2", "DIC INTERNAL"
  title: string;
  scheduleType: string; // e.g. "FULL WEEK SCHEDULE"
  capacity: number; // e.g. 24 or 12
  stops: TransportStop[];
  centerEtaName: string; // e.g. "ECO DRIVE AL QUOZ" or "ECO DRIVE - DIC"
  trips: TransportTrip[];
  departures?: { id: string; time: string; destination?: string | null; notes?: string | null }[];
}

/** Match official return departures by the times explicitly recorded on a pickup row.
 * Unmatched departures remain independent; never infer a pairing from array position.
 */
export function getTripReturnDepartures(route: TransportRoute, trip: TransportTrip) {
  const times = (trip.departure || '').toUpperCase().match(/\b\d{1,2}:\d{2}\s*[AP]M\b/g) || [];
  // Only the first time belongs to the pickup row; subsequent times are independent.
  const first = times[0]?.replace(/\s/g, '');
  return (route.departures || []).filter(d => d.time.toUpperCase().replace(/\s/g, '') === first);
}
export function formatReturnDeparture(d: NonNullable<TransportRoute['departures']>[number]) {
  return [d.time, d.destination || d.notes].filter(Boolean).join(' · ');
}
