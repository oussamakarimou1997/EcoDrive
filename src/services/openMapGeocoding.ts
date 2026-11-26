import type { StudentLocation, LocationInputSource } from '../types/smartTransport';

interface Feature {
  geometry?: { coordinates?: number[] };
  properties?: { name?: string; street?: string; housenumber?: string; district?: string; city?: string; state?: string; country?: string; countrycode?: string };
}
const endpoint = 'https://photon.komoot.io';
function normalize(f: Feature, source: LocationInputSource): StudentLocation | null {
  const [lng, lat] = f.geometry?.coordinates ?? [];
  const p = f.properties ?? {};
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 24.75 || lat > 25.45 || lng < 54.85 || lng > 55.65 || (p.countrycode && p.countrycode.toUpperCase() !== 'AE')) return null;
  const street = [p.housenumber, p.street].filter(Boolean).join(' ');
  const label = [...new Set([p.name, street, p.district, p.city, p.state, p.country].filter(Boolean))].join(', ');
  return { lat, lng, label: label || `${lat.toFixed(5)}, ${lng.toFixed(5)}`, areaName: p.district || p.name || p.city, source };
}
async function lookup(path: string, params: URLSearchParams, signal?: AbortSignal): Promise<Feature[]> {
  const response = await fetch(`${endpoint}/${path}/?${params}`, { signal });
  if (!response.ok) throw new Error(`Address service unavailable (${response.status})`);
  const data = await response.json() as { features?: Feature[] };
  return Array.isArray(data.features) ? data.features : [];
}
export async function searchDubaiAddress(query: string, signal?: AbortSignal): Promise<StudentLocation[]> {
  if (query.trim().length < 3) return [];
  const features = await lookup('api', new URLSearchParams({ q: query.trim(), lat: '25.2048', lon: '55.2708', bbox: '54.85,24.75,55.65,25.45', limit: '6', lang: 'en' }), signal);
  return features.map(f => normalize(f, 'autocomplete')).filter((f): f is StudentLocation => f !== null);
}
export async function reverseDubaiAddress(lat: number, lng: number, source: LocationInputSource = 'map', signal?: AbortSignal): Promise<StudentLocation> {
  const fallback: StudentLocation = { lat, lng, label: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, source };
  try {
    const features = await lookup('reverse', new URLSearchParams({ lat: String(lat), lon: String(lng), limit: '1', lang: 'en' }), signal);
    const result = features[0] && normalize(features[0], source);
    return result ? { ...result, lat, lng } : fallback;
  } catch (error) { if (signal?.aborted) throw error; return fallback; }
}
