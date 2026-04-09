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

  const faqJsonLd = (category || city)
    ? buildFaqJsonLd(locale, categoryLabel, cityLabel, dishes)
    : null;

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
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
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
        <RelatedFilters
          locale={locale}
          city={city}
          category={category}
          allCities={allCities}
        />
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

// === FAQ JSON-LD generator (localized) ===

type FaqDish = {
  dish_name: string;
  restaurant_name: string;
  latest_price: number | null;
  currency: string;
  avg_rating: number;
};

function buildFaqJsonLd(locale: string, category: string, city: string, dishes: FaqDish[]) {
  const top3 = dishes.slice(0, 3);
  const top3Names = top3.map((d) => `${d.dish_name} (${d.restaurant_name})`).join(', ');
  const prices = top3.filter((d) => d.latest_price).map((d) => Number(d.latest_price));
  const avgPrice =
    prices.length > 0
      ? Math.round((prices.reduce((s, p) => s + p, 0) / prices.length) * 100) / 100
      : null;
  const currency = top3[0]?.currency || 'EUR';
  const currencySymbol =
    currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency === 'GBP' ? '£' : currency;

  const templates = {
    fr: {
      q1: category && city
        ? `Quel est le meilleur ${category} à ${city} ?`
        : category
        ? `Quel est le meilleur ${category} ?`
        : `Où manger les meilleurs plats à ${city} ?`,
      a1: top3.length > 0
        ? `Selon les avis de la communauté DishRank, le top ${top3.length} ${category || 'plats'}${city ? ` à ${city}` : ''} : ${top3Names}.`
        : `Découvre le classement complet sur DishRank, basé sur les avis vérifiés de la communauté.`,
      q2: avgPrice ? `Combien coûte un ${category || 'plat'}${city ? ` à ${city}` : ''} ?` : null,
      a2: avgPrice
        ? `Le prix moyen d'un ${category || 'plat'}${city ? ` à ${city}` : ''} est d'environ ${avgPrice} ${currencySymbol} selon les avis de la communauté DishRank.`
        : null,
      q3: `Comment fonctionne le classement DishRank ?`,
      a3: `DishRank classe les plats (et non les restaurants) selon les notes et avis vérifiés de sa communauté de gourmets. Chaque utilisateur peut noter un plat de 1 à 5 étoiles, ajouter une photo, le prix et un commentaire.`,
    },
    en: {
      q1: category && city
        ? `What is the best ${category} in ${city}?`
        : category
        ? `What is the best ${category}?`
        : `Where to eat the best dishes in ${city}?`,
      a1: top3.length > 0
        ? `According to DishRank community reviews, the top ${top3.length} ${category || 'dishes'}${city ? ` in ${city}` : ''}: ${top3Names}.`
        : `Find the full ranking on DishRank, based on verified community reviews.`,
      q2: avgPrice ? `How much does a ${category || 'dish'} cost${city ? ` in ${city}` : ''}?` : null,
      a2: avgPrice
        ? `The average price of a ${category || 'dish'}${city ? ` in ${city}` : ''} is around ${avgPrice} ${currencySymbol} according to DishRank community reviews.`
        : null,
      q3: `How does the DishRank ranking work?`,
      a3: `DishRank ranks dishes (not restaurants) based on verified ratings and reviews from its community of foodies. Each user can rate a dish from 1 to 5 stars, add a photo, the price and a comment.`,
    },
    es: {
      q1: category && city
        ? `¿Cuál es el mejor ${category} en ${city}?`
        : category
        ? `¿Cuál es el mejor ${category}?`
        : `¿Dónde comer los mejores platos en ${city}?`,
      a1: top3.length > 0
        ? `Según las opiniones de la comunidad DishRank, el top ${top3.length} ${category || 'platos'}${city ? ` en ${city}` : ''}: ${top3Names}.`
        : `Encuentra la clasificación completa en DishRank, basada en opiniones verificadas de la comunidad.`,
      q2: avgPrice ? `¿Cuánto cuesta un ${category || 'plato'}${city ? ` en ${city}` : ''}?` : null,
      a2: avgPrice
        ? `El precio medio de un ${category || 'plato'}${city ? ` en ${city}` : ''} es de unos ${avgPrice} ${currencySymbol} según las opiniones de la comunidad DishRank.`
        : null,
      q3: `¿Cómo funciona el ranking de DishRank?`,
      a3: `DishRank clasifica los platos (no los restaurantes) según las valoraciones y opiniones verificadas de su comunidad de gourmets. Cada usuario puede valorar un plato de 1 a 5 estrellas, añadir una foto, el precio y un comentario.`,
    },
    de: {
      q1: category && city
        ? `Was ist der beste ${category} in ${city}?`
        : category
        ? `Was ist der beste ${category}?`
        : `Wo isst man die besten Gerichte in ${city}?`,
      a1: top3.length > 0
        ? `Laut den Bewertungen der DishRank Community sind die Top ${top3.length} ${category || 'Gerichte'}${city ? ` in ${city}` : ''}: ${top3Names}.`
        : `Finde das vollständige Ranking auf DishRank, basierend auf verifizierten Community-Bewertungen.`,
      q2: avgPrice ? `Wie viel kostet ein ${category || 'Gericht'}${city ? ` in ${city}` : ''}?` : null,
      a2: avgPrice
        ? `Der Durchschnittspreis für ein ${category || 'Gericht'}${city ? ` in ${city}` : ''} liegt laut DishRank Community Bewertungen bei etwa ${avgPrice} ${currencySymbol}.`
        : null,
      q3: `Wie funktioniert das DishRank Ranking?`,
      a3: `DishRank bewertet Gerichte (nicht Restaurants) basierend auf verifizierten Bewertungen und Reviews seiner Foodie-Community. Jeder Nutzer kann ein Gericht mit 1 bis 5 Sternen bewerten, ein Foto, den Preis und einen Kommentar hinzufügen.`,
    },
    it: {
      q1: category && city
        ? `Qual è il miglior ${category} a ${city}?`
        : category
        ? `Qual è il miglior ${category}?`
        : `Dove mangiare i migliori piatti a ${city}?`,
      a1: top3.length > 0
        ? `Secondo le recensioni della community DishRank, i top ${top3.length} ${category || 'piatti'}${city ? ` a ${city}` : ''}: ${top3Names}.`
        : `Scopri la classifica completa su DishRank, basata su recensioni verificate della community.`,
      q2: avgPrice ? `Quanto costa un ${category || 'piatto'}${city ? ` a ${city}` : ''}?` : null,
      a2: avgPrice
        ? `Il prezzo medio di un ${category || 'piatto'}${city ? ` a ${city}` : ''} è di circa ${avgPrice} ${currencySymbol} secondo le recensioni della community DishRank.`
        : null,
      q3: `Come funziona la classifica DishRank?`,
      a3: `DishRank classifica i piatti (non i ristoranti) in base ai voti e alle recensioni verificate della sua community di gourmet. Ogni utente può valutare un piatto da 1 a 5 stelle, aggiungere una foto, il prezzo e un commento.`,
    },
  };

  const tpl = templates[locale as keyof typeof templates] || templates.fr;

  const questions = [
    { name: tpl.q1, text: tpl.a1 },
    ...(tpl.q2 && tpl.a2 ? [{ name: tpl.q2, text: tpl.a2 }] : []),
    { name: tpl.q3, text: tpl.a3 },
  ];

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: questions.map((q) => ({
      '@type': 'Question',
      name: q.name,
      acceptedAnswer: { '@type': 'Answer', text: q.text },
    })),
  };
}

// Re-export so route files can use the same helper
export { cityFromSlug };
