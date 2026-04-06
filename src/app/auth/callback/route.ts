import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = 'https://yztbhdvrvgozhyaujtjz.supabase.co';

/**
 * Auth callback proxy — redirects OAuth callbacks to Supabase
 * so the browser shows dishrank.fr instead of the Supabase URL.
 *
 * Apple/Google OAuth → dishrank.fr/auth/callback → Supabase callback
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams.toString();
  return NextResponse.redirect(`${SUPABASE_URL}/auth/v1/callback?${searchParams}`);
}

export async function POST(request: NextRequest) {
  // Apple sends a POST with form data for the callback
  const formData = await request.formData();
  const params = new URLSearchParams();
  formData.forEach((value, key) => {
    params.append(key, value.toString());
  });
  return NextResponse.redirect(`${SUPABASE_URL}/auth/v1/callback?${params.toString()}`, {
    status: 303, // POST → GET redirect
  });
}
