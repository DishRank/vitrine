import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { getSupabaseServer } from '@/lib/pro/supabaseServer';

/**
 * Point d'atterrissage des flows auth web (lot 1 espace-pro-web) :
 *  • OAuth Google/Apple (PKCE) : GoTrue redirige ici avec `?code=` → échange
 *    contre une session (cookies posés par le client @supabase/ssr).
 *  • Emails signup/recovery dont le template émet `token_hash` : vérifiés via
 *    verifyOtp — la session résultante est posée en cookies elle aussi.
 *  • Erreurs GoTrue (`?error_description=`) : renvoyées lisibles sur /pro/login.
 *
 * `next` est validé (chemin relatif interne uniquement — anti open-redirect).
 * GET sans effet de bord au sens CSRF : poser une session via un code à usage
 * unique n'est pas exploitable cross-site (le code est déjà lié au verifier
 * PKCE en cookie first-party).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  // Un OAuth annulé peut n'envoyer que `?error=access_denied` sans
  // error_description — traiter les deux.
  const errorDescription = url.searchParams.get('error_description') || url.searchParams.get('error');

  // Anti open-redirect : chemin relatif interne uniquement, backslash rejeté
  // (le parseur WHATWG normalise `\` en `/` → `/\evil.com` sortirait du
  // domaine — audit M1).
  const rawNext = url.searchParams.get('next') ?? '/pro/espace';
  const next =
    rawNext.startsWith('/') && !rawNext.startsWith('//') && !rawNext.includes('\\')
      ? rawNext
      : '/pro/espace';

  const fail = (message: string) =>
    NextResponse.redirect(
      new URL(`/pro/login?error=${encodeURIComponent(message)}`, url.origin)
    );

  // Ne JAMAIS refléter error_description (paramètre arbitraire → message de
  // phishing affiché sur notre page de login — audit B2). Les codes GoTrue
  // connus reçoivent un message dédié, le reste un générique.
  if (errorDescription) {
    const expired = /expired|invalid/i.test(errorDescription);
    return fail(
      expired
        ? 'Le lien a expiré — redemande un email.'
        : 'Connexion impossible. Réessaie.'
    );
  }

  const supabase = await getSupabaseServer();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
    return fail('Connexion impossible — le lien a peut-être expiré. Réessaie.');
  }

  if (tokenHash && type) {
    // Risque résiduel documenté (audit B3) : contrairement au chemin `code`
    // (PKCE, lié au verifier cookie first-party), un token_hash n'a pas de
    // state anti login-CSRF — un attaquant pourrait faire ouvrir SON lien
    // recovery à une victime et la connecter dans SON compte. Impact faible
    // en B2B ; le template email recommandé (token_hash) reste le compromis
    // robuste cross-browser. Ne pas élargir ce chemin à d'autres usages.
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
    return fail('Lien invalide ou expiré — redemande un email.');
  }

  return fail('Lien incomplet.');
}
