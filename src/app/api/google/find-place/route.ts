import { NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/verifyAuth';
import { getCorsHeaders } from '@/lib/cors';

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { headers: getCorsHeaders(request) });
}

export async function POST(request: Request) {
  const cors = getCorsHeaders(request);
  const userId = await getAuthenticatedUserId(request);
  if (!userId) {
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
