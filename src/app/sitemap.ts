import { MetadataRoute } from 'next';
import {
  fetchCategories,
  fetchCities,
  fetchCityCategoryPairs,
  fetchRestaurantsWithDishes,
  fetchRestaurantsWithMenu,
} from '@/lib/supabase';
import { citySlug, restaurantSlug } from '@/lib/slug';
import { MIN_PLATS_CARTE, estVilleCarte } from '@/lib/menuOnly';

// Force dynamic rendering (rebuilt on each request — cheap because data is cached)
export const dynamic = 'force-dynamic';

const BASE = 'https://dishrank.fr';
const LOCALES = ['fr', 'en', 'es', 'de', 'it'];

/**
 * BCP-47 hreflang codes pour les alternates du sitemap.
 * DOIT matcher `HREFLANG_BY_LOCALE` dans `seoMetadata.ts` — sinon Google
 * voit des codes incohérents entre le sitemap (`fr`) et les balises HTML
 * (`fr-FR`), ce qui invalide les signaux hreflang.
 */
const HREFLANG_BY_LOCALE: Record<string, string> = {
  fr: 'fr-FR',
  en: 'en-US',
  es: 'es-ES',
  de: 'de-DE',
  it: 'it-IT',
};

/**
 * Top categories (~30) — these are the only ones included in the sitemap
 * to avoid diluting the crawl budget. The 200+ niche categories are still
 * accessible (and indexable) via internal linking from category pages.
 */
const TOP_CATEGORY_SLUGS = [
  // Most searched globally
  'burger', 'pizza', 'sushi', 'pasta', 'ramen', 'kebab', 'tacos', 'salad',
  // Popular dish types
  'steak', 'seafood', 'curry', 'bowl', 'sandwich', 'wrap',
  // Desserts & breakfast
  'dessert', 'pastry', 'crepes', 'breakfast', 'brunch', 'ice-cream',
  // Drinks
  'coffee', 'tea', 'cocktail', 'wine', 'beer',
  // Cuisines (high traffic)
  'french', 'italian', 'japanese', 'chinese', 'indian', 'mexican',
];

/**
 * Continental / umbrella parents from the hierarchy. These don't exist as
 * rows in `dish_categories` but the page at `/c/<slug>` aggregates every
 * descendant dish (via expandCategorySlug + RPC). Very high SEO value
 * because they capture broad queries like "best european food", "boissons
 * à Lyon", etc. Separate from TOP_CATEGORY_SLUGS because they bypass the
 * DB-slug validation (fetchAllCategorySlugs).
 */
const HIERARCHY_PARENT_SLUGS = [
  'asian', 'european', 'middle-eastern', 'latin-american', 'north-american',
  'african', 'caribbean', 'american', 'drinks',
];

/**
 * Top cities (~30) — same logic. The other cities in the DB are still indexable
 * via the dynamic routes — they're just not surfaced in the sitemap.
 */
const TOP_CITY_NAMES = [
  'Lyon', 'Paris', 'Marseille', 'Toulouse', 'Bordeaux', 'Lille', 'Nice', 'Nantes',
  'Strasbourg', 'Montpellier', 'Rennes', 'Grenoble', 'Rouen', 'Toulon', 'Dijon',
  'Angers', 'Saint-Étienne', 'Le Havre', 'Reims', 'Clermont-Ferrand', 'Tours',
  'Limoges', 'Metz', 'Besançon', 'Perpignan', 'Orléans', 'Caen', 'Brest',
  'Mulhouse', 'Nancy',
];
const PRIORITY_CITIES = new Set(['Lyon', 'Paris', 'Marseille', 'Toulouse', 'Bordeaux']);

/**
 * Langues listées pour les fiches « carte relevée ». Elles existent dans les 5 langues
 * (et le hreflang les déclare), mais 818 fiches × 5 = 4 090 URLs de pages sans avis : on
 * ne liste que fr + en, là où la demande existe. Les autres se découvrent par hreflang.
 */
const LOCALES_CARTE = ['fr', 'en'];

function pathFor(locale: string, path: string) {
  const prefix = locale === 'fr' ? '' : `/${locale}`;
  return `${BASE}${prefix}${path}`;
}

/**
 * Une entrée par langue, chacune déclarant les 5 alternates hreflang.
 *
 * `emises` restreint les URLs *listées* (budget d'exploration) sans toucher aux
 * alternates : celles-ci doivent rester le jeu complet, identique aux balises HTML de la
 * page, sinon Google voit deux jeux hreflang contradictoires et les ignore.
 */
