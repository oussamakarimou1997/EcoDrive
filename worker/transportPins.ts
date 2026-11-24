import { TRANSPORT_ROUTES } from '../src/data/transportationData';
import { BRANCHES_DATA } from '../src/data/branchesData';
import { Env } from './types';

interface CachedPin {
  lat: number;
  lng: number;
  resolvedUrl: string;
  cachedAt: number;
}

const PIN_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const resolvedPinCache = new Map<string, CachedPin | null>();
let lastBulkResolveAt = 0;

function extractCoordsFromGoogleMapsUrl(urlStr: string): { lat: number; lng: number } | null {
  // 1. Prefer exact pin coordinates (!3dLAT!4dLNG)
  const m3d4d = urlStr.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (m3d4d) {
    return { lat: parseFloat(m3d4d[1]), lng: parseFloat(m3d4d[2]) };
  }
  // 2. Search path (/maps/search/LAT,+LNG or /maps/search/LAT,LNG)
  const mSearch = urlStr.match(/\/search\/(-?\d+\.\d+),[\s+]*(-?\d+\.\d+)/);
  if (mSearch) {
    return { lat: parseFloat(mSearch[1]), lng: parseFloat(mSearch[2]) };
  }
  // 3. Query param (?q=LAT,LNG or ?query=LAT,LNG)
  const mQuery = urlStr.match(/[?&](?:q|query|ll)=(-?\d+\.\d+)(?:,|%2C)\s*(-?\d+\.\d+)/);
  if (mQuery) {
    return { lat: parseFloat(mQuery[1]), lng: parseFloat(mQuery[2]) };
  }
  // 4. Viewport center fallback (@LAT,LNG)
  const mAt = urlStr.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (mAt) {
    return { lat: parseFloat(mAt[1]), lng: parseFloat(mAt[2]) };
  }
  return null;
}

function isAllowedMapsShortUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    return (
      parsed.protocol === 'https:' &&
      (parsed.hostname === 'maps.app.goo.gl' || parsed.hostname === 'goo.gl')
    );
  } catch {
    return false;
  }
}

async function resolveSinglePinUrl(pinUrl: string): Promise<CachedPin | null> {
  if (!isAllowedMapsShortUrl(pinUrl)) return null;

  const existing = resolvedPinCache.get(pinUrl);
  if (existing !== undefined) {
    if (existing === null) return null;
    if (Date.now() - existing.cachedAt < PIN_CACHE_TTL_MS) {
      return existing;
    }
  }

  try {
    const response = await fetch(pinUrl, {
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });
    const finalUrl = response.url;
    const coords = extractCoordsFromGoogleMapsUrl(finalUrl);
    if (!coords) {
      resolvedPinCache.set(pinUrl, null);
      return null;
    }
    const entry: CachedPin = {
      lat: coords.lat,
      lng: coords.lng,
      resolvedUrl: finalUrl,
      cachedAt: Date.now(),
    };
    resolvedPinCache.set(pinUrl, entry);
    return entry;
  } catch (err) {
    console.warn(`Failed to resolve Google Maps short link ${pinUrl}:`, err);
    return null;
  }
}

function extractOfficialPinUrlsFromData(): {
  transportPinUrls: string[];
  alQuozCenterUrl: string | null;
  dicReferenceBranchUrl: string | null;
} {
  const pinSet = new Set<string>();
  for (const route of TRANSPORT_ROUTES) {
    for (const stop of route.stops) {
      if (stop.pinUrl && isAllowedMapsShortUrl(stop.pinUrl)) {
        pinSet.add(stop.pinUrl);
      }
    }
  }

  const alQuozBranch = BRANCHES_DATA.find((b) => b.name === 'Al Qouz Test Center');
  const saphireBranch = BRANCHES_DATA.find((b) => b.name === 'Saphire Mall');

  const alQuozCenterUrl =
    alQuozBranch?.locationUrl && isAllowedMapsShortUrl(alQuozBranch.locationUrl)
      ? alQuozBranch.locationUrl
      : null;

  const dicReferenceBranchUrl =
    saphireBranch?.locationUrl && isAllowedMapsShortUrl(saphireBranch.locationUrl)
      ? saphireBranch.locationUrl
      : null;

  return {
    transportPinUrls: Array.from(pinSet),
    alQuozCenterUrl,
    dicReferenceBranchUrl,
  };
}

