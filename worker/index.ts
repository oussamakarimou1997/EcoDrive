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
  deleteBranchInfoInDb,
  deleteInstructorInDb,
  getAdminAuthStatus,
  getBranchInfoDatasetFromDb,
  getInstructorsDatasetFromDb,
  recordVerifyFailure,
  replaceBranchInfoDatasetInDb,
  replaceInstructorsDatasetInDb,
  revokeAdminSessionToken,
  setupInitialAdminAccessCode,
  updateBranchInfoInDb,
  updateInstructorInDb,
  validateAdminSessionToken,
  verifyAdminAccessCodeAndCreateSession,
} from './db';
import { DetectedInstructorColumns, InstructorRecord } from '../src/types/instructors';
import { BranchInfoRecord, DetectedBranchInfoColumns } from '../src/types/branchInfo';

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
    lat: number;
    lng: number;
  };
  dubaiTime?: {
    weekday: string;
    formattedTime: string;
  };
  selectedDay?: string;
  nearestStation?: unknown;
  nearbyAlternatives?: unknown[];
  activeFilters?: unknown;
  unmappedStationsCount?: number;
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

  if (!payload || !payload.studentLocation) {
    return jsonResponse({ error: 'Missing student location context.' }, 400);
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
              description:
                'A clear 1-sentence summary identifying the nearest verified station and distance.',
            },
            recommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description:
                '3 to 5 factual bullet points covering exact station, distance, next bus timing, landmark, and Google Maps navigation.',
            },
            alternativeTip: {
              type: Type.STRING,
              description:
                '1 concise tip comparing nearby alternative stations if available, or explaining filter status if none.',
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

    const rawText = response.text?.trim();
    if (!rawText) {
      return jsonResponse({ error: 'AI returned an empty recommendation response.' }, 502);
    }

    const parsed = JSON.parse(rawText);
    return jsonResponse(parsed, 200);
  } catch (err: unknown) {
    console.error('Gemini AI recommendations error:', err);
    const message =
      err instanceof Error ? err.message : 'Failed to generate AI recommendations.';
    if (
      message.includes('PERMISSION_DENIED') ||
      message.includes('API_KEY_INVALID') ||
      message.includes('403') ||
      message.includes('400')
    ) {
      return jsonResponse(
        {
          error:
            'Invalid or missing Gemini API key. Please verify GEMINI_API_KEY in Cloudflare Workers Secrets.',
        },
        401
      );
    }
    if (message.includes('RESOURCE_EXHAUSTED') || message.includes('429')) {
      return jsonResponse(
        {
          error: 'Gemini API rate limit reached. Please try again shortly.',
        },
        429
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
    // 1. Transportation & Google Maps Routes
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
