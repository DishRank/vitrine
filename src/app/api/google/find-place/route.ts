import { NextResponse } from 'next/server';
import { getAuthenticatedContext } from '@/lib/verifyAuth';
import { getCorsHeaders } from '@/lib/cors';
import { getSupabaseServiceClientFor } from '@/lib/supabase';

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
  const supabase = getSupabaseServiceClientFor(auth.supabaseUrl, auth.serviceRoleKey);
  const { data: gate, error: gateErr } = await supabase.rpc('try_log_google_api_call', {
    p_endpoint: 'find_place',
    p_user_id: auth.userId,
  });
  if (gateErr) {
    console.warn('[find-place] gate rpc failed, allowing through:', gateErr.message);
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
