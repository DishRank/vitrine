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

// ── Traduction du menu = PREMIUM (frontière v2 §2.1) ────────────────────────
// Appliquée AU RENDU, même patron que le thème : pour un resto free (ou
// premium expiré) on VIDE les feuilles i18n → tout le contenu restaurateur
// retombe sur le français source, y compris variantes et options. Les libellés
// de PLATEFORME (MENU_UI : allergènes, « épuisé », boutons…) restent dans la
// langue du visiteur — ils sont à nous, pas au resto. Appliqué APRÈS le Data
// Cache (qui ignore le tier) → dégradation propre à l'expiration, sans trigger.

function gateSection(s: MenuSection): MenuSection {
  return {
    ...s,
    i18n: {},
    items: s.items.map(gateItem),
    children: s.children.map(gateSection),
  };
}

function gateItem(it: MenuItem): MenuItem {
  return {
    ...it,
    i18n: {},
    variants: it.variants.map((v) => ({ ...v, i18n: undefined })),
    options: it.options.map((o) => ({ ...o, i18n: undefined })),
  };
}

export function gateMenuTranslations(menus: MenuTree[], isPremium: boolean): MenuTree[] {
  if (isPremium) return menus;
  return menus.map((m) => ({ ...m, i18n: {}, sections: m.sections.map(gateSection) }));
}

// ── Notes communautaires par plat (l'allusion « organique » à l'app) ────────
// Les avis DishRank du resto, agrégés par nom de plat normalisé (même clé que
// get_signature_dishes : lower(trim(name))). Sert à afficher un discret
// « ★ 4.3 · 12 avis » sur les plats DÉJÀ notés — jamais rien de forcé.
export type DishRating = { avg: number; count: number };

/** Clé de rapprochement plat ↔ avis (nom normalisé). */
export function ratingKey(name: string): string {
  return name.trim().toLowerCase();
}

export function fetchMenuRatings(restaurantId: string): Promise<Record<string, DishRating>> {
  return unstable_cache(
    async () => {
      const url = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) return {};
      const supabase = createClient(url, key);
      const { data, error } = await supabase
        .from('reviews')
        .select('dish_name, rating')
        .eq('restaurant_id', restaurantId)
        .eq('pending_moderation', false)
        .limit(4000);
      if (error || !data) return {};
      const agg: Record<string, { sum: number; count: number }> = {};
      for (const r of data as { dish_name: string | null; rating: number | null }[]) {
        const nm = (r.dish_name ?? '').trim().toLowerCase();
        if (!nm || r.rating == null) continue;
        (agg[nm] ??= { sum: 0, count: 0 }).sum += Number(r.rating);
        agg[nm].count += 1;
      }
      const out: Record<string, DishRating> = {};
      for (const [nm, v] of Object.entries(agg)) {
        out[nm] = { avg: Math.round((v.sum / v.count) * 10) / 10, count: v.count };
      }
      return out;
    },
    ['menu-ratings', restaurantId],
    { revalidate: 300, tags: [`menu:${restaurantId}`] }
  )();
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

/**
 * Langues RÉELLEMENT disponibles pour ce menu : `fr` (source) + les locales
 * présentes dans les feuilles i18n (name non vide). Ces traductions sont
 * produites par l'edge `menu-translate` (DeepL, premium → en/es/de/it) ; on
 * n'offre donc dans le sélecteur que les langues effectivement traduites.
 * (Pour un resto free/expiré, `gateMenuTranslations` a vidé les i18n → `['fr']`
 * → sélecteur masqué.)
 */
export function menuLocales(menus: MenuTree[]): MenuLocale[] {
  const present = new Set<MenuLocale>();
  const scan = (i18n: MenuI18n | null | undefined) => {
    if (!i18n) return;
    for (const code of Object.keys(i18n)) {
      if ((MENU_LOCALES as readonly string[]).includes(code) && i18n[code]?.name?.trim()) {
        present.add(code as MenuLocale);
      }
    }
  };
  for (const m of menus) {
    scan(m.i18n);
    for (const s of m.sections) {
      scan(s.i18n);
      for (const it of s.items) scan(it.i18n);
      for (const c of s.children) {
        scan(c.i18n);
        for (const it of c.items) scan(it.i18n);
      }
    }
  }
  // fr en tête, puis dans l'ordre MENU_LOCALES.
  return MENU_LOCALES.filter((l) => l === 'fr' || present.has(l));
}

