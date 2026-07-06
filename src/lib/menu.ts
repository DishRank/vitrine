/**
 * Menu numérique — data layer vitrine (tables migration 085 du projet app).
 *
 * `fetchMenuTree` passe par le Data Cache Next (`unstable_cache`, tag
 * `menu:{id}`, revalidate 300 s) : le cache maison `cached()` de
 * lib/supabase.ts est un Map PAR INSTANCE lambda — sur la route QR (rendue
 * dynamiquement à chaque requête pour le nonce CSP), quasi chaque scan serait
 * un cold start sans le Data Cache partagé.
 *
 * Le client service-role BYPASSE la RLS → on refiltre ici ce que la RLS aurait
 * masqué au public : menus `is_active`, sections/items `is_visible`.
 */
import { createClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';

// ── Types (miroir léger de lib/menuTypes.ts côté app) ──────────────────────

export interface MenuVariant {
  id: string;
  label: string;
  price: number;
  i18n?: Record<string, { label?: string }>;
}
export interface MenuOptionChoice {
  label: string;
  price_delta?: number;
}
export interface MenuOption {
  id: string;
  name: string;
  required?: boolean;
  max?: number;
  choices: MenuOptionChoice[];
  i18n?: Record<string, { name?: string }>;
}
export interface FormulaConfig {
  prices: { label: string; price: number }[];
  slots: {
    name: string;
    source: { section_id?: string | null; item_ids?: string[] };
    supplements?: { item_id: string; price_delta: number }[];
  }[];
}
export type MenuI18n = Record<string, { name?: string; description?: string }>;

export interface MenuItem {
  id: string;
  section_id: string;
  kind: 'item' | 'formula';
  name: string;
  description: string | null;
  price: number | null;
  currency: string;
  photo_url: string | null;
  display_order: number;
  is_available: boolean;
  is_signature: boolean;
  allergens: string[];
  diet_tags: string[];
  variants: MenuVariant[];
  options: MenuOption[];
  availability: { services?: string[]; days?: number[] };
  formula_config: FormulaConfig | null;
  i18n: MenuI18n;
  created_at: string;
}

export interface MenuSection {
  id: string;
  parent_section_id: string | null;
  name: string;
  description: string | null;
  display_order: number;
  i18n: MenuI18n;
  items: MenuItem[];
  children: MenuSection[];
  created_at: string;
}

export interface MenuTree {
  id: string;
  slug: string;
  name: string;
  i18n: MenuI18n;
  display_order: number;
  version: number;
  sections: MenuSection[];
}

// ── Fetch (Data Cache Next, tag menu:{id}) ──────────────────────────────────

const byOrder = <T extends { display_order: number; created_at: string }>(a: T, b: T) =>
  a.display_order - b.display_order || a.created_at.localeCompare(b.created_at);

async function fetchMenuTreeRaw(restaurantId: string): Promise<MenuTree[]> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];
  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from('restaurant_menus')
    .select(
      `id, slug, name, i18n, display_order, is_active, version,
       menu_sections(id, parent_section_id, name, description, i18n, display_order, is_visible, created_at,
         menu_items(id, section_id, kind, name, description, price, currency, photo_url, display_order, is_visible, is_available, is_signature, allergens, diet_tags, variants, options, availability, formula_config, i18n, created_at))`
    )
    .eq('restaurant_id', restaurantId);
  if (error || !data) return [];

  return (data as unknown as (MenuTree & {
    is_active: boolean;
    created_at?: string;
    menu_sections: (MenuSection & {
      is_visible: boolean;
      menu_items: (MenuItem & { is_visible: boolean })[];
    })[];
  })[])
    .filter((m) => m.is_active)
    .sort((a, b) => a.display_order - b.display_order)
    .map((m) => {
      const visibleSections = (m.menu_sections ?? [])
        .filter((s) => s.is_visible)
        .sort(byOrder)
        .map((s) => ({
          id: s.id,
          parent_section_id: s.parent_section_id,
          name: s.name,
          description: s.description,
          display_order: s.display_order,
          i18n: s.i18n ?? {},
          created_at: s.created_at,
          items: (s.menu_items ?? []).filter((i) => i.is_visible).sort(byOrder),
          children: [] as MenuSection[],
        }));
      const roots = visibleSections.filter((s) => !s.parent_section_id);
      for (const root of roots) {
        root.children = visibleSections.filter((s) => s.parent_section_id === root.id);
      }
      return {
        id: m.id,
        slug: m.slug,
        name: m.name,
        i18n: m.i18n ?? {},
        display_order: m.display_order,
        version: m.version,
        sections: roots,
      };
    })
    .filter((m) => m.sections.some((s) => s.items.length > 0 || s.children.some((c) => c.items.length > 0)));
}

