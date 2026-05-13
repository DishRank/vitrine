/**
 * URL slug helpers for cities.
 *
 * Cities are stored in the DB as proper names ("Lyon", "Saint-Étienne") but
 * URLs need to be lowercase, ASCII-safe and dash-separated for SEO.
 */

/**
 * Slugify a city name for URL usage.
 * "Saint-Étienne" → "saint-etienne"
 * "La Rochelle"   → "la-rochelle"
 * "Aix-en-Provence" → "aix-en-provence"
 */
export function citySlug(name: string): string {
  return name
    .normalize('NFD') // decompose accented chars (é → e + ́)
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .toLowerCase()
    .trim()
    .replace(/['']/g, '') // strip apostrophes
    .replace(/[^a-z0-9\s-]/g, '') // remove other special chars
    .replace(/\s+/g, '-') // spaces → dashes
    .replace(/-+/g, '-'); // collapse multiple dashes
}

/**
 * Reverse-lookup: given a slug from a URL, find the matching original
 * city name from a known list. Case-insensitive, accent-insensitive.
 *
 * Returns the original city name (preserving accents/case) or null if no match.
 */
export function cityFromSlug(slug: string, knownCities: string[]): string | null {
  const normalized = slug.toLowerCase();
  for (const city of knownCities) {
    if (citySlug(city) === normalized) return city;
  }
  return null;
}

/**
 * Slugify a restaurant name for URL usage.
 * Same normalization as citySlug, plus length cap to keep URLs reasonable.
 *
 * Uniqueness is enforced WITHIN a city (since restaurants live under
 * /[city]/r/[slug]). If two restaurants in the same city share the same
 * slug, callers must disambiguate by appending a short suffix from the
 * restaurant ID (cf. `restaurantSlugWithId`).
 *
 * "Le Bistrot du Coin"           → "le-bistrot-du-coin"
 * "Big Fernand — Bellecour"      → "big-fernand-bellecour"
 * "Sushi Shop (Part-Dieu)"       → "sushi-shop-part-dieu"
 */
export function restaurantSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * Restaurant slug with the first 6 chars of its UUID appended for guaranteed
 * uniqueness within a city. Used for restaurants that collide on the base
 * slug (rare but possible — e.g. two "Le Bistrot" in Lyon).
 *
 * "Le Bistrot du Coin" + id "a3f2e1c0-..." → "le-bistrot-du-coin-a3f2e1"
 */
export function restaurantSlugWithId(name: string, id: string): string {
  const base = restaurantSlug(name);
  const idFragment = id.replace(/-/g, '').slice(0, 6);
  return `${base}-${idFragment}`;
}
