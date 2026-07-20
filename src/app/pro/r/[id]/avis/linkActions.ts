'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { assertOwner } from '@/lib/pro/data';
import { logProEvent } from '@/lib/pro/instrument';

/**
 * Association avis ↔ plat du menu (mig 112/113). Trois gestes pour l'owner :
 *  1. RATTACHER un avis orphelin à un plat existant (RPC link_review_to_menu_item
 *     — seul chemin d'écriture, la RLS UPDATE de reviews est author-only). Le
 *     geste inverse — DÉTACHER — n'existe pas (mig.130) : un avis rattaché
 *     compte dans la note du plat, pouvoir l'en retirer serait un bouton
 *     « effacer ce 1/5 de ma moyenne ». Une erreur d'association se corrige en
 *     repointant l'avis sur le bon plat ;
 *  2. CRÉER le plat à partir du nom de l'avis (bootstrappe la carte + une section
 *     « À classer » si le resto n'a pas encore de menu) → le nom colle, la
 *     jointure par nom résout l'avis (et tous ceux du même nom) ;
 *  3. ALIAS : déclarer un NOM alternatif → un plat (corrige en masse tous les
 *     avis portant ce nom, présents et futurs).
 *
 * Le dish_name du client n'est JAMAIS modifié. Périmètre v1 = orphelins
 * uniquement (garde côté RPC). Chaque action revalide le Data Cache `menu:{id}`.
 */

export interface LinkActionState {
  error?: string;
  ok?: boolean;
  /** Id du plat créé (createDishFromReviewAction) → le client enchaîne sur son
   *  édition dans l'onglet menu. */
  itemId?: string;
}

const FAIL_OWNER: LinkActionState = { error: "Tu n'es pas le propriétaire de cet établissement." };

function mapLinkError(error: { message?: string } | null): string {
  const m = (error?.message ?? '').toUpperCase();
  if (m.includes('UNLINK_FORBIDDEN'))
    return 'Un avis ne peut pas être détaché d’un plat — rattachez-le au bon plat.';
  if (m.includes('REVIEW_NOT_ORPHAN')) return 'Cet avis correspond déjà à un plat de la carte.';
  if (m.includes('ITEM_NOT_FOUND')) return 'Plat introuvable dans ta carte.';
  if (m.includes('REVIEW_NOT_FOUND')) return 'Avis introuvable.';
  if (m.includes('NOT_OWNER')) return FAIL_OWNER.error!;
  if (m.includes('ALIAS_SHADOWS_DISH'))
    return 'Ce nom est déjà celui d’un plat visible de la carte — inutile comme nom alternatif.';
  if (m.includes('ALIAS_LIMIT')) return 'Trop de noms alternatifs pour cet établissement.';
  if (m.includes('23505') || m.includes('DUPLICATE') || m.includes('UNIQUE'))
    return 'Ce nom alternatif existe déjà.';
  return 'Une erreur est survenue. Réessaie.';
}

function revalidateReviews(restaurantId: string) {
  revalidateTag(`menu:${restaurantId}`, 'max');
  revalidatePath(`/pro/r/${restaurantId}/avis`);
}

// ── 1. Rattacher un avis à un plat (jamais l'en détacher) ─────────────────────
export async function linkReviewAction(
  restaurantId: string,
  _prev: LinkActionState,
  formData: FormData
): Promise<LinkActionState> {
  const reviewId = String(formData.get('reviewId') ?? '');
  const menuItemId = String(formData.get('menuItemId') ?? '').trim();
  if (!reviewId) return { error: 'Avis introuvable.' };
  // Détacher n'est pas un geste autorisé : un avis rattaché compte dans la note
  // du plat, et pouvoir l'en retirer reviendrait à laisser un restaurateur
  // effacer un mauvais avis de sa moyenne. Une association ERRONÉE se corrige
  // en la repointant sur le bon plat. Le RPC refuse aussi le NULL (mig.130) —
  // ceci n'est que le premier filtre.
  if (!menuItemId) return { error: 'Choisissez le plat auquel rattacher cet avis.' };

  const ctx = await assertOwner(restaurantId);
  if (!ctx) return FAIL_OWNER;
  const { supabase } = ctx;

  const { error } = await supabase.rpc('link_review_to_menu_item', {
    p_review_id: reviewId,
    p_menu_item_id: menuItemId,
  });
  if (error) return { error: mapLinkError(error) };

  await logProEvent(supabase, 'pro_review_link', restaurantId);
  revalidateReviews(restaurantId);
  return { ok: true };
}

