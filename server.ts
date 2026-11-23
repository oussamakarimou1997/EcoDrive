import 'dotenv/config';
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import {
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ConflictError,
  getInstructorsDatasetFromDb,
  createInstructorInDb,
  updateInstructorInDb,
  deleteInstructorInDb,
  replaceInstructorsDatasetInDb,
  getBranchInfoDatasetFromDb,
  createBranchInfoInDb,
  updateBranchInfoInDb,
  deleteBranchInfoInDb,
  replaceBranchInfoDatasetInDb,
  getAdminAuthStatus,
  setupInitialAdminAccessCode,
  verifyAdminAccessCodeAndCreateSession,
  validateAdminSessionToken,
  revokeAdminSessionToken,
  changeAdminAccessCode,
} from './serverDb';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '1mb' }));

// ---------------------------------------------------------------------------
// In-memory TTL cache for resolved pin URLs (max 24h, within GMP 30-day rule)
// ---------------------------------------------------------------------------
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

async function extractOfficialPinUrlsFromSource(): Promise<{
  transportPinUrls: string[];
  alQuozCenterUrl: string | null;
  dicReferenceBranchUrl: string | null;
}> {
  const transportFilePath = path.join(__dirname, 'src', 'data', 'transportationData.ts');
  const branchesFilePath = path.join(__dirname, 'src', 'data', 'branchesData.ts');

  const [transportContent, branchesContent] = await Promise.all([
    fs.readFile(transportFilePath, 'utf-8'),
    fs.readFile(branchesFilePath, 'utf-8'),
  ]);

  const pinUrlMatches = [...transportContent.matchAll(/pinUrl:\s*'([^']+)'/g)].map((m) => m[1]);
  const transportPinUrls = [...new Set(pinUrlMatches)].filter(isAllowedMapsShortUrl);

  // Extract Al Qouz Test Center and Saphire Mall (DIC) URLs from branchesData.ts
  const alQuozMatch = branchesContent.match(
    /name:\s*'Al Qouz Test Center'[\s\S]*?locationUrl:\s*'([^']+)'/
  );
  const saphireMatch = branchesContent.match(
    /name:\s*'Saphire Mall'[\s\S]*?locationUrl:\s*'([^']+)'/
  );

  return {
    transportPinUrls,
    alQuozCenterUrl: alQuozMatch?.[1] && isAllowedMapsShortUrl(alQuozMatch[1]) ? alQuozMatch[1] : null,
    dicReferenceBranchUrl:
      saphireMatch?.[1] && isAllowedMapsShortUrl(saphireMatch[1]) ? saphireMatch[1] : null,
  };
}

function getServerMapsApiKey(): string | undefined {
  return process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;
}

// ---------------------------------------------------------------------------
// API Route 1: Resolve official Eco Drive Transportation & Center GPS pins
// ---------------------------------------------------------------------------
app.get('/api/transport/resolved-pins', async (_req, res) => {
  try {
    const { transportPinUrls, alQuozCenterUrl, dicReferenceBranchUrl } =
      await extractOfficialPinUrlsFromSource();

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
    const dicSaphireEntry = dicReferenceBranchUrl ? resolvedPinCache.get(dicReferenceBranchUrl) : null;

    // Optionally geocode DIC Centre via Google Geocoding API if available
    let dicGeocodedCoords: { lat: number; lng: number; sourceLabel: string } | null = null;
    const mapsKey = getServerMapsApiKey();
    if (mapsKey) {
      try {
        const query = encodeURIComponent('Eco Drive Driving Institute Dubai Industrial City Saih Shuaib 2 Dubai');
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

    return res.json({ pins, centers });
  } catch (err) {
    console.error('Error resolving transport pins:', err);
    return res.status(500).json({ error: 'Failed to resolve transportation station coordinates.' });
  }
});

// ---------------------------------------------------------------------------
// API Route 2: Server-side Geocoding Proxy (bypasses CORS CF1)
// ---------------------------------------------------------------------------
app.get('/api/maps/geocode', async (req, res) => {
  const address = String(req.query.address || '').trim();
  if (!address) {
    return res.status(400).json({ error: 'Address query parameter is required.' });
  }

  const mapsKey = getServerMapsApiKey();
  if (!mapsKey) {
    return res.status(503).json({ error: 'Google Maps API key is not configured on the server.' });
  }

  try {
    const encodedAddress = encodeURIComponent(address.toLowerCase().includes('dubai') ? address : `${address}, Dubai, UAE`);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&components=country:AE&bounds=24.75,54.85|25.45,55.65&region=ae&key=${mapsKey}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(7000) });

    if (response.status === 429) {
      return res.status(429).json({ error: 'Google Maps Geocoding quota exceeded.', quotaExceeded: true });
    }

    const data = (await response.json()) as {
      status: string;
      error_message?: string;
      results?: Array<{
        formatted_address: string;
        place_id: string;
        geometry: { location: { lat: number; lng: number } };
      }>;
    };

    if (data.status === 'OVER_QUERY_LIMIT' || data.status === 'RESOURCE_EXHAUSTED') {
      return res.status(429).json({
        error: data.error_message || 'Geocoding quota exceeded.',
        quotaExceeded: true,
      });
    }

    if (data.status === 'ZERO_RESULTS') {
      return res.json({ result: null, status: 'ZERO_RESULTS' });
    }

    if (data.status !== 'OK' || !data.results?.length) {
      return res.status(502).json({
        error: data.error_message || `Geocoding failed with status ${data.status}`,
        status: data.status,
      });
    }

    const top = data.results[0];
    return res.json({
      result: {
        lat: top.geometry.location.lat,
        lng: top.geometry.location.lng,
        formattedAddress: top.formatted_address,
        placeId: top.place_id,
      },
    });
  } catch (err) {
    console.error('Geocode proxy error:', err);
    return res.status(500).json({ error: 'Unable to geocode address right now.' });
  }
});

