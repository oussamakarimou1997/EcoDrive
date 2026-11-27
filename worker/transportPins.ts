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
const PIN_RETRY_AFTER_MS = 30 * 1000;
const resolvedPinCache = new Map<string, CachedPin>();
const failedPinCache = new Map<string, number>();
let lastBulkResolveAt = 0;

function isValidUaeCoords(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= 22.5 &&
    lat <= 26.5 &&
    lng >= 51.0 &&
    lng <= 56.5
  );
}

function tryMatchCoordsInText(text: string): { lat: number; lng: number } | null {
  // 1. Prefer exact pin coordinates (!3dLAT!4dLNG)
  const m3d4d = text.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (m3d4d) {
    const lat = parseFloat(m3d4d[1]);
    const lng = parseFloat(m3d4d[2]);
    if (isValidUaeCoords(lat, lng)) return { lat, lng };
  }
  // 2. Search path (/maps/search/LAT,+LNG or /maps/search/LAT,LNG or %2C / %2B)
  const mSearch = text.match(/\/search\/(-?\d+\.\d+)(?:,|%2C)[\s+%2B]*(-?\d+\.\d+)/i);
  if (mSearch) {
    const lat = parseFloat(mSearch[1]);
    const lng = parseFloat(mSearch[2]);
    if (isValidUaeCoords(lat, lng)) return { lat, lng };
  }
  // 3. Query param (?q=LAT,LNG or ?query=LAT,LNG)
  const mQuery = text.match(/[?&](?:q|query|ll)=(-?\d+\.\d+)(?:,|%2C)[\s+%2B]*(-?\d+\.\d+)/i);
  if (mQuery) {
    const lat = parseFloat(mQuery[1]);
    const lng = parseFloat(mQuery[2]);
    if (isValidUaeCoords(lat, lng)) return { lat, lng };
  }
  // 4. Viewport center fallback (@LAT,LNG)
  const mAt = text.match(/@(-?\d+\.\d+)(?:,|%2C)(-?\d+\.\d+)/i);
  if (mAt) {
    const lat = parseFloat(mAt[1]);
    const lng = parseFloat(mAt[2]);
    if (isValidUaeCoords(lat, lng)) return { lat, lng };
  }
  return null;
}

function extractCoordsFromGoogleMapsUrl(urlStr: string): { lat: number; lng: number } | null {
  const direct = tryMatchCoordsInText(urlStr);
  if (direct) return direct;

  try {
    const parsed = new URL(urlStr);
    const continueParam = parsed.searchParams.get('continue');
    if (continueParam) {
      const fromContinue = tryMatchCoordsInText(continueParam);
      if (fromContinue) return fromContinue;
      try {
        const decodedContinue = decodeURIComponent(continueParam);
        const fromDecodedContinue = tryMatchCoordsInText(decodedContinue);
        if (fromDecodedContinue) return fromDecodedContinue;
      } catch {
        // ignore malformed URI sequence
      }
    }
  } catch {
    // ignore URL parse error
  }

  try {
    const decoded = decodeURIComponent(urlStr);
    if (decoded !== urlStr) {
      return tryMatchCoordsInText(decoded);
    }
  } catch {
    // ignore malformed URI sequence
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
  if (existing && Date.now() - existing.cachedAt < PIN_CACHE_TTL_MS) {
    return existing;
  }

  const lastFailedAt = failedPinCache.get(pinUrl);
  if (lastFailedAt && Date.now() - lastFailedAt < PIN_RETRY_AFTER_MS) {
    return null;
  }

  try {
    let currentUrl = pinUrl;
    for (let hop = 0; hop < 6; hop++) {
      const response = await fetch(currentUrl, {
        redirect: 'manual',
        signal: AbortSignal.timeout(6000),
      });

      const locationHeader = response.headers.get('location');
      try {
        await response.body?.cancel();
      } catch {
        // ignore body cancel error
      }

      if (locationHeader) {
        const nextUrl = new URL(locationHeader, currentUrl).toString();
        const coords = extractCoordsFromGoogleMapsUrl(nextUrl);
        if (coords) {
          const entry: CachedPin = {
            lat: coords.lat,
            lng: coords.lng,
            resolvedUrl: nextUrl,
            cachedAt: Date.now(),
          };
          resolvedPinCache.set(pinUrl, entry);
          failedPinCache.delete(pinUrl);
          return entry;
        }
        currentUrl = nextUrl;
        continue;
      }

      const finalCoords = extractCoordsFromGoogleMapsUrl(response.url || currentUrl);
      if (finalCoords) {
        const entry: CachedPin = {
          lat: finalCoords.lat,
          lng: finalCoords.lng,
          resolvedUrl: response.url || currentUrl,
          cachedAt: Date.now(),
        };
        resolvedPinCache.set(pinUrl, entry);
        failedPinCache.delete(pinUrl);
        return entry;
      }
      break;
    }

    failedPinCache.set(pinUrl, Date.now());
    return null;
  } catch (err) {
    console.warn(`Failed to resolve Google Maps short link ${pinUrl}:`, err);
    failedPinCache.set(pinUrl, Date.now());
    return null;
  }
}

async function resolvePinBatch(urls: string[], concurrency = 5): Promise<void> {
  for (let i = 0; i < urls.length; i += concurrency) {
    const chunk = urls.slice(i, i + concurrency);
    await Promise.all(chunk.map((u) => resolveSinglePinUrl(u)));
  }
}

function extractOfficialPinUrlsFromData(routes: {stops:{pinUrl?:string}[]} = TRANSPORT_ROUTES): {
  transportPinUrls: string[];
  alQuozCenterUrl: string | null;
  dicReferenceBranchUrl: string | null;
} {
  const pinSet = new Set<string>();
  for (const route of routes) {
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
  let routes: {stops:{pinUrl?:string}[]} = TRANSPORT_ROUTES;
  try {
    const result = await env.DB.prepare('SELECT s.pin_url FROM transport_stops s JOIN transport_routes r ON r.id=s.route_id WHERE s.active=1 AND r.active=1').all<{pin_url:string|null}>();
    if (result.success && result.results.length) routes=[{stops:result.results.map(s=>({pinUrl:s.pin_url ?? undefined}))}];
  } catch (err) { console.warn('Live transport pins unavailable; using saved catalog',err); }
  const { transportPinUrls, alQuozCenterUrl, dicReferenceBranchUrl } =
    extractOfficialPinUrlsFromData(routes);

  const allUrls = [...transportPinUrls];
  if (alQuozCenterUrl) allUrls.push(alQuozCenterUrl);
  if (dicReferenceBranchUrl) allUrls.push(dicReferenceBranchUrl);

  const now = Date.now();
  const pendingUrls = allUrls.filter((u) => {
    const cached = resolvedPinCache.get(u);
    if (cached && now - cached.cachedAt < PIN_CACHE_TTL_MS) return false;
    const failedAt = failedPinCache.get(u);
    if (failedAt && now - failedAt < PIN_RETRY_AFTER_MS) return false;
    return true;
  });

  if (pendingUrls.length > 0 || now - lastBulkResolveAt >= PIN_CACHE_TTL_MS) {
    await resolvePinBatch(pendingUrls, 5);
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
