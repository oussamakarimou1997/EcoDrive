import React from 'react';
import {
  X,
  MapPin,
  Bus,
  Clock,
  ExternalLink,
  Calendar,
  Users,
  Building2,
  Navigation,
} from 'lucide-react';
import { StudentLocation, TransportStation } from '../types/smartTransport';
import {
  buildGoogleMapsDirectionsUrl,
  formatStraightLineDistance,
  getTimePeriodLabel,
} from '../utils/transportFinderUtils';

interface StationDetailsModalProps {
  station: TransportStation | null;
  straightLineKm?: number | null;
  studentLocation: StudentLocation | null;
  onClose: () => void;
}

export const StationDetailsModal: React.FC<StationDetailsModalProps> = ({
  station,
  straightLineKm,
  studentLocation,
  onClose,
}) => {
  if (!station) return null;

  const directionsUrl = buildGoogleMapsDirectionsUrl(studentLocation, station);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="station-details-title"
    >
      <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-[#E2E8F0] dark:border-slate-700 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-[#064E3B] dark:bg-[#043427] text-white p-5 flex items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              {station.routes.map((r) => (
                <span
                  key={`${r.routeId}-${r.stopId}`}
                  className="px-2 py-0.5 rounded bg-white/15 border border-white/20 text-[11px] font-bold uppercase"
                >
                  {r.routeCode} · {r.centerId === 'al_quoz' ? 'Al Quoz' : 'DIC'}
                </span>
              ))}
            </div>
            <h3 id="station-details-title" className="text-lg sm:text-xl font-extrabold">
              {station.name}
            </h3>
            <p className="text-xs text-emerald-100/85 mt-1">
              {station.landmarks.join(' / ')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Close station details"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Quick Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-[#F8FAFC] dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase text-[#64748B] dark:text-slate-400 flex items-center gap-1">
                <Building2 className="w-3 h-3 text-[#006B45] dark:text-emerald-400" />
                <span>Destination Branch</span>
              </span>
              <span className="block text-xs font-bold text-[#0F172A] dark:text-slate-100 mt-1">
                {station.centerName} ({station.branchCode})
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#F8FAFC] dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase text-[#64748B] dark:text-slate-400 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-[#006B45] dark:text-emerald-400" />
                <span>Operating Schedule</span>
              </span>
              <span className="block text-xs font-bold text-[#0F172A] dark:text-slate-100 mt-1">
                {station.routes[0]?.scheduleType || 'FULL WEEK SCHEDULE'} (7 Days)
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#F8FAFC] dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase text-[#64748B] dark:text-slate-400 flex items-center gap-1">
                <Navigation className="w-3 h-3 text-[#006B45] dark:text-emerald-400" />
                <span>Straight-Line Distance</span>
              </span>
              <span className="block text-xs font-bold text-[#0F172A] dark:text-slate-100 mt-1">
                {straightLineKm !== null && straightLineKm !== undefined
                  ? formatStraightLineDistance(straightLineKm)
                  : station.hasCoordinates
                    ? 'Select your location to compute'
                    : 'GPS coordinates unavailable'}
              </span>
            </div>
          </div>

          {/* Served Routes & Landmarks */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
              Routes Serving This Pickup Stop
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {station.routes.map((r) => (
                <div
                  key={`${r.routeId}-${r.stopId}`}
                  className="p-3 rounded-xl bg-[#F0FDF4] dark:bg-emerald-950/40 border border-[#D1FAE5] dark:border-emerald-800/60 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-[#064E3B] dark:text-emerald-200">
                      {r.routeCode} → {r.destinationName}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#006B45] dark:text-emerald-400">
                      <Users className="w-3 h-3" />
                      {r.capacity} Pax
                    </span>
                  </div>
                  <p className="text-[11px] text-[#064E3B]/80 dark:text-emerald-300/80 mt-1">{r.routeTitle}</p>
                  <p className="text-[11px] text-[#64748B] dark:text-slate-400 mt-1">
                    <strong className="text-[#0F172A] dark:text-slate-200">Pickup Point:</strong> {r.landmark}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Complete Chronological Schedule Table */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400 mb-2 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#006B45] dark:text-emerald-400" />
              <span>Complete Daily Bus Schedule ({station.departures.length} Departures)</span>
            </h4>
            <div className="border border-[#E2E8F0] dark:border-slate-800 rounded-xl overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#F1F5F9] dark:bg-slate-900 border-b border-[#E2E8F0] dark:border-slate-800 text-[#475569] dark:text-slate-300 font-bold text-[11px] uppercase">
                    <th className="py-2.5 px-3.5">Pickup Time</th>
                    <th className="py-2.5 px-3.5">Period</th>
                    <th className="py-2.5 px-3.5">Route</th>
                    <th className="py-2.5 px-3.5">Destination / Branch</th>
                    <th className="py-2.5 px-3.5">ETA Institute</th>
                    <th className="py-2.5 px-3.5">Return Dep.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] dark:divide-slate-800">
                  {station.departures.map((dep, idx) => (
                    <tr
                      key={`${dep.tripId}-${dep.pickupTime}-${idx}`}
                      className={idx % 2 === 0 ? 'bg-white dark:bg-[#0F172A]' : 'bg-[#FAFAFA] dark:bg-slate-900/40'}
                    >
                      <td className="py-2.5 px-3.5 font-mono font-bold text-[#064E3B] dark:text-emerald-300">
                        {dep.pickupTime}
                      </td>
                      <td className="py-2.5 px-3.5 text-[11px] text-[#475569] dark:text-slate-400">
                        {getTimePeriodLabel(dep.period)}
                      </td>
                      <td className="py-2.5 px-3.5 font-semibold text-[#0F172A] dark:text-slate-100">
                        {dep.routeCode}
                      </td>
                      <td className="py-2.5 px-3.5 font-medium text-[#0F172A] dark:text-slate-200">
                        {dep.destinationName}
                      </td>
                      <td className="py-2.5 px-3.5 font-mono text-[#059669] dark:text-emerald-400 font-semibold">
                        {dep.etaAtCentre}
                      </td>
                      <td className="py-2.5 px-3.5 font-mono text-[#475569] dark:text-slate-300">
                        {dep.returnDeparture}
                        {dep.notes && (
                          <span className="block text-[10px] text-[#059669] dark:text-emerald-400 mt-0.5">
                            {dep.notes}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[#F8FAFC] dark:bg-slate-900/90 border-t border-[#E2E8F0] dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          {station.primaryPinUrl ? (
            <a
              href={station.primaryPinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#006B45] dark:text-emerald-400 hover:underline"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>View Official Eco Drive Bus Pin</span>
            </a>
          ) : (
            <span className="text-xs text-[#64748B] dark:text-slate-400">Official pin link not listed in source</span>
          )}

          <div className="flex items-center gap-2">
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#006B45] hover:bg-[#064E3B] text-white text-xs font-bold transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open Directions in Google Maps</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 text-xs font-semibold text-[#0F172A] dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