// ---------------------------------------------------------------------------
// API Route 3: Server-side Reverse Geocoding Proxy (bypasses CORS CF1)
// ---------------------------------------------------------------------------
app.get('/api/maps/reverse-geocode', async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: 'Valid numeric lat and lng are required.' });
  }

  const mapsKey = getServerMapsApiKey();
  if (!mapsKey) {
    return res.json({
      formattedAddress: `${lat.toFixed(5)}, ${lng.toFixed(5)} (Dubai, UAE)`,
      areaName: 'Selected Map Point',
    });
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=en&key=${mapsKey}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(7000) });

    if (response.status === 429) {
      return res.status(429).json({ error: 'Reverse geocoding quota exceeded.', quotaExceeded: true });
    }

    const data = (await response.json()) as {
      status: string;
      error_message?: string;
      results?: Array<{
        formatted_address: string;
        address_components?: Array<{
          long_name: string;
          types: string[];
        }>;
      }>;
    };

    if (data.status === 'OVER_QUERY_LIMIT' || data.status === 'RESOURCE_EXHAUSTED') {
      return res.status(429).json({
        error: data.error_message || 'Reverse geocoding quota exceeded.',
        quotaExceeded: true,
      });
    }

    if (data.status !== 'OK' || !data.results?.length) {
      return res.json({
        formattedAddress: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        areaName: 'Selected Location',
      });
    }

    const top = data.results[0];
    const neighborhoodComp = top.address_components?.find(
      (c) =>
        c.types.includes('sublocality_level_1') ||
        c.types.includes('neighborhood') ||
        c.types.includes('sublocality') ||
        c.types.includes('locality')
    );

    return res.json({
      formattedAddress: top.formatted_address,
      areaName: neighborhoodComp?.long_name || 'Dubai',
    });
  } catch (err) {
    console.warn('Reverse geocode proxy error:', err);
    return res.json({
      formattedAddress: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      areaName: 'Selected Location',
    });
  }
});

// ---------------------------------------------------------------------------
// API Route 4: AI-Powered Transportation Recommendations (Gemini server-side)
// ---------------------------------------------------------------------------
interface AIRecommendationRequestBody {
  studentLocation: {
    label: string;
    lat: number;
    lng: number;
  };
  dubaiTime: {
    weekday: string;
    formattedTime: string;
  };
  selectedDay: string;
  nearestStation: {
    name: string;
    landmarks: string[];
    straightLineKm: number;
    walkingDistanceMeters?: number | null;
    walkingDurationMinutes?: number | null;
    branchesServed: string[];
    operatingDays: string;
    nextBus?: {
      departureTime: string;
      minutesRemaining: number;
      isNextDay: boolean;
      nextDayLabel?: string;
      routeCode: string;
      destination: string;
    } | null;
    departures: Array<{
      time: string;
      routeCode: string;
      destination: string;
      etaAtCentre: string;
      returnDeparture: string;
    }>;
  } | null;
  nearbyAlternatives: Array<{
    name: string;
    straightLineKm: number;
    branchesServed: string[];
    nextDepartureTime?: string | null;
    departureCount: number;
  }>;
  activeFilters: {
    branch: string;
    timePeriod: string;
    maxDistanceKm: number | null;
  };
  unmappedStationsCount: number;
}

