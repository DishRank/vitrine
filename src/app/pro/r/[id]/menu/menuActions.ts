'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { assertOwner } from '@/lib/pro/data';

/**
 * Éditeur de menu web (lot 3). Portage fidèle de hooks/useRestaurantMenu.ts :
 *  - modèle hybride mig.085 (restaurant_menus → menu_sections → menu_items) ;
 *  - RLS « owner du resto OU is_moderator » : aucune nouvelle policy ;
 *  - CAS optimiste (expectedUpdatedAt → MENU_CONFLICT) sur l'édition de contenu
 *    d'un plat, pour la période où l'app ET le web éditent en parallèle ;
 *  - cap signature (1 gratuit / 5 premium) et validation jsonb = triggers
 *    serveur → on ne fait que mapper leurs codes d'erreur.
 *
 * Après chaque écriture : revalidate le tag Data-Cache `menu:{id}` (la page QR
 * publique) + le chemin de l'éditeur. « Édition temps réel » (frontière v2 §2.1).
 */

export interface MenuActionState {
  error?: string;
  ok?: boolean;
}

function mapMenuError(error: { message?: string } | null): string {
  const m = (error?.message ?? '').toUpperCase();
  if (m.includes('MENU_CONFLICT')) return 'Ce plat a été modifié ailleurs entre-temps. Rechargez la page.';
  if (m.includes('SIGNATURE_LIMIT'))
    return 'Limite de plats signature atteinte (1 en gratuit, 5 en Premium).';
  if (m.includes('MENU_INVALID')) return 'Données du plat invalides.';
  return 'Une erreur est survenue. Réessayez.';
}

function revalidateMenu(restaurantId: string) {
  // Next 16 : revalidateTag(tag, profile). 'max' = purge immédiate du Data Cache
  // (même appel que la route /api/revalidate-menu existante).
  revalidateTag(`menu:${restaurantId}`, 'max');
  revalidatePath(`/pro/r/${restaurantId}/menu`);
}

const FAIL_OWNER: MenuActionState = { error: "Tu n'es pas le propriétaire de cet établissement." };

// ── Menu (carte) ──────────────────────────────────────────────────────────────

/** Get-or-create de la carte par défaut (miroir useEnsureDefaultMenu). */
export async function createDefaultMenuAction(restaurantId: string): Promise<MenuActionState> {
  const ctx = await assertOwner(restaurantId);
  if (!ctx) return FAIL_OWNER;
  const { supabase } = ctx;

  const { data: existing } = await supabase
    .from('restaurant_menus')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .limit(1);
  if (!existing || existing.length === 0) {
    const { error } = await supabase
      .from('restaurant_menus')
      .insert({ restaurant_id: restaurantId, slug: 'carte', name: 'Notre carte' });
    if (error) return { error: mapMenuError(error) };
  }
  revalidateMenu(restaurantId);
  return { ok: true };
}

// ── Sections ────────────────────────────────────────────────────────────────

