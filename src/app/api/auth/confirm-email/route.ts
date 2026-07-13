import { NextRequest, NextResponse } from 'next/server';
import { createClient, type EmailOtpType } from '@supabase/supabase-js';

/**
 * Server-side email confirmation.
 *
 * Why this exists: the client used to hand the token off to GoTrue's GET
 * `/auth/v1/verify` via `window.location.replace`. That works for the legacy
 * `token` param (GoTrue 303-redirects, even on failure) but **dead-ends on a
 * 400 for `token_hash`** — no `Location` header to follow, so the page froze
 * forever on "Vérification en cours…". Our email template emits `token_hash`,
 * so we hit that 400 path every time.
 *
 * The robust fix is the documented Supabase pattern: call `verifyOtp({ type,
 * token_hash })`, which is a normal POST that **always resolves** with a
 * `{ data, error }` result. We do it server-side so no Supabase key is shipped
 * to the browser and we reuse the key already in the environment.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tokenHash = searchParams.get('token_hash') || searchParams.get('token');
  const type = (searchParams.get('type') || 'signup') as EmailOtpType;

  if (!tokenHash) {
    return NextResponse.json(
      { ok: false, code: 'missing_token', message: 'Lien invalide ou expiré.' },
      { status: 400 },
    );
  }

  // Multi-projet (lot 1.6 espace-pro-web) : le lien email ne dit pas de quel
  // projet Supabase vient le token. On tente prod puis dev — un token_hash
  // inconnu d'un projet n'y est PAS consommé, l'essai suivant reste valide.
  const candidates = [
    { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY },
    { url: process.env.SUPABASE_URL_DEV, key: process.env.SUPABASE_SERVICE_ROLE_KEY_DEV },
  ].filter((c): c is { url: string; key: string } => !!c.url && !!c.key);

  if (candidates.length === 0) {
    return NextResponse.json(
      { ok: false, code: 'server_misconfig', message: 'Configuration serveur manquante.' },
      { status: 500 },
    );
  }

  let error: { code?: string; message?: string } | null = null;
  for (const { url, key } of candidates) {
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const res = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    error = res.error;
    if (!error) break;
  }

  if (error) {
    const expired = /expired|invalid|otp/i.test(`${error.code ?? ''} ${error.message ?? ''}`);
    return NextResponse.json(
      {
        ok: false,
        code: error.code ?? 'verify_failed',
        message: expired
          ? "Le lien a expiré. Reconnecte-toi dans l'app pour recevoir un nouveau lien."
          : 'Lien invalide ou expiré.',
      },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
