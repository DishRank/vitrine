import { cache } from 'react';
import { redirect } from 'next/navigation';
import { getSupabaseServer } from './supabaseServer';

/**
 * Données partagées de l'espace pro. Toutes les lectures passent par la session
 * de l'utilisateur (RLS `owner_id = auth.uid()`) — JAMAIS de service role ici.
 */

export interface OwnedRestaurant {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  photo_url: string | null;
  place_type: string | null;
  owner_id: string | null;
  subscription_tier: string | null;
  subscription_expires_at: string | null;
  description: string | null;
  accepts_groups: boolean;
  group_offer: string | null;
  phone: string | null;
  website: string | null;
  menu_url: string | null;
  instagram: string | null;
  reservation_url: string | null;
  price_level: number | null;
  cuisines: string[] | null;
  opening_hours_raw: string | null;
  osm_id: number | null;
  auto_thank_enabled: boolean;
  thank_template: string | null;
  menu_theme: unknown;
  menu_languages: string[] | null;
  /** Logo de l'établissement — colonne dédiée depuis la mig.124 (identité, pas
   *  thème). L'affichage en tête du menu reste piloté par menu_theme.show_logo. */
  logo_url: string | null;
  subscription_source: string | null;
  subscription_status: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

const LISTING_COLS =
  'id, name, city, address, photo_url, place_type, owner_id, subscription_tier, subscription_expires_at, ' +
  'description, accepts_groups, group_offer, phone, website, menu_url, instagram, reservation_url, ' +
  'price_level, cuisines, opening_hours_raw, osm_id, auto_thank_enabled, thank_template, menu_theme, menu_languages, logo_url, ' +
  'subscription_source, subscription_status, stripe_customer_id, stripe_subscription_id';

/** Identité minimale suffisante pour /pro (filtres owner_id + affichage). */
export interface ProUser {
  id: string;
  email: string | null;
}

/**
 * Contexte auth déduplifié par requête (`cache()`). getClaims (au lieu de
 * getUser) : validation LOCALE du JWT via les clés asymétriques ES256 (vérif de
 * signature JWKS cachée) → ZÉRO appel réseau à GoTrue par rendu de page. L'id
 * vient du token signé (infalsifiable) ; la RLS reste le vrai garde en base.
 */
const getAuthContext = cache(async () => {
  const supabase = await getSupabaseServer();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims as { sub?: string; email?: string } | undefined;
  const user: ProUser | null = claims?.sub ? { id: claims.sub, email: claims.email ?? null } : null;
  return { supabase, user };
});

/** Le user courant, ou redirect login. */
export async function requireUser() {
  const { supabase, user } = await getAuthContext();
  if (!user) redirect('/pro/login');
  return { supabase, user };
}

/**
 * Vérifie que l'utilisateur possède ce resto — renvoie {supabase, user} ou null.
 * Filet applicatif au-dessus de la RLS (qui bloque déjà les écritures
 * cross-owner) : permet un message d'erreur clair dans les Server Actions.
 */
export async function assertOwner(restaurantId: string) {
  const { supabase, user } = await getAuthContext();
  if (!user) return null;
  const { data } = await supabase
    .from('restaurants')
    .select('owner_id')
    .eq('id', restaurantId)
    .maybeSingle();
  return (data as { owner_id: string | null } | null)?.owner_id === user.id ? { supabase, user } : null;
}

/** Apparences enregistrées d'un établissement (bibliothèque, mig.159). Chargée
 *  côté serveur pour que l'éditeur s'ouvre déjà peuplé — même patron que
 *  `initial` pour l'apparence active. La RLS borne déjà au propriétaire. */
export async function getMenuThemeLibrary(restaurantId: string) {
  const { supabase, user } = await getAuthContext();
  if (!user) return [];
  const { data } = await supabase
    .from('restaurant_menu_themes')
    .select('id, name, config, updated_at')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false });
  return (data ?? []) as { id: string; name: string; config: unknown; updated_at: string }[];
}

/** Premium actif ? (miroir de `has_active_premium` — expires NULL = à vie). */
export function isPremium(r: Pick<OwnedRestaurant, 'subscription_tier' | 'subscription_expires_at'>): boolean {
  return (
    r.subscription_tier === 'premium' &&
    (!r.subscription_expires_at || new Date(r.subscription_expires_at) > new Date())
  );
}

