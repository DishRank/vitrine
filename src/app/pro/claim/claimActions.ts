'use server';

import { getSupabaseServer } from '@/lib/pro/supabaseServer';
import { rateLimit } from '@/lib/pro/rateLimit';
import { logProEvent } from '@/lib/pro/instrument';

/**
 * Claim web (lot 2). Portage du flux de ClaimRestaurantSheet :
 *  1. recherche du resto (ici : restos DÉJÀ en base — ceux qui ont des avis /
 *     un QR ; la matérialisation OSM d'un resto absent viendra ensuite),
 *  2. code email auto-vérifié via l'edge function `claim-verify` (invocable
 *     telle quelle avec le JWT web porté par la session cookies),
 *  3. fallback manuel (INSERT restaurant_claims, validé par un modérateur),
 *  4. re-dépôt après refus.
 *
 * Toutes les actions exigent une session (defense-in-depth au-delà du
 * middleware) et sont rate-limitées PAR USER : l'edge fn ne borne le code que
 * par (resto, requester), donc sans plafond par user un compte pourrait faire
 * spammer des emails « code » vers les contacts OSM de restos tiers, et poser
 * un claim pending — verrou global par resto — sur tous les restos non possédés.
 */

export interface RestaurantHit {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  claimed: boolean;
}

async function currentUserId(): Promise<string | null> {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/** Recherche par nom via l'RPC `search_restaurants` : insensible aux accents,
 *  tolérante aux fautes de frappe (trigram) et classée par pertinence (exact →
 *  préfixe → sous-chaîne → similarité). RLS SELECT publique — on n'expose qu'un
 *  booléen `claimed` (jamais l'owner_id d'un tiers). */
export async function searchRestaurantsAction(query: string): Promise<RestaurantHit[]> {
  const uid = await currentUserId();
  if (!uid) return [];
  const q = query.trim();
  if (q.length < 2) return [];
  const supabase = await getSupabaseServer();
  const { data } = await supabase.rpc('search_restaurants', { p_query: q, p_limit: 15 });
  return ((data ?? []) as {
    id: string;
    name: string;
    city: string | null;
    address: string | null;
    owner_id: string | null;
  }[]).map((r) => ({ id: r.id, name: r.name, city: r.city, address: r.address, claimed: !!r.owner_id }));
}

export interface ClaimVerifyResult {
  ok: boolean;
  error?: string;
  allowedDomain?: string;
  sentToMasked?: string;
  method?: 'email_osm' | 'email_domain';
  verified?: boolean;
  devCode?: string;
}

async function invokeClaimVerify(
  restaurantId: string,
  action: 'request' | 'verify',
  extra: { email?: string; code?: string }
): Promise<ClaimVerifyResult> {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.functions.invoke('claim-verify', {
    body: { action, restaurantId, ...extra },
  });
  if (error) return { ok: false, error: 'network' };
  return data as ClaimVerifyResult;
}

export async function requestClaimCodeAction(restaurantId: string, email?: string): Promise<ClaimVerifyResult> {
  const uid = await currentUserId();
  if (!uid) return { ok: false, error: 'unauthenticated' };
  // Plafond par user : ~15 demandes de code / heure, tous restos confondus
  // (borne l'amplification d'emails ; l'edge fn garde le cooldown 60 s par resto).
  const rl = await rateLimit(`pro:claim:code:${uid}`, 15, 3_600_000);
  if (!rl.ok) return { ok: false, error: 'cooldown' };
  return invokeClaimVerify(restaurantId, 'request', { email: email?.trim() || undefined });
}

export async function verifyClaimCodeAction(restaurantId: string, code: string): Promise<ClaimVerifyResult> {
  const uid = await currentUserId();
  if (!uid) return { ok: false, error: 'unauthenticated' };
  const res = await invokeClaimVerify(restaurantId, 'verify', { code: code.trim() });
  if (res.verified) {
    const supabase = await getSupabaseServer();
    await logProEvent(supabase, 'pro_claim_completed', restaurantId);
  }
  return res;
}

export interface ManualClaimResult {
  ok: boolean;
  error?: string;
}

/** Demande manuelle (INSERT restaurant_claims, RLS : requester = moi + resto non
 *  possédé). L'index partiel unique est PAR RESTO (pas par requester) : un
 *  conflit 23505 peut donc venir d'un AUTRE user — on distingue les deux. */
export async function submitManualClaimAction(
  restaurantId: string,
  message: string
): Promise<ManualClaimResult> {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Session expirée — reconnecte-toi.' };

  // Plafond par user : max 8 demandes manuelles / heure (anti-flood de la file
  // de modération + du verrou pending global-par-resto).
  const rl = await rateLimit(`pro:claim:manual:${user.id}`, 8, 3_600_000);
  if (!rl.ok) return { ok: false, error: 'Trop de demandes. Réessaie dans un moment.' };

  const { error } = await supabase.from('restaurant_claims').insert({
    restaurant_id: restaurantId,
    requester_id: user.id,
    verification_method: 'manual',
    message: message.trim() || null,
  });

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      // Conflit d'unicité (pending existant). Est-ce le MIEN ? (RLS SELECT ne me
      // montre que mes propres claims → présent = à moi, absent = à un tiers.)
      const { data: mine } = await supabase
        .from('restaurant_claims')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .eq('requester_id', user.id)
        .eq('status', 'pending')
        .maybeSingle();
      if (mine) return { ok: true }; // ma demande est déjà en attente → écran pending
      return { ok: false, error: 'Cet établissement fait déjà l’objet d’une demande en cours.' };
    }
    return { ok: false, error: 'Impossible d’enregistrer la demande. Réessaie.' };
  }
  return { ok: true };
}