export function fetchMenuTree(restaurantId: string): Promise<MenuTree[]> {
  return unstable_cache(() => fetchMenuTreeRaw(restaurantId), ['menu-tree', restaurantId], {
    revalidate: 300,
    tags: [`menu:${restaurantId}`],
  })();
}

// ── Logs serveur (scan QR + vue menu) ───────────────────────────────────────
// Appelés via after() par la page — jamais bloquants, jamais levants.

export async function logQrScanServer(restaurantId: string, src: string): Promise<void> {
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return;
    const supabase = createClient(url, key);
    await supabase.rpc('log_qr_scan', {
      p_restaurant_id: restaurantId,
      p_dish_name: null,
      p_src: src,
    });
  } catch {
    // best-effort : un log raté ne casse jamais la page
  }
}

export async function logMenuViewServer(restaurantId: string, src: string | null): Promise<void> {
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return;
    const supabase = createClient(url, key);
    await supabase.from('analytics_events').insert({
      user_id: null,
      event_type: 'menu_view',
      event_data: { restaurant_id: restaurantId, src: src ?? 'web' },
    });
  } catch {
    // best-effort
  }
}

// ── i18n contenu + libellés UI ───────────────────────────────────────────────

export const MENU_LOCALES = ['fr', 'en', 'es', 'de', 'it'] as const;
export type MenuLocale = (typeof MENU_LOCALES)[number];

/** Locale du visiteur depuis l'en-tête Accept-Language (fr par défaut). */
export function pickLocale(acceptLanguage: string | null): MenuLocale {
  for (const part of (acceptLanguage ?? '').split(',')) {
    const code = part.trim().slice(0, 2).toLowerCase();
    if ((MENU_LOCALES as readonly string[]).includes(code)) return code as MenuLocale;
  }
  return 'fr';
}

/** Champ traduit : locale demandée sinon source fr. */
export function loc(
  base: string | null,
  i18n: MenuI18n | null | undefined,
  locale: MenuLocale,
  field: 'name' | 'description' = 'name'
): string | null {
  if (locale !== 'fr') {
    const v = i18n?.[locale]?.[field];
    if (v && v.trim()) return v;
  }
  return base;
}

/** Libellés UI de la page menu (autonome — la route vit hors [locale]). */
export const MENU_UI: Record<
  MenuLocale,
  {
    menuTitle: string;
    from: string;
    soldOut: string;
    signature: string;
    lunchOnly: string;
    dinnerOnly: string;
    choiceOf: string;
    required: string;
    supplement: string;
    allergensTitle: string;
    poweredBy: string;
    rateCta: string;
    appStore: string;
    playStore: string;
    orVisit: string;
    allergens: Record<string, string>;
    diets: Record<string, string>;
  }
