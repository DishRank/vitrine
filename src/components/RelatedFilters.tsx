import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { localizedCategory } from '@/lib/categoryLabels';
import { citySlug } from '@/lib/slug';

/**
 * Server component — generates a block of internal links to related filtered
 * pages. Critical for SEO: distributes PageRank across the filter combinations,
 * helps Google discover and contextually link the city/category pages.
 *
 * Strategy depending on context:
 *  - On a city + category page (/lyon/burger):
 *      → other categories in the same city (/lyon/pizza, /lyon/sushi…)
 *      → same category in other cities (/paris/burger, /marseille/burger…)
 *  - On a city alone (/lyon):
 *      → top categories in that city (/lyon/burger, /lyon/pizza…)
 *      → other top cities (/paris, /marseille…)
 *  - On a category alone (/c/burger):
 *      → top cities for that category (/lyon/burger, /paris/burger…)
 *      → related categories (/c/pizza, /c/sandwich…)
 *  - On homepage:
 *      → top categories + top cities to seed the crawl
 */

const TOP_CATEGORIES = [
  'burger', 'pizza', 'sushi', 'pasta', 'ramen', 'kebab', 'tacos',
  'salad', 'steak', 'curry', 'dessert', 'crepes',
];

const TOP_CITIES = [
  'Lyon', 'Paris', 'Marseille', 'Toulouse', 'Bordeaux',
  'Lille', 'Nice', 'Nantes', 'Strasbourg', 'Montpellier',
];

type Props = {
  locale: string;
  /** Original DB city name (e.g. "Lyon") — already resolved from slug */
  city?: string;
  /** Category slug (e.g. "burger") */
  category?: string;
  /** All known city names (for filtering by what actually exists) */
  allCities: string[];
};

export default async function RelatedFilters({ locale, city, category, allCities }: Props) {
  const t = await getTranslations({ locale, namespace: 'related' });
  const localePrefix = locale === 'fr' ? '' : `/${locale}`;

  // Build the two link buckets based on the current context
  const topCities = TOP_CITIES.filter((c) => allCities.includes(c));

  let leftTitle = '';
  let leftLinks: Array<{ href: string; label: string }> = [];
  let rightTitle = '';
  let rightLinks: Array<{ href: string; label: string }> = [];

  if (city && category) {
    // /lyon/burger → other categories in Lyon + same category in other cities
    leftTitle = t('moreInCity', { city });
    leftLinks = TOP_CATEGORIES.filter((c) => c !== category)
      .slice(0, 8)
      .map((slug) => ({
        href: `${localePrefix}/${citySlug(city)}/${slug}`,
        label: localizedCategory(slug, locale),
      }));
    rightTitle = t('sameInOtherCities', { category: localizedCategory(category, locale) });
    rightLinks = topCities
      .filter((c) => c !== city)
      .slice(0, 8)
      .map((c) => ({
        href: `${localePrefix}/${citySlug(c)}/${category}`,
        label: c,
      }));
  } else if (city) {
    // /lyon → top categories in Lyon + other top cities
    leftTitle = t('topInCity', { city });
    leftLinks = TOP_CATEGORIES.slice(0, 8).map((slug) => ({
      href: `${localePrefix}/${citySlug(city)}/${slug}`,
      label: localizedCategory(slug, locale),
    }));
    rightTitle = t('otherCities');
    rightLinks = topCities
      .filter((c) => c !== city)
      .slice(0, 8)
      .map((c) => ({
        href: `${localePrefix}/${citySlug(c)}`,
        label: c,
      }));
  } else if (category) {
    // /c/burger → top cities for that category + other categories
    leftTitle = t('categoryByCity', { category: localizedCategory(category, locale) });
    leftLinks = topCities.slice(0, 8).map((c) => ({
      href: `${localePrefix}/${citySlug(c)}/${category}`,
      label: c,
    }));
    rightTitle = t('otherCategories');
    rightLinks = TOP_CATEGORIES.filter((c) => c !== category)
      .slice(0, 8)
      .map((slug) => ({
        href: `${localePrefix}/c/${slug}`,
        label: localizedCategory(slug, locale),
      }));
  } else {
    // Homepage → top categories + top cities
    leftTitle = t('exploreByCategory');
    leftLinks = TOP_CATEGORIES.slice(0, 8).map((slug) => ({
      href: `${localePrefix}/c/${slug}`,
      label: localizedCategory(slug, locale),
    }));
    rightTitle = t('exploreByCity');
    rightLinks = topCities.slice(0, 8).map((c) => ({
      href: `${localePrefix}/${citySlug(c)}`,
      label: c,
    }));
  }

  if (leftLinks.length === 0 && rightLinks.length === 0) return null;

  return (
    <section className="max-w-[1200px] mx-auto px-4 sm:px-8 py-10 sm:py-14">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 sm:gap-12">
        {leftLinks.length > 0 && (
          <div>
            <h2 className="text-base font-bold text-[var(--text)] mb-3">{leftTitle}</h2>
            <ul className="flex flex-wrap gap-2">
              {leftLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    prefetch={false}
                    className="inline-block px-3 py-1.5 rounded-full text-xs font-medium border border-[var(--border2)] text-[var(--text2)] bg-[var(--surface)] hover:border-[var(--primary)] hover:text-[var(--primary)] hover:-translate-y-0.5 transition-all duration-200 capitalize"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        {rightLinks.length > 0 && (
          <div>
            <h2 className="text-base font-bold text-[var(--text)] mb-3">{rightTitle}</h2>
            <ul className="flex flex-wrap gap-2">
              {rightLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    prefetch={false}
                    className="inline-block px-3 py-1.5 rounded-full text-xs font-medium border border-[var(--border2)] text-[var(--text2)] bg-[var(--surface)] hover:border-[var(--primary)] hover:text-[var(--primary)] hover:-translate-y-0.5 transition-all duration-200"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
