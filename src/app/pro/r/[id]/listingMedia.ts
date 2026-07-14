'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { assertOwner } from '@/lib/pro/data';
import { normalizeMenuTheme, isDefaultTheme } from './menu/themeConstants';

/**
 * Écritures média de la FICHE établissement :
 *  - image vitrine (`restaurants.photo_url`) : GRATUIT. Soit une photo envoyée
 *    par l'owner (bucket dish-photos, son dossier), soit une photo d'AVIS de ce
 *    resto (on la référence telle quelle — dans le dossier du client, donc on
 *    vérifie qu'elle correspond bien à un avis publié de l'établissement).
 *  - logo : c'est LE logo unique du resto, stocké dans `menu_theme.logo_url`
 *    (le même que celui du menu). PREMIUM — le trigger 101 lève THEME_PREMIUM
 *    quand un thème non-défaut (logo inclus) est écrit par un resto gratuit.
 *
 * Miroir de l'app (OwnerManageSheet cover + MenuThemeSheet logo) : même bucket,
 * même convention .webp, le picker d'avis copie juste la review.photo_url.
 */

export interface ListingMediaState {
  error?: string;
  ok?: boolean;
}

/** URL storage publique dans le dossier de CET owner, en .webp (défense en
 *  profondeur : pas l'objet d'un autre user, pas d'extension arbitraire). */
function ownerStorageUrl(url: string, uid: string): boolean {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return false;
  const prefix = `${base}/storage/v1/object/public/dish-photos/${uid}/`;
  return url.startsWith(prefix) && url.length < 500 && /\.webp(\?|$)/.test(url);
}

function revalidateListing(restaurantId: string) {
  revalidateTag(`menu:${restaurantId}`, 'max');
  revalidatePath(`/pro/r/${restaurantId}`);
  revalidatePath(`/pro/r/${restaurantId}/fiche`);
}

/** Image vitrine (couverture). `null` = retirer. */
export async function setListingCoverAction(
  restaurantId: string,
  photoUrl: string | null
): Promise<ListingMediaState> {
  const ctx = await assertOwner(restaurantId);
  if (!ctx) return { error: "Tu n'es pas le propriétaire de cet établissement." };
  const { supabase, user } = ctx;

  let value: string | null = null;
  const url = photoUrl?.trim() ?? '';
  if (url) {
    if (ownerStorageUrl(url, user.id)) {
      value = url; // envoi de l'owner
    } else {
      // Sinon : doit être une photo d'un avis PUBLIÉ de ce resto (le picker
      // copie review.photo_url verbatim → correspondance exacte attendue).
      const { data } = await supabase
        .from('reviews')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .eq('pending_moderation', false)
        .eq('photo_url', url)
        .limit(1);
      if (!data || data.length === 0) return { error: 'Image invalide.' };
      value = url;
    }
  }

  const { error, count } = await supabase
    .from('restaurants')
    .update({ photo_url: value }, { count: 'exact' })
    .eq('id', restaurantId)
    .eq('owner_id', user.id);
  if (error || !count) return { error: 'Enregistrement impossible.' };

  revalidateListing(restaurantId);
  return { ok: true };
}

/** Logo unique du resto (= `menu_theme.logo_url`, aussi affiché en tête du
 *  menu). `null` = retirer (gratuit). Ajouter/changer = PREMIUM. */
export async function setListingLogoAction(
  restaurantId: string,
  logoUrl: string | null
): Promise<ListingMediaState> {
  const ctx = await assertOwner(restaurantId);
  if (!ctx) return { error: "Tu n'es pas le propriétaire de cet établissement." };
  const { supabase, user } = ctx;

  const url = logoUrl?.trim() ?? '';
  if (url && !ownerStorageUrl(url, user.id)) return { error: 'Logo invalide.' };

  // Lire le thème courant, y fusionner le logo, réécrire (le trigger 101 gate
  // le premium ; retirer le logo d'un thème par ailleurs par défaut reste
  // gratuit car on réécrit alors {}).
  const { data: row } = await supabase
    .from('restaurants')
    .select('menu_theme')
    .eq('id', restaurantId)
    .maybeSingle();
  const theme = normalizeMenuTheme((row as { menu_theme?: unknown } | null)?.menu_theme);
  theme.logo_url = url || null;
  const payload = isDefaultTheme(theme) ? {} : theme;

  const { error } = await supabase
    .from('restaurants')
    .update({ menu_theme: payload })
    .eq('id', restaurantId)
    .eq('owner_id', user.id);
  if (error) {
    if ((error.message ?? '').toUpperCase().includes('THEME_PREMIUM'))
      return { error: 'Le logo fait partie de la personnalisation Premium.' };
    return { error: 'Enregistrement impossible.' };
  }

  revalidateListing(restaurantId);
  revalidatePath(`/pro/r/${restaurantId}/menu`);
  revalidatePath(`/pro/r/${restaurantId}/menu/apparence`);
  return { ok: true };
}
