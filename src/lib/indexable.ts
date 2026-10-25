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
import { allParentSlugs } from './categoryHierarchy';

/** Sous ce nombre de plats affichés, la page est trop maigre pour être indexée. */
export const MIN_DISHES_FOR_INDEX = 3;

/** Plats affichés au plus par une page ville / catégorie (HomePageContent). */
export const SHOWN_DISHES_LIMIT = 100;

/**
 * Plats parcourus pour trouver ceux d'une ville. Filtrer le top 100 NATIONAL par
 * ville (avant) vidait les pages des villes moins bien notées dès que la base
 * dépassait 100 plats — elle en compte 99 au 25/10/2026. À remplacer par une RPC
 * filtrée par ville quand la base approchera ce volume.
 */
const SCAN_LIMIT = 1000;

/** Même ville, quelle que soit la graphie en base (« Lyon », « LYON », « Saint-Étienne »). */
export function sameCity(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return citySlug(a) === citySlug(b);
}

/** Tous les plats (avec photo) d'une catégorie, ou de la ville, avant le plafond d'affichage. */
async function allDishes(category?: string, city?: string): Promise<DishRow[]> {
  const dishes = await fetchDishes(category, SCAN_LIMIT);
  return city ? dishes.filter((d) => sameCity(d.restaurant_city, city)) : dishes;
}

/**
 * Les plats qu'une page ville / catégorie affiche. Lève en cas d'erreur réseau :
 * une erreur passagère ne doit pas se déguiser en « page vide » (noindex) ; rendue
 * dans la page, elle répond 500 et Google repasse.
 */
export async function shownDishes(category?: string, city?: string): Promise<DishRow[]> {
  return (await allDishes(category, city)).slice(0, SHOWN_DISHES_LIMIT);
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
  for (const d of await allDishes(category)) {
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
let indexCache: { at: number; value: Promise<CategoryIndex>; settled?: CategoryIndex } | null = null;

/**
 * Comptes de plats affichés pour toutes les catégories ayant des avis (+ parents de
 * hiérarchie) : un appel par catégorie, gardé 30 min. Périmé, l'index précédent
 * reste servi pendant qu'un nouveau se calcule (aucune page n'attend le recalcul) ;
 * une erreur n'est pas gardée.
 */
export function fetchCategoryIndex(): Promise<CategoryIndex> {
  const now = Date.now();
  if (indexCache && now - indexCache.at < INDEX_TTL_MS) return indexCache.value;
  const previous = indexCache?.settled;
  const value = buildCategoryIndex();
  const entry: { at: number; value: Promise<CategoryIndex>; settled?: CategoryIndex } = { at: now, value };
  indexCache = entry;
  value.then(
    (v) => {
      entry.settled = v;
    },
    () => {
      // Échec : on garde l'index précédent (s'il existe) et on retente dans une minute.
      if (indexCache !== entry) return;
      indexCache = previous
        ? { at: Date.now() - INDEX_TTL_MS + 60_000, value: Promise.resolve(previous), settled: previous }
        : null;
    },
  );
  return previous ? Promise.resolve(previous) : value;
}

async function buildCategoryIndex(): Promise<CategoryIndex> {
  const [categories, cities] = await Promise.all([fetchCategories(), dishCountByCity()]);
  const slugs = [
    ...new Set([...categories.map((c) => c.slug), ...HIERARCHY_PARENT_SLUGS, ...allParentSlugs()]),
  ];
  const entries = await mapLimit(slugs, 4, async (slug) => {
    const dishes = await allDishes(slug);
    const byCity = new Map<string, { city: string; n: number }>();
    for (const d of dishes) {
      if (!d.restaurant_city) continue;
      const key = citySlug(d.restaurant_city);
      if (!key) continue;
      const cur = byCity.get(key);
      if (!cur) byCity.set(key, { city: d.restaurant_city, n: 1 });
      else {
        cur.n += 1;
        if (isMixedCase(d.restaurant_city) && !isMixedCase(cur.city)) cur.city = d.restaurant_city;
      }
    }
    return [slug, { total: Math.min(dishes.length, SHOWN_DISHES_LIMIT), byCity }] as const;
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
