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
  const input = body?.input;
  if (!input || typeof input !== 'string') {
    return NextResponse.json({ error: 'input required' }, { status: 400, headers: CORS });
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

  return NextResponse.json(data, { headers: CORS });
}
