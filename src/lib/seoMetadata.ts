import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { localizedCategory } from './categoryLabels';
import { citySlug } from './slug';

const OG_LOCALE_MAP: Record<string, string> = {
  fr: 'fr_FR',
  en: 'en_US',
  es: 'es_ES',
  de: 'de_DE',
  it: 'it_IT',
};

const SITE = 'https://dishrank.fr';
const OG_IMAGE = `${SITE}/img/play_store_feature_graphic.webp`;

/**
 * Build the URL path for a given filter combo (without locale prefix).
 *  - city + category : /lyon/burger
 *  - city alone      : /lyon
 *  - category alone  : /c/burger
 *  - none            : ''
 */
export function buildFilterPath(citySlugOrName?: string, categorySlugVal?: string): string {
  const cSlug = citySlugOrName ? citySlug(citySlugOrName) : '';
  if (cSlug && categorySlugVal) return `/${cSlug}/${categorySlugVal}`;
  if (cSlug) return `/${cSlug}`;
  if (categorySlugVal) return `/c/${categorySlugVal}`;
  return '';
}

/**
 * Build a full URL for a given locale + filter path.
 * French is the default locale (no prefix).
 */
export function buildFilterUrl(locale: string, citySlugOrName?: string, categorySlugVal?: string): string {
  const path = buildFilterPath(citySlugOrName, categorySlugVal);
  const localePrefix = locale === 'fr' ? '' : `/${locale}`;
  return `${SITE}${localePrefix}${path}`;
}

/**
 * Generate the full Metadata for a page given its filter context.
 * `cityName` should be the original (un-slugified) city name from the DB,
 * because it's used in the displayed title/description.
 */
export async function buildSeoMetadata({
  locale,
  category,
  city,
  hasSearchQuery = false,
}: {
  locale: string;
  category?: string; // raw slug, e.g. "burger"
  city?: string; // original DB name, e.g. "Saint-Étienne"
  /** True if a `?q=` text search is active — triggers noindex to avoid duplicate content */
  hasSearchQuery?: boolean;
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'meta' });

  const categoryLabel = category ? localizedCategory(category, locale) : '';
  const cityLabel = city || '';

  let title = t('title');
  let description = t('description');

  if (category && city) {
    title = t('titleWithCityCategory', { category: categoryLabel, city: cityLabel });
    description = t('descWithCityCategory', { category: categoryLabel, city: cityLabel });
  } else if (category) {
    title = t('titleWithCategory', { category: categoryLabel });
    description = t('descWithCategory', { category: categoryLabel });
  } else if (city) {
    title = t('titleWithCity', { city: cityLabel });
    description = t('descWithCity', { city: cityLabel });
  }

  return {
    title,
    description,
    // When the user is searching with ?q=, the page is a search result variant
    // of the canonical URL — tell Google to not index it (the canonical still
    // points to the unsearched version so PageRank flows correctly).
    robots: hasSearchQuery
      ? { index: false, follow: true }
      : { index: true, follow: true },
    openGraph: {
      title,
      description,
      url: buildFilterUrl(locale, city, category),
      siteName: 'DishRank',
      images: [{ url: OG_IMAGE, width: 1024, height: 500 }],
      locale: OG_LOCALE_MAP[locale] || locale,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [OG_IMAGE],
    },
    alternates: {
      canonical: buildFilterUrl(locale, city, category),
      languages: {
        fr: buildFilterUrl('fr', city, category),
        en: buildFilterUrl('en', city, category),
        es: buildFilterUrl('es', city, category),
        de: buildFilterUrl('de', city, category),
        it: buildFilterUrl('it', city, category),
        'x-default': buildFilterUrl('fr', city, category),
      },
    },
  };
}
