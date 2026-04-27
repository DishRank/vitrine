import { NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/verifyAuth';
import { getCorsHeaders } from '@/lib/cors';

const ALLOWED_FIELDS = new Set(['rating', 'user_ratings_total', 'name', 'formatted_address', 'place_id']);

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
  const placeId = body?.place_id;
  if (!placeId || typeof placeId !== 'string') {
    return NextResponse.json({ error: 'place_id required' }, { status: 400, headers: cors });
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
