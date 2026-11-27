import { handleOpenWalkingRoute } from './openWalkingRoute';
import { GoogleGenAI, Type } from '@google/genai';
import { Env } from './types';
import { getServerMapsApiKey, resolveOfficialTransportPins } from './transportPins';
import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  changeAdminAccessCode,
  checkVerifyRateLimit,
  clearVerifyRateLimit,
  createBranchInfoInDb,
  createInstructorInDb,
  createPriceRecordInDb,
  deleteBranchInfoInDb,
  deleteInstructorInDb,
  deletePriceRecordInDb,
  getAdminAuthStatus,
  getBranchInfoDatasetFromDb,
  getInstructorsDatasetFromDb,
  getPricesDatasetFromDb,
  recordVerifyFailure,
  replaceBranchInfoDatasetInDb,
  replaceInstructorsDatasetInDb,
  replacePricesDatasetInDb,
  revokeAdminSessionToken,
  rollbackPricesDatasetInDb,
  setupInitialAdminAccessCode,
  updateBranchInfoInDb,
  updateInstructorInDb,
  updatePriceRecordInDb,
  validateAdminSessionToken,
  verifyAdminAccessCodeAndCreateSession,
} from './db';
import { DetectedInstructorColumns, InstructorRecord } from '../src/types/instructors';
import { BranchInfoRecord, DetectedBranchInfoColumns } from '../src/types/branchInfo';
import { DetectedPriceColumns, PriceRecord } from '../src/types/prices';

const MAX_JSON_BODY_BYTES = 2 * 1024 * 1024; // 2 MB

class BadJsonError extends Error {
  public status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'BadJsonError';
    this.status = status;
  }
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

async function readJsonBody<T = Record<string, unknown>>(request: Request): Promise<T> {
  const contentLength = Number(request.headers.get('content-length') || '0');
  if (contentLength > MAX_JSON_BODY_BYTES) {
    throw new BadJsonError('Request payload exceeds maximum allowed size.', 413);
  }
  const rawText = await request.text();
  if (rawText.length > MAX_JSON_BODY_BYTES) {
    throw new BadJsonError('Request payload exceeds maximum allowed size.', 413);
  }
  if (!rawText.trim()) {
    return {} as T;
  }
  try {
    return JSON.parse(rawText) as T;
  } catch {
    throw new BadJsonError('Invalid JSON request body.', 400);
  }
}

function getClientKey(request: Request): string {
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp && cfIp.trim()) return cfIp.trim();
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd && fwd.trim()) {
    const first = fwd.split(',')[0]?.trim();
    if (first) return first;
  }
  return 'unknown';
}

function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

