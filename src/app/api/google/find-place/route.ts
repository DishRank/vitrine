import { NextResponse } from 'next/server';
import { getAuthenticatedContext } from '@/lib/verifyAuth';
import { getCorsHeaders } from '@/lib/cors';
import { getSupabaseServiceClientFor } from '@/lib/supabase';
import { googleGateRefusal, googleQuotaGate } from '@/lib/googleQuota';

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { headers: getCorsHeaders(request) });
}

export async function POST(request: Request) {
  const cors = getCorsHeaders(request);
  const auth = await getAuthenticatedContext(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: cors });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GOOGLE_PLACES_API_KEY not set' }, { status: 500, headers: cors });
  }

  const body = await request.json().catch(() => null);
  const input = body?.input;
  if (!input || typeof input !== 'string') {
    return NextResponse.json({ error: 'input required' }, { status: 400, headers: cors });
  }

  // Server-side rate-limit gate. Find Place with `fields=place_id` bills
  // against the Text Search Essentials (IDs Only) SKU which has 10 000
  // free calls/month. We cap at 9 000 to keep some margin. Refused
  // request → 429, client falls back to its own cached/empty result.
  // Compteur en panne → 503 (échec fermé, cf. lib/googleQuota).
  const supabase = getSupabaseServiceClientFor(auth.supabaseUrl, auth.serviceRoleKey);
  const gate = await googleQuotaGate(supabase, 'find_place', auth.userId, 'find-place');
  if (!gate.ok) return googleGateRefusal(gate, cors);

  const params = new URLSearchParams({
    input,
    inputtype: 'textquery',
    fields: 'place_id',
    key: apiKey,
  });

  const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?${params.toString()}`;
  const res = await fetch(url);
  const data = await res.json();

  return NextResponse.json(data, { headers: cors });
}
