import { NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/verifyAuth';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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
  if (!body) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400, headers: CORS });
  }

  const { type, lat, lng, address, language = 'fr', result_type } = body;

  const params = new URLSearchParams();
  params.set('language', language);
  params.set('key', apiKey);

  if (type === 'reverse') {
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json({ error: 'lat and lng required for reverse geocoding' }, { status: 400, headers: CORS });
    }
    params.set('latlng', `${lat},${lng}`);
    if (result_type) params.set('result_type', result_type);
  } else if (type === 'forward') {
    if (!address || typeof address !== 'string') {
      return NextResponse.json({ error: 'address required for forward geocoding' }, { status: 400, headers: CORS });
    }
    params.set('address', address);
  } else {
    return NextResponse.json({ error: 'type must be "reverse" or "forward"' }, { status: 400, headers: CORS });
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`;
  const res = await fetch(url);
  const data = await res.json();

  return NextResponse.json(data, { headers: CORS });
}
