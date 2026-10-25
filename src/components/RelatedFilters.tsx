import { getTranslations } from 'next-intl/server';
import { localizedCategory } from '@/lib/categoryLabels';
import { citySlug } from '@/lib/slug';
import {
  MIN_DISHES_FOR_INDEX,
  fetchCategoryIndex,
  indexableCategories,
  indexableCities,
} from '@/lib/indexable';
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

/** Liens par colonne. */
const MAX_LINKS = 8;

type Props = {
  locale: string;
  /** Original DB city name (e.g. "Lyon") — already resolved from slug */
  city?: string;
  /** Category slug (e.g. "burger") */
  category?: string;
  /** All known city names (gardé pour les appelants ; les villes liées viennent de l'index). */
  allCities: string[];
};

/**
 * Les liens ne visent que des pages INDEXABLES (lib/indexable), les plus fournies
 * d'abord. Avant : 12 catégories et 10 villes figées — /lyon/kebab, /c/ramen ou
 * /marseille, vides ou en noindex, recevaient le maillage, et les villes qui ont des
 * plats notés (Rodez, Clermont-Ferrand…) n'étaient jamais liées.
 */
export default async function RelatedFilters({ locale, city, category }: Props) {
  const t = await getTranslations({ locale, namespace: 'related' });
  const localePrefix = locale === 'fr' ? '' : `/${locale}`;

  let index: Awaited<ReturnType<typeof fetchCategoryIndex>>;
  try {
    index = await fetchCategoryIndex();
  } catch {
    // Le maillage est un bonus : sans données, la page s'affiche sans ce bloc.
    return null;
  }

  const cities = indexableCities(index);
  const cityLink = (c: { slug: string; city: string }, cat?: string) => ({
    href: `${localePrefix}/${c.slug}${cat ? `/${cat}` : ''}`,
    label: c.city,
  });
  const categoryLink = (slug: string, inCity?: string) => ({
    href: inCity ? `${localePrefix}/${citySlug(inCity)}/${slug}` : `${localePrefix}/c/${slug}`,
    label: localizedCategory(slug, locale),
  });
  const capitalized = (slug: string) => {
    const label = localizedCategory(slug, locale);
    return label.charAt(0).toUpperCase() + label.slice(1);
  };

  let leftTitle = '';
  let leftLinks: Array<{ href: string; label: string }> = [];
  let rightTitle = '';
  let rightLinks: Array<{ href: string; label: string }> = [];

  if (city && category) {
    // /lyon/burger → autres catégories à Lyon + la même catégorie ailleurs
    leftTitle = t('moreInCity', { city });
    leftLinks = indexableCategories(index, city)
      .filter((c) => c.slug !== category)
      .slice(0, MAX_LINKS)
      .map((c) => categoryLink(c.slug, city));
    rightTitle = t('sameInOtherCities', { category: capitalized(category) });
    const byCity = index.categories.get(category)?.byCity;
    rightLinks = cities
      .filter((c) => c.slug !== citySlug(city) && (byCity?.get(c.slug)?.n ?? 0) >= MIN_DISHES_FOR_INDEX)
      .slice(0, MAX_LINKS)
      .map((c) => cityLink(c, category));
  } else if (city) {
    // /lyon → catégories de Lyon + autres villes
    leftTitle = t('topInCity', { city });
    leftLinks = indexableCategories(index, city)
      .slice(0, MAX_LINKS)
      .map((c) => categoryLink(c.slug, city));
    rightTitle = t('otherCities');
    rightLinks = cities
      .filter((c) => c.slug !== citySlug(city))
      .slice(0, MAX_LINKS)
      .map((c) => cityLink(c));
  } else if (category) {
    // /c/burger → autres catégories (gauche) + villes pour cette catégorie (droite),
    // comme la homepage (catégories à gauche, villes à droite).
    leftTitle = t('otherCategories');
    leftLinks = indexableCategories(index)
      .filter((c) => c.slug !== category)
      .slice(0, MAX_LINKS)
      .map((c) => categoryLink(c.slug));
    rightTitle = t('categoryByCity', { category: capitalized(category) });
    const byCity = index.categories.get(category)?.byCity;
    rightLinks = cities
      .filter((c) => (byCity?.get(c.slug)?.n ?? 0) >= MIN_DISHES_FOR_INDEX)
      .slice(0, MAX_LINKS)
      .map((c) => cityLink(c, category));
  } else {
    // Homepage → catégories + villes pour amorcer l'exploration
    leftTitle = t('exploreByCategory');
    leftLinks = indexableCategories(index)
      .slice(0, MAX_LINKS)
      .map((c) => categoryLink(c.slug));
    rightTitle = t('exploreByCity');
    rightLinks = cities.slice(0, MAX_LINKS).map((c) => cityLink(c));
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
            <h2 className="display text-[var(--text)] text-[26px] sm:text-[30px] mb-4">{leftTitle}</h2>
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
            <h2 className="display text-[var(--text)] text-[26px] sm:text-[30px] mb-4">{rightTitle}</h2>
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
