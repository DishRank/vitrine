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
