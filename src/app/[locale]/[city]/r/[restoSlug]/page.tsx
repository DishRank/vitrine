import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import dynamic from 'next/dynamic';
import {
  fetchCities,
  fetchRestaurantBySlug,
  fetchDishesForRestaurant,
  fetchReviewsForRestaurant,
} from '@/lib/supabase';
import { cityFromSlug, citySlug, restaurantSlug } from '@/lib/slug';
import Nav from '@/components/Nav';
import DishGrid from '@/components/DishGrid';
import CtaBanner from '@/components/CtaBanner';
import Footer from '@/components/Footer';
import RelatedFilters from '@/components/RelatedFilters';

const DishModal = dynamic(() => import('@/components/DishModal'));
const LegalSheet = dynamic(() => import('@/components/LegalSheet'));
const CookieConsent = dynamic(() => import('@/components/CookieConsent'));
const BetaModal = dynamic(() => import('@/components/BetaModal'));

// ISR : 1h pour matcher les autres routes filtrées
export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string; city: string; restoSlug: string }>;
  searchParams: Promise<{ page?: string }>;
};

const SITE = 'https://dishrank.fr';

function localePrefix(locale: string): string {
  return locale === 'fr' ? '' : `/${locale}`;
}

function buildRestaurantUrl(locale: string, cityName: string, slug: string): string {
  return `${SITE}${localePrefix(locale)}/${citySlug(cityName)}/r/${slug}`;
}

// schema.org attend le jour en anglais ; nos `opening_intervals` sont
// 0-indexés lundi→dimanche.
const SCHEMA_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function minutesToHHMM(min: number): string {
  const clamped = Math.min(Math.max(min, 0), 1439); // 1440 (=24:00) → 23:59 (ISO time)
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** `opening_intervals` ({ d:0=lun…6=dim, s, e minutes }) → schema.org
 *  OpeningHoursSpecification (une entrée par créneau de service ; les
 *  services de nuit sont déjà scindés côté app). */
function openingHoursSpec(
  intervals: { d: number; s: number; e: number }[] | null,
) {
  if (!intervals || !intervals.length) return undefined;
  const specs = intervals
    .filter((iv) => SCHEMA_DAYS[iv.d] && iv.e > iv.s)
    .map((iv) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: `https://schema.org/${SCHEMA_DAYS[iv.d]}`,
      opens: minutesToHHMM(iv.s),
      closes: minutesToHHMM(iv.e),
    }));
  return specs.length ? specs : undefined;
}

/** Slug de cuisine ('coffee_shop') → libellé lisible ('Coffee Shop') pour
 *  `servesCuisine` (schema.org attend du texte, pas des slugs). */
