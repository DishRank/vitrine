export async function getAuthenticatedUserId(request: Request): Promise<string | null> {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return null;

  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    console.warn('[verifyAuth] Missing SUPABASE_URL or SUPABASE_ANON_KEY');
    return null;
  }

  try {
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: anonKey,
      },
    });
    if (!res.ok) {
      console.warn('[verifyAuth] Supabase auth rejected token:', res.status);
      return null;
    }
    const user = await res.json();
    return user?.id || null;
  } catch (err) {
    console.warn('[verifyAuth] Fetch failed:', (err as Error).message);
    return null;
  }
}
