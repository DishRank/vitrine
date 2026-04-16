import { MetadataRoute } from 'next';
import { fetchCategories, fetchCities } from '@/lib/supabase';
import { citySlug } from '@/lib/slug';

// Force dynamic rendering (rebuilt on each request — cheap because data is cached)
export const dynamic = 'force-dynamic';

const BASE = 'https://dishrank.fr';
const LOCALES = ['fr', 'en', 'es', 'de', 'it'];

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

function pathFor(locale: string, path: string) {
  const prefix = locale === 'fr' ? '' : `/${locale}`;
  return `${BASE}${prefix}${path}`;
}

function withAlternates(
  path: string,
  extra: Omit<MetadataRoute.Sitemap[number], 'url' | 'alternates'>
): MetadataRoute.Sitemap {
  return LOCALES.map((locale) => ({
    url: pathFor(locale, path),
    lastModified: new Date(),
    alternates: {
      languages: Object.fromEntries(LOCALES.map((l) => [l, pathFor(l, path)])),
    },
    ...extra,
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Fetch live data to filter our static lists against what actually exists
  let dbCategorySlugs = new Set<string>();
  let dbCityNames = new Set<string>();
  try {
    const [categories, cities] = await Promise.all([
      fetchCategories(),
      fetchCities(),
    ]);
    dbCategorySlugs = new Set(categories.map((c) => c.slug));
    dbCityNames = new Set(cities);
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
  // Top DB categories × top cities + hierarchy umbrellas × top cities.
  const cityCatSlugs = [...HIERARCHY_PARENT_SLUGS, ...validCategories];
  for (const slug of cityCatSlugs) {
    for (const city of validCities) {
      urls.push(
        ...withAlternates(`/${citySlug(city)}/${slug}`, {
          changeFrequency: 'daily',
          priority: PRIORITY_CITIES.has(city) ? 0.85 : 0.65,
        })
      );
    }
  }

  return urls;
}