export function getServerMapsApiKey(env: Env): string | undefined {
  return env.GOOGLE_MAPS_API_KEY || env.VITE_GOOGLE_MAPS_API_KEY;
}

export async function resolveOfficialTransportPins(env: Env): Promise<{
  pins: Record<string, { lat: number; lng: number } | null>;
  centers: Record<
    'al_quoz' | 'dic',
    { lat: number; lng: number; label: string; pinUrl?: string } | null
  >;
}> {
  const { transportPinUrls, alQuozCenterUrl, dicReferenceBranchUrl } =
    extractOfficialPinUrlsFromData();

  const allUrls = [...transportPinUrls];
  if (alQuozCenterUrl) allUrls.push(alQuozCenterUrl);
  if (dicReferenceBranchUrl) allUrls.push(dicReferenceBranchUrl);

  const isCacheFresh =
    Date.now() - lastBulkResolveAt < PIN_CACHE_TTL_MS &&
    allUrls.every((u) => resolvedPinCache.has(u));

  if (!isCacheFresh) {
    await Promise.all(allUrls.map((u) => resolveSinglePinUrl(u)));
    lastBulkResolveAt = Date.now();
  }

  const pins: Record<string, { lat: number; lng: number } | null> = {};
  for (const u of transportPinUrls) {
    const entry = resolvedPinCache.get(u);
    pins[u] = entry ? { lat: entry.lat, lng: entry.lng } : null;
  }

  const alQuozEntry = alQuozCenterUrl ? resolvedPinCache.get(alQuozCenterUrl) : null;
  const dicSaphireEntry = dicReferenceBranchUrl
    ? resolvedPinCache.get(dicReferenceBranchUrl)
    : null;

  let dicGeocodedCoords: { lat: number; lng: number; sourceLabel: string } | null = null;
  const mapsKey = getServerMapsApiKey(env);
  if (mapsKey) {
    try {
      const query = encodeURIComponent(
        'Eco Drive Driving Institute Dubai Industrial City Saih Shuaib 2 Dubai'
      );
      const geoResp = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&components=country:AE&key=${mapsKey}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (geoResp.ok) {
        const geoJson = (await geoResp.json()) as {
          status: string;
          results?: Array<{ geometry?: { location?: { lat: number; lng: number } } }>;
        };
        if (geoJson.status === 'OK' && geoJson.results?.[0]?.geometry?.location) {
          dicGeocodedCoords = {
            lat: geoJson.results[0].geometry.location.lat,
            lng: geoJson.results[0].geometry.location.lng,
            sourceLabel: 'Dubai Industrial City (DIC) Centre',
          };
        }
      }
    } catch {
      // Non-fatal: fall back to Saphire Mall DIC branch pin if geocoding unavailable
    }
  }

  const centers: Record<
    'al_quoz' | 'dic',
    { lat: number; lng: number; label: string; pinUrl?: string } | null
  > = {
    al_quoz: alQuozEntry
      ? {
          lat: alQuozEntry.lat,
          lng: alQuozEntry.lng,
          label: 'Al Qouz Test Center (Al Quoz Industrial Area 3)',
          pinUrl: alQuozCenterUrl ?? undefined,
        }
      : null,
    dic: dicGeocodedCoords
      ? {
          lat: dicGeocodedCoords.lat,
          lng: dicGeocodedCoords.lng,
          label: dicGeocodedCoords.sourceLabel,
        }
      : dicSaphireEntry
        ? {
            lat: dicSaphireEntry.lat,
            lng: dicSaphireEntry.lng,
            label: 'DIC Centre Area (Saphire Mall DIC Reference)',
            pinUrl: dicReferenceBranchUrl ?? undefined,
          }
        : null,
  };

  return { pins, centers };
}
