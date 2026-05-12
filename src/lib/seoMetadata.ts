import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { localizedCategory } from './categoryLabels';
import { theBestOf, isNationality, grammarFor } from './categoryGrammar';
import { citySlug } from './slug';

const OG_LOCALE_MAP: Record<string, string> = {
  fr: 'fr_FR',
  en: 'en_US',
  es: 'es_ES',
  de: 'de_DE',
  it: 'it_IT',
};

/**
 * BCP-47 codes pour `<link rel="alternate" hreflang="...">`.
 * Google accepte les codes langue seuls (`fr`) mais les codes
 * langue-région (`fr-FR`) donnent un meilleur ciblage pays — utile
 * dès qu'on commence à diversifier (ex : `es-ES` vs `es-MX`, `de-DE`
 * vs `de-AT`). Cohérent avec le ciblage initial : France (fr-FR),
 * marchés européens principaux pour les autres.
 */
const HREFLANG_BY_LOCALE: Record<string, string> = {
  fr: 'fr-FR',
  en: 'en-US',
  es: 'es-ES',
  de: 'de-DE',
  it: 'it-IT',
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
  // Pre-built "best {category}" fragment with correct FR gender/number agreement
  // (e.g. "le meilleur burger" / "la meilleure pizza" / "les meilleures pâtes").
  // Other locales use a simple per-locale "best" prefix that works
  // gender-invariant since those languages don't require adjective agreement here.
  const bestCategory = category
    ? buildBestCategoryFragment(locale, category, categoryLabel)
    : '';

  let title = t('title');
  let description = t('description');

  if (category && city) {
    title = t('titleWithCityCategory', { category: categoryLabel, city: cityLabel, bestCategory });
    description = t('descWithCityCategory', { category: categoryLabel, city: cityLabel, bestCategory });
  } else if (category) {
    title = t('titleWithCategory', { category: categoryLabel, bestCategory });
    description = t('descWithCategory', { category: categoryLabel, bestCategory });
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
        [HREFLANG_BY_LOCALE.fr]: buildFilterUrl('fr', city, category),
        [HREFLANG_BY_LOCALE.en]: buildFilterUrl('en', city, category),
        [HREFLANG_BY_LOCALE.es]: buildFilterUrl('es', city, category),
        [HREFLANG_BY_LOCALE.de]: buildFilterUrl('de', city, category),
        [HREFLANG_BY_LOCALE.it]: buildFilterUrl('it', city, category),
        'x-default': buildFilterUrl('fr', city, category),
      },
    },
  };
}

/**
 * Builds a localized "best {category}" fragment with correct grammar.
 *  - FR: "le meilleur burger" / "la meilleure pizza" / "les meilleures pâtes"
 *  - For nationality / umbrella slugs (`french`, `asian`, `european`, …), the
 *    label is an adjective not a dish, so we prefix "plats" / "dishes" etc.
 *    to stay grammatical: "les meilleurs plats européens" instead of
 *    "le meilleur européen".
 *  - Others: simple per-locale "best" prefix.
 *
 * Exported so that Hero.tsx, CityGuide and meta titles share one source.
 */
export function buildBestCategoryFragment(
  locale: string,
  categorySlug: string,
  categoryLabel: string,
): string {
  const nat = isNationality(categorySlug);

  if (locale === 'fr') {
    if (nat) {
      // "plats" = masc plur → "les meilleurs plats <adj>"
      return `Les meilleurs plats ${categoryLabel}`;
    }
    const raw = theBestOf(categorySlug, categoryLabel);
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }

  const prefix = PREFIX_BY_LOCALE[locale] ?? PREFIX_BY_LOCALE.en;
  if (nat) {
    const dishesWord = DISHES_BY_LOCALE[locale] ?? DISHES_BY_LOCALE.en;
    // Put the pluralizer after the adjective for DE/IT/ES where it reads
    // naturally, after "best" for EN. We keep it simple and consistent.
    return `${prefix} ${categoryLabel} ${dishesWord}`;
  }
  return `${prefix} ${categoryLabel}`;
}

