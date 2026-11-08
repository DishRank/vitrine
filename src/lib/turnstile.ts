/**
 * Cloudflare Turnstile pour la notation SANS COMPTE du menu (/api/menu/rate).
 *
 * Widget DÉDIÉ, distinct de celui de /pro (dont le secret vit dans le
 * dashboard Supabase Auth, pas ici) : mode « Invisible » côté Cloudflare, et
 * son secret doit être connu de NOTRE serveur pour appeler siteverify.
 *
 * Activation = la PAIRE complète. Clé publique sans secret (ou l'inverse) ⇒
 * ni widget sur le menu, ni vérification : un déploiement à moitié configuré
 * ne doit jamais casser la notation. On le dit une fois dans les logs.
 *
 * ⚠️ Le widget charge une iframe challenges.cloudflare.com : la CSP de
 * /menu/* et /restaurant/* (src/proxy.ts) doit l'autoriser (frame-src +
 * connect-src) AVANT de poser ces variables, sinon aucun jeton n'est émis et
 * toute notation invitée est refusée.
 */

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** Action déclarée au rendu du widget et revérifiée ici : un jeton émis pour
 *  un autre usage du même widget ne passe pas. */
export const MENU_RATE_ACTION = 'menu_rate';

function config(): { siteKey: string; secret: string } | null {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_MENU_SITE_KEY;
  const secret = process.env.TURNSTILE_MENU_SECRET_KEY;
  return siteKey && secret ? { siteKey, secret } : null;
}

/** Clé publique à passer au widget, UNIQUEMENT si la vérification serveur est
 *  active elle aussi. */
export function menuTurnstileSiteKey(): string | undefined {
  return config()?.siteKey;
}

let warnedDisabled = false;

/**
 * - `ok`          : jeton valide ;
 * - `skipped`     : Turnstile non configuré, pas de vérification ;
 * - `rejected`    : jeton absent, invalide, expiré ou déjà utilisé ;
 * - `unavailable` : Cloudflare injoignable. L'appelant laisse passer (les
 *   plafonds par IP et en base tiennent toujours) : une panne chez Cloudflare
 *   ne doit pas couper la notation, et un attaquant ne peut pas la provoquer.
 */
export type TurnstileVerdict = 'ok' | 'skipped' | 'rejected' | 'unavailable';

export async function verifyMenuTurnstile(token: unknown, ip: string): Promise<TurnstileVerdict> {
  const cfg = config();
  if (!cfg) {
    if (!warnedDisabled) {
      warnedDisabled = true;
      console.warn(
        '[turnstile] notation invitée SANS vérification anti-robot : ' +
          'NEXT_PUBLIC_TURNSTILE_MENU_SITE_KEY et/ou TURNSTILE_MENU_SECRET_KEY absentes.'
      );
    }
    return 'skipped';
  }

  // Un jeton Turnstile fait au plus 2048 caractères.
  if (typeof token !== 'string' || !token || token.length > 2048) return 'rejected';

  const body = new URLSearchParams({ secret: cfg.secret, response: token });
  if (ip && ip !== 'unknown') body.set('remoteip', ip);

  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      console.error('[turnstile] siteverify HTTP', res.status);
      return 'unavailable';
    }
    const data = (await res.json()) as {
      success?: boolean;
      action?: string;
      'error-codes'?: string[];
    };
    if (!data.success) {
      const codes = data['error-codes'] ?? [];
      // Souci côté Cloudflare ou secret mal saisi dans Vercel : ce n'est pas
      // un jeton forgé, et refuser casserait TOUTES les notations.
      if (codes.includes('internal-error')) return 'unavailable';
      if (codes.includes('invalid-input-secret')) {
        console.error('[turnstile] TURNSTILE_MENU_SECRET_KEY refusée par Cloudflare.');
        return 'unavailable';
      }
      // Codes d'erreur seuls (jamais le jeton) : une paire de clés croisée ou
      // un hostname manquant dans le widget (www.dishrank.fr) se lit ici.
      console.warn('[turnstile] jeton refusé par siteverify :', codes.join(',') || 'aucun code');
      return 'rejected';
    }
    if (data.action && data.action !== MENU_RATE_ACTION) {
      console.warn('[turnstile] jeton refusé : action inattendue', data.action);
      return 'rejected';
    }
    return 'ok';
  } catch (e) {
    console.error('[turnstile] siteverify injoignable:', (e as Error).message);
    return 'unavailable';
  }
}
