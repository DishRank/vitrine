import { headers } from 'next/headers';
import dynamic from 'next/dynamic';
import { getTranslations } from 'next-intl/server';
import { fetchDishes, fetchCategories, fetchRecentReviews } from '@/lib/supabase';
import { localizedCategory } from '@/lib/categoryLabels';
import { jsonLdHtml } from '@/lib/jsonLd';
import { citySlug, cityFromSlug, restaurantSlug } from '@/lib/slug';
import { buildFilterPath, buildFilterUrl, buildBestCategoryFragment, buildTopDishesTitle } from '@/lib/seoMetadata';
import Nav from './Nav';
import Hero from './Hero';
import DishVsRestoDemo from './DishVsRestoDemo';
import SearchSection from './SearchSection';
import DishGrid from './DishGrid';
import SocialProof from './SocialProof';
import SocialFeatures from './SocialFeatures';
import FoodCloud from './FoodCloud';
import WhySection from './WhySection';
import FAQ from './FAQ';
import Showcase from './Showcase';
import CtaBanner from './CtaBanner';
import Footer from './Footer';
import RelatedFilters from './RelatedFilters';
import CityGuide from './CityGuide';
import TrackInView from './TrackInView';

// ─── Lazy-loaded modals ────────────────────────────────────────────────
// Ces composants ne s'affichent jamais au first paint (ils répondent à
// un user gesture ou à un délai). Les charger à la demande retire ~30 KB
// de JS du First Load Bundle de la home.
//
// On garde le SSR (`ssr: true` est le défaut) pour que l'HTML initial du
// LegalSheet soit pré-rendu si l'URL contient déjà `?page=privacy` (cas
// du partage direct sur Reddit etc.). Les autres modals n'ont pas
// d'usage SSR mais peuvent rester en SSR sans coût significatif.
const DishModal = dynamic(() => import('./DishModal'));
const LegalSheet = dynamic(() => import('./LegalSheet'));
const CookieConsent = dynamic(() => import('./CookieConsent'));
const BetaModal = dynamic(() => import('./BetaModal'));

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
  // Fetch dishes (cached) — by category if applicable.
  // recentReviews used by <SocialProof /> sur toutes les pages — cache 60s
  // partagé (clé `recent-reviews:12`) donc 1 query pour toutes les pages
  // dans la fenêtre de cache, négligeable même avec 200+ catégories.
  // Nonce CSP injecté par middleware — appliqué à tous les <script> JSON-LD
  // inline pour qu'ils soient autorisés par la CSP `'strict-dynamic'`.
  const nonce = (await headers()).get('x-nonce') || undefined;

  // Traductions pour le JSON-LD (description WebSite + SoftwareApplication).
  // Sans ça, ces descriptions restaient hardcodées FR sur toutes les locales
  // → mismatch de langue côté schema.org sur /en/, /es/, etc.
  const tMeta = await getTranslations({ locale, namespace: 'meta' });
  const siteTagline = tMeta('siteTagline');
  const appDescription = tMeta('appDescription');

  let dishes: Awaited<ReturnType<typeof fetchDishes>> = [];
  let categories: Awaited<ReturnType<typeof fetchCategories>> = [];
  let recentReviews: Awaited<ReturnType<typeof fetchRecentReviews>> = [];
  const isHome = !category && !city;
  try {
    [dishes, categories, recentReviews] = await Promise.all([
      fetchDishes(category, 100),
      fetchCategories(),
      fetchRecentReviews(12),
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
  // Pre-built "best category" fragment with correct FR grammar — passed to
  // <Hero /> and re-used in meta tags so wording stays consistent.
  const bestCategory = category ? buildBestCategoryFragment(locale, category, categoryLabel) : '';

  // Pre-built "Les 10 meilleurs X" title passed to <DishGrid />. Handles FR
  // grammar (gender agreement) and the nationality prefix ("plats français").
  const topDishesTitle = buildTopDishesTitle({
    locale,
    categorySlug: category || undefined,
    categoryLabel: categoryLabel || undefined,
    cityLabel: cityLabel || undefined,
    limit: 10,
  });

  // === JSON-LD ===

  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': 'https://dishrank.fr/#organization',
    name: 'DishRank',
    alternateName: ['Dish Rank', 'Dish-Rank', 'dishrank'],
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
    alternateName: ['Dish Rank', 'Dish-Rank', 'dishrank'],
    description: siteTagline,
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

  // SoftwareApplication : declare the mobile app so Google can show "app install"
  // rich results on queries like "dishrank app" or "app noter plats".
  const softwareAppJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': 'https://dishrank.fr/#app',
    name: 'DishRank',
    alternateName: ['Dish Rank', 'Dish-Rank'],
    operatingSystem: 'iOS, Android',
    applicationCategory: 'LifestyleApplication',
    description: appDescription,
    url: 'https://dishrank.fr',
    downloadUrl: [
      'https://apps.apple.com/fr/app/dishrank/id6761752556',
      'https://play.google.com/store/apps/details?id=com.dishrank.app',
    ],
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'EUR',
    },
    publisher: { '@id': 'https://dishrank.fr/#organization' },
    inLanguage: ['fr', 'en', 'es', 'de', 'it'],
  };

  // Build the ItemList of top dishes as schema.org Product items.
  //
  // Design notes (why this exact shape):
  //  - `Product` is the recommended type for any rated item (Google has
  //    dedicated rich results for "Product with AggregateRating").
  //  - `description` is required to get rid of the "missing description"
  //    Search Console warning. We build it from restaurant + price.
  //  - `brand` must be `Brand` or `Organization`, NOT `Restaurant` (that was
  //    the "invalid type for brand" warning). We use `Organization` with the
  //    restaurant name, which is the semantically correct mapping.
  //  - We intentionally do NOT emit an `Offer` object: DishRank is not a
  //    merchant, there is no actual online sale, and emitting `offers`
  //    without `shippingDetails` / `hasMerchantReturnPolicy` triggers
  //    merchant-listing warnings. The price is instead embedded in the
  //    description text, which Google still picks up for snippets.
  const pageUrl = buildFilterUrl(locale, city, category);
  const dishListJsonLd = dishes.length > 0
    ? (() => {
        // Note: we deliberately do NOT attach an `aggregateRating` to the
        // ItemList. Google's review-snippet schema only accepts AggregateRating
        // under a fixed list of parent types (Product, LocalBusiness, Recipe,
        // Organization, …). ItemList is not in that list, and adding it
        // triggered the Search Console error
        //   "Type d'objet non valide pour le champ <parent_node>".
        // Individual itemListElement[].item entries are Product objects, which
        // ARE valid parents — so the signal is preserved per dish, plus the
        // FoodEstablishment JSON-LD on city pages carries the page-level
        // aggregate.

        return {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name:
            categoryLabel && cityLabel
              ? `Best ${categoryLabel} in ${cityLabel}`
              : categoryLabel
              ? `Best ${categoryLabel}`
              : cityLabel
              ? `Best dishes in ${cityLabel}`
              : 'Top rated dishes',
          url: pageUrl,
          numberOfItems: dishes.length,
          itemListElement: dishes.slice(0, 10).map((d, i) => {
            const priceFragment = d.latest_price
              ? `${Number(d.latest_price).toFixed(2)} ${d.currency || 'EUR'}`
              : null;
            const addressFragment = d.restaurant_address ? ` — ${d.restaurant_address}` : '';
            // Example: "Menu 39€ servi chez Sambahia — Rue du Doyenné, Lyon, 69005. Noté 5/5 sur DishRank (1 avis)."
            const description = [
              `${d.dish_name} servi chez ${d.restaurant_name}${addressFragment}.`,
              priceFragment ? `Prix : ${priceFragment}.` : null,
              `Noté ${Number(d.avg_rating).toFixed(1)}/5 sur DishRank (${d.review_count} avis).`,
            ]
              .filter(Boolean)
              .join(' ');

            // URL unique par plat — pointe vers la page resto avec un
            // fragment sur le slug du nom du plat. Important :
            //   • Le fragment DOIT être unique par dish (avant on utilisait
            //     `#dish-${restaurant_id}` → URLs dupliquées quand un resto
            //     avait plusieurs plats au Top, ce qui violait la règle
            //     schema.org "Product.url must be unique per item").
            //   • Cibler la page resto (et pas la home) augmente la valeur
            //     SEO du lien : Google découvre la page fiche resto via le
            //     ItemList, et le fragment plat sert d'ancre logique.
            const localePref = locale === 'fr' ? '' : `/${locale}`;
            const dishUrl = d.restaurant_city
              ? `https://dishrank.fr${localePref}/${citySlug(d.restaurant_city)}/r/${restaurantSlug(d.restaurant_name)}#${restaurantSlug(d.dish_name)}`
              : `${pageUrl}#${restaurantSlug(d.dish_name)}-${d.restaurant_id.slice(0, 8)}`;

            return {
              '@type': 'ListItem',
              position: i + 1,
              item: {
                '@type': 'Product',
                name: d.dish_name,
                url: dishUrl,
                description,
                image: d.cover_photo_url,
                aggregateRating: {
                  '@type': 'AggregateRating',
                  ratingValue: Number(d.avg_rating),
                  reviewCount: Math.max(Number(d.review_count) || 0, 1),
                  bestRating: 5,
                  worstRating: 1,
                },
                brand: {
                  '@type': 'Organization',
                  name: d.restaurant_name,
                },
              },
            };
          }),
        };
      })()
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

  // LocalBusiness / FoodEstablishment : activates local SEO signals (Knowledge
  // Panel, Maps pack) on city-level pages. Only generated when a city is
  // present. The aggregateRating is computed from the fetched dishes so Google
  // sees real numbers, not made-up ones.
  const localBusinessJsonLd = city && dishes.length > 0
    ? (() => {
        const avgRating =
          dishes.reduce((sum, d) => sum + Number(d.avg_rating), 0) / dishes.length;
        const totalReviews = dishes.reduce((sum, d) => sum + Number(d.review_count), 0);
        const name = categoryLabel
          ? `DishRank — ${categoryLabel} ${cityLabel}`
          : `DishRank ${cityLabel}`;
        return {
          '@context': 'https://schema.org',
          '@type': 'FoodEstablishment',
          '@id': `${buildFilterUrl(locale, city, category)}#place`,
          name,
          url: buildFilterUrl(locale, city, category),
          image: 'https://dishrank.fr/img/play_store_feature_graphic.webp',
          address: {
            '@type': 'PostalAddress',
            addressLocality: cityLabel,
            addressCountry: 'FR',
          },
          areaServed: {
            '@type': 'City',
            name: cityLabel,
          },
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: Math.round(avgRating * 10) / 10,
            reviewCount: Math.max(totalReviews, dishes.length),
            bestRating: 5,
            worstRating: 1,
          },
          priceRange: '€€',
        };
      })()
    : null;

  // NOTE: FAQPage JSON-LD is intentionally NOT generated here. It lives in
  // <WhySection /> (the only place where the questions are visible to users),
  // which is the requirement of Google's FAQ structured data policy and
  // prevents the "duplicate FAQPage" Search Console error.

  return (
    <>
      {/* `suppressHydrationWarning` requis sur les <script nonce={...}> :
          React 19 retire l'attribut `nonce` du DOM après hydratation pour
          ne pas le leaker au JS client (cf. github.com/facebook/react#26334),
          ce qui crée un mismatch avec l'arbre serveur qui contient encore
          le nonce. Le warning est cosmétique — l'attribut a déjà été utilisé
          par le browser au parse-time pour valider la CSP. */}
      <script
        type="application/ld+json"
        nonce={nonce}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(organizationJsonLd) }}
      />
      <script
        type="application/ld+json"
        nonce={nonce}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(websiteJsonLd) }}
      />
      <script
        type="application/ld+json"
        nonce={nonce}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(softwareAppJsonLd) }}
      />
      <script
        type="application/ld+json"
        nonce={nonce}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(breadcrumbs) }}
      />
      {dishListJsonLd && (
        <script
          type="application/ld+json"
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: jsonLdHtml(dishListJsonLd) }}
        />
      )}
      {localBusinessJsonLd && (
        <script
          type="application/ld+json"
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: jsonLdHtml(localBusinessJsonLd) }}
        />
      )}
      <Nav />
      <main id="main-content">
        <Hero
          category={categoryLabel || undefined}
          city={cityLabel || undefined}
          bestCategory={bestCategory || undefined}
        />
        {/* Démo "même resto, plats opposés" — preuve visuelle immédiate du
            value prop. Home uniquement : sur les pages filtrées catégorie/
            ville, le visiteur est déjà en shopping intent, on ne ré-explique
            pas le concept. Trackée pour mesurer son impact sur les
            conversions (corrélation avec téléchargements post-vue). */}
        {isHome && (
          <TrackInView section="dish_vs_resto_demo">
            <DishVsRestoDemo />
          </TrackInView>
        )}
        <SearchSection
          categories={categories}
          initialCategory={category || ''}
          initialCity={cityLabel || ''}
          initialQuery={initialQuery || ''}
          cities={allCities}
        />
        <DishGrid
          initialDishes={dishes}
          title={topDishesTitle}
        />
        {/* "Entre amis" — promu juste après le Top 10 pour servir le pitch
            social tôt dans le scroll : tu viens de voir des plats notés,
            tu apprends que tu peux décider en groupe sans débat WhatsApp.
            Cohérent avec le tagline du Hero ("met fin aux débats"). */}
        <TrackInView section="social_features">
          <SocialFeatures />
        </TrackInView>
        {/* CTA banner placé après les deux pitchs (top 10 + social) —
            l'utilisateur a vu la valeur produit ET la valeur sociale, c'est
            le bon moment pour télécharger. */}
        <CtaBanner />
        {/* "En direct" — feed marquee, montre que la communauté est active.
            Maintenant affiché sur toutes les pages (home + filtrées) tant
            qu'on a assez d'avis récents (le composant retourne null en
            interne si reviews.length < 6). Recent reviews ne sont fetchés
            que sur la home pour éviter une N+1 query, donc en pratique le
            marquee n'apparaît qu'à la home pour l'instant. */}
        <SocialProof reviews={recentReviews} />
        {(city || category) && (
          <CityGuide
            locale={locale}
            city={city}
            category={category}
            dishes={dishes}
          />
        )}
        {/* Affiche aussi sur la home (pas de filtre) pour le maillage SEO :
            top categories + top cities visibles en un coup d'oeil. */}
        <RelatedFilters
          locale={locale}
          city={city}
          category={category}
          allCities={allCities}
        />
        {/* Transition visuelle nuage d'emojis flottants — affiché sur toutes
            les pages (décoratif universel, pas de cost SEO). */}
        <FoodCloud />
        <WhySection />
        {/* FAQ accordéon — uniquement sur la home pour ne pas dupliquer le
            JSON-LD FAQPage avec celui de WhySection sur les pages filtrées
            (sinon Search Console flagge "duplicate FAQPage"). */}
        {isHome && <FAQ nonce={nonce} />}
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
