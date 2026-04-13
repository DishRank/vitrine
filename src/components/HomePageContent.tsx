import { fetchDishes, fetchCategories } from '@/lib/supabase';
import { localizedCategory } from '@/lib/categoryLabels';
import { citySlug, cityFromSlug } from '@/lib/slug';
import { buildFilterPath } from '@/lib/seoMetadata';
import Nav from './Nav';
import Hero from './Hero';
import SearchSection from './SearchSection';
import DishGrid from './DishGrid';
import WhySection from './WhySection';
import ExploreCategories from './ExploreCategories';
import Showcase from './Showcase';
import CtaBanner from './CtaBanner';
import Footer from './Footer';
import DishModal from './DishModal';
import LegalSheet from './LegalSheet';
import CookieConsent from './CookieConsent';
import BetaModal from './BetaModal';
import RelatedFilters from './RelatedFilters';

type Props = {
  locale: string;
  /** Category slug from the URL (e.g. "burger") */
  category?: string;
  /** Original city name from the DB (e.g. "Saint-Étienne") — already resolved from slug */
  city?: string;
  /** Optional ?q= text search */
  initialQuery?: string;
  /** Optional ?page= for legal sheet */
  initialPage?: string;
  /** Master list of all known cities (for the dropdown) */
  allCities: string[];
};

export default async function HomePageContent({
  locale,
  category,
  city,
  initialQuery,
  initialPage,
  allCities,
}: Props) {
  // Fetch dishes (cached) — by category if applicable
  let dishes: Awaited<ReturnType<typeof fetchDishes>> = [];
  let categories: Awaited<ReturnType<typeof fetchCategories>> = [];
  try {
    [dishes, categories] = await Promise.all([
      fetchDishes(category, 100),
      fetchCategories(),
    ]);
  } catch (e) {
    console.error('SSR fetch error:', e);
  }

  // Filter by city server-side (case-insensitive substring match for safety)
  if (city) {
    dishes = dishes.filter((d) =>
      d.restaurant_city?.toLowerCase().includes(city.toLowerCase())
    );
  }

  const categoryLabel = category ? localizedCategory(category, locale) : '';
  const cityLabel = city || '';

  // === JSON-LD ===

  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': 'https://dishrank.fr/#organization',
    name: 'DishRank',
    url: 'https://dishrank.fr',
    logo: 'https://dishrank.fr/img/icon.webp',
    sameAs: [
      'https://www.instagram.com/dishrank.app',
      'https://apps.apple.com/fr/app/dishrank/id6761752556',
      'https://play.google.com/store/apps/details?id=com.dishrank.app',
    ],
  };

  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': 'https://dishrank.fr/#website',
    url: 'https://dishrank.fr',
    name: 'DishRank',
    description: 'Note les plats, pas les restos.',
    publisher: { '@id': 'https://dishrank.fr/#organization' },
    inLanguage: ['fr-FR', 'en-US', 'es-ES', 'de-DE', 'it-IT'],
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://dishrank.fr/?q={search_term_string}',
      },
      'query-input': 'required name=search_term_string',
    },
  };

  const dishListJsonLd = dishes.length > 0
    ? {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name:
          categoryLabel && cityLabel
            ? `Best ${categoryLabel} in ${cityLabel}`
            : categoryLabel
            ? `Best ${categoryLabel}`
            : 'Top rated dishes',
        numberOfItems: dishes.length,
        itemListElement: dishes.slice(0, 10).map((d, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': 'Product',
            name: d.dish_name,
            image: d.cover_photo_url,
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: d.avg_rating,
              reviewCount: d.review_count,
              bestRating: 5,
            },
            ...(d.latest_price
              ? {
                  offers: {
                    '@type': 'Offer',
                    price: d.latest_price,
                    priceCurrency: d.currency || 'EUR',
                    availability: 'https://schema.org/InStock',
                  },
                }
              : {}),
            brand: {
              '@type': 'Restaurant',
              name: d.restaurant_name,
              address: d.restaurant_address,
            },
          },
        })),
      }
    : null;

  // BreadcrumbList using path-based URLs
  const localePrefix = locale === 'fr' ? '' : `/${locale}`;
  const breadcrumbItems: Array<{ '@type': string; position: number; name: string; item: string }> = [
    { '@type': 'ListItem', position: 1, name: 'DishRank', item: `https://dishrank.fr${localePrefix}` },
  ];
  if (city) {
    breadcrumbItems.push({
      '@type': 'ListItem',
      position: 2,
      name: cityLabel,
      item: `https://dishrank.fr${localePrefix}/${citySlug(city)}`,
    });
  }
  if (category) {
    breadcrumbItems.push({
      '@type': 'ListItem',
      position: city ? 3 : 2,
      name: categoryLabel,
      item: `https://dishrank.fr${localePrefix}${buildFilterPath(city, category)}`,
    });
  }
  const breadcrumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbItems,
  };

  // NOTE: FAQPage JSON-LD is intentionally NOT generated here. It lives in
  // <WhySection /> (the only place where the questions are visible to users),
  // which is the requirement of Google's FAQ structured data policy and
  // prevents the "duplicate FAQPage" Search Console error.

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }}
      />
      {dishListJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(dishListJsonLd) }}
        />
      )}
      <Nav />
      <main id="main-content">
        <Hero category={categoryLabel || undefined} city={cityLabel || undefined} />
        <SearchSection
          categories={categories}
          initialCategory={category || ''}
          initialCity={cityLabel || ''}
          initialQuery={initialQuery || ''}
          cities={allCities}
        />
        <DishGrid
          initialDishes={dishes}
          initialCategory={category || ''}
          initialCity={cityLabel || ''}
        />
        <CtaBanner />
        {(city || category) && (
          <RelatedFilters
            locale={locale}
            city={city}
            category={category}
            allCities={allCities}
          />
        )}
        <WhySection />
        <ExploreCategories />
        <Showcase />
      </main>
      <Footer />
      <DishModal />
      <LegalSheet initialPage={initialPage || ''} />
      <CookieConsent />
      <BetaModal />
    </>
  );
}

// Re-export so route files can use the same helper
export { cityFromSlug };