const PREFIX_BY_LOCALE: Record<string, string> = {
  en: 'Best',
  es: 'Mejor',
  de: 'Bester',
  it: 'Miglior',
  fr: 'Meilleur',
};

const DISHES_BY_LOCALE: Record<string, string> = {
  en: 'dishes',
  es: 'platos',
  de: 'Gerichte',
  it: 'piatti',
  fr: 'plats',
};

/**
 * Construit le titre "Les 10 meilleurs X" avec la grammaire et la langue
 * correctes. Gere aussi les cuisines nationales en les prefixant avec
 * "plats" / "dishes" / "platos" / "Gerichte" / "piatti".
 *
 * Exemples FR :
 *  - burger         -> "Les 10 meilleurs burgers"
 *  - pizza          -> "Les 10 meilleures pizzas"
 *  - pasta          -> "Les 10 meilleures pâtes"
 *  - french         -> "Les 10 meilleurs plats français"
 *  - italian + Lyon -> "Les 10 meilleurs plats italiens de Lyon"
 *  - (aucun)        -> "Les 10 meilleurs plats"
 *  - Lyon seul      -> "Les 10 meilleurs plats de Lyon"
 */
export function buildTopDishesTitle({
  locale,
  categorySlug,
  categoryLabel,
  cityLabel,
  limit = 10,
}: {
  locale: string;
  categorySlug?: string;
  categoryLabel?: string;
  cityLabel?: string;
  limit?: number;
}): string {
  const hasCategory = !!(categorySlug && categoryLabel);
  const hasCity = !!cityLabel;
  const nat = hasCategory && isNationality(categorySlug!);

  if (locale === 'fr') {
    // "Les 10" -> toujours pluriel. Seul le genre vient de la categorie.
    // Masc -> "meilleurs", Fem -> "meilleures".
    let base: string;
    if (!hasCategory) {
      base = `Les ${limit} meilleurs plats`;
    } else if (nat) {
      // "plats" est masculin pluriel.
      base = `Les ${limit} meilleurs plats ${categoryLabel}`;
    } else {
      const { g } = grammarFor(categorySlug!);
      const adj = g === 'f' ? 'meilleures' : 'meilleurs';
      base = `Les ${limit} ${adj} ${categoryLabel}`;
    }
    if (hasCity) return `${base} de ${cityLabel}`;
    return base;
  }

  if (locale === 'en') {
    let base: string;
    if (!hasCategory) base = `Top ${limit} dishes`;
    else if (nat) base = `Top ${limit} ${categoryLabel} dishes`;
    else base = `Top ${limit} ${categoryLabel}`;
    if (hasCity) return `${base} in ${cityLabel}`;
    return base;
  }

  if (locale === 'es') {
    let base: string;
    if (!hasCategory) base = `Los ${limit} mejores platos`;
    else if (nat) base = `Los ${limit} mejores platos ${categoryLabel}`;
    else base = `Los ${limit} mejores ${categoryLabel}`;
    if (hasCity) return `${base} de ${cityLabel}`;
    return base;
  }

  if (locale === 'de') {
    let base: string;
    if (!hasCategory) base = `Die ${limit} besten Gerichte`;
    else if (nat) base = `Die ${limit} besten ${categoryLabel}en Gerichte`;
    else base = `Die ${limit} besten ${categoryLabel}`;
    if (hasCity) return `${base} in ${cityLabel}`;
    return base;
  }

  if (locale === 'it') {
    let base: string;
    if (!hasCategory) base = `I ${limit} migliori piatti`;
    else if (nat) base = `I ${limit} migliori piatti ${categoryLabel}`;
    else base = `I ${limit} migliori ${categoryLabel}`;
    if (hasCity) return `${base} di ${cityLabel}`;
    return base;
  }

  // Fallback
  let base: string;
  if (!hasCategory) base = `Top ${limit} dishes`;
  else if (nat) base = `Top ${limit} ${categoryLabel} dishes`;
  else base = `Top ${limit} ${categoryLabel}`;
  if (hasCity) return `${base} in ${cityLabel}`;
  return base;
}
