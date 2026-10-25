/**
 * Qui mérite d'être indexé — UNE règle, partagée par les pages (balise robots),
 * le sitemap et le maillage interne (RelatedFilters).
 *
 * Constat Search Console (25/10/2026) : 46 pages indexées pour 2 200 refusées, dont
 * 555 « exclues par noindex ». Chaque endroit comptait les plats à sa façon :
 *   • /c/<cat> demandait 3 plats à la RPC PUIS retirait ceux sans photo → une
 *     catégorie riche sortait en noindex dès qu'un des 3 premiers n'avait pas de photo ;
 *   • /<ville>/<cat> filtrait le top 50 NATIONAL par sous-chaîne de ville ;
 *   • le sitemap annonçait toute paire (ville, catégorie) ayant 1 avis, et toutes
 *     les catégories de la base — des pages que la route marquait ensuite noindex.
 * Ici on compte ce que la page AFFICHE (même appel, même filtre), et le sitemap
 * n'annonce que ce qui passe ce seuil.
 */
import { fetchCategories, fetchDishes, type DishRow } from './supabase';
import { citySlug } from './slug';
import { VILLES_CARTE, estVilleCarte } from './menuOnly';

/** Sous ce nombre de plats affichés, la page est trop maigre pour être indexée. */
export const MIN_DISHES_FOR_INDEX = 3;

/**
 * Plats chargés par une page ville / catégorie (HomePageContent). Au-delà de ce
 * volume par catégorie, une page ville ne voit que le haut du classement national :
 * à remplacer par une RPC filtrée par ville quand une catégorie dépassera 100 plats.
 */
export const SHOWN_DISHES_LIMIT = 100;

/** Même ville, quelle que soit la graphie en base (« Lyon », « LYON », « Saint-Étienne »). */
export function sameCity(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return citySlug(a) === citySlug(b);
}

/**
 * Les plats qu'une page ville / catégorie affiche. Lève en cas d'erreur réseau :
 * une erreur passagère ne doit pas se déguiser en « page vide » (noindex mis en cache
 * une heure par l'ISR) ; la page répond 500 et Google repasse plus tard.
 */
export async function shownDishes(category?: string, city?: string): Promise<DishRow[]> {
  const dishes = await fetchDishes(category, SHOWN_DISHES_LIMIT);
  return city ? dishes.filter((d) => sameCity(d.restaurant_city, city)) : dishes;
}

/**
 * Page /c/<cat>, /<ville> ou /<ville>/<cat> indexable, d'après les plats qu'elle
 * affiche (`shownDishes(category, city)`, déjà chargés par la page) ?
 */
export function isIndexableWith(dishes: DishRow[], category?: string, city?: string): boolean {
  // Ville du pilote « cartes relevées » : sa page liste aussi des centaines de fiches
  // restaurant, elle a du contenu même sans plat noté.
  if (city && !category && estVilleCarte(city)) return true;
  return dishes.length >= MIN_DISHES_FOR_INDEX;
}

/**
 * Nombre de plats affichés par ville pour une catégorie (ou toutes catégories) :
 * sert au sitemap et au maillage, sans un appel par ville.
 */
export async function dishCountByCity(category?: string): Promise<Map<string, { city: string; n: number }>> {
  const byCity = new Map<string, { city: string; n: number }>();
  for (const d of await shownDishes(category)) {
    if (!d.restaurant_city) continue;
    const key = citySlug(d.restaurant_city);
    if (!key) continue;
    const cur = byCity.get(key);
    if (!cur) {
      byCity.set(key, { city: d.restaurant_city, n: 1 });
      continue;
    }
    cur.n += 1;
    // Graphie affichée : la casse mixte plutôt que « LYON » / « lyon » (cf. cityFromSlug).
    if (isMixedCase(d.restaurant_city) && !isMixedCase(cur.city)) cur.city = d.restaurant_city;
  }
  return byCity;
}

function isMixedCase(s: string): boolean {
  return s !== s.toUpperCase() && s !== s.toLowerCase();
}

// ── Index des pages indexables (sitemap + maillage) ──────────────────────────

/**
 * Parents de hiérarchie (asian, drinks…) : pas de ligne dans `dish_categories`,
 * mais une page /c/<slug> qui agrège leurs descendants.
 */
export const HIERARCHY_PARENT_SLUGS = [
  'asian', 'european', 'middle-eastern', 'latin-american', 'north-american',
  'african', 'caribbean', 'american', 'drinks',
];

export interface CategoryIndex {
  /** slug → plats affichés au total et par ville (clé : slug de ville). */
  categories: Map<string, { total: number; byCity: Map<string, { city: string; n: number }> }>;
  /** slug de ville → plats affichés, toutes catégories. */
  cities: Map<string, { city: string; n: number }>;
}

const INDEX_TTL_MS = 30 * 60 * 1000;
let indexCache: { at: number; value: Promise<CategoryIndex> } | null = null;

/**
 * Comptes de plats affichés pour toutes les catégories ayant des avis (+ parents de
 * hiérarchie), calculés une fois et gardés 30 min : le sitemap et chaque bloc de
 * liens internes s'en servent sans relancer ~70 RPC chacun. Une erreur n'est pas
 * gardée en cache.
 */
export function fetchCategoryIndex(): Promise<CategoryIndex> {
  if (indexCache && Date.now() - indexCache.at < INDEX_TTL_MS) return indexCache.value;
  const value = buildCategoryIndex();
  indexCache = { at: Date.now(), value };
  value.catch(() => {
    if (indexCache?.value === value) indexCache = null;
  });
  return value;
}

async function buildCategoryIndex(): Promise<CategoryIndex> {
  const [categories, cities] = await Promise.all([fetchCategories(), dishCountByCity()]);
  const slugs = [...new Set([...categories.map((c) => c.slug), ...HIERARCHY_PARENT_SLUGS])];
  const entries = await mapLimit(slugs, 6, async (slug) => {
    const [dishes, byCity] = await Promise.all([shownDishes(slug), dishCountByCity(slug)]);
    return [slug, { total: dishes.length, byCity }] as const;
  });
  return { categories: new Map(entries), cities };
}

/** Villes indexables (assez de plats notés, ou pilote « cartes relevées »), les plus fournies d'abord. */
export function indexableCities(index: CategoryIndex): { slug: string; city: string; n: number }[] {
  const out = new Map<string, { slug: string; city: string; n: number }>();
  for (const [slug, v] of index.cities) {
    if (v.n >= MIN_DISHES_FOR_INDEX) out.set(slug, { slug, ...v });
  }
  for (const city of VILLES_CARTE) {
    const slug = citySlug(city);
    if (!out.has(slug)) out.set(slug, { slug, city, n: index.cities.get(slug)?.n ?? 0 });
  }
  return [...out.values()].sort((a, b) => b.n - a.n);
}

/** Catégories indexables, globalement ou dans une ville, les plus fournies d'abord. */
export function indexableCategories(
  index: CategoryIndex,
  city?: string,
): { slug: string; n: number }[] {
  const villeSlug = city ? citySlug(city) : '';
  const out: { slug: string; n: number }[] = [];
  for (const [slug, v] of index.categories) {
    const n = villeSlug ? (v.byCity.get(villeSlug)?.n ?? 0) : v.total;
    if (n >= MIN_DISHES_FOR_INDEX) out.push({ slug, n });
  }
  return out.sort((a, b) => b.n - a.n);
}

/** `fn` sur chaque élément, `limit` à la fois (ne pas lancer 70 RPC d'un coup). */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