function prettyCuisine(slug: string): string {
  return slug
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Q/R localisées pour le FAQPage JSON-LD — cible les réponses directes des
 *  moteurs IA (« quels sont les meilleurs plats », « quelle note », « où »). */
function buildRestaurantFaq(
  locale: string,
  d: {
    name: string;
    cityName: string;
    address: string | null;
    avg: number;
    count: number;
    top: { dish_name: string; avg_rating: number }[];
  },
) {
  const dishesList = d.top
    .slice(0, 3)
    .map((x) => `${x.dish_name} (${Number(x.avg_rating).toFixed(1)}/5)`)
    .join(', ');
  const loc = d.address ? `${d.address}, ${d.cityName}` : d.cityName;

  type QA = { q: string; a: string };
  const byLocale: Record<string, QA[]> = {
    fr: [
      { q: `Quels sont les meilleurs plats chez ${d.name} ?`, a: `Sur DishRank, les plats les mieux notés chez ${d.name} sont : ${dishesList}.` },
      { q: `Quelle est la note de ${d.name} sur DishRank ?`, a: `${d.name} a une note moyenne de ${d.avg}/5 basée sur ${d.count} avis vérifiés de la communauté DishRank.` },
      { q: `Où se trouve ${d.name} ?`, a: `${d.name} se situe à ${loc}.` },
    ],
    en: [
      { q: `What are the best dishes at ${d.name}?`, a: `On DishRank, the top-rated dishes at ${d.name} are: ${dishesList}.` },
      { q: `What is ${d.name}'s rating on DishRank?`, a: `${d.name} has an average rating of ${d.avg}/5 based on ${d.count} verified reviews from the DishRank community.` },
      { q: `Where is ${d.name} located?`, a: `${d.name} is located in ${loc}.` },
    ],
    es: [
      { q: `¿Cuáles son los mejores platos de ${d.name}?`, a: `En DishRank, los platos mejor valorados de ${d.name} son: ${dishesList}.` },
      { q: `¿Qué valoración tiene ${d.name} en DishRank?`, a: `${d.name} tiene una valoración media de ${d.avg}/5 basada en ${d.count} reseñas verificadas de la comunidad DishRank.` },
      { q: `¿Dónde está ${d.name}?`, a: `${d.name} se encuentra en ${loc}.` },
    ],
    de: [
      { q: `Was sind die besten Gerichte bei ${d.name}?`, a: `Auf DishRank sind die bestbewerteten Gerichte bei ${d.name}: ${dishesList}.` },
      { q: `Wie ist die Bewertung von ${d.name} auf DishRank?`, a: `${d.name} hat eine Durchschnittsbewertung von ${d.avg}/5 auf Basis von ${d.count} verifizierten Bewertungen der DishRank-Community.` },
      { q: `Wo befindet sich ${d.name}?`, a: `${d.name} befindet sich in ${loc}.` },
    ],
    it: [
      { q: `Quali sono i piatti migliori da ${d.name}?`, a: `Su DishRank, i piatti più votati da ${d.name} sono: ${dishesList}.` },
      { q: `Qual è la valutazione di ${d.name} su DishRank?`, a: `${d.name} ha una valutazione media di ${d.avg}/5 basata su ${d.count} recensioni verificate della community DishRank.` },
      { q: `Dove si trova ${d.name}?`, a: `${d.name} si trova a ${loc}.` },
    ],
  };
  const list = byLocale[locale] || byLocale.fr;
  return list.map((x) => ({
    '@type': 'Question',
    name: x.q,
    acceptedAnswer: { '@type': 'Answer', text: x.a },
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, city, restoSlug } = await params;

  let allCities: string[] = [];
  try {
    allCities = await fetchCities();
  } catch {}
  const cityName = cityFromSlug(city, allCities);
  if (!cityName) return { robots: { index: false, follow: false } };

  const restaurant = await fetchRestaurantBySlug(cityName, restoSlug).catch(() => null);
  if (!restaurant) return { robots: { index: false, follow: false } };

  // Titre / description SEO — leveragent le nom + la ville pour matcher les
  // recherches brandées type "{nom} {ville} avis" / "{nom} menu".
  const titleByLocale: Record<string, string> = {
    fr: `${restaurant.name} à ${cityName} — Tous les plats notés | DishRank`,
    en: `${restaurant.name} in ${cityName} — All rated dishes | DishRank`,
    es: `${restaurant.name} en ${cityName} — Todos los platos valorados | DishRank`,
    de: `${restaurant.name} in ${cityName} — Alle bewerteten Gerichte | DishRank`,
    it: `${restaurant.name} a ${cityName} — Tutti i piatti valutati | DishRank`,
  };
  const descByLocale: Record<string, string> = {
    fr: `Découvre tous les plats de ${restaurant.name} à ${cityName} notés par la communauté DishRank. Photos, prix, avis vérifiés — sache exactement quoi commander.`,
    en: `Discover every dish at ${restaurant.name} in ${cityName}, rated by the DishRank community. Photos, prices, verified reviews — know exactly what to order.`,
    es: `Descubre todos los platos de ${restaurant.name} en ${cityName} valorados por la comunidad DishRank. Fotos, precios, opiniones verificadas — sabe exactamente qué pedir.`,
    de: `Entdecke alle Gerichte von ${restaurant.name} in ${cityName}, bewertet von der DishRank-Community. Fotos, Preise, verifizierte Bewertungen — wisse genau, was du bestellen sollst.`,
    it: `Scopri tutti i piatti di ${restaurant.name} a ${cityName} valutati dalla community DishRank. Foto, prezzi, recensioni verificate — sai esattamente cosa ordinare.`,
  };

  const title = titleByLocale[locale] || titleByLocale.fr;
  const description = descByLocale[locale] || descByLocale.fr;
  const canonical = buildRestaurantUrl(locale, cityName, restoSlug);

  const HREFLANG: Record<string, string> = {
    fr: 'fr-FR', en: 'en-US', es: 'es-ES', de: 'de-DE', it: 'it-IT',
  };

  return {
    title,
    description,
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: 'DishRank',
      images: [{ url: `${SITE}/img/play_store_feature_graphic.webp`, width: 1024, height: 500 }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${SITE}/img/play_store_feature_graphic.webp`],
    },
    alternates: {
      canonical,
      languages: {
        [HREFLANG.fr]: buildRestaurantUrl('fr', cityName, restoSlug),
        [HREFLANG.en]: buildRestaurantUrl('en', cityName, restoSlug),
        [HREFLANG.es]: buildRestaurantUrl('es', cityName, restoSlug),
        [HREFLANG.de]: buildRestaurantUrl('de', cityName, restoSlug),
        [HREFLANG.it]: buildRestaurantUrl('it', cityName, restoSlug),
        'x-default': buildRestaurantUrl('fr', cityName, restoSlug),
      },
    },
  };
}

export default async function RestaurantPage({ params, searchParams }: Props) {
  const { locale, city, restoSlug } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;

  let allCities: string[] = [];
  try {
    allCities = await fetchCities();
  } catch {}

  const cityName = cityFromSlug(city, allCities);
  if (!cityName) notFound();

  const restaurant = await fetchRestaurantBySlug(cityName, restoSlug);
  if (!restaurant) notFound();

  const dishes = await fetchDishesForRestaurant(restaurant.id).catch(() => []);

  // Si 0 plat moderé → on ne render PAS la page indexable (équivalent 404 SEO).
  // Empêche les soft-404 sur des restos qui existent en DB mais n'ont aucune
  // review modérée affichable.
  if (dishes.length === 0) notFound();

  // Avis récents avec commentaire (tous plats confondus) → Review[] du JSON-LD.
  const reviews = await fetchReviewsForRestaurant(restaurant.id).catch(() => []);

  // Address + geo viennent de la RPC `get_feed_dishes` (déjà jointe côté DB)
  // plutôt que d'un SELECT direct sur `restaurants` — on évite de supposer
  // des colonnes qui pourraient ne pas exister. Tous les dishes d'un même
  // resto partagent les mêmes valeurs ici, donc on prend dishes[0].
  const restaurantAddress = dishes[0]?.restaurant_address || null;
  const restaurantLat = dishes[0]?.restaurant_lat ?? null;
  const restaurantLng = dishes[0]?.restaurant_lng ?? null;

  const nonce = (await headers()).get('x-nonce') || undefined;

  const tMeta = await getTranslations({ locale, namespace: 'meta' });
  const siteTagline = tMeta('siteTagline');
  const appDescription = tMeta('appDescription');

  const canonical = buildRestaurantUrl(locale, cityName, restoSlug);

  // Stats agrégées pour le hero
  const totalReviews = dishes.reduce((sum, d) => sum + Number(d.review_count), 0);
  const avgRating = dishes.length > 0
    ? dishes.reduce((sum, d) => sum + Number(d.avg_rating), 0) / dishes.length
    : 0;
  const topDish = dishes[0];

  // === JSON-LD ===

  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE}/#organization`,
    name: 'DishRank',
    alternateName: ['Dish Rank', 'Dish-Rank', 'dishrank'],
    url: SITE,
    logo: `${SITE}/img/icon.webp`,
    sameAs: [
      'https://www.instagram.com/dishrank.app',
      'https://apps.apple.com/fr/app/dishrank/id6761752556',
      'https://play.google.com/store/apps/details?id=com.dishrank.app',
    ],
  };

  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE}/#website`,
    url: SITE,
    name: 'DishRank',
    description: siteTagline,
    publisher: { '@id': `${SITE}/#organization` },
    inLanguage: ['fr-FR', 'en-US', 'es-ES', 'de-DE', 'it-IT'],
  };

  const softwareAppJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': `${SITE}/#app`,
    name: 'DishRank',
    operatingSystem: 'iOS, Android',
    applicationCategory: 'LifestyleApplication',
    description: appDescription,
    url: SITE,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    publisher: { '@id': `${SITE}/#organization` },
  };

  const breadcrumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'DishRank', item: `${SITE}${localePrefix(locale)}` },
      { '@type': 'ListItem', position: 2, name: cityName, item: `${SITE}${localePrefix(locale)}/${citySlug(cityName)}` },
      { '@type': 'ListItem', position: 3, name: restaurant.name, item: canonical },
    ],
  };

  // Restaurant schema — clé pour les recherches brandées.
  // hasMenuItem référence chaque plat noté comme MenuItem (plus précis que
  // Product ici car on est dans un contexte resto + menu).
  const restaurantJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    '@id': `${canonical}#restaurant`,
    name: restaurant.name,
    url: canonical,
    image: dishes[0]?.cover_photo_url || `${SITE}/img/play_store_feature_graphic.webp`,
    address: {
      '@type': 'PostalAddress',
      streetAddress: restaurantAddress || undefined,
      addressLocality: cityName,
      addressCountry: 'FR',
    },
    geo: restaurantLat && restaurantLng ? {
      '@type': 'GeoCoordinates',
      latitude: restaurantLat,
      longitude: restaurantLng,
    } : undefined,
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: Math.round(avgRating * 10) / 10,
      reviewCount: Math.max(totalReviews, dishes.length),
      bestRating: 5,
      worstRating: 1,
    },
    priceRange: '€€',
    telephone: restaurant.phone || undefined,
    servesCuisine:
      restaurant.cuisines && restaurant.cuisines.length
        ? restaurant.cuisines.map(prettyCuisine)
        : undefined,
    menu: canonical,
    openingHoursSpecification: openingHoursSpec(restaurant.opening_intervals),
    review: reviews.length
      ? reviews.map((rv) => ({
          '@type': 'Review',
          author: { '@type': 'Person', name: rv.profiles?.display_name || 'DishRank' },
          datePublished: rv.created_at,
          reviewRating: {
            '@type': 'Rating',
            ratingValue: Number(rv.rating),
            bestRating: 5,
            worstRating: 1,
          },
          name: rv.dish_name,
          reviewBody: rv.comment,
        }))
      : undefined,
    hasMenu: {
      '@type': 'Menu',
      hasMenuSection: {
        '@type': 'MenuSection',
        name: 'Plats notés sur DishRank',
        hasMenuItem: dishes.map((d) => ({
          '@type': 'MenuItem',
          name: d.dish_name,
          image: d.cover_photo_url,
          offers: d.latest_price ? {
            '@type': 'Offer',
            price: Number(d.latest_price).toFixed(2),
            priceCurrency: d.currency || 'EUR',
          } : undefined,
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: Number(d.avg_rating),
            reviewCount: Math.max(Number(d.review_count) || 0, 1),
            bestRating: 5,
            worstRating: 1,
          },
        })),
      },
    },
  };

  // FAQPage — questions/réponses localisées adossées aux données réelles du
  // resto. Cible les « featured snippets » et surtout les réponses directes
  // des moteurs IA (ChatGPT, Perplexity, Google AI Overviews).
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${canonical}#faq`,
    mainEntity: buildRestaurantFaq(locale, {
      name: restaurant.name,
      cityName,
      address: restaurantAddress,
      avg: Math.round(avgRating * 10) / 10,
      count: Math.max(totalReviews, dishes.length),
      top: dishes.map((d) => ({ dish_name: d.dish_name, avg_rating: Number(d.avg_rating) })),
    }),
  };

  // Titre H2 du DishGrid — réutilisé du composant existant
  const topDishesTitle =
    locale === 'fr' ? `Les plats notés chez ${restaurant.name}`
    : locale === 'en' ? `Rated dishes at ${restaurant.name}`
    : locale === 'es' ? `Platos valorados en ${restaurant.name}`
    : locale === 'de' ? `Bewertete Gerichte bei ${restaurant.name}`
    : locale === 'it' ? `Piatti valutati da ${restaurant.name}`
    : `Rated dishes at ${restaurant.name}`;

  return (
    <>
      <script type="application/ld+json" nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
      <script type="application/ld+json" nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
      <script type="application/ld+json" nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppJsonLd) }} />
      <script type="application/ld+json" nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }} />
      <script type="application/ld+json" nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify(restaurantJsonLd).replace(/</g, '\\u003c') }} />
      <script type="application/ld+json" nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, '\\u003c') }} />

      <Nav />
      <main id="main-content">
        {/* Hero compact spécifique resto — pas le gros Hero de la home,
            on garde le focus sur les plats. */}
        <section className="relative pt-24 pb-8 sm:pb-12 text-center overflow-hidden">
          <div
            className="absolute -top-[80px] left-1/2 -translate-x-1/2 rounded-full pointer-events-none"
            style={{
              width: 'min(900px, 100vw)',
              height: 'min(500px, 55vw)',
              background: 'radial-gradient(closest-side, rgba(124,108,247,0.20), transparent 70%)',
              filter: 'blur(40px)',
              contain: 'paint',
            }}
            aria-hidden="true"
          />

          <div className="relative z-10 max-w-[1100px] mx-auto px-4 sm:px-8">
            {/* Breadcrumb */}
            <nav aria-label="Breadcrumb" className="mb-5 text-xs sm:text-sm text-[var(--text3)]">
              <a href={`${localePrefix(locale) || '/'}`} className="hover:text-[var(--primary)] transition-colors">
                DishRank
              </a>
              <span className="mx-2 opacity-50">›</span>
              <a
                href={`${localePrefix(locale)}/${citySlug(cityName)}`}
                className="hover:text-[var(--primary)] transition-colors"
              >
                {cityName}
              </a>
              <span className="mx-2 opacity-50">›</span>
              <span className="text-[var(--text2)]">{restaurant.name}</span>
            </nav>

            <h1
              className="font-bold text-[var(--text)] mb-3"
              style={{
                fontSize: 'clamp(2rem, 6vw, 4rem)',
                lineHeight: 1.04,
                letterSpacing: '-0.02em',
              }}
            >
              {restaurant.name}
            </h1>

            <p className="text-sm sm:text-base text-[var(--text2)] mb-5">
              {restaurantAddress ? `${restaurantAddress} · ` : ''}{cityName}
            </p>

            {/* Stats inline : note moyenne + nb de plats + nb d'avis */}
            <div className="inline-flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-[var(--text2)]">
              <span className="inline-flex items-center gap-1.5">
                <span className="font-bold text-[var(--text)] text-base">
                  {avgRating.toFixed(1)}
                </span>
                <span style={{ color: 'var(--star)' }}>★</span>
                <span className="opacity-70">moyenne</span>
              </span>
              <span style={{ opacity: 0.3 }}>·</span>
              <span>
                <b className="text-[var(--text)] font-bold">{dishes.length}</b>{' '}
                plat{dishes.length > 1 ? 's' : ''} noté{dishes.length > 1 ? 's' : ''}
              </span>
              <span style={{ opacity: 0.3 }}>·</span>
              <span>
                <b className="text-[var(--text)] font-bold">{totalReviews}</b>{' '}
                avis
              </span>
            </div>
          </div>
        </section>

        {/* Liste des plats du resto — reuse DishGrid (limité à 10 max) */}
        <DishGrid initialDishes={dishes} title={topDishesTitle} />

        {/* CTA download — capture les visiteurs qui ont scrollé jusqu'aux plats */}
        <CtaBanner />

        {/* Bloc SEO : court paragraphe contextuel pour rajouter du contenu
            unique indexable par page resto. Pas de gros wall of text — l'idée
            est juste d'éviter le "thin content" et de servir 2-3 keywords
            longue traîne ({nom} {ville} avis, {nom} menu, etc.). */}
        <section className="max-w-[820px] mx-auto px-4 sm:px-8 py-10 sm:py-14">
          <h2
            className="font-extrabold text-[var(--text)] mb-4 tracking-tight"
            style={{ fontSize: 'clamp(1.25rem, 3vw, 1.75rem)' }}
          >
            À propos de {restaurant.name}
          </h2>
          <p className="text-sm sm:text-base text-[var(--text2)] leading-relaxed">
            {restaurant.name} est répertorié sur DishRank avec <strong className="text-[var(--text)]">
            {dishes.length} plat{dishes.length > 1 ? 's' : ''} noté{dishes.length > 1 ? 's' : ''}
            </strong> par la communauté locale de {cityName}. La note moyenne agrégée
            est de <strong className="text-[var(--text)]">{avgRating.toFixed(1)}/5</strong> sur{' '}
            {totalReviews} avis vérifiés.
            {topDish && (
              <> Le plat le mieux noté actuellement est <strong className="text-[var(--text)]">
              {topDish.dish_name}</strong> ({Number(topDish.avg_rating).toFixed(1)}/5).</>
            )}{' '}
            DishRank classe chaque plat individuellement plutôt que le restaurant
            dans son ensemble : tu sais exactement quoi commander chez{' '}
            {restaurant.name}, et tu peux comparer avec d'autres adresses
            similaires à {cityName}.
          </p>
        </section>

        {/* Maillage interne — vers d'autres restos / catégories du même secteur */}
        <RelatedFilters
          locale={locale}
          city={cityName}
          allCities={allCities}
        />
      </main>

      <Footer />
      <DishModal />
      <LegalSheet initialPage={sp.page || ''} />
      <CookieConsent />
      <BetaModal />
    </>
  );
}