export async function upsertSectionAction(
  restaurantId: string,
  _prev: MenuActionState,
  formData: FormData
): Promise<MenuActionState> {
  const ctx = await assertOwner(restaurantId);
  if (!ctx) return FAIL_OWNER;
  const { supabase } = ctx;

  const id = String(formData.get('id') ?? '') || null;
  const menuId = String(formData.get('menuId') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim() || null;
  if (!name) return { error: 'Le nom de la catégorie est requis.' };
  if (name.length > 200) return { error: 'Nom trop long (200 caractères max).' };
  if (description && description.length > 500) return { error: 'Description trop longue.' };
  if (!id && !menuId) return { error: 'Carte introuvable.' };

  if (id) {
    const { error } = await supabase
      .from('menu_sections')
      .update({ name, description })
      .eq('id', id)
      .eq('restaurant_id', restaurantId);
    if (error) return { error: mapMenuError(error) };
  } else {
    const { error } = await supabase
      .from('menu_sections')
      .insert({ menu_id: menuId, restaurant_id: restaurantId, name, description });
    if (error) return { error: mapMenuError(error) };
  }
  revalidateMenu(restaurantId);
  return { ok: true };
}

export async function deleteSectionAction(restaurantId: string, sectionId: string): Promise<MenuActionState> {
  const ctx = await assertOwner(restaurantId);
  if (!ctx) return FAIL_OWNER;
  const { error } = await ctx.supabase
    .from('menu_sections')
    .delete()
    .eq('id', sectionId)
    .eq('restaurant_id', restaurantId);
  if (error) return { error: mapMenuError(error) };
  revalidateMenu(restaurantId);
  return { ok: true };
}

export async function setSectionVisibleAction(
  restaurantId: string,
  sectionId: string,
  visible: boolean
): Promise<MenuActionState> {
  const ctx = await assertOwner(restaurantId);
  if (!ctx) return FAIL_OWNER;
  const { error } = await ctx.supabase
    .from('menu_sections')
    .update({ is_visible: visible })
    .eq('id', sectionId)
    .eq('restaurant_id', restaurantId);
  if (error) return { error: mapMenuError(error) };
  revalidateMenu(restaurantId);
  return { ok: true };
}

// ── Items ───────────────────────────────────────────────────────────────────

const ALLERGEN_KEYS = new Set([
  'gluten', 'crustaces', 'oeufs', 'poissons', 'arachides', 'soja', 'lait',
  'fruits_coque', 'celeri', 'moutarde', 'sesame', 'sulfites', 'lupin', 'mollusques',
]);
const DIET_KEYS = new Set([
  'vegetarien', 'vegan', 'halal', 'sans_gluten', 'bio', 'fait_maison', 'epice', 'nouveau',
]);

/** Crée/édite un plat (kind='item'). CAS sur l'édition : si `expectedUpdatedAt`
 *  ne matche plus, 0 ligne modifiée → MENU_CONFLICT (édition concurrente). */
export async function upsertItemAction(
  restaurantId: string,
  _prev: MenuActionState,
  formData: FormData
): Promise<MenuActionState> {
  const ctx = await assertOwner(restaurantId);
  if (!ctx) return FAIL_OWNER;
  const { supabase } = ctx;

  const id = String(formData.get('id') ?? '') || null;
  const sectionId = String(formData.get('sectionId') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim() || null;
  const priceRaw = String(formData.get('price') ?? '').replace(',', '.').trim();
  const price = priceRaw === '' ? null : Number(priceRaw);
  const isVisible = formData.get('is_visible') === 'on';
  const isSignature = formData.get('is_signature') === 'on';
  const allergens = formData.getAll('allergens').map(String).filter((a) => ALLERGEN_KEYS.has(a));
  const dietTags = formData.getAll('diet_tags').map(String).filter((d) => DIET_KEYS.has(d));
  const expectedUpdatedAt = String(formData.get('expectedUpdatedAt') ?? '') || null;

  if (!name) return { error: 'Le nom du plat est requis.' };
  if (name.length > 200) return { error: 'Nom trop long (200 caractères max).' };
  if (description && description.length > 1000) return { error: 'Description trop longue (1000 caractères max).' };
  if (price != null && (!Number.isFinite(price) || price < 0 || price > 100000))
    return { error: 'Prix invalide.' };
  if (!id && !sectionId) return { error: 'Catégorie introuvable.' };

  // Champs réellement gérés par le formulaire web. À l'UPDATE on n'envoie QUE
  // ceux-ci : NE PAS toucher variants/options/availability/category_slugs/
  // formula_config/kind, qui peuvent avoir été configurés dans l'app (sinon
  // édition du nom/prix depuis le web = écrasement silencieux — audit F1). Le
  // trigger validate_menu_item_leaves valide NEW.* = valeurs existantes, donc
  // les omettre est sûr.
  const formFields = {
    name,
    description,
    price,
    is_visible: isVisible,
    is_signature: isSignature,
    allergens,
    diet_tags: dietTags,
  };

  if (id) {
    // Ne pas éditer une FORMULE via ce formulaire (il ne gère pas ses slots) —
    // .eq('kind','item') : une tentative sur une formule ne matche aucune ligne.
    let q = supabase
      .from('menu_items')
      .update(formFields)
      .eq('id', id)
      .eq('restaurant_id', restaurantId)
      .eq('kind', 'item');
    if (expectedUpdatedAt) q = q.eq('updated_at', expectedUpdatedAt);
    const { data, error } = await q.select('id');
    if (error) return { error: mapMenuError(error) };
    if (!data || data.length === 0)
      return { error: mapMenuError({ message: 'MENU_CONFLICT' }) };
  } else {
    // INSERT : feuilles jsonb par défaut (kind='item', formula_config NULL).
    const { error } = await supabase.from('menu_items').insert({
      ...formFields,
      restaurant_id: restaurantId,
      section_id: sectionId,
      kind: 'item',
      category_slugs: [] as string[],
      variants: [] as unknown[],
      options: [] as unknown[],
      availability: {} as Record<string, unknown>,
      formula_config: null,
    });
    if (error) return { error: mapMenuError(error) };
  }
  revalidateMenu(restaurantId);
  return { ok: true };
}

export async function deleteItemAction(restaurantId: string, itemId: string): Promise<MenuActionState> {
  const ctx = await assertOwner(restaurantId);
  if (!ctx) return FAIL_OWNER;
  // NB : le sweep des formules référençant cet item (useDeleteMenuItem) n'est
  // pas nécessaire tant que l'éditeur web ne crée pas de formules (kind='item'
  // seulement) — à ajouter avec l'éditeur de formules.
  const { error } = await ctx.supabase
    .from('menu_items')
    .delete()
    .eq('id', itemId)
    .eq('restaurant_id', restaurantId);
  if (error) return { error: mapMenuError(error) };
  revalidateMenu(restaurantId);
  return { ok: true };
}

/** Bascule rapide d'un flag booléen (visible / dispo / signature). Pas de CAS :
 *  un toggle est idempotent et last-write-wins est acceptable. Le cap signature
 *  reste appliqué par le trigger (SIGNATURE_LIMIT). */
export async function setItemFlagAction(
  restaurantId: string,
  itemId: string,
  flag: 'is_visible' | 'is_available' | 'is_signature',
  value: boolean
): Promise<MenuActionState> {
  const ctx = await assertOwner(restaurantId);
  if (!ctx) return FAIL_OWNER;
  const { error } = await ctx.supabase
    .from('menu_items')
    .update({ [flag]: value })
    .eq('id', itemId)
    .eq('restaurant_id', restaurantId);
  if (error) return { error: mapMenuError(error) };
  revalidateMenu(restaurantId);
  return { ok: true };
}

// ── Réordonnancement ──────────────────────────────────────────────────────────
// Renumérotage complet index=display_order (miroir useReorderList) : après le
// backfill tout le monde est à 0, un swap de doublons ne positionnerait rien.

export async function reorderAction(
  restaurantId: string,
  table: 'menu_sections' | 'menu_items',
  orderedIds: string[]
): Promise<MenuActionState> {
  // Une Server Action reçoit des args client arbitraires : valider le nom de
  // table (allowlist runtime) et borner la liste (anti-amplification 1 requête
  // → N updates séquentiels — audit F3).
  if (table !== 'menu_sections' && table !== 'menu_items') return { error: 'Table invalide.' };
  if (!Array.isArray(orderedIds) || orderedIds.length > 500) return { error: 'Liste invalide.' };
  const ctx = await assertOwner(restaurantId);
  if (!ctx) return FAIL_OWNER;
  const { supabase } = ctx;
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from(table)
      .update({ display_order: i })
      .eq('id', orderedIds[i])
      .eq('restaurant_id', restaurantId);
    if (error) return { error: mapMenuError(error) };
  }
  revalidateMenu(restaurantId);
  return { ok: true };
}

// ── Traduction automatique (PREMIUM, edge fn menu-translate) ──────────────────

export interface TranslateResult {
  ok: boolean;
  error?: string;
  translated?: number;
}

export async function translateMenuAction(restaurantId: string): Promise<TranslateResult> {
  const ctx = await assertOwner(restaurantId);
  if (!ctx) return { ok: false, error: "Tu n'es pas le propriétaire de cet établissement." };
  const { data, error } = await ctx.supabase.functions.invoke('menu-translate', {
    body: { restaurantId },
  });
  if (error) return { ok: false, error: 'network' };
  const res = data as { ok?: boolean; error?: string; translated?: number };
  if (res?.error === 'premium_required')
    return { ok: false, error: 'La traduction automatique du menu est réservée au Premium.' };
  revalidateMenu(restaurantId);
  return { ok: !!res?.ok, translated: res?.translated };
}
