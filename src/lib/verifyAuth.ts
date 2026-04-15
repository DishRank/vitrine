import { createClient } from '@supabase/supabase-js';

let _authClient: ReturnType<typeof createClient> | null = null;

function getAuthClient() {
  if (!_authClient) {
    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    if (!url || !anonKey) throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
    _authClient = createClient(url, anonKey);
  }
  return _authClient;
}

export async function getAuthenticatedUserId(request: Request): Promise<string | null> {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return null;

  try {
    const { data: { user }, error } = await getAuthClient().auth.getUser(token);
    if (error || !user) return null;
    return user.id;
  } catch {
    return null;
  }
}
