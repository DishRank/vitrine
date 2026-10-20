'use server';

import { headers } from 'next/headers';
import { revalidateTag } from 'next/cache';
import { after } from 'next/server';
import { flushInviteAlerts } from '@/lib/pro/inviteAlerts';
import { getSupabaseServer } from '@/lib/pro/supabaseServer';
import { rateLimit } from '@/lib/pro/rateLimit';
import { INVITE_TOKEN_RE, UUID_RE, isAllergenKey, type AllergenKey } from '@/lib/pro/invite';

/**
 * Server Actions de la page « tableau des allergènes » (mig. 196).
 *
 * Aucune session requise : le jeton de l'URL est la clé, vérifié en base par
 * les RPC SECURITY DEFINER (invite_*). La seule action qui publie quoi que ce
 * soit (invite_apply) exige EN PLUS que l'utilisateur connecté soit le
 * propriétaire vérifié de la fiche — contrôlé côté base, pas ici.
 *
 * Server Actions = vérification d'Origin native (anti-CSRF). Rate limit par IP.
 */

export interface InviteActionResult {
  ok: boolean;
  error?: string;
  confirmedCount?: number;
  count?: number;
}

async function clientIp(): Promise<string> {
  const h = await headers();
  const real = h.get('x-real-ip');
  if (real) return real.trim();
  const xff = h.get('x-forwarded-for');
  if (xff) {
    const parts = xff.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return 'unknown';
}

async function limited(kind: string, max: number, windowMs: number): Promise<boolean> {
  const ip = await clientIp();
  const rl = await rateLimit(`pro:allergenes:${kind}:${ip}`, max, windowMs);
  return !rl.ok;
}

const ERRORS: Record<string, string> = {
  INVITE_NOT_FOUND: 'Ce lien n’est plus valide.',
  MENU_REMOVED: 'Votre carte a été retirée : ce tableau n’est plus modifiable.',
  ITEM_NOT_IN_MENU: 'Ce plat ne fait plus partie de votre carte.',
  UNKNOWN_ALLERGEN: 'Allergène inconnu.',
  NOT_AUTHENTICATED: 'Connectez-vous pour publier.',
  NOT_OWNER: 'Seul le compte qui gère cette fiche peut publier.',
  RESTAURANT_CLAIMED: 'Cette fiche est gérée depuis l’espace restaurateur.',
};

function mapError(message: string | undefined): string {
  const code = Object.keys(ERRORS).find((k) => message?.includes(k));
  return code ? ERRORS[code] : 'Une erreur est survenue. Réessayez dans un instant.';
}

async function restaurantIdOf(token: string): Promise<string | null> {
  const supabase = await getSupabaseServer();
  const { data } = await supabase.rpc('invite_get', { p_token: token });
  const id = (data as { restaurant?: { id?: string } } | null)?.restaurant?.id;
  return id && UUID_RE.test(id) ? id : null;
}

/** Ouverture, impression, clic « revendiquer » : alimente l'entonnoir du test. */
export async function trackInviteEvent(token: string, event: 'open' | 'print' | 'claim_click'): Promise<void> {
  if (!INVITE_TOKEN_RE.test(token)) return;
  if (!['open', 'print', 'claim_click'].includes(event)) return;
  if (await limited('event', 60, 60_000)) return;
  const supabase = await getSupabaseServer();
  const { error } = await supabase.rpc('invite_event', { p_token: token, p_event: event });
  if (!error) after(flushInviteAlerts);
}

/**
 * Enregistre les allergènes d'un plat. `confirmed` = le restaurateur a vérifié
 * CE plat ; `excluded` = la ligne relevée n'est pas un plat (écartée du tableau).
 */
export async function saveDishAllergens(
  token: string,
  itemId: string,
  allergens: string[],
  confirmed: boolean,
  excluded = false
): Promise<InviteActionResult> {
  if (!INVITE_TOKEN_RE.test(token) || !UUID_RE.test(itemId)) return { ok: false, error: 'Lien invalide.' };
  if (!Array.isArray(allergens) || allergens.length > 14 || !allergens.every(isAllergenKey)) {
    return { ok: false, error: 'Allergène inconnu.' };
  }
  if (await limited('save', 400, 600_000)) return { ok: false, error: 'Trop de modifications. Réessayez dans quelques minutes.' };

  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.rpc('invite_save_item', {
    p_token: token,
    p_item_id: itemId,
    p_allergens: allergens as AllergenKey[],
    p_confirmed: !!confirmed,
    p_excluded: !!excluded,
  });
  if (error) return { ok: false, error: mapError(error.message) };
  after(flushInviteAlerts);
  return { ok: true, confirmedCount: Number(data ?? 0) };
}

/** Publie les plats vérifiés sur la carte en ligne — propriétaire vérifié uniquement (contrôlé en base). */
export async function publishAllergens(token: string): Promise<InviteActionResult> {
  if (!INVITE_TOKEN_RE.test(token)) return { ok: false, error: 'Lien invalide.' };
  if (await limited('publish', 10, 600_000)) return { ok: false, error: 'Réessayez dans quelques minutes.' };
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.rpc('invite_apply', { p_token: token });
  if (error) return { ok: false, error: mapError(error.message) };
  const rid = await restaurantIdOf(token);
  if (rid) revalidateTag(`menu:${rid}`, 'max');
  after(flushInviteAlerts);
  return { ok: true, count: Number(data ?? 0) };
}

/** « Ne plus me contacter » : la machine d'envoi n'écrira plus à ce restaurant. */
export async function stopContact(token: string): Promise<InviteActionResult> {
  if (!INVITE_TOKEN_RE.test(token)) return { ok: false, error: 'Lien invalide.' };
  if (await limited('optout', 10, 600_000)) return { ok: false, error: 'Réessayez dans quelques minutes.' };
  const supabase = await getSupabaseServer();
  const { error } = await supabase.rpc('invite_contact_opt_out', { p_token: token });
  if (error) return { ok: false, error: mapError(error.message) };
  after(flushInviteAlerts);
  return { ok: true };
}

/** « Retirer ma carte » : dépublie la carte relevée, interdit son ré-import, coupe le contact. */
export async function removeMenu(token: string): Promise<InviteActionResult> {
  if (!INVITE_TOKEN_RE.test(token)) return { ok: false, error: 'Lien invalide.' };
  if (await limited('remove', 5, 600_000)) return { ok: false, error: 'Réessayez dans quelques minutes.' };
  const rid = await restaurantIdOf(token);
  const supabase = await getSupabaseServer();
  const { error } = await supabase.rpc('invite_remove_menu', { p_token: token });
  if (error) return { ok: false, error: mapError(error.message) };
  if (rid) revalidateTag(`menu:${rid}`, 'max');
  after(flushInviteAlerts);
  return { ok: true };
}