// ── Thème d'apparence (feature premium, migration 091) ──────────────────────
// Copie synchronisée de constants/menuTheme.ts côté app. Le thème n'est
// APPLIQUÉ que si le resto est premium (sinon défaut ivoire) → dégradation
// propre à l'expiration, sans trigger DB.

export type MenuThemePreset = 'ivory' | 'linen' | 'charcoal' | 'night';
export interface ResolvedMenuTheme {
  bg: string;
  card: string;
  text: string;
  sub: string;
  line: string;
  accent: string;
  dark: boolean;
  font: 'serif' | 'modern';
  photos: boolean;
  logoUrl: string | null;
}

const MENU_PRESETS: Record<MenuThemePreset, Omit<ResolvedMenuTheme, 'accent' | 'font' | 'photos' | 'logoUrl'>> = {
  ivory: { bg: '#FBF8F3', card: '#FFFFFF', text: '#2A241E', sub: '#8C8478', line: '#EBE4D8', dark: false },
  linen: { bg: '#F5EEE3', card: '#FFFDF9', text: '#3A2E22', sub: '#90806A', line: '#E5DAC8', dark: false },
  charcoal: { bg: '#211D1B', card: '#2A2523', text: '#F2ECE3', sub: '#A89C8D', line: '#37312C', dark: true },
  night: { bg: '#14161F', card: '#1C1F2B', text: '#ECEEF5', sub: '#9AA0B0', line: '#262A38', dark: true },
};

export function isRestaurantPremium(
  tier: string | null | undefined,
  expires: string | null | undefined
): boolean {
  return tier === 'premium' && (!expires || new Date(expires) > new Date());
}

export type StorePlatform = 'ios' | 'android' | 'desktop';

/** Plateforme depuis le User-Agent de la requête (SSR — le detectPlatform du
 *  site est client-only). iPhone/iPad/iPod → ios ; Android → android ; sinon
 *  desktop (montre les deux boutons). */
export function detectPlatformFromUA(ua: string | null | undefined): StorePlatform {
  const s = ua ?? '';
  if (/iPhone|iPad|iPod/i.test(s)) return 'ios';
  if (/Android/i.test(s)) return 'android';
  return 'desktop';
}

/** Thème effectif. Les PHOTOS de plats sont GRATUITES (frontière v2 §2.1 —
 *  défaut true, seule une désactivation explicite les masque) ; le reste du
 *  thème (ambiance, accent, police, logo) reste PREMIUM — défaut ivoire sinon. */
export function resolveMenuTheme(raw: unknown, isPremium: boolean): ResolvedMenuTheme {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const photos = o.photos !== false;
  if (!isPremium) {
    return {
      ...MENU_PRESETS.ivory,
      accent: '#AE8324',
      font: 'serif',
      // Free = comportement par défaut : photos TOUJOURS affichées. Le toggle
      // d'affichage appartient au thème (premium) — sans ça, un resto
      // rétrogradé avec `photos:false` stocké ne pourrait plus les réactiver.
      photos: true,
      logoUrl: null,
    };
  }
  const key: MenuThemePreset = (['ivory', 'linen', 'charcoal', 'night'] as const).includes(
    o.theme as MenuThemePreset
  )
    ? (o.theme as MenuThemePreset)
    : 'ivory';
  const accent =
    typeof o.accent === 'string' && /^#[0-9a-fA-F]{6}$/.test(o.accent) ? (o.accent as string) : '#AE8324';
  const font = o.font === 'modern' ? 'modern' : 'serif';
  const logoUrl = typeof o.logo_url === 'string' && o.logo_url ? (o.logo_url as string) : null;
  return { ...MENU_PRESETS[key], accent, font, photos, logoUrl };
}

/** Libellés UI de la page menu (autonome — la route vit hors [locale]). */
export const MENU_UI: Record<
  MenuLocale,
  {
    menuTitle: string;
    from: string;
    soldOut: string;
    signature: string;
    rateAction: string;
    ratePublish: string;
    rateCommentPh: string;
    rateThanks: string;
    rateAnonHint: string;
    rateAlready: string;
    rateError: string;
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
    reviewsWord: string;
    ratedBy: string;
    likedTitle: string;
    rateInvite: string;
    openApp: string;
    searchPlaceholder: string;
    filterAll: string;
    filterSignature: string;
    noResults: string;
    allergens: Record<string, string>;
    diets: Record<string, string>;
  }
