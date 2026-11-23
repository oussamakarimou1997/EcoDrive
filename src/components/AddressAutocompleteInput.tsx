import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { Search, MapPin, X, Loader2 } from 'lucide-react';
import { StudentLocation } from '../types/smartTransport';

interface AddressAutocompleteInputProps {
  value: string;
  onChange: (val: string) => void;
  onSelectLocation: (loc: StudentLocation, autoFind?: boolean) => void;
  placeholder?: string;
  autoTriggerFindOnSelect?: boolean;
  compact?: boolean;
}

const DUBAI_BOUNDS: google.maps.LatLngBoundsLiteral = {
  north: 25.45,
  south: 24.75,
  east: 55.65,
  west: 54.85,
};

function isQuotaError(err: unknown): boolean {
  const msg = String(err instanceof Error ? err.message : err || '');
  return (
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('OVER_QUERY_LIMIT') ||
    msg.includes('429')
  );
}

export const AddressAutocompleteInput: React.FC<AddressAutocompleteInputProps> = ({
  value,
  onChange,
  onSelectLocation,
  placeholder = 'Enter your residential area, building, street, or address in Dubai...',
  autoTriggerFindOnSelect = false,
  compact = false,
}) => {
  const placesLib = useMapsLibrary('places');
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const skipNextFetchRef = useRef(false);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Fetch Places API (New) Autocomplete suggestions with session token
  useEffect(() => {
    if (!placesLib) return;
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }

    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    const { AutocompleteSessionToken, AutocompleteSuggestion } = placesLib;
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = new AutocompleteSessionToken();
    }

    let cancelled = false;
    setIsLoading(true);
    setSearchError(null);

    const timer = window.setTimeout(() => {
      AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: trimmed,
        sessionToken: sessionTokenRef.current!,
        includedRegionCodes: ['ae'],
        locationBias: DUBAI_BOUNDS,
        language: 'en',
        region: 'AE',
      })
        .then((res) => {
          if (cancelled) return;
          setSuggestions(res.suggestions || []);
          setIsOpen(true);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          if (isQuotaError(err)) {
            window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
          }
          setSuggestions([]);
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [placesLib, value]);

  const resetSession = useCallback(() => {
    sessionTokenRef.current = null;
    setSuggestions([]);
    setIsOpen(false);
  }, []);

  const handleSuggestionClick = useCallback(
    async (suggestion: google.maps.places.AutocompleteSuggestion) => {
      if (!placesLib || !suggestion.placePrediction) return;
      setIsLoading(true);
      setSearchError(null);

      try {
        const place = suggestion.placePrediction.toPlace();
        await place.fetchFields({
          fields: ['displayName', 'formattedAddress', 'location'],
        });

        const loc = place.location;
        if (!loc) {
          setSearchError('Could not retrieve coordinates for this place. Please try another selection.');
          return;
        }

        const label =
          place.formattedAddress ||
          place.displayName ||
          suggestion.placePrediction.text.text;

        skipNextFetchRef.current = true;
        onChange(label);
        resetSession();

        onSelectLocation(
          {
            lat: loc.lat(),
            lng: loc.lng(),
            label,
            areaName: place.displayName || undefined,
            source: 'autocomplete',
          },
          autoTriggerFindOnSelect
        );
      } catch (err: unknown) {
        if (isQuotaError(err)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        setSearchError('Unable to fetch coordinates for that suggestion. Try pressing Enter or picking on the map.');
      } finally {
        setIsLoading(false);
      }
    },
    [placesLib, onChange, onSelectLocation, resetSession, autoTriggerFindOnSelect]
  );

  // Fallback: Pressing Enter geocodes via server proxy (avoids CORS & handles free-text entry)
  const handleManualGeocode = useCallback(async () => {
    const trimmed = value.trim();
    if (!trimmed) return;

    setIsLoading(true);
    setSearchError(null);
    setIsOpen(false);

    try {
      const resp = await fetch(`/api/maps/geocode?address=${encodeURIComponent(trimmed)}`);
      const data = (await resp.json()) as {
        quotaExceeded?: boolean;
        error?: string;
        result?: {
          lat: number;
          lng: number;
          formattedAddress: string;
        } | null;
      };

      if (resp.status === 429 || data.quotaExceeded) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        setSearchError('Location lookup limit reached. Please use "Choose Location on Map" or "Use My Current Location".');
        return;
      }

      if (!resp.ok || !data.result) {
        // Fallback to Places searchByText if Geocoding API isn't enabled on project
        if (placesLib?.Place?.searchByText) {
          try {
            const { places } = await placesLib.Place.searchByText({
              textQuery: trimmed.toLowerCase().includes('dubai') ? trimmed : `${trimmed}, Dubai, UAE`,
              fields: ['displayName', 'formattedAddress', 'location'],
              locationBias: DUBAI_BOUNDS,
              region: 'AE',
              maxResultCount: 1,
            });
            const found = places?.[0];
            if (found?.location) {
              const label = found.formattedAddress || found.displayName || trimmed;
              skipNextFetchRef.current = true;
              onChange(label);
              onSelectLocation(
                {
                  lat: found.location.lat(),
                  lng: found.location.lng(),
                  label,
                  areaName: found.displayName || undefined,
                  source: 'autocomplete',
                },
                autoTriggerFindOnSelect
              );
              return;
            }
          } catch (placesErr) {
            if (isQuotaError(placesErr)) {
              window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
            }
          }
        }
        setSearchError(
          data.error ||
            `No Dubai location found for "${trimmed}". Try a nearby landmark or pick directly on the map.`
        );
        return;
      }

      skipNextFetchRef.current = true;
      onChange(data.result.formattedAddress);
      onSelectLocation(
        {
          lat: data.result.lat,
          lng: data.result.lng,
          label: data.result.formattedAddress,
          source: 'autocomplete',
        },
        autoTriggerFindOnSelect
      );
    } catch {
      setSearchError('Unable to look up address right now. Please select a location on the map.');
    } finally {
      setIsLoading(false);
    }
  }, [value, placesLib, onChange, onSelectLocation, autoTriggerFindOnSelect]);

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
          <Search className="w-4 h-4 text-[#006B45] dark:text-emerald-400" />
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setSearchError(null);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (suggestions.length > 0 && isOpen) {
                void handleSuggestionClick(suggestions[0]);
              } else {
                void handleManualGeocode();
              }
            }
          }}
          placeholder={placeholder}
          className={`w-full pl-10 pr-20 bg-[#F8FAFC] dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded-xl text-[#0F172A] dark:text-slate-100 placeholder-[#94A3B8] dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006B45] focus:border-[#006B45] transition-all ${
            compact ? 'py-2 text-xs' : 'py-3 text-xs sm:text-sm'
          }`}
          aria-label="Enter Dubai address or area"
        />

        <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center gap-1">
          {isLoading && <Loader2 className="w-4 h-4 text-[#006B45] dark:text-emerald-400 animate-spin" />}
          {value && !isLoading && (
            <button
              type="button"
              onClick={() => {
                onChange('');
                setSuggestions([]);
                setIsOpen(false);
                setSearchError(null);
              }}
              className="p-1 text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-slate-200 rounded-md"
              title="Clear address"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Autocomplete Suggestions Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <ul className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-[#0F172A] border border-[#CBD5E1] dark:border-slate-700 rounded-xl shadow-xl max-h-72 overflow-y-auto divide-y divide-[#F1F5F9] dark:divide-slate-800">
          {suggestions.map((suggestion, idx) => {
            const pred = suggestion.placePrediction;
            if (!pred) return null;
            const mainText = pred.mainText?.text || pred.text.text;
            const secondaryText = pred.secondaryText?.text;
            return (
              <li key={pred.placeId || idx}>
                <button
                  type="button"
                  onClick={() => void handleSuggestionClick(suggestion)}
                  className="w-full text-left px-3.5 py-2.5 hover:bg-[#F0FDF4] dark:hover:bg-emerald-950/40 transition-colors flex items-start gap-2.5"
                >
                  <MapPin className="w-4 h-4 text-[#006B45] dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <span className="block text-xs sm:text-sm font-semibold text-[#0F172A] dark:text-slate-100 truncate">
                      {mainText}
                    </span>
                    {secondaryText && (
                      <span className="block text-[11px] text-[#64748B] dark:text-slate-400 truncate">
                        {secondaryText}
                      </span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {searchError && (
        <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-1.5">
          {searchError}
        </p>
      )}
    </div>
  );
};
