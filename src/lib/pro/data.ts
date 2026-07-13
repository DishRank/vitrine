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
}

const LISTING_COLS =
  'id, name, city, address, photo_url, place_type, owner_id, subscription_tier, subscription_expires_at, ' +
  'description, accepts_groups, group_offer, phone, website, menu_url, instagram, reservation_url, ' +
  'price_level, cuisines, opening_hours_raw, osm_id';

/**
 * Contexte auth déduplifié par requête (`cache()`) : un SEUL getUser réseau
 * même si le layout /pro/r, le layout [id] et la page l'appellent tous.
 */
const getAuthContext = cache(async () => {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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

/** Premium actif ? (miroir de `has_active_premium` — expires NULL = à vie). */
export function isPremium(r: Pick<OwnedRestaurant, 'subscription_tier' | 'subscription_expires_at'>): boolean {
  return (
    r.subscription_tier === 'premium' &&
    (!r.subscription_expires_at || new Date(r.subscription_expires_at) > new Date())
  );
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
  if (!resto || resto.owner_id !== user.id) redirect('/pro');
  return resto;
});