> = {
  fr: {
    menuTitle: 'Menu',
    from: 'dès',
    soldOut: 'Épuisé',
    signature: 'Choix du chef', rateAction: 'Noter', ratePublish: 'Publier', rateCommentPh: 'Un mot sur ce plat ? (optionnel)', rateThanks: 'Merci pour votre note !', rateAnonHint: 'Sans compte — votre note est anonyme.', rateAlready: 'Vous avez déjà noté ce plat ce mois-ci.', rateError: 'Impossible d’envoyer la note — réessayez.',
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
    reviewsWord: 'avis',
    searchPlaceholder: 'Rechercher un plat…',
    filterAll: 'Tout',
    filterSignature: 'Signature',
    noResults: 'Aucun plat ne correspond',
    ratedBy: 'Noté par la communauté',
    likedTitle: 'Un plat vous a plu ?',
    rateInvite: 'Notez-le sur DishRank',
    openApp: 'Ouvrir dans l’app',
    allergens: {
      gluten: 'Gluten', crustaces: 'Crustacés', oeufs: 'Œufs', poissons: 'Poissons',
      arachides: 'Arachides', soja: 'Soja', lait: 'Lait', fruits_coque: 'Fruits à coque',
      celeri: 'Céleri', moutarde: 'Moutarde', sesame: 'Sésame', sulfites: 'Sulfites',
      lupin: 'Lupin', mollusques: 'Mollusques',
    },
    diets: {
      vegetarien: 'Végétarien', vegan: 'Vegan', halal: 'Halal', sans_gluten: 'Sans gluten', bio: 'Bio',
      fait_maison: 'Fait maison', epice: 'Épicé', nouveau: 'Nouveau',
    },
  },
  en: {
    menuTitle: 'Menu',
    from: 'from',
    soldOut: 'Sold out',
    signature: "Chef's choice", rateAction: 'Rate', ratePublish: 'Publish', rateCommentPh: 'A word about this dish? (optional)', rateThanks: 'Thanks for rating!', rateAnonHint: 'No account needed — your rating is anonymous.', rateAlready: 'You already rated this dish this month.', rateError: 'Could not send your rating — try again.',
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
    reviewsWord: 'reviews',
    searchPlaceholder: 'Search a dish…',
    filterAll: 'All',
    filterSignature: 'Signature',
    noResults: 'No matching dish',
    ratedBy: 'Rated by the community',
    likedTitle: 'Enjoyed a dish?',
    rateInvite: 'Rate it on DishRank',
    openApp: 'Open in the app',
    allergens: {
      gluten: 'Gluten', crustaces: 'Crustaceans', oeufs: 'Eggs', poissons: 'Fish',
      arachides: 'Peanuts', soja: 'Soy', lait: 'Milk', fruits_coque: 'Tree nuts',
      celeri: 'Celery', moutarde: 'Mustard', sesame: 'Sesame', sulfites: 'Sulphites',
      lupin: 'Lupin', mollusques: 'Molluscs',
    },
    diets: {
      vegetarien: 'Vegetarian', vegan: 'Vegan', halal: 'Halal', sans_gluten: 'Gluten-free', bio: 'Organic',
      fait_maison: 'Homemade', epice: 'Spicy', nouveau: 'New',
    },
  },
  es: {
    menuTitle: 'Carta',
    from: 'desde',
    soldOut: 'Agotado',
    signature: 'Elección del chef', rateAction: 'Valorar', ratePublish: 'Publicar', rateCommentPh: '¿Unas palabras sobre el plato? (opcional)', rateThanks: '¡Gracias por tu valoración!', rateAnonHint: 'Sin cuenta — tu valoración es anónima.', rateAlready: 'Ya valoraste este plato este mes.', rateError: 'No se pudo enviar la valoración — inténtalo de nuevo.',
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
    reviewsWord: 'reseñas',
    searchPlaceholder: 'Buscar un plato…',
    filterAll: 'Todo',
    filterSignature: 'Especialidad',
    noResults: 'Ningún plato coincide',
    ratedBy: 'Puntuado por la comunidad',
    likedTitle: '¿Te gustó un plato?',
    rateInvite: 'Puntúalo en DishRank',
    openApp: 'Abrir en la app',
    allergens: {
      gluten: 'Gluten', crustaces: 'Crustáceos', oeufs: 'Huevos', poissons: 'Pescado',
      arachides: 'Cacahuetes', soja: 'Soja', lait: 'Leche', fruits_coque: 'Frutos de cáscara',
      celeri: 'Apio', moutarde: 'Mostaza', sesame: 'Sésamo', sulfites: 'Sulfitos',
      lupin: 'Altramuces', mollusques: 'Moluscos',
    },
    diets: {
      vegetarien: 'Vegetariano', vegan: 'Vegano', halal: 'Halal', sans_gluten: 'Sin gluten', bio: 'Ecológico',
      fait_maison: 'Casero', epice: 'Picante', nouveau: 'Nuevo',
    },
  },
  de: {
    menuTitle: 'Speisekarte',
    from: 'ab',
    soldOut: 'Ausverkauft',
    signature: 'Empfehlung des Chefs', rateAction: 'Bewerten', ratePublish: 'Senden', rateCommentPh: 'Ein Wort zum Gericht? (optional)', rateThanks: 'Danke für deine Bewertung!', rateAnonHint: 'Ohne Konto — deine Bewertung ist anonym.', rateAlready: 'Du hast dieses Gericht diesen Monat schon bewertet.', rateError: 'Bewertung konnte nicht gesendet werden — bitte erneut versuchen.',
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
    reviewsWord: 'Bewertungen',
    searchPlaceholder: 'Gericht suchen…',
    filterAll: 'Alle',
    filterSignature: 'Spezialität',
    noResults: 'Kein passendes Gericht',
    ratedBy: 'Von der Community bewertet',
    likedTitle: 'Ein Gericht genossen?',
    rateInvite: 'Bewerte es auf DishRank',
    openApp: 'In der App öffnen',
    allergens: {
      gluten: 'Gluten', crustaces: 'Krebstiere', oeufs: 'Eier', poissons: 'Fisch',
      arachides: 'Erdnüsse', soja: 'Soja', lait: 'Milch', fruits_coque: 'Schalenfrüchte',
      celeri: 'Sellerie', moutarde: 'Senf', sesame: 'Sesam', sulfites: 'Sulfite',
      lupin: 'Lupinen', mollusques: 'Weichtiere',
    },
    diets: {
      vegetarien: 'Vegetarisch', vegan: 'Vegan', halal: 'Halal', sans_gluten: 'Glutenfrei', bio: 'Bio',
      fait_maison: 'Hausgemacht', epice: 'Scharf', nouveau: 'Neu',
    },
  },
  it: {
    menuTitle: 'Menu',
    from: 'da',
    soldOut: 'Esaurito',
    signature: 'Scelta dello chef', rateAction: 'Valuta', ratePublish: 'Pubblica', rateCommentPh: 'Due parole sul piatto? (facoltativo)', rateThanks: 'Grazie per la valutazione!', rateAnonHint: 'Senza account — la tua valutazione è anonima.', rateAlready: 'Hai già valutato questo piatto questo mese.', rateError: 'Invio non riuscito — riprova.',
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
    reviewsWord: 'recensioni',
    searchPlaceholder: 'Cerca un piatto…',
    filterAll: 'Tutto',
    filterSignature: 'Specialità',
    noResults: 'Nessun piatto corrisponde',
    ratedBy: 'Votato dalla comunità',
    likedTitle: 'Ti è piaciuto un piatto?',
    rateInvite: 'Votalo su DishRank',
    openApp: 'Apri nell’app',
    allergens: {
      gluten: 'Glutine', crustaces: 'Crostacei', oeufs: 'Uova', poissons: 'Pesce',
      arachides: 'Arachidi', soja: 'Soia', lait: 'Latte', fruits_coque: 'Frutta a guscio',
      celeri: 'Sedano', moutarde: 'Senape', sesame: 'Sesamo', sulfites: 'Solfiti',
      lupin: 'Lupini', mollusques: 'Molluschi',
    },
    diets: {
      vegetarien: 'Vegetariano', vegan: 'Vegano', halal: 'Halal', sans_gluten: 'Senza glutine', bio: 'Bio',
      fait_maison: 'Fatto in casa', epice: 'Piccante', nouveau: 'Novità',
    },
  },
};
