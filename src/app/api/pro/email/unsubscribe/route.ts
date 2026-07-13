/**
 * Désabonnement one-click du digest owner (lot 4.4) : `GET /api/pro/email/unsubscribe?u=<uid>&t=<hmac>`.
 * Lien HMAC-signé présent dans chaque email — pas de login requis (bonne
 * délivrabilité). Pose profiles.email_digest_opt_out = true via service-role.
 *
 * ⚠️ Cette route est sous /api → hors du matcher du proxy (pas de CSP nonce) :
 * on rend une page HTML minimale autonome.
 */
import { getSupabaseServiceClient } from '@/lib/supabase';
import { verifyUnsubToken } from '@/lib/pro/email';

export const runtime = 'nodejs';

function page(title: string, body: string, status: number): Response {
  const html =
    `<!doctype html><html lang="fr"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>` +
    `<body style="font-family:system-ui,sans-serif;max-width:480px;margin:60px auto;padding:0 20px;text-align:center;color:#2A241E">` +
    `<h2 style="color:#6C5CE7">DishRank Pro</h2>${body}</body></html>`;
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const uid = url.searchParams.get('u') || '';
  const token = url.searchParams.get('t') || '';

  if (!/^[0-9a-f-]{36}$/i.test(uid) || !verifyUnsubToken(uid, token)) {
    return page('Lien invalide', `<p>Ce lien de désabonnement est invalide ou a expiré.</p>`, 400);
  }

  try {
    const supabase = getSupabaseServiceClient();
    const { error } = await supabase.from('profiles').update({ email_digest_opt_out: true }).eq('id', uid);
    if (error) throw error;
  } catch (e) {
    console.error('[unsubscribe] failed:', (e as Error).message);
    return page('Erreur', `<p>Impossible d'enregistrer votre choix. Réessayez plus tard.</p>`, 500);
  }

  return page(
    'Désabonné',
    `<p>C'est fait — vous ne recevrez plus les rappels d'avis à répondre.</p>` +
      `<p style="color:#8C8478;font-size:13px;margin-top:16px">Vous pouvez réactiver ces rappels à tout moment depuis votre espace ` +
      `<a href="/pro/compte" style="color:#6C5CE7">compte</a>.</p>`,
    200
  );
}