app.post('/api/transport/ai-recommendations', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: 'Gemini API key is not configured. Configure GEMINI_API_KEY in Settings > Secrets to enable AI recommendations.',
    });
  }

  const payload = req.body as AIRecommendationRequestBody;
  if (!payload || !payload.studentLocation) {
    return res.status(400).json({ error: 'Missing student location context.' });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const systemInstruction = `You are the Eco Drive Driving Institute Smart Transportation Assistant in Dubai.
Your ONLY job is to explain and summarize verified transportation search results in clear, helpful student-friendly guidance.

STRICT GROUNDING RULES:
1. ONLY reference station names, landmarks, straight-line distances, walking distances/times, departure times, route codes, school branches, and operating days that are explicitly present in the provided JSON context.
2. NEVER invent, estimate, or alter any bus departure times, station names, distances, walking durations, or operating days.
3. Explicitly distinguish between "straight-line distance" and "walking distance/time" whenever mentioning distance. If walkingDistanceMeters is null or absent, state clearly that walking route data is unavailable and only cite the straight-line distance.
4. If nearestStation is null (e.g. no stations match the student's active filters), clearly explain that no verified station matched the current filters and suggest relaxing the filters (like maximum distance or branch).
5. Remind the student to arrive 5–10 minutes early at the pickup point and use the "Open in Google Maps" button for exact navigation.`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Analyze this verified Eco Drive bus search result and generate concise, accurate recommendations for the student:\n${JSON.stringify(payload)}`,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            headline: {
              type: Type.STRING,
              description: 'A clear 1-sentence summary identifying the nearest verified station and distance.',
            },
            recommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '3 to 5 factual bullet points covering exact station, distance, next bus timing, landmark, and Google Maps navigation.',
            },
            alternativeTip: {
              type: Type.STRING,
              description: '1 concise tip comparing nearby alternative stations if available, or explaining filter status if none.',
            },
            arrivalReminder: {
              type: Type.STRING,
              description: 'Brief practical reminder about arriving 5-10 minutes before departure and verifying operating schedule.',
            },
          },
          required: ['headline', 'recommendations', 'alternativeTip', 'arrivalReminder'],
        },
      },
    });

    const rawText = response.text?.trim();
    if (!rawText) {
      return res.status(502).json({ error: 'AI returned an empty recommendation response.' });
    }

    const parsed = JSON.parse(rawText);
    return res.json(parsed);
  } catch (err: unknown) {
    console.error('Gemini AI recommendations error:', err);
    const message = err instanceof Error ? err.message : 'Failed to generate AI recommendations.';
    if (message.includes('PERMISSION_DENIED') || message.includes('API_KEY_INVALID') || message.includes('403') || message.includes('400')) {
      return res.status(401).json({
        error: 'Invalid or missing Gemini API key. Please verify GEMINI_API_KEY in Settings > Secrets.',
      });
    }
    if (message.includes('RESOURCE_EXHAUSTED') || message.includes('429')) {
      return res.status(429).json({
        error: 'Gemini API rate limit reached. Please try again shortly.',
      });
    }
    return res.status(502).json({ error: message });
  }
});

// ---------------------------------------------------------------------------
// API Route 5: Admin Access Code Auth & Session Enforcement
// ---------------------------------------------------------------------------
const verifyAttempts = new Map<string, { count: number; blockedUntil: number }>();
const MAX_VERIFY_FAILURES = 5;
const VERIFY_LOCKOUT_MS = 30 * 1000;

function getClientKey(req: express.Request): string {
  const fwd = req.headers['x-forwarded-for'];
  const ip = Array.isArray(fwd)
    ? fwd[0]
    : typeof fwd === 'string'
      ? fwd.split(',')[0]?.trim()
      : req.ip || 'unknown';
  return ip || 'unknown';
}

function extractBearerToken(req: express.Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== 'string') return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function requireAdminAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const token = extractBearerToken(req);
  if (!validateAdminSessionToken(token)) {
    return res.status(401).json({
      error: 'Unauthorized: Valid Admin Access Code authorization is required for this operation.',
      code: 'ADMIN_AUTH_REQUIRED',
    });
  }
  next();
}

app.get('/api/admin/status', (req, res) => {
  try {
    const status = getAdminAuthStatus();
    const token = extractBearerToken(req);
    const authorized = validateAdminSessionToken(token);
    return res.json({
      configured: status.configured,
      managedByEnv: status.managedByEnv,
      authorized,
    });
  } catch (err) {
    console.error('Error checking admin status:', err);
    return res.status(500).json({ error: 'Unable to check admin security status.' });
  }
});

app.post('/api/admin/setup', (req, res) => {
  try {
    const { accessCode } = req.body || {};
    const session = setupInitialAdminAccessCode(accessCode);
    return res.status(201).json(session);
  } catch (err) {
    if (err instanceof ValidationError) {
      return res.status(400).json({ error: err.message, fieldErrors: err.fieldErrors });
    }
    if (err instanceof ConflictError) {
      return res.status(409).json({ error: err.message });
    }
    console.error('Error setting up admin access code:', err);
    return res.status(500).json({ error: 'Failed to configure Admin Access Code.' });
  }
});

app.post('/api/admin/verify', (req, res) => {
  const clientKey = getClientKey(req);
  const now = Date.now();
  const record = verifyAttempts.get(clientKey);
  if (record && record.blockedUntil > now) {
    const secondsLeft = Math.ceil((record.blockedUntil - now) / 1000);
    return res.status(429).json({
      error: `Too many invalid access code attempts. Please wait ${secondsLeft} seconds before trying again.`,
    });
  }

  try {
    const { accessCode } = req.body || {};
    const session = verifyAdminAccessCodeAndCreateSession(accessCode);
    verifyAttempts.delete(clientKey);
    return res.json(session);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      const prevCount = record && record.blockedUntil <= now ? record.count : 0;
      const nextCount = prevCount + 1;
      if (nextCount >= MAX_VERIFY_FAILURES) {
        verifyAttempts.set(clientKey, {
          count: 0,
          blockedUntil: now + VERIFY_LOCKOUT_MS,
        });
      } else {
        verifyAttempts.set(clientKey, {
          count: nextCount,
          blockedUntil: 0,
        });
      }
      return res.status(401).json({ error: 'Access denied. Invalid Admin Access Code.' });
    }
    if (err instanceof ValidationError) {
      return res.status(400).json({ error: err.message });
    }
    console.error('Error verifying admin access code:', err);
    return res.status(500).json({ error: 'Unable to verify Admin Access Code.' });
  }
});

app.post('/api/admin/change-code', requireAdminAuth, (req, res) => {
  try {
    const { currentCode, newCode } = req.body || {};
    const session = changeAdminAccessCode(currentCode, newCode);
    return res.json(session);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return res.status(401).json({ error: 'Access denied. Invalid Admin Access Code.' });
    }
    if (err instanceof ValidationError) {
      return res.status(400).json({ error: err.message, fieldErrors: err.fieldErrors });
    }
    console.error('Error changing admin access code:', err);
    return res.status(500).json({ error: 'Failed to update Admin Access Code.' });
  }
});

app.post('/api/admin/logout', (req, res) => {
  try {
    const token = extractBearerToken(req);
    revokeAdminSessionToken(token);
    return res.json({ locked: true });
  } catch (err) {
    console.error('Error locking admin session:', err);
    return res.status(500).json({ error: 'Unable to lock admin session.' });
  }
});

// ---------------------------------------------------------------------------
// API Route 6: Instructors CRUD (SQLite Database Persistence, Admin Protected)
// ---------------------------------------------------------------------------
app.get('/api/instructors', (_req, res) => {
  try {
    const dataset = getInstructorsDatasetFromDb();
    return res.json(dataset);
  } catch (err) {
    console.error('Error loading instructors from database:', err);
    return res.status(500).json({ error: 'Failed to load instructors from database.' });
  }
});

app.post('/api/instructors', requireAdminAuth, (req, res) => {
  try {
    const { fields, sheetName } = req.body || {};
    const created = createInstructorInDb(fields, sheetName);
    return res.status(201).json({ record: created });
  } catch (err) {
    if (err instanceof ValidationError) {
      return res.status(400).json({ error: err.message, fieldErrors: err.fieldErrors });
    }
    console.error('Error creating instructor:', err);
    return res.status(500).json({ error: 'Failed to save instructor to database.' });
  }
});

app.put('/api/instructors/:rowKey', requireAdminAuth, (req, res) => {
  try {
    const rowKey = decodeURIComponent(req.params.rowKey);
    const { fields } = req.body || {};
    const updated = updateInstructorInDb(rowKey, fields);
    return res.json({ record: updated });
  } catch (err) {
    if (err instanceof ValidationError) {
      return res.status(400).json({ error: err.message, fieldErrors: err.fieldErrors });
    }
    if (err instanceof NotFoundError) {
      return res.status(404).json({ error: err.message });
    }
    console.error('Error updating instructor:', err);
    return res.status(500).json({ error: 'Failed to update instructor in database.' });
  }
});

app.delete('/api/instructors/:rowKey', requireAdminAuth, (req, res) => {
  try {
    const rowKey = decodeURIComponent(req.params.rowKey);
    deleteInstructorInDb(rowKey);
    return res.json({ deleted: true, rowKey });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return res.status(404).json({ error: err.message });
    }
    console.error('Error deleting instructor:', err);
    return res.status(500).json({ error: 'Failed to delete instructor from database.' });
  }
});

app.post('/api/instructors/import', requireAdminAuth, (req, res) => {
  try {
    const dataset = replaceInstructorsDatasetInDb(req.body);
    return res.json(dataset);
  } catch (err) {
    if (err instanceof ValidationError) {
      return res.status(400).json({ error: err.message, fieldErrors: err.fieldErrors });
    }
    console.error('Error importing instructors:', err);
    return res.status(500).json({ error: 'Failed to save imported instructors dataset.' });
  }
});

// ---------------------------------------------------------------------------
// API Route 7: Branch Information CRUD (SQLite Database Persistence, Admin Protected)
// ---------------------------------------------------------------------------
app.get('/api/branch-info', (_req, res) => {
  try {
    const dataset = getBranchInfoDatasetFromDb();
    return res.json(dataset);
  } catch (err) {
    console.error('Error loading branch info from database:', err);
    return res.status(500).json({ error: 'Failed to load branch information from database.' });
  }
});

app.post('/api/branch-info', requireAdminAuth, (req, res) => {
  try {
    const { fields, sheetName } = req.body || {};
    const created = createBranchInfoInDb(fields, sheetName);
    return res.status(201).json({ record: created });
  } catch (err) {
    if (err instanceof ValidationError) {
      return res.status(400).json({ error: err.message, fieldErrors: err.fieldErrors });
    }
    console.error('Error creating branch info:', err);
    return res.status(500).json({ error: 'Failed to save branch to database.' });
  }
});

app.put('/api/branch-info/:rowKey', requireAdminAuth, (req, res) => {
  try {
    const rowKey = decodeURIComponent(req.params.rowKey);
    const { fields } = req.body || {};
    const updated = updateBranchInfoInDb(rowKey, fields);
    return res.json({ record: updated });
  } catch (err) {
    if (err instanceof ValidationError) {
      return res.status(400).json({ error: err.message, fieldErrors: err.fieldErrors });
    }
    if (err instanceof NotFoundError) {
      return res.status(404).json({ error: err.message });
    }
    console.error('Error updating branch info:', err);
    return res.status(500).json({ error: 'Failed to update branch in database.' });
  }
});

app.delete('/api/branch-info/:rowKey', requireAdminAuth, (req, res) => {
  try {
    const rowKey = decodeURIComponent(req.params.rowKey);
    deleteBranchInfoInDb(rowKey);
    return res.json({ deleted: true, rowKey });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return res.status(404).json({ error: err.message });
    }
    console.error('Error deleting branch info:', err);
    return res.status(500).json({ error: 'Failed to delete branch from database.' });
  }
});

app.post('/api/branch-info/import', requireAdminAuth, (req, res) => {
  try {
    const dataset = replaceBranchInfoDatasetInDb(req.body);
    return res.json(dataset);
  } catch (err) {
    if (err instanceof ValidationError) {
      return res.status(400).json({ error: err.message, fieldErrors: err.fieldErrors });
    }
    console.error('Error importing branch info:', err);
    return res.status(500).json({ error: 'Failed to save imported branch dataset.' });
  }
});

// ---------------------------------------------------------------------------
// Vite Middleware (Dev) or Static Assets (Prod)
// ---------------------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Eco Drive server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
