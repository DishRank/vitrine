import { getTranslations } from 'next-intl/server';
import { localizedCategory } from '@/lib/categoryLabels';
import { citySlug } from '@/lib/slug';
import RelatedFilterLink from './RelatedFilterLink';

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
    const catLabel = localizedCategory(category, locale);
    const catLabelCap = catLabel.charAt(0).toUpperCase() + catLabel.slice(1);
    rightTitle = t('sameInOtherCities', { category: catLabelCap });
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
    // /c/burger → other categories (gauche) + top cities for that category (droite)
    // On met les categories a gauche pour etre coherent avec la homepage
    // (categories a gauche, villes a droite).
    leftTitle = t('otherCategories');
    leftLinks = TOP_CATEGORIES.filter((c) => c !== category)
      .slice(0, 8)
      .map((slug) => ({
        href: `${localePrefix}/c/${slug}`,
        label: localizedCategory(slug, locale),
      }));
    const catLabel = localizedCategory(category, locale);
    const catLabelCap = catLabel.charAt(0).toUpperCase() + catLabel.slice(1);
    rightTitle = t('categoryByCity', { category: catLabelCap });
    rightLinks = topCities.slice(0, 8).map((c) => ({
      href: `${localePrefix}/${citySlug(c)}/${category}`,
      label: c,
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

  // Si une seule colonne a du contenu, on passe en mono-colonne centree
  // plutot que de laisser la grille 2-cols afficher le bloc colle a gauche.
  const singleColumn = leftLinks.length === 0 || rightLinks.length === 0;
  // Quand la colonne gauche contient des categories (homepage `/` ou page
  // categorie `/c/<slug>`), on aligne ses chips a droite pour converger
  // visuellement vers l'axe central avec la colonne villes qui reste a gauche.
  const categoriesLeft = !city;

  return (
    <section className="max-w-[1200px] mx-auto px-4 sm:px-8 py-10 sm:py-14">
      <div
        className={
          singleColumn
            ? 'flex justify-center'
            : 'grid grid-cols-1 sm:grid-cols-2 gap-8 sm:gap-12'
        }
      >
        {leftLinks.length > 0 && (
          <div
            className={
              singleColumn
                ? 'text-center'
                : categoriesLeft
                ? 'sm:text-right'
                : ''
            }
          >
            <h2 className="text-base font-bold text-[var(--text)] mb-3">{leftTitle}</h2>
            <ul
              className={`flex flex-wrap gap-2 ${
                singleColumn
                  ? 'justify-center'
                  : categoriesLeft
                  ? 'sm:justify-end'
                  : ''
              }`}
            >
              {leftLinks.map((link) => (
                <li key={link.href}>
                  <RelatedFilterLink href={link.href} label={link.label} />
                </li>
              ))}
            </ul>
          </div>
        )}
        {rightLinks.length > 0 && (
          <div className={singleColumn ? 'text-center' : ''}>
            <h2 className="text-base font-bold text-[var(--text)] mb-3">{rightTitle}</h2>
            <ul className={`flex flex-wrap gap-2 ${singleColumn ? 'justify-center' : ''}`}>
              {rightLinks.map((link) => (
                <li key={link.href}>
                  <RelatedFilterLink href={link.href} label={link.label} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
