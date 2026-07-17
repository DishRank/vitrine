import { getSupabaseServer } from '@/lib/pro/supabaseServer';
import type { MenuVariant, MenuOption, MenuAvailability, FormulaConfig } from './menuLeaves';

/**
 * Lecture de l'arbre menu pour l'ÉDITEUR (session RLS de l'owner → inclut les
 * sections/plats masqués, contrairement à fetchMenuTree public qui refiltre).
 * Tri client (display_order puis created_at), 1 seul niveau de section.
 */

/** Nom alternatif d'un plat (mig 112) — les avis portant ce nom comptent pour lui. */
export interface MenuItemAlias {
  id: string;
  alias_label: string;
}

/**
 * Feuilles de traduction d'un plat (menu_items.i18n). fr = colonnes source
 * (name/description) — jamais dans i18n. Contrat mig 085 : une entrée SANS
 * `_auto` = traduction MANUELLE (jamais réécrite par l'edge auto-trad) ; `_auto:
 * true` + `_h` = auto (retraduite si la source change). L'éditeur préserve
 * `_auto`/`_h` des locales NON éditées et les retire des locales éditées à la main.
 */
export type MenuItemI18n = Record<
  string,
  { name?: string; description?: string; _auto?: boolean; _h?: string }
>;

export interface EditorItem {
  id: string;
  section_id: string;
  kind: 'item' | 'formula';
  name: string;
  description: string | null;
  price: number | null;
  currency: string;
  photo_url: string | null;
  display_order: number;
  is_visible: boolean;
  is_available: boolean;
  is_signature: boolean;
  allergens: string[];
  diet_tags: string[];
  category_slugs: string[];
  variants: MenuVariant[];
  options: MenuOption[];
  availability: MenuAvailability;
  formula_config: FormulaConfig | null;
  /** Traductions (EN/ES/DE/IT) ; fr = colonnes source name/description. */
  i18n: MenuItemI18n;
  /** Noms alternatifs (chargés à part depuis menu_item_aliases). */
  aliases: MenuItemAlias[];
  updated_at: string;
  created_at: string;
}

export interface EditorSection {
  id: string;
  name: string;
  description: string | null;
  parent_section_id: string | null;
  display_order: number;
  is_visible: boolean;
  created_at: string;
  items: EditorItem[];
  /** Traductions de la section (EN/ES/DE/IT) ; fr = colonnes source name/description. */
  i18n: MenuItemI18n;
  /** Sous-catégories (1 seul niveau de profondeur, comme l'app). */
  children: EditorSection[];
}

export interface EditorMenu {
  id: string;
  name: string;
  version: number;
  sections: EditorSection[];
  /** Langues cibles (en/es/de/it) ayant AU MOINS une traduction dans l'arbre. */
  translatedLocales: string[];
}

/** Langues cibles de la traduction auto (la saisie se fait en FR). */
export const MENU_TARGET_LOCALES = ['en', 'es', 'de', 'it'] as const;

type I18nMap = Record<string, { name?: string; description?: string } | undefined> | null;
function hasLocaleContent(i18n: I18nMap, locale: string): boolean {
  const e = i18n?.[locale];
  return !!(e && ((e.name && e.name.trim()) || (e.description && e.description.trim())));
}

const byOrder = <T extends { display_order: number; created_at: string }>(a: T, b: T) =>
  a.display_order - b.display_order || a.created_at.localeCompare(b.created_at);

const SELECT = `id, name, version, display_order, created_at,
  menu_sections(id, name, description, i18n, parent_section_id, display_order, is_visible, created_at,
    menu_items(id, section_id, kind, name, description, i18n, price, currency, photo_url, display_order, is_visible, is_available, is_signature, allergens, diet_tags, category_slugs, variants, options, availability, formula_config, updated_at, created_at))`;

/** L'arbre complet des cartes du resto (souvent une seule, « Notre carte »). */
export async function getEditorMenus(restaurantId: string): Promise<EditorMenu[]> {
  const supabase = await getSupabaseServer();
  const [{ data }, { data: aliasData }] = await Promise.all([
    supabase.from('restaurant_menus').select(SELECT).eq('restaurant_id', restaurantId),
    supabase.from('menu_item_aliases').select('id, alias_label, menu_item_id').eq('restaurant_id', restaurantId),
  ]);

  // Noms alternatifs regroupés par plat (attachés à chaque EditorItem).
  const aliasMap = new Map<string, MenuItemAlias[]>();
  for (const a of (aliasData ?? []) as { id: string; alias_label: string; menu_item_id: string }[]) {
    const arr = aliasMap.get(a.menu_item_id);
    if (arr) arr.push({ id: a.id, alias_label: a.alias_label });
    else aliasMap.set(a.menu_item_id, [{ id: a.id, alias_label: a.alias_label }]);
  }

  type RawItem = EditorItem & { parent_section_id?: string | null };
  type RawSection = {
    id: string;
    name: string;
    description: string | null;
    parent_section_id: string | null;
    display_order: number;
    is_visible: boolean;
    created_at: string;
    i18n?: I18nMap;
    menu_items: RawItem[];
  };
  type RawMenu = Omit<EditorMenu, 'sections' | 'translatedLocales'> & { display_order: number; created_at: string; menu_sections: RawSection[] };

  const normItem = (it: RawItem): EditorItem => ({
    ...it,
    price: it.price != null ? Number(it.price) : null,
    allergens: Array.isArray(it.allergens) ? it.allergens : [],
    diet_tags: Array.isArray(it.diet_tags) ? it.diet_tags : [],
    category_slugs: Array.isArray(it.category_slugs) ? it.category_slugs : [],
    variants: Array.isArray(it.variants) ? it.variants : [],
    options: Array.isArray(it.options) ? it.options : [],
    availability: it.availability && typeof it.availability === 'object' ? it.availability : {},
    formula_config:
      it.formula_config && typeof it.formula_config === 'object'
        ? (it.formula_config as unknown as FormulaConfig)
        : null,
    i18n: (it.i18n as MenuItemI18n) ?? {},
    aliases: aliasMap.get(it.id) ?? [],
  });

  return ((data ?? []) as unknown as RawMenu[])
    .sort(byOrder)
    .map((m) => {
      const raw = m.menu_sections ?? [];
      const translatedLocales = MENU_TARGET_LOCALES.filter((loc) =>
        raw.some(
          (s) =>
            hasLocaleContent(s.i18n ?? null, loc) ||
            (s.menu_items ?? []).some((it) => hasLocaleContent(it.i18n ?? null, loc))
        )
      );

      // Toutes les sections en objets EditorSection (children vides d'abord)…
      const byId = new Map<string, EditorSection>();
      for (const s of raw) {
        byId.set(s.id, {
          id: s.id,
          name: s.name,
          description: s.description,
          parent_section_id: s.parent_section_id,
          display_order: s.display_order,
          is_visible: s.is_visible,
          created_at: s.created_at,
          items: (s.menu_items ?? []).map(normItem).sort(byOrder),
          i18n: (s.i18n as MenuItemI18n) ?? {},
          children: [],
        });
      }
      // …puis on rattache les sous-sections à leur parent (1 niveau).
      const roots: EditorSection[] = [];
      for (const s of byId.values()) {
        const parent = s.parent_section_id ? byId.get(s.parent_section_id) : undefined;
        if (parent) parent.children.push(s);
        else roots.push(s);
      }
      roots.sort(byOrder);
      for (const r of roots) r.children.sort(byOrder);

      return { id: m.id, name: m.name, version: m.version, translatedLocales, sections: roots };
    });
}
