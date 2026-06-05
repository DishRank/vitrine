import { NextResponse } from 'next/server';
import { getAuthenticatedContext } from '@/lib/verifyAuth';
import { getCorsHeaders } from '@/lib/cors';
import { getSupabaseServiceClientFor } from '@/lib/supabase';

const ALLOWED_FIELDS = new Set(['rating', 'user_ratings_total', 'name', 'formatted_address', 'place_id']);

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { headers: getCorsHeaders(request) });
}

export async function POST(request: Request) {
  const cors = getCorsHeaders(request);
  const auth = await getAuthenticatedContext(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: cors });
  }

  // Pick the Google key matching the calling platform — each key is
  // IP-restricted to our server origins (Vercel + Supabase edge) but
  // tracked separately in GCP so we can rotate/revoke either without
  // breaking the other platform. Falls back to the generic key when a
  // platform-specific one isn't configured yet (smooth migration).
  const platform = (request.headers.get('x-client-platform') || '').toLowerCase();
  const apiKey =
    (platform === 'android' ? process.env.GOOGLE_PLACES_API_KEY_ANDROID : null)
    || (platform === 'ios' ? process.env.GOOGLE_PLACES_API_KEY_IOS : null)
    || process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GOOGLE_PLACES_API_KEY not set' }, { status: 500, headers: cors });
  }

  const body = await request.json().catch(() => null);
  const placeId = body?.place_id;
  if (!placeId || typeof placeId !== 'string') {
    return NextResponse.json({ error: 'place_id required' }, { status: 400, headers: cors });
  }

  // Server-side rate-limit gate. Place Details with atmosphere fields
  // (rating / user_ratings_total) bills against the Enterprise SKU
  // category, which has 1 000 free calls/month SHARED with Place Photos.
  // We cap at 950 to leave headroom for races + clock skew at the month
  // boundary. The RPC returns false BEFORE inserting if the cap is hit.
  const supabase = getSupabaseServiceClientFor(auth.supabaseUrl, auth.serviceRoleKey);
  const { data: gate, error: gateErr } = await supabase.rpc('try_log_google_api_call', {
    p_endpoint: 'place_details',
    p_user_id: auth.userId,
  });
  if (gateErr) {
    console.warn('[place-details] gate rpc failed, allowing through:', gateErr.message);
  } else if (Array.isArray(gate) && gate[0] && gate[0].allowed === false) {
    return NextResponse.json(
      {
        error: 'monthly_cap_reached',
        category: gate[0].category,
        current_count: gate[0].current_count,
        monthly_cap: gate[0].monthly_cap,
      },
      { status: 429, headers: cors }
    );
  }

  const requestedFields: string[] = Array.isArray(body.fields) && body.fields.length > 0
    ? body.fields.filter((f: string) => ALLOWED_FIELDS.has(f))
    : ['rating', 'user_ratings_total'];

  const params = new URLSearchParams({
    place_id: placeId,
    fields: requestedFields.join(','),
    key: apiKey,
  });

  const url = `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`;
  const res = await fetch(url);
  const data = await res.json();

  return NextResponse.json(data, { headers: cors });
}