async function requireAdminAuth(request: Request, env: Env): Promise<Response | null> {
  const token = extractBearerToken(request);
  const isValid = await validateAdminSessionToken(env.DB, token, env.ADMIN_ACCESS_CODE);
  if (!isValid) {
    return jsonResponse(
      {
        error:
          'Unauthorized: Valid Admin Access Code authorization is required for this operation.',
        code: 'ADMIN_AUTH_REQUIRED',
      },
      401
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Route Handlers
// ---------------------------------------------------------------------------
async function handleResolvedPins(env: Env): Promise<Response> {
  try {
    const payload = await resolveOfficialTransportPins(env);
    return jsonResponse(payload, 200);
  } catch (err) {
    console.error('Error resolving transport pins:', err);
    return jsonResponse(
      { error: 'Failed to resolve transportation station coordinates.' },
      500
    );
  }
}

async function handleGeocode(url: URL, env: Env): Promise<Response> {
  const address = (url.searchParams.get('address') || '').trim();
  if (!address) {
    return jsonResponse({ error: 'Address query parameter is required.' }, 400);
  }

  const mapsKey = getServerMapsApiKey(env);
  if (!mapsKey) {
    return jsonResponse(
      { error: 'Google Maps API key is not configured on the server.' },
      503
    );
  }

  try {
    const encodedAddress = encodeURIComponent(
      address.toLowerCase().includes('dubai') ? address : `${address}, Dubai, UAE`
    );
    const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&components=country:AE&bounds=24.75,54.85|25.45,55.65&region=ae&key=${mapsKey}`;
    const response = await fetch(geoUrl, { signal: AbortSignal.timeout(7000) });

    if (response.status === 429) {
      return jsonResponse(
        { error: 'Google Maps Geocoding quota exceeded.', quotaExceeded: true },
        429
      );
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
      return jsonResponse(
        {
          error: data.error_message || 'Geocoding quota exceeded.',
          quotaExceeded: true,
        },
        429
      );
    }

    if (data.status === 'ZERO_RESULTS') {
      return jsonResponse({ result: null, status: 'ZERO_RESULTS' }, 200);
    }

    if (data.status !== 'OK' || !data.results?.length) {
      return jsonResponse(
        {
          error: data.error_message || `Geocoding failed with status ${data.status}`,
          status: data.status,
        },
        502
      );
    }

    const top = data.results[0];
    return jsonResponse(
      {
        result: {
          lat: top.geometry.location.lat,
          lng: top.geometry.location.lng,
          formattedAddress: top.formatted_address,
          placeId: top.place_id,
        },
      },
      200
    );
  } catch (err) {
    console.error('Geocode proxy error:', err);
    return jsonResponse({ error: 'Unable to geocode address right now.' }, 500);
  }
}

async function handleReverseGeocode(url: URL, env: Env): Promise<Response> {
  const latParam = url.searchParams.get('lat');
  const lngParam = url.searchParams.get('lng');
  const lat = latParam !== null ? Number(latParam) : NaN;
  const lng = lngParam !== null ? Number(lngParam) : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return jsonResponse({ error: 'Valid numeric lat and lng are required.' }, 400);
  }

  const mapsKey = getServerMapsApiKey(env);
  if (!mapsKey) {
    return jsonResponse(
      {
        formattedAddress: `${lat.toFixed(5)}, ${lng.toFixed(5)} (Dubai, UAE)`,
        areaName: 'Selected Map Point',
      },
      200
    );
  }

  try {
    const revUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=en&key=${mapsKey}`;
    const response = await fetch(revUrl, { signal: AbortSignal.timeout(7000) });

    if (response.status === 429) {
      return jsonResponse(
        { error: 'Reverse geocoding quota exceeded.', quotaExceeded: true },
        429
      );
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
      return jsonResponse(
        {
          error: data.error_message || 'Reverse geocoding quota exceeded.',
          quotaExceeded: true,
        },
        429
      );
    }

    if (data.status !== 'OK' || !data.results?.length) {
      return jsonResponse(
        {
          formattedAddress: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          areaName: 'Selected Location',
        },
        200
      );
    }

    const top = data.results[0];
    const neighborhoodComp = top.address_components?.find(
      (c) =>
        c.types.includes('sublocality_level_1') ||
        c.types.includes('neighborhood') ||
        c.types.includes('sublocality') ||
        c.types.includes('locality')
    );

    return jsonResponse(
      {
        formattedAddress: top.formatted_address,
        areaName: neighborhoodComp?.long_name || 'Dubai',
      },
      200
    );
  } catch (err) {
    console.warn('Reverse geocode proxy error:', err);
    return jsonResponse(
      {
        formattedAddress: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        areaName: 'Selected Location',
      },
      200
    );
  }
}

interface AIRecommendationRequestBody {
  studentLocation?: {
    label: string;
    lat: number | null;
    lng: number | null;
  };
  matchStatus?: 'exact_station' | 'area_no_exact_station';
  selectedStationName?: string;
  dubaiTime?: {
    weekday: string;
    formattedTime: string;
  };
  selectedDay?: string;
  studentRequirements?: string;
  nearestStation?: unknown;
  sameRouteStations?: unknown[];
  nearbyAlternatives?: unknown[];
  activeFilters?: unknown;
  unmappedStationsCount?: number;
}

function stripJsonCodeFences(rawText: string): string {
  const trimmed = rawText.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

function isValidAiRecommendationPayload(
  val: unknown
): val is {
  headline: string;
  recommendations: string[];
  alternativeTip: string;
  arrivalReminder: string;
} {
  if (!val || typeof val !== 'object') return false;
  const obj = val as Record<string, unknown>;
  if (typeof obj.headline !== 'string' || !obj.headline.trim()) return false;
  if (
    !Array.isArray(obj.recommendations) ||
    obj.recommendations.length === 0 ||
    !obj.recommendations.every((item) => typeof item === 'string' && item.trim().length > 0)
  ) {
    return false;
  }
  if (typeof obj.alternativeTip !== 'string') return false;
  if (typeof obj.arrivalReminder !== 'string') return false;
  return true;
}

function isTransientGeminiError(message: string): boolean {
  const upper = message.toUpperCase();
  return (
    upper.includes('429') ||
    upper.includes('RESOURCE_EXHAUSTED') ||
    upper.includes('503') ||
    upper.includes('500') ||
    upper.includes('UNAVAILABLE') ||
    upper.includes('DEADLINE_EXCEEDED') ||
    upper.includes('TIMEOUT') ||
    upper.includes('NETWORK')
  );
}

async function handleAiRecommendations(request: Request, env: Env): Promise<Response> {
  const apiKey = (env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    return jsonResponse(
      {
        error:
          'Gemini API key is not configured. Configure GEMINI_API_KEY in Cloudflare Workers Secrets to enable AI recommendations.',
      },
      503
    );
  }

  let payload: AIRecommendationRequestBody;
  try {
    payload = await readJsonBody<AIRecommendationRequestBody>(request);
  } catch (err) {
    if (err instanceof BadJsonError) {
      return jsonResponse({ error: err.message }, err.status);
    }
    return jsonResponse({ error: 'Invalid request body.' }, 400);
  }

  if (
    !payload ||
    !payload.studentLocation ||
    typeof payload.studentLocation.label !== 'string' ||
    !payload.studentLocation.label.trim()
  ) {
    return jsonResponse({ error: 'Missing valid student location or station context.' }, 400);
  }

  const sanitizedRequirements =
    typeof payload.studentRequirements === 'string'
      ? payload.studentRequirements.trim().slice(0, 500)
      : undefined;

  const modelPayload: AIRecommendationRequestBody = {
    ...payload,
    studentRequirements: sanitizedRequirements || undefined,
  };

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
Your ONLY job is to explain and summarize verified transportation search results in clear, factual, student-friendly guidance.

STRICT ACCURACY & GROUNDING RULES:
1. ONLY reference station names, landmarks, straight-line distances, walking distances/times, departure times, route codes, same-route stops, school branches, and operating days that are explicitly present in the provided JSON context.
2. NEVER invent, estimate, or alter any bus departure times, station names, connections, routes, distances, walking durations, travel times, or operating days.
3. RESPECT STATION MATCH STATUS:
   - If matchStatus is "exact_station", the student explicitly selected the official station named in selectedStationName (and nearestStation). Base all primary guidance strictly on that exact station and NEVER suggest replacing it with a different station.
   - If matchStatus is "area_no_exact_station", clearly state that studentLocation.label has NO exact Eco Drive pickup stop on the selected branch schedule, and present nearestStation and nearbyAlternatives strictly as "optional nearby alternatives" sorted by distance from studentLocation.label. Never claim an alternative station IS the searched neighborhood.
4. DISTINGUISH RELATIONSHIPS CLEARLY:
   - "Primary / Selected Station" (nearestStation)
   - "Same-Route Stations" (sameRouteStations: sequential stops on the same bus line)
   - "Optional Nearby Alternatives" (nearbyAlternatives: nearby stops sorted by geographic distance)
   Never confuse same-route stops with geographically nearby alternatives unless both facts appear explicitly in the JSON.
5. Explicitly distinguish between "straight-line distance" and "walking distance/time" whenever mentioning distance. If walkingDistanceMeters is null or absent, state clearly that walking route data is unavailable.
6. If nearestStation is null or has zero departures for the active filters, state clearly that verified data is unavailable under the current filters and suggest relaxing the filters rather than guessing.
7. Remind the student to arrive 5–10 minutes early at the pickup point and use the "Open in Google Maps" button when station coordinates are available.
8. If studentRequirements is present in the JSON context, directly address those student requirements using ONLY the verified data provided.`;

    let response: Awaited<ReturnType<typeof ai.models.generateContent>> | null = null;
    let lastErr: unknown = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Analyze this verified Eco Drive bus search result and generate concise, accurate recommendations for the student:\n${JSON.stringify(modelPayload)}`,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                headline: {
                  type: Type.STRING,
                  description:
                    'A clear 1-sentence summary stating either the exact selected station or that the searched location has no direct Eco Drive stop and naming the closest optional alternative.',
                },
                recommendations: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description:
                    '3 to 5 factual bullet points covering match status, exact/alternative station, same-route line stops if relevant, distance, next bus timing, landmark, and student requirements.',
                },
                alternativeTip: {
                  type: Type.STRING,
                  description:
                    '1 concise tip comparing optional nearby alternative stations or same-route stops strictly from the JSON, or explaining filter adjustments if none.',
                },
                arrivalReminder: {
                  type: Type.STRING,
                  description:
                    'Brief practical reminder about arriving 5-10 minutes before departure and verifying operating schedule.',
                },
              },
              required: ['headline', 'recommendations', 'alternativeTip', 'arrivalReminder'],
            },
          },
        });
        break;
      } catch (attemptErr: unknown) {
        lastErr = attemptErr;
        const msg =
          attemptErr instanceof Error ? attemptErr.message : String(attemptErr || '');
        if (attempt < 2 && isTransientGeminiError(msg)) {
          const delayMs = 300 * Math.pow(3, attempt);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }
        throw attemptErr;
      }
    }

    if (!response) {
      throw lastErr || new Error('AI request failed after retries.');
    }

    const rawText = response.text?.trim();
    if (!rawText) {
      return jsonResponse({ error: 'AI returned an empty recommendation response.' }, 502);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripJsonCodeFences(rawText));
    } catch {
      return jsonResponse(
        { error: 'AI returned a malformed response format. Please click Retry AI.' },
        502
      );
    }

    if (!isValidAiRecommendationPayload(parsed)) {
      return jsonResponse(
        { error: 'AI response was missing required guidance fields. Please click Retry AI.' },
        502
      );
    }

    return jsonResponse(parsed, 200);
  } catch (err: unknown) {
    console.error('Gemini AI recommendations error:', err);
    const message =
      err instanceof Error ? err.message : 'Failed to generate AI recommendations.';
    const upper = message.toUpperCase();

    if (
      upper.includes('PERMISSION_DENIED') ||
      upper.includes('API_KEY_INVALID') ||
      upper.includes('API KEY NOT VALID') ||
      upper.includes('UNAUTHENTICATED') ||
      upper.includes('401') ||
      upper.includes('403')
    ) {
      return jsonResponse(
        {
          error:
            'Invalid or unauthorized Gemini API key. Please verify GEMINI_API_KEY in Cloudflare Workers Secrets.',
        },
        401
      );
    }
    if (upper.includes('RESOURCE_EXHAUSTED') || upper.includes('429')) {
      return jsonResponse(
        {
          error: 'Gemini API rate limit reached. Please try again shortly.',
        },
        429
      );
    }
    if (upper.includes('NOT_FOUND') || upper.includes('404')) {
      return jsonResponse(
        {
          error: 'Configured Gemini model is currently unavailable. Please try again later.',
        },
        502
      );
    }
    if (upper.includes('INVALID_ARGUMENT') || upper.includes('400')) {
      return jsonResponse(
        {
          error: `Gemini rejected the search request: ${message}`,
        },
        400
      );
    }
    return jsonResponse({ error: message }, 502);
  }
}