// ── 2. Créer le plat à partir d'un nom d'avis (+ bootstrap carte si besoin) ────
export async function createDishFromReviewAction(
  restaurantId: string,
  _prev: LinkActionState,
  formData: FormData
): Promise<LinkActionState> {
  const dishName = String(formData.get('dishName') ?? '').trim();
  if (!dishName) return { error: 'Nom du plat manquant.' };
  if (dishName.length > 200) return { error: 'Nom trop long (200 caractères max).' };

  const ctx = await assertOwner(restaurantId);
  if (!ctx) return FAIL_OWNER;
  const { supabase } = ctx;

  // Get-or-create carte par défaut + section « À classer » (bootstrap si le
  // resto n'a pas encore de menu — cas « aucune carte »).
  const { data: menus } = await supabase
    .from('restaurant_menus')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: true })
    .limit(1);
  let menuId = (menus?.[0] as { id: string } | undefined)?.id;
  if (!menuId) {
    const { data: created, error } = await supabase
      .from('restaurant_menus')
      .insert({ restaurant_id: restaurantId, slug: 'carte', name: 'Notre carte' })
      .select('id')
      .single();
    if (error) return { error: mapLinkError(error) };
    menuId = (created as { id: string }).id;
  }
  const { data: secs } = await supabase
    .from('menu_sections')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .eq('menu_id', menuId)
    .eq('name', 'À classer')
    .limit(1);
  let sectionId = (secs?.[0] as { id: string } | undefined)?.id;
  if (!sectionId) {
    const { data: sec, error } = await supabase
      .from('menu_sections')
      .insert({ menu_id: menuId, restaurant_id: restaurantId, name: 'À classer' })
      .select('id')
      .single();
    if (error) return { error: mapLinkError(error) };
    sectionId = (sec as { id: string }).id;
  }

  // Nom copié verbatim → la jointure par nom résout l'avis (et ses homonymes).
  const { data: created, error } = await supabase
    .from('menu_items')
    .insert({
      restaurant_id: restaurantId,
      section_id: sectionId,
      kind: 'item',
      name: dishName,
      description: null,
      price: null,
      is_visible: true,
      is_signature: false,
      allergens: [],
      diet_tags: [],
      category_slugs: [],
      variants: [],
      options: [],
      availability: {},
      formula_config: null,
    })
    .select('id')
    .single();
  if (error) return { error: mapLinkError(error) };

  await logProEvent(supabase, 'pro_menu_bootstrap', restaurantId);
  revalidateTag(`menu:${restaurantId}`, 'max');
  revalidatePath(`/pro/r/${restaurantId}/avis`);
  revalidatePath(`/pro/r/${restaurantId}/menu`);
  return { ok: true, itemId: (created as { id: string }).id };
}

// ── 3. Noms alternatifs (alias) : créer / supprimer ───────────────────────────
export async function createAliasAction(
  restaurantId: string,
  _prev: LinkActionState,
  formData: FormData
): Promise<LinkActionState> {
  const menuItemId = String(formData.get('menuItemId') ?? '');
  const aliasLabel = String(formData.get('aliasLabel') ?? '').trim();
  if (!menuItemId) return { error: 'Plat introuvable.' };
  if (!aliasLabel) return { error: 'Nom alternatif manquant.' };
  if (aliasLabel.length > 200) return { error: 'Nom trop long (200 caractères max).' };

  const ctx = await assertOwner(restaurantId);
  if (!ctx) return FAIL_OWNER;
  const { supabase, user } = ctx;

  const { error } = await supabase.from('menu_item_aliases').insert({
    restaurant_id: restaurantId,
    menu_item_id: menuItemId,
    alias_label: aliasLabel,
    created_by: user.id,
  });
  if (error) return { error: mapLinkError(error) };

  await logProEvent(supabase, 'pro_menu_alias', restaurantId);
  revalidateTag(`menu:${restaurantId}`, 'max');
  revalidatePath(`/pro/r/${restaurantId}/avis`);
  revalidatePath(`/pro/r/${restaurantId}/menu`);
  return { ok: true };
}

export async function deleteAliasAction(
  restaurantId: string,
  aliasId: string
): Promise<LinkActionState> {
  if (!aliasId) return { error: 'Nom alternatif introuvable.' };
  const ctx = await assertOwner(restaurantId);
  if (!ctx) return FAIL_OWNER;
  const { error } = await ctx.supabase
    .from('menu_item_aliases')
    .delete()
    .eq('id', aliasId)
    .eq('restaurant_id', restaurantId);
  if (error) return { error: mapLinkError(error) };
  revalidateTag(`menu:${restaurantId}`, 'max');
  revalidatePath(`/pro/r/${restaurantId}/menu`);
  return { ok: true };
}
