'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServer } from '@/lib/pro/supabaseServer';
import { mapAuthErrorFr } from '@/lib/pro/authErrors';

export interface ListingActionState {
  error?: string;
  ok?: boolean;
}

/** Trim → null si vide (les colonnes texte nullable préfèrent NULL au ''). */
function nn(v: FormDataEntryValue | null): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  return s === '' ? null : s;
}

function toUrl(v: string | null): string | null {
  if (!v) return null;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

/**
 * Met à jour les colonnes owner-éditables de la fiche (miroir de
 * `useUpdateOwnerListing`). La RLS « Owner édite sa fiche » autorise, et le
 * trigger `guard_restaurant_protected_cols` rejette toute tentative de toucher
 * les colonnes protégées (subscription, owner_id, is_verified) — inutile de les
 * lister, on ne les touche pas. Le thème (premium) est un autre écran, gardé
 * serveur par le trigger 101.
 */
export async function updateListingAction(
  restaurantId: string,
  _prev: ListingActionState,
  formData: FormData
): Promise<ListingActionState> {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Session expirée — reconnecte-toi.' };

  const priceRaw = formData.get('price_level');
  const priceLevel =
    typeof priceRaw === 'string' && priceRaw !== '' ? Math.min(4, Math.max(1, Number(priceRaw))) : null;

  const cuisinesRaw = nn(formData.get('cuisines'));
  const cuisines = cuisinesRaw
    ? cuisinesRaw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean).slice(0, 8)
    : [];

  const patch = {
    description: nn(formData.get('description')),
    accepts_groups: formData.get('accepts_groups') === 'on',
    group_offer: nn(formData.get('group_offer')),
    phone: nn(formData.get('phone')),
    website: toUrl(nn(formData.get('website'))),
    reservation_url: toUrl(nn(formData.get('reservation_url'))),
    menu_url: toUrl(nn(formData.get('menu_url'))),
    instagram: nn(formData.get('instagram')),
    price_level: priceLevel,
    cuisines,
  };

  // La possession est re-vérifiée par la RLS UPDATE (owner_id = auth.uid()) :
  // un .eq('id') qui ne matche aucune ligne autorisée renvoie 0 ligne sans
  // erreur. On ajoute le filtre owner_id pour un message clair.
  const { error, count } = await supabase
    .from('restaurants')
    .update(patch, { count: 'exact' })
    .eq('id', restaurantId)
    .eq('owner_id', user.id);

  if (error) return { error: mapAuthErrorFr(error) };
  if (!count) return { error: "Tu n'es pas le propriétaire de cet établissement." };

  revalidatePath(`/pro/r/${restaurantId}`);
  return { ok: true };
}
