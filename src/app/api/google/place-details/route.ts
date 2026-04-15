import { NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/verifyAuth';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ALLOWED_FIELDS = new Set(['rating', 'user_ratings_total', 'name', 'formatted_address', 'place_id']);

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS });
}

export async function POST(request: Request) {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GOOGLE_PLACES_API_KEY not set' }, { status: 500, headers: CORS });
  }

  const body = await request.json().catch(() => null);
  const placeId = body?.place_id;
  if (!placeId || typeof placeId !== 'string') {
    return NextResponse.json({ error: 'place_id required' }, { status: 400, headers: CORS });
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

  return NextResponse.json(data, { headers: CORS });
}
