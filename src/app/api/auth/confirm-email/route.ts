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

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json(
      { ok: false, code: 'server_misconfig', message: 'Configuration serveur manquante.' },
      { status: 500 },
    );
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

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
