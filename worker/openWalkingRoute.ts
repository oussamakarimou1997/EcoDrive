/** Worker handler. Register POST /api/maps/walking-route in worker/index.ts. */
export async function handleOpenWalkingRoute(request: Request, apiKey?: string): Promise<Response> {
  const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: {'Cache-Control': 'no-store'} });
  if (request.method !== 'POST') return reply({error:'Method not allowed'},405);
  if (!apiKey) return reply({error:'Walking service not configured'},503);
  const valid = (p: any) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.lat >= 24.75 && p.lat <= 25.45 && p.lng >= 54.85 && p.lng <= 55.65;
  let body: any;
  try { body = await request.json(); } catch { return reply({error:'Invalid JSON'},400); }
  if (!valid(body?.origin) || !valid(body?.destination)) return reply({error:'Invalid coordinates'},400);
  const {origin, destination} = body;
  try {
    const response = await fetch('https://api.heigit.org/openrouteservice/v2/directions/foot-walking/geojson', {
      method:'POST', headers:{Authorization:apiKey,'Content-Type':'application/json'},
      body:JSON.stringify({coordinates:[[origin.lng,origin.lat],[destination.lng,destination.lat]]}),
      signal:AbortSignal.timeout(12000),
    });
    if (!response.ok) return reply({error:'Walking route unavailable'},response.status === 429 ? 429 : 502);
    const data: any = await response.json();
    const route = data.features?.[0];
    const coordinates = route?.geometry?.coordinates;
    const summary = route?.properties?.summary;
    if (!Array.isArray(coordinates) || coordinates.length < 2 || !coordinates.every((p: any) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])) || !Number.isFinite(summary?.distance) || !Number.isFinite(summary?.duration) || summary.distance < 0 || summary.duration < 0) return reply({error:'No valid walking route'},502);
    return reply({coordinates:coordinates.map((p: number[])=>[p[0],p[1]]),distanceMeters:summary.distance,durationMillis:summary.duration*1000});
  } catch { return reply({error:'Walking service unavailable'},502); }
}
