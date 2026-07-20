import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

/**
 * Identité d'APPAREIL pour la notation sans compte depuis le menu web.
 *
 * Remplace la session anonyme Supabase (`signInAnonymously`) qui était le choix
 * initial. Le raisonnement du changement, pour qui relira ceci :
 *
 *  - la session anonyme créait une vraie ligne `auth.users` par appareil →
 *    facturation MAU, table qui gonfle, et une identité que l'attaquant peut
 *    renouveler à volonté depuis un script ;
 *  - surtout, elle laissait le client parler DIRECTEMENT à PostgREST, donc le
 *    serveur ne voyait ni le restaurant réellement scanné ni l'IP — les deux
 *    seules informations qui permettent un garde-fou honnête.
 *
 * Ici l'identité est un simple uuid signé (HMAC-SHA256) posé en cookie
 * httpOnly : infalsifiable côté client, invisible pour JS, et purement local à
 * DishRank. Elle ne sert QU'À la déduplication (cooldown 30 j par plat) — elle
 * n'authentifie rien et ne donne aucun droit.
 *
 * ⚠️ `GUEST_COOKIE_SECRET` est OBLIGATOIRE. Pas de repli silencieux sur une
 * valeur en dur : un secret deviné rendrait le cooldown contournable en
 * forgeant des cookies. Sans secret, la notation invité est simplement
 * indisponible (échec fermé).
 */

export const GUEST_COOKIE = 'dishrank_guest';
/** 1 an : la dédup n'a de sens que si l'identité survit largement au cooldown 30 j. */
export const GUEST_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function secret(): string | null {
  const s = process.env.GUEST_COOKIE_SECRET;
  return s && s.length >= 16 ? s : null;
}

function sign(id: string, key: string): string {
  return createHmac('sha256', key).update(id).digest('base64url');
}

/** Vérifie la signature en temps constant (une comparaison naïve fuiterait le
 *  secret octet par octet). Renvoie l'uuid, ou null si le cookie est absent,
 *  malformé ou signé avec une autre clé. */
export function readGuestId(cookieValue: string | undefined): string | null {
  const key = secret();
  if (!key || !cookieValue) return null;
  const dot = cookieValue.lastIndexOf('.');
  if (dot <= 0) return null;
  const id = cookieValue.slice(0, dot);
  const mac = cookieValue.slice(dot + 1);
  if (!UUID_RE.test(id)) return null;
  const expected = sign(id, key);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  return timingSafeEqual(a, b) ? id : null;
}

/** Nouvelle identité d'appareil + sa valeur de cookie signée. */
export function issueGuestId(): { id: string; cookie: string } | null {
  const key = secret();
  if (!key) return null;
  const id = randomUUID();
  return { id, cookie: `${id}.${sign(id, key)}` };
}
