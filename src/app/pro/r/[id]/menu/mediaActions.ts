'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { assertOwner } from '@/lib/pro/data';
import { normalizeMenuTheme, isDefaultTheme, type MenuThemeConfig } from './themeConstants';

export interface MediaActionState {
  error?: string;
  ok?: boolean;
}

function revalidateMenu(restaurantId: string) {
  revalidateTag(`menu:${restaurantId}`, 'max');
  revalidatePath(`/pro/r/${restaurantId}/menu`);
  revalidatePath(`/pro/r/${restaurantId}/menu/apparence`);
}

/** Une URL storage de NOTRE projet, bucket dish-photos, DANS le dossier de
 *  l'uploadeur (`<uid>/…`) et en .webp (convention uploadMenuImage). Défense en
 *  profondeur : empêche de référencer l'objet d'un autre user ou une extension
 *  arbitraire. null = suppression. */
function validStorageUrl(url: string | null, uid: string): { ok: boolean; value: string | null } {
  if (url == null || url === '') return { ok: true, value: null };
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return { ok: false, value: null };
  const prefix = `${base}/storage/v1/object/public/dish-photos/${uid}/`;
  // Autorise `?v=timestamp` en suffixe (bust cache) ; exige .webp avant le query.
  if (url.startsWith(prefix) && url.length < 500 && /\.webp(\?|$)/.test(url)) {
    return { ok: true, value: url };
  }
  return { ok: false, value: null };
}

// ── Photo d'un plat ───────────────────────────────────────────────────────────
export async function setItemPhotoAction(
  restaurantId: string,
  itemId: string,
  photoUrl: string | null
): Promise<MediaActionState> {
  const ctx = await assertOwner(restaurantId);
  if (!ctx) return { error: "Tu n'es pas le propriétaire de cet établissement." };
  const v = validStorageUrl(photoUrl, ctx.user.id);
  if (!v.ok) return { error: 'URL de photo invalide.' };

  const { error } = await ctx.supabase
    .from('menu_items')
    .update({ photo_url: v.value })
    .eq('id', itemId)
    .eq('restaurant_id', restaurantId);
  if (error) return { error: 'Enregistrement impossible.' };
  revalidateMenu(restaurantId);
  return { ok: true };
}

// ── Thème du menu (PREMIUM — trigger 101) ─────────────────────────────────────
export async function updateThemeAction(
  restaurantId: string,
  theme: MenuThemeConfig
): Promise<MediaActionState> {
  const ctx = await assertOwner(restaurantId);
  if (!ctx) return { error: "Tu n'es pas le propriétaire de cet établissement." };

  const t = normalizeMenuTheme(theme);
  // Valider le logo (URL storage dans le dossier de l'owner) si présent.
  const logo = validStorageUrl(t.logo_url, ctx.user.id);
  if (!logo.ok) return { error: 'Logo invalide.' };
  t.logo_url = logo.value;

  // Reset au thème par défaut = on écrit {} (libre, non premium). Sinon on écrit
  // la config ; le trigger 101 lève THEME_PREMIUM si le resto n'est pas premium.
  const payload = isDefaultTheme(t) ? {} : t;

  const { error } = await ctx.supabase
    .from('restaurants')
    .update({ menu_theme: payload })
    .eq('id', restaurantId)
    .eq('owner_id', ctx.user.id);
  if (error) {
    if ((error.message ?? '').toUpperCase().includes('THEME_PREMIUM'))
      return { error: "La personnalisation de l'apparence est réservée au forfait Premium." };
    return { error: 'Enregistrement impossible.' };
  }
  revalidateMenu(restaurantId);
  return { ok: true };
}