> = {
  fr: {
    menuTitle: 'Menu',
    from: 'dès',
    soldOut: 'Épuisé',
    signature: 'Signature',
    lunchOnly: 'Le midi',
    dinnerOnly: 'Le soir',
    choiceOf: 'Au choix',
    required: 'obligatoire',
    supplement: 'suppl.',
    allergensTitle: 'Allergènes',
    poweredBy: 'Propulsé par DishRank — note les plats, pas les restos',
    rateCta: 'Noter les plats sur l’app',
    appStore: 'Télécharger sur l’App Store',
    playStore: 'Télécharger sur Google Play',
    orVisit: 'Ou visite',
    allergens: {
      gluten: 'Gluten', crustaces: 'Crustacés', oeufs: 'Œufs', poissons: 'Poissons',
      arachides: 'Arachides', soja: 'Soja', lait: 'Lait', fruits_coque: 'Fruits à coque',
      celeri: 'Céleri', moutarde: 'Moutarde', sesame: 'Sésame', sulfites: 'Sulfites',
      lupin: 'Lupin', mollusques: 'Mollusques',
    },
    diets: {
      vegetarien: 'Végétarien', vegan: 'Vegan', halal: 'Halal', sans_gluten: 'Sans gluten',
      fait_maison: 'Fait maison', epice: 'Épicé', nouveau: 'Nouveau',
    },
  },
  en: {
    menuTitle: 'Menu',
    from: 'from',
    soldOut: 'Sold out',
    signature: 'Signature',
    lunchOnly: 'Lunch only',
    dinnerOnly: 'Dinner only',
    choiceOf: 'Choice of',
    required: 'required',
    supplement: 'extra',
    allergensTitle: 'Allergens',
    poweredBy: 'Powered by DishRank — rate dishes, not restaurants',
    rateCta: 'Rate the dishes on the app',
    appStore: 'Download on the App Store',
    playStore: 'Get it on Google Play',
    orVisit: 'Or visit',
    allergens: {
      gluten: 'Gluten', crustaces: 'Crustaceans', oeufs: 'Eggs', poissons: 'Fish',
      arachides: 'Peanuts', soja: 'Soy', lait: 'Milk', fruits_coque: 'Tree nuts',
      celeri: 'Celery', moutarde: 'Mustard', sesame: 'Sesame', sulfites: 'Sulphites',
      lupin: 'Lupin', mollusques: 'Molluscs',
    },
    diets: {
      vegetarien: 'Vegetarian', vegan: 'Vegan', halal: 'Halal', sans_gluten: 'Gluten-free',
      fait_maison: 'Homemade', epice: 'Spicy', nouveau: 'New',
    },
  },
  es: {
    menuTitle: 'Carta',
    from: 'desde',
    soldOut: 'Agotado',
    signature: 'Estrella',
    lunchOnly: 'Solo mediodía',
    dinnerOnly: 'Solo noche',
    choiceOf: 'A elegir',
    required: 'obligatorio',
    supplement: 'supl.',
    allergensTitle: 'Alérgenos',
    poweredBy: 'Impulsado por DishRank — puntúa platos, no restaurantes',
    rateCta: 'Puntúa los platos en la app',
    appStore: 'Descargar en el App Store',
    playStore: 'Disponible en Google Play',
    orVisit: 'O visita',
    allergens: {
      gluten: 'Gluten', crustaces: 'Crustáceos', oeufs: 'Huevos', poissons: 'Pescado',
      arachides: 'Cacahuetes', soja: 'Soja', lait: 'Leche', fruits_coque: 'Frutos de cáscara',
      celeri: 'Apio', moutarde: 'Mostaza', sesame: 'Sésamo', sulfites: 'Sulfitos',
      lupin: 'Altramuces', mollusques: 'Moluscos',
    },
    diets: {
      vegetarien: 'Vegetariano', vegan: 'Vegano', halal: 'Halal', sans_gluten: 'Sin gluten',
      fait_maison: 'Casero', epice: 'Picante', nouveau: 'Nuevo',
    },
  },
  de: {
    menuTitle: 'Speisekarte',
    from: 'ab',
    soldOut: 'Ausverkauft',
    signature: 'Signature',
    lunchOnly: 'Nur mittags',
    dinnerOnly: 'Nur abends',
    choiceOf: 'Zur Wahl',
    required: 'Pflicht',
    supplement: 'Aufpreis',
    allergensTitle: 'Allergene',
    poweredBy: 'Bereitgestellt von DishRank — bewerte Gerichte, keine Restaurants',
    rateCta: 'Gerichte in der App bewerten',
    appStore: 'Im App Store laden',
    playStore: 'Bei Google Play laden',
    orVisit: 'Oder besuche',
    allergens: {
      gluten: 'Gluten', crustaces: 'Krebstiere', oeufs: 'Eier', poissons: 'Fisch',
      arachides: 'Erdnüsse', soja: 'Soja', lait: 'Milch', fruits_coque: 'Schalenfrüchte',
      celeri: 'Sellerie', moutarde: 'Senf', sesame: 'Sesam', sulfites: 'Sulfite',
      lupin: 'Lupinen', mollusques: 'Weichtiere',
    },
    diets: {
      vegetarien: 'Vegetarisch', vegan: 'Vegan', halal: 'Halal', sans_gluten: 'Glutenfrei',
      fait_maison: 'Hausgemacht', epice: 'Scharf', nouveau: 'Neu',
    },
  },
  it: {
    menuTitle: 'Menu',
    from: 'da',
    soldOut: 'Esaurito',
    signature: 'Signature',
    lunchOnly: 'Solo pranzo',
    dinnerOnly: 'Solo cena',
    choiceOf: 'A scelta',
    required: 'obbligatorio',
    supplement: 'suppl.',
    allergensTitle: 'Allergeni',
    poweredBy: 'Offerto da DishRank — vota i piatti, non i ristoranti',
    rateCta: 'Vota i piatti sull’app',
    appStore: 'Scarica su App Store',
    playStore: 'Disponibile su Google Play',
    orVisit: 'Oppure visita',
    allergens: {
      gluten: 'Glutine', crustaces: 'Crostacei', oeufs: 'Uova', poissons: 'Pesce',
      arachides: 'Arachidi', soja: 'Soia', lait: 'Latte', fruits_coque: 'Frutta a guscio',
      celeri: 'Sedano', moutarde: 'Senape', sesame: 'Sesamo', sulfites: 'Solfiti',
      lupin: 'Lupini', mollusques: 'Molluschi',
    },
    diets: {
      vegetarien: 'Vegetariano', vegan: 'Vegano', halal: 'Halal', sans_gluten: 'Senza glutine',
      fait_maison: 'Fatto in casa', epice: 'Piccante', nouveau: 'Novità',
    },
  },
};