// ---------------------------------------------------------------------------
// Main Cloudflare Worker Router
// ---------------------------------------------------------------------------
async function handleApiRequest(request: Request, env: Env, url: URL): Promise<Response> {
  const { pathname } = url;
  const method = request.method.toUpperCase();

  try {
    // Read-only transportation catalog. Existing frontend remains unchanged.
    if (pathname === '/api/transport/catalog' && method === 'GET') {
      const center = url.searchParams.get('center');
      if (center !== null && center !== 'dic' && center !== 'al_quoz') {
        return jsonResponse({ error: 'Invalid transportation center.' }, 400);
      }
      try {
        const [centers, routes, stops, trips, times, departures] = await env.DB.batch<Record<string, unknown>>([
          env.DB.prepare('SELECT id, name FROM transport_centers ORDER BY id'),
          env.DB.prepare('SELECT * FROM transport_routes WHERE active=1 ORDER BY center_id, CAST(substr(route_code,7) AS INTEGER), id'),
          env.DB.prepare('SELECT * FROM transport_stops WHERE active=1 ORDER BY position,id'),
          env.DB.prepare('SELECT * FROM transport_trips WHERE active=1 ORDER BY position,id'),
          env.DB.prepare('SELECT * FROM transport_stop_times'),
          env.DB.prepare('SELECT * FROM transport_departures WHERE active=1 ORDER BY position,id'),
        ]);
        if (![centers,routes,stops,trips,times,departures].every(r => r.success)) {
          throw new Error('Transport catalog query failed');
        }
        const selected = routes.results.filter(r => !center || r.center_id === center);
        if (!selected.length) return jsonResponse({ error: 'Transportation catalog unavailable.' }, 503);
        return jsonResponse({
          centers: centers.results.filter(c => !center || c.id === center),
          routes: selected.map(r => {
            const routeStops = stops.results.filter(s => s.route_id === r.id);
            const stopIds = new Set(routeStops.map(s => s.id));
            return {
              id:r.id, centerId:r.center_id, routeCode:r.route_code,
              title:r.title, scheduleType:r.schedule_type, capacity:r.capacity,
              centerEtaName:r.center_eta_name,
              stops:routeStops.map(s => ({
                id:s.id, name:s.name, landmark:s.landmark, pinUrl:s.pin_url ?? undefined,
                latitude:s.latitude, longitude:s.longitude,
              })),
              trips:trips.results.filter(t => t.route_id === r.id).map(t => ({
                id:t.id, eta:t.eta, departure:t.departure, notes:t.notes ?? undefined,
                stopTimes:Object.fromEntries(times.results.filter(x => x.route_id === r.id && x.trip_id === t.id && stopIds.has(x.stop_id)).map(x => [String(x.stop_id),x.pickup_time])),
              })),
              departures:departures.results.filter(d => d.route_id === r.id).map(d => ({
                id:d.id, time:d.departure_time, destination:d.destination, notes:d.notes,
              })),
            };
          }),
        });
      } catch (err) {
        console.error('Transport catalog read failed:', err);
        return jsonResponse({ error: 'Unable to load transportation catalog.' }, 503);
      }
    }

    // 1. Transportation & Google Maps Routes
    if (pathname === '/api/maps/walking-route' && method === 'POST') {
      return handleOpenWalkingRoute(request, env.ORS_API_KEY);
    }

    if (pathname === '/api/transport/resolved-pins' && method === 'GET') {
      return await handleResolvedPins(env);
    }

    if (pathname === '/api/maps/geocode' && method === 'GET') {
      return await handleGeocode(url, env);
    }

    if (pathname === '/api/maps/reverse-geocode' && method === 'GET') {
      return await handleReverseGeocode(url, env);
    }

    if (pathname === '/api/transport/ai-recommendations' && method === 'POST') {
      return await handleAiRecommendations(request, env);
    }

    // 2. Admin Access Code Auth Routes
    if (pathname === '/api/admin/status' && method === 'GET') {
      try {
        const status = await getAdminAuthStatus(env.DB, env.ADMIN_ACCESS_CODE);
        const token = extractBearerToken(request);
        const authorized = await validateAdminSessionToken(
          env.DB,
          token,
          env.ADMIN_ACCESS_CODE
        );
        return jsonResponse({
          configured: status.configured,
          managedByEnv: status.managedByEnv,
          authorized,
        });
      } catch (err) {
        console.error('Error checking admin status:', err);
        return jsonResponse({ error: 'Unable to check admin security status.' }, 500);
      }
    }

    if (pathname === '/api/admin/setup' && method === 'POST') {
      try {
        const body = await readJsonBody<{ accessCode?: unknown }>(request);
        const session = await setupInitialAdminAccessCode(
          env.DB,
          body.accessCode,
          env.ADMIN_ACCESS_CODE
        );
        return jsonResponse(session, 201);
      } catch (err) {
        if (err instanceof BadJsonError) {
          return jsonResponse({ error: err.message }, err.status);
        }
        if (err instanceof ValidationError) {
          return jsonResponse({ error: err.message, fieldErrors: err.fieldErrors }, 400);
        }
        if (err instanceof ConflictError) {
          return jsonResponse({ error: err.message }, 409);
        }
        console.error('Error setting up admin access code:', err);
        return jsonResponse({ error: 'Failed to configure Admin Access Code.' }, 500);
      }
    }

    if (pathname === '/api/admin/verify' && method === 'POST') {
      const clientKey = getClientKey(request);
      try {
        const secondsLeft = await checkVerifyRateLimit(env.DB, clientKey);
        if (secondsLeft > 0) {
          return jsonResponse(
            {
              error: `Too many invalid access code attempts. Please wait ${secondsLeft} seconds before trying again.`,
            },
            429
          );
        }

        const body = await readJsonBody<{ accessCode?: unknown }>(request);
        const session = await verifyAdminAccessCodeAndCreateSession(
          env.DB,
          body.accessCode,
          env.ADMIN_ACCESS_CODE
        );
        await clearVerifyRateLimit(env.DB, clientKey);
        return jsonResponse(session, 200);
      } catch (err) {
        if (err instanceof BadJsonError) {
          return jsonResponse({ error: err.message }, err.status);
        }
        if (err instanceof UnauthorizedError) {
          await recordVerifyFailure(env.DB, clientKey);
          return jsonResponse(
            { error: 'Access denied. Invalid Admin Access Code.' },
            401
          );
        }
        if (err instanceof ValidationError) {
          return jsonResponse({ error: err.message }, 400);
        }
        console.error('Error verifying admin access code:', err);
        return jsonResponse({ error: 'Unable to verify Admin Access Code.' }, 500);
      }
    }

    if (pathname === '/api/admin/change-code' && method === 'POST') {
      const authError = await requireAdminAuth(request, env);
      if (authError) return authError;

      try {
        const body = await readJsonBody<{ currentCode?: unknown; newCode?: unknown }>(
          request
        );
        const session = await changeAdminAccessCode(
          env.DB,
          body.currentCode,
          body.newCode,
          env.ADMIN_ACCESS_CODE
        );
        return jsonResponse(session, 200);
      } catch (err) {
        if (err instanceof BadJsonError) {
          return jsonResponse({ error: err.message }, err.status);
        }
        if (err instanceof UnauthorizedError) {
          return jsonResponse(
            { error: 'Access denied. Invalid Admin Access Code.' },
            401
          );
        }
        if (err instanceof ValidationError) {
          return jsonResponse({ error: err.message, fieldErrors: err.fieldErrors }, 400);
        }
        console.error('Error changing admin access code:', err);
        return jsonResponse({ error: 'Failed to update Admin Access Code.' }, 500);
      }
    }

    if (pathname === '/api/admin/logout' && method === 'POST') {
      try {
        const token = extractBearerToken(request);
        await revokeAdminSessionToken(env.DB, token);
        return jsonResponse({ locked: true }, 200);
      } catch (err) {
        console.error('Error locking admin session:', err);
        return jsonResponse({ error: 'Unable to lock admin session.' }, 500);
      }
    }

    // 3. Instructors CRUD Routes
    if (pathname === '/api/instructors' && method === 'GET') {
      try {
        const dataset = await getInstructorsDatasetFromDb(env.DB);
        return jsonResponse(dataset, 200);
      } catch (err) {
        console.error('Error loading instructors from database:', err);
        return jsonResponse({ error: 'Failed to load instructors from database.' }, 500);
      }
    }

    if (pathname === '/api/instructors' && method === 'POST') {
      const authError = await requireAdminAuth(request, env);
      if (authError) return authError;

      try {
        const body = await readJsonBody<{
          fields?: Record<string, unknown>;
          sheetName?: string;
        }>(request);
        const created = await createInstructorInDb(
          env.DB,
          body.fields || {},
          body.sheetName
        );
        return jsonResponse({ record: created }, 201);
      } catch (err) {
        if (err instanceof BadJsonError) {
          return jsonResponse({ error: err.message }, err.status);
        }
        if (err instanceof ValidationError) {
          return jsonResponse({ error: err.message, fieldErrors: err.fieldErrors }, 400);
        }
        console.error('Error creating instructor:', err);
        return jsonResponse({ error: 'Failed to save instructor to database.' }, 500);
      }
    }

    if (pathname === '/api/instructors/import' && method === 'POST') {
      const authError = await requireAdminAuth(request, env);
      if (authError) return authError;

      try {
        const body = await readJsonBody<{
          fileName: string;
          sheetNames: string[];
          columns: string[];
          detectedColumns: DetectedInstructorColumns;
          records: InstructorRecord[];
          importedAt: string;
        }>(request);
        const dataset = await replaceInstructorsDatasetInDb(env.DB, body);
        return jsonResponse(dataset, 200);
      } catch (err) {
        if (err instanceof BadJsonError) {
          return jsonResponse({ error: err.message }, err.status);
        }
        if (err instanceof ValidationError) {
          return jsonResponse({ error: err.message, fieldErrors: err.fieldErrors }, 400);
        }
        console.error('Error importing instructors:', err);
        return jsonResponse({ error: 'Failed to save imported instructors dataset.' }, 500);
      }
    }

    const instructorItemMatch = pathname.match(/^\/api\/instructors\/([^/]+)$/);
    if (instructorItemMatch) {
      let rowKey: string;
      try {
        rowKey = decodeURIComponent(instructorItemMatch[1]);
      } catch {
        return jsonResponse({ error: 'Invalid instructor identifier.' }, 400);
      }

      if (method === 'PUT') {
        const authError = await requireAdminAuth(request, env);
        if (authError) return authError;

        try {
          const body = await readJsonBody<{ fields?: Record<string, unknown> }>(request);
          const updated = await updateInstructorInDb(env.DB, rowKey, body.fields || {});
          return jsonResponse({ record: updated }, 200);
        } catch (err) {
          if (err instanceof BadJsonError) {
            return jsonResponse({ error: err.message }, err.status);
          }
          if (err instanceof ValidationError) {
            return jsonResponse(
              { error: err.message, fieldErrors: err.fieldErrors },
              400
            );
          }
          if (err instanceof NotFoundError) {
            return jsonResponse({ error: err.message }, 404);
          }
          console.error('Error updating instructor:', err);
          return jsonResponse(
            { error: 'Failed to update instructor in database.' },
            500
          );
        }
      }

      if (method === 'DELETE') {
        const authError = await requireAdminAuth(request, env);
        if (authError) return authError;

        try {
          await deleteInstructorInDb(env.DB, rowKey);
          return jsonResponse({ deleted: true, rowKey }, 200);
        } catch (err) {
          if (err instanceof NotFoundError) {
            return jsonResponse({ error: err.message }, 404);
          }
          console.error('Error deleting instructor:', err);
          return jsonResponse(
            { error: 'Failed to delete instructor from database.' },
            500
          );
        }
      }
    }

    // 4. Branch Information CRUD Routes
    if (pathname === '/api/branch-info' && method === 'GET') {
      try {
        const dataset = await getBranchInfoDatasetFromDb(env.DB);
        return jsonResponse(dataset, 200);
      } catch (err) {
        console.error('Error loading branch info from database:', err);
        return jsonResponse(
          { error: 'Failed to load branch information from database.' },
          500
        );
      }
    }

    if (pathname === '/api/branch-info' && method === 'POST') {
      const authError = await requireAdminAuth(request, env);
      if (authError) return authError;

      try {
        const body = await readJsonBody<{
          fields?: Record<string, unknown>;
          sheetName?: string;
        }>(request);
        const created = await createBranchInfoInDb(
          env.DB,
          body.fields || {},
          body.sheetName
        );
        return jsonResponse({ record: created }, 201);
      } catch (err) {
        if (err instanceof BadJsonError) {
          return jsonResponse({ error: err.message }, err.status);
        }
        if (err instanceof ValidationError) {
          return jsonResponse({ error: err.message, fieldErrors: err.fieldErrors }, 400);
        }
        console.error('Error creating branch info:', err);
        return jsonResponse({ error: 'Failed to save branch to database.' }, 500);
      }
    }

    if (pathname === '/api/branch-info/import' && method === 'POST') {
      const authError = await requireAdminAuth(request, env);
      if (authError) return authError;

      try {
        const body = await readJsonBody<{
          fileName: string;
          sheetNames: string[];
          columns: string[];
          detectedColumns: DetectedBranchInfoColumns;
          records: BranchInfoRecord[];
          notes: string[];
          importedAt: string;
        }>(request);
        const dataset = await replaceBranchInfoDatasetInDb(env.DB, body);
        return jsonResponse(dataset, 200);
      } catch (err) {
        if (err instanceof BadJsonError) {
          return jsonResponse({ error: err.message }, err.status);
        }
        if (err instanceof ValidationError) {
          return jsonResponse({ error: err.message, fieldErrors: err.fieldErrors }, 400);
        }
        console.error('Error importing branch info:', err);
        return jsonResponse({ error: 'Failed to save imported branch dataset.' }, 500);
      }
    }

    const branchItemMatch = pathname.match(/^\/api\/branch-info\/([^/]+)$/);
    if (branchItemMatch) {
      let rowKey: string;
      try {
        rowKey = decodeURIComponent(branchItemMatch[1]);
      } catch {
        return jsonResponse({ error: 'Invalid branch identifier.' }, 400);
      }

      if (method === 'PUT') {
        const authError = await requireAdminAuth(request, env);
        if (authError) return authError;

        try {
          const body = await readJsonBody<{ fields?: Record<string, unknown> }>(request);
          const updated = await updateBranchInfoInDb(env.DB, rowKey, body.fields || {});
          return jsonResponse({ record: updated }, 200);
        } catch (err) {
          if (err instanceof BadJsonError) {
            return jsonResponse({ error: err.message }, err.status);
          }
          if (err instanceof ValidationError) {
            return jsonResponse(
              { error: err.message, fieldErrors: err.fieldErrors },
              400
            );
          }
          if (err instanceof NotFoundError) {
            return jsonResponse({ error: err.message }, 404);
          }
          console.error('Error updating branch info:', err);
          return jsonResponse({ error: 'Failed to update branch in database.' }, 500);
        }
      }

      if (method === 'DELETE') {
        const authError = await requireAdminAuth(request, env);
        if (authError) return authError;

        try {
          await deleteBranchInfoInDb(env.DB, rowKey);
          return jsonResponse({ deleted: true, rowKey }, 200);
        } catch (err) {
          if (err instanceof NotFoundError) {
            return jsonResponse({ error: err.message }, 404);
          }
          console.error('Error deleting branch info:', err);
          return jsonResponse(
            { error: 'Failed to delete branch from database.' },
            500
          );
        }
      }
    }

    // 5. Prices Catalog CRUD, Excel Import & Rollback Routes (Cloudflare D1)
    if (pathname === '/api/prices' && method === 'GET') {
      try {
        const dataset = await getPricesDatasetFromDb(env.DB);
        return jsonResponse(dataset, 200);
      } catch (err) {
        console.error('Error loading prices from database:', err);
        return jsonResponse({ error: 'Failed to load Prices catalog from database.' }, 500);
      }
    }

    if (pathname === '/api/prices' && method === 'POST') {
      const authError = await requireAdminAuth(request, env);
      if (authError) return authError;

      try {
        const body = await readJsonBody<{
          fields?: Record<string, unknown>;
          sheetName?: string;
          category?: string;
          productName?: string;
          priceDisplay?: string;
          currency?: string;
        }>(request);
        const created = await createPriceRecordInDb(env.DB, body);
        return jsonResponse({ record: created }, 201);
      } catch (err) {
        if (err instanceof BadJsonError) {
          return jsonResponse({ error: err.message }, err.status);
        }
        if (err instanceof ValidationError) {
          return jsonResponse({ error: err.message, fieldErrors: err.fieldErrors }, 400);
        }
        console.error('Error creating price record:', err);
        return jsonResponse({ error: 'Failed to save price record to database.' }, 500);
      }
    }

    if (pathname === '/api/prices/import' && method === 'POST') {
      const authError = await requireAdminAuth(request, env);
      if (authError) return authError;

      try {
        const body = await readJsonBody<{
          fileName: string;
          sheetNames: string[];
          columns: string[];
          detectedColumns: DetectedPriceColumns;
          records: PriceRecord[];
          notes: string[];
          contentHash: string;
          importedAt: string;
        }>(request);
        const dataset = await replacePricesDatasetInDb(env.DB, body);
        return jsonResponse(dataset, 200);
      } catch (err) {
        if (err instanceof BadJsonError) {
          return jsonResponse({ error: err.message }, err.status);
        }
        if (err instanceof ValidationError) {
          return jsonResponse({ error: err.message, fieldErrors: err.fieldErrors }, 400);
        }
        console.error('Error importing prices dataset:', err);
        return jsonResponse({ error: 'Failed to save imported Prices dataset to database.' }, 500);
      }
    }

    if (pathname === '/api/prices/rollback' && method === 'POST') {
      const authError = await requireAdminAuth(request, env);
      if (authError) return authError;

      try {
        const dataset = await rollbackPricesDatasetInDb(env.DB);
        return jsonResponse(dataset, 200);
      } catch (err) {
        if (err instanceof NotFoundError) {
          return jsonResponse({ error: err.message }, 404);
        }
        console.error('Error rolling back prices dataset:', err);
        return jsonResponse({ error: 'Failed to restore previous Prices backup.' }, 500);
      }
    }

    const priceItemMatch = pathname.match(/^\/api\/prices\/([^/]+)$/);
    if (priceItemMatch) {
      let rowKey: string;
      try {
        rowKey = decodeURIComponent(priceItemMatch[1]);
      } catch {
        return jsonResponse({ error: 'Invalid price identifier.' }, 400);
      }

      if (method === 'PUT') {
        const authError = await requireAdminAuth(request, env);
        if (authError) return authError;

        try {
          const body = await readJsonBody<{
            fields?: Record<string, unknown>;
            category?: string;
            productName?: string;
            priceDisplay?: string;
            currency?: string;
          }>(request);
          const updated = await updatePriceRecordInDb(env.DB, rowKey, body);
          return jsonResponse({ record: updated }, 200);
        } catch (err) {
          if (err instanceof BadJsonError) {
            return jsonResponse({ error: err.message }, err.status);
          }
          if (err instanceof ValidationError) {
            return jsonResponse(
              { error: err.message, fieldErrors: err.fieldErrors },
              400
            );
          }
          if (err instanceof NotFoundError) {
            return jsonResponse({ error: err.message }, 404);
          }
          console.error('Error updating price record:', err);
          return jsonResponse({ error: 'Failed to update price record in database.' }, 500);
        }
      }

      if (method === 'DELETE') {
        const authError = await requireAdminAuth(request, env);
        if (authError) return authError;

        try {
          await deletePriceRecordInDb(env.DB, rowKey);
          return jsonResponse({ deleted: true, rowKey }, 200);
        } catch (err) {
          if (err instanceof NotFoundError) {
            return jsonResponse({ error: err.message }, 404);
          }
          console.error('Error deleting price record:', err);
          return jsonResponse(
            { error: 'Failed to delete price record from database.' },
            500
          );
        }
      }
    }

    return jsonResponse({ error: 'API endpoint not found.' }, 404);
  } catch (err) {
    console.error('Unhandled API worker error:', err);
    return jsonResponse({ error: 'Internal server error.' }, 500);
  }
}

export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    // Strictly isolate /api/* routes so they never fall through to SPA index.html
    if (url.pathname.startsWith('/api/')) {
      return handleApiRequest(request, env, url);
    }

    // Delegate static asset & SPA routing to Cloudflare Workers Assets binding
    return env.ASSETS.fetch(request);
  },
};
