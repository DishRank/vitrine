/**
 * Resolved auth context. `supabaseUrl` + `serviceRoleKey` identify WHICH
 * Supabase project issued the JWT — needed so downstream routes can read
 * caches / write to that project's tables (the prod vitrine talks to PROD
 * by default, but the mobile dev build issues DEV-project JWTs ; without
 * project-aware routing every dev request would 401 against prod).
 */
export interface AuthContext {
  userId: string;
  supabaseUrl: string;
  serviceRoleKey: string;
}

/**
 * Decode (without verifying) the JWT payload to read the `iss` claim. Used
 * as a routing hint only — the actual token validation happens via
 * `auth/v1/user` on the matching project. Returns the issuer URL stripped
 * of the `/auth/v1` suffix so it matches our `SUPABASE_URL` env var shape.
 */
function parseJwtIssuer(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    // Base64url → base64.
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    const iss = payload?.iss as string | undefined;
    if (!iss) return null;
    return iss.replace(/\/auth\/v1\/?$/, '');
  } catch { return null; }
}

/**
 * Validate a Bearer JWT against the project that issued it (prod or dev,
 * derived from the token's `iss` claim) and return both the user id and the
 * matching project credentials. Routes that need project-aware service-role
 * access (OSM cache, photo cache) should use this. Routes that only care
 * about "is the user authenticated" can keep using `getAuthenticatedUserId`.
 */
export async function getAuthenticatedContext(request: Request): Promise<AuthContext | null> {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return null;

  const issuerUrl = parseJwtIssuer(token);
  if (!issuerUrl) {
    console.warn('[verifyAuth] JWT has no usable iss claim');
    return null;
  }

  const prodUrl = process.env.SUPABASE_URL || '';
  const devUrl = process.env.SUPABASE_URL_DEV || '';
  let supabaseUrl = '';
  let anonKey = '';
  let serviceRoleKey = '';
  if (prodUrl && issuerUrl === prodUrl) {
    supabaseUrl = prodUrl;
    anonKey = process.env.SUPABASE_ANON_KEY || '';
    serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  } else if (devUrl && issuerUrl === devUrl) {
    supabaseUrl = devUrl;
    anonKey = process.env.SUPABASE_ANON_KEY_DEV || '';
    serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY_DEV || '';
  } else {
    console.warn('[verifyAuth] JWT issuer does not match any configured project:', issuerUrl);
    return null;
  }
  if (!anonKey || !serviceRoleKey) {
    console.warn('[verifyAuth] Missing anon/service keys for project', supabaseUrl);
    return null;
  }

  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
    });
    if (!res.ok) {
      console.warn('[verifyAuth] Supabase rejected token:', res.status, 'project=', supabaseUrl);
      return null;
    }
    const user = await res.json();
    if (!user?.id) return null;
    return { userId: user.id, supabaseUrl, serviceRoleKey };
  } catch (err) {
    console.warn('[verifyAuth] Fetch failed:', (err as Error).message);
    return null;
  }
}

/**
 * Legacy — returns just the user id. Kept for routes that don't need to
 * know which project issued the token (eg. google find-place / details
 * which only care that *some* DishRank user is calling).
 */
export async function getAuthenticatedUserId(request: Request): Promise<string | null> {
  const ctx = await getAuthenticatedContext(request);
  return ctx?.userId ?? null;
}