function withAlternates(
  path: string,
  extra: Omit<MetadataRoute.Sitemap[number], 'url' | 'alternates'>,
  emises: string[] = LOCALES
): MetadataRoute.Sitemap {
  return emises.map((locale) => ({
    url: pathFor(locale, path),
    lastModified: new Date(),
    alternates: {
      languages: Object.fromEntries(LOCALES.map((l) => [HREFLANG_BY_LOCALE[l], pathFor(l, path)])),
    },
    ...extra,
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Fetch live data to filter our static lists against what actually exists
  let dbCategorySlugs = new Set<string>();
  let dbCityNames = new Set<string>();
  let dbCityCategoryPairs: { city: string; category_slug: string; dish_count: number }[] = [];
  let dbRestaurants: Awaited<ReturnType<typeof fetchRestaurantsWithDishes>> = [];
  let dbRestaurantsCarte: Awaited<ReturnType<typeof fetchRestaurantsWithMenu>> = [];
  try {
    const [categories, cities, pairs, restos, restosCarte] = await Promise.all([
      fetchCategories(),
      fetchCities(),
      fetchCityCategoryPairs(),
      fetchRestaurantsWithDishes(),
      fetchRestaurantsWithMenu(MIN_PLATS_CARTE),
    ]);
    dbCategorySlugs = new Set(categories.map((c) => c.slug));
    dbCityNames = new Set(cities);
    dbCityCategoryPairs = pairs;
    dbRestaurants = restos;
    dbRestaurantsCarte = restosCarte;
  } catch (e) {
    console.error('sitemap: failed to fetch data', e);
  }

  // Only include URLs whose category/city actually exists in the DB.
  // This prevents 404s from being indexed.
  const validCategories = TOP_CATEGORY_SLUGS.filter((slug) => dbCategorySlugs.has(slug));
  const validCities = TOP_CITY_NAMES.filter((name) => dbCityNames.has(name));

  const urls: MetadataRoute.Sitemap = [
    // Homepage (priority 1)
    ...withAlternates('', { changeFrequency: 'daily', priority: 1 }),
    // Landing restaurateur — seule page indexable de la zone /pro (le reste est
    // noindex). Hors [locale] (FR only) → entrée simple, sans hreflang.
    {
      url: `${BASE}/pro`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
  ];

  // 1. Hierarchy parents (continental umbrellas + drinks) — broadest landing
  // pages, aggregate many dishes. Highest category priority.
  for (const slug of HIERARCHY_PARENT_SLUGS) {
    urls.push(
      ...withAlternates(`/c/${slug}`, {
        changeFrequency: 'daily',
        priority: 0.9,
      })
    );
  }

  // 2. Top category-only pages : /c/<slug>
  for (const slug of validCategories) {
    urls.push(
      ...withAlternates(`/c/${slug}`, {
        changeFrequency: 'daily',
        priority: 0.8,
      })
    );
  }

  // 2bis. Secondary categories (all other categories in DB) at priority 0.4.
  // Keeps the crawl budget for top categories but still surfaces niche
  // categories to Google for discovery.
  const topSet = new Set(validCategories);
  const hierarchySet = new Set(HIERARCHY_PARENT_SLUGS);
  for (const slug of dbCategorySlugs) {
    if (topSet.has(slug) || hierarchySet.has(slug)) continue;
    urls.push(
      ...withAlternates(`/c/${slug}`, {
        changeFrequency: 'weekly',
        priority: 0.4,
      })
    );
  }

  // 2. Top city-only pages : /<city-slug>
  for (const city of validCities) {
    urls.push(
      ...withAlternates(`/${citySlug(city)}`, {
        changeFrequency: 'daily',
        priority: PRIORITY_CITIES.has(city) ? 0.9 : 0.7,
      })
    );
  }

  // 3. City × category combinations : /<city-slug>/<cat>
  // Driven by the DB: every (city, category) pair that actually has at least
  // one moderated review gets indexed. Avoids bloating the sitemap with empty
  // pages that Google would ignore (or worse, mark as soft-404).
  // Dedup is implicit since fetchCityCategoryPairs returns distinct rows.
  for (const pair of dbCityCategoryPairs) {
    const cs = citySlug(pair.city);
    if (!cs) continue;
    // Boost priority when there are multiple dishes — these pages tend to
    // rank better and deserve more crawl budget.
    const isPriorityCity = PRIORITY_CITIES.has(pair.city);
    const priority = isPriorityCity
      ? Math.min(0.9, 0.7 + Math.min(pair.dish_count, 5) * 0.04)
      : Math.min(0.7, 0.5 + Math.min(pair.dish_count, 5) * 0.04);
    urls.push(
      ...withAlternates(`/${cs}/${pair.category_slug}`, {
        changeFrequency: 'daily',
        priority,
      })
    );
  }

  // 3bis. Hierarchy umbrella × top city — these aggregate pages don't have
  // direct DB rows (they expand at request time via expandCategorySlug), so
  // we still emit them statically for the priority cities only.
  for (const slug of HIERARCHY_PARENT_SLUGS) {
    for (const city of validCities) {
      if (!PRIORITY_CITIES.has(city)) continue;
      urls.push(
        ...withAlternates(`/${citySlug(city)}/${slug}`, {
          changeFrequency: 'daily',
          priority: 0.8,
        })
      );
    }
  }

  // 4. Restaurant pages : /<city-slug>/r/<restaurant-slug>
  // Driven by the DB : tout restaurant qui a au moins 1 plat noté (review
  // modérée) est listé. Capture les recherches brandées type "{nom} {ville}
  // avis" / "{nom} menu" qu'on ne couvrait pas avant.
  //
  // Dedup : si plusieurs restos d'une même ville produisent le même slug
  // (rare mais possible — ex. 2 "Le Bistrot" à Lyon), on garde celui avec le
  // plus de plats notés. Les autres ne sont pas listés pour éviter les URLs
  // dupliquées (ils restent fetchables via la query mais Google ne les voit
  // pas via sitemap → pas d'index, pas de signal négatif).
  const restaurantPathByCity = new Map<string, Map<string, { slug: string; dishCount: number }>>();
  for (const r of dbRestaurants) {
    const cSlug = citySlug(r.city);
    if (!cSlug) continue;
    const rSlug = restaurantSlug(r.name);
    if (!rSlug) continue;
    const cityMap = restaurantPathByCity.get(cSlug) || new Map();
    const existing = cityMap.get(rSlug);
    if (!existing || r.dish_count > existing.dishCount) {
      cityMap.set(rSlug, { slug: rSlug, dishCount: r.dish_count });
    }
    restaurantPathByCity.set(cSlug, cityMap);
  }
  for (const [cSlug, cityMap] of restaurantPathByCity) {
    for (const { slug: rSlug, dishCount } of cityMap.values()) {
      // Priority graduée par nombre de plats : plus un resto a de plats notés,
      // plus la page est riche en contenu → plus elle mérite de crawl budget.
      const priority = Math.min(0.7, 0.4 + Math.min(dishCount, 6) * 0.05);
      urls.push(
        ...withAlternates(`/${cSlug}/r/${rSlug}`, {
          changeFrequency: 'weekly',
          priority,
        })
      );
    }
  }

  // 4bis. Fiches « carte relevée » (19/09) : restaurants SANS avis dont la carte a été
  // relevée sur leur propre site. Elles valent d'être indexées (plats, prix, balisage
  // MenuItem), mais elles n'ont aucune note : priorité basse, et même périmètre que la
  // route (`lib/menuOnly` : Lyon d'abord, MIN_PLATS_CARTE plats minimum) — un sitemap
  // qui annoncerait une page que la route refuse de rendre fabriquerait des 404.
  const dejaListe = new Set<string>();
  for (const [cSlug, cityMap] of restaurantPathByCity) {
    for (const { slug } of cityMap.values()) dejaListe.add(`${cSlug}/${slug}`);
  }
  for (const r of dbRestaurantsCarte) {
    if (!estVilleCarte(r.city)) continue;
    const cSlug = citySlug(r.city);
    const rSlug = restaurantSlug(r.name);
    if (!cSlug || !rSlug || dejaListe.has(`${cSlug}/${rSlug}`)) continue;
    dejaListe.add(`${cSlug}/${rSlug}`);
    urls.push(
      ...withAlternates(
        `/${cSlug}/r/${rSlug}`,
        { changeFrequency: 'monthly', priority: 0.3 },
        LOCALES_CARTE
      )
    );
  }

  return urls;
}