/** Premium OFFERT (comp) — pas un abonnement Stripe payant. Founder = à vie ;
 *  admin = comp de lancement (v1 « premium offert »). Ces lignes sont immunisées
 *  contre le webhook Stripe (apply_stripe_subscription les refuse). */
export function isComped(r: Pick<OwnedRestaurant, 'subscription_source'>): boolean {
  return r.subscription_source === 'founder_comp' || r.subscription_source === 'admin';
}

/** Les établissements que je possède (drive le sélecteur + la home). */
export async function getMyRestaurants(): Promise<OwnedRestaurant[]> {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from('restaurants')
    .select(LISTING_COLS)
    .eq('owner_id', user.id)
    .order('name');
  return (data ?? []) as unknown as OwnedRestaurant[];
}

/**
 * Nombre d'avis publiés SANS réponse — la tâche récurrente n°1 de l'owner.
 * `cache()` : partagé par le layout (pastille onglet) et le cockpit d'accueil
 * dans un même rendu. 2 requêtes légères (ids seulement).
 */
export const getPendingReviewCount = cache(async (id: string): Promise<number> => {
  const { supabase } = await requireUser();
  const [{ data: reviewIds }, { data: repliedIds }] = await Promise.all([
    supabase.from('reviews').select('id').eq('restaurant_id', id).eq('pending_moderation', false),
    supabase.from('review_replies').select('review_id').eq('restaurant_id', id),
  ]);
  const replied = new Set(((repliedIds ?? []) as { review_id: string }[]).map((r) => r.review_id));
  return ((reviewIds ?? []) as { id: string }[]).filter((r) => !replied.has(r.id)).length;
});

/**
 * Comme getPendingReviewCount mais pour TOUS les restos d'un coup (pastille
 * « Avis » de la sidebar + point de notification, qui vivent au-dessus du
 * segment [id] et ne connaissent donc pas le resto actif côté serveur).
 */
export async function getPendingReviewCounts(ids: string[]): Promise<Record<string, number>> {
  if (ids.length === 0) return {};
  const { supabase } = await requireUser();
  const [{ data: reviews }, { data: replies }] = await Promise.all([
    supabase.from('reviews').select('id, restaurant_id').in('restaurant_id', ids).eq('pending_moderation', false),
    supabase.from('review_replies').select('review_id').in('restaurant_id', ids),
  ]);
  const replied = new Set(((replies ?? []) as { review_id: string }[]).map((r) => r.review_id));
  const counts: Record<string, number> = {};
  for (const r of (reviews ?? []) as { id: string; restaurant_id: string }[]) {
    if (!replied.has(r.id)) counts[r.restaurant_id] = (counts[r.restaurant_id] ?? 0) + 1;
  }
  return counts;
}

/**
 * Journal de notifications métier de l'owner (migration 130).
 *
 * À NE PAS confondre avec `getPendingReviewCounts` : celui-ci est une liste de
 * travail (« combien d'avis restent à répondre ? »), recalculée à chaque rendu ;
 * ci-dessous c'est un journal d'ÉVÉNEMENTS horodatés, avec un état lu/non-lu
 * persistant, partagé avec la feuille de notifications de l'app mobile.
 *
 * La lecture passe par la session SSR de l'owner : la policy
 * « Voir ses notifications » (`auth.uid() = user_id`) suffit, aucun service
 * role n'est nécessaire — et n'en utilisez pas ici, ce serait un contournement
 * de RLS sur une donnée strictement personnelle.
 */
export interface OwnerNotification {
  id: string;
  type: string;
  restaurant_id: string;
  review_id: string | null;
  read: boolean;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

export async function getOwnerNotifications(
  ids: string[],
  limit = 30
): Promise<OwnerNotification[]> {
  if (ids.length === 0) return [];
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from('notifications')
    .select('id, type, restaurant_id, review_id, read, created_at, metadata')
    .in('restaurant_id', ids)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as unknown as OwnerNotification[];
}

/**
 * Charge un resto possédé, ou redirige. La RLS SELECT est publique (n'importe
 * quel resto est lisible), donc on VÉRIFIE explicitement la possession :
 * `owner_id = user.id`. Renvoie aussi la session pour les appels suivants.
 */
export const requireOwnedRestaurant = cache(async (id: string): Promise<OwnedRestaurant> => {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from('restaurants')
    .select(LISTING_COLS)
    .eq('id', id)
    .maybeSingle();
  const resto = data as unknown as OwnedRestaurant | null;
  if (!resto || resto.owner_id !== user.id) redirect('/pro/espace');
  return resto;
});
