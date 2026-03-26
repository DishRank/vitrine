import { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { fetchDishes, fetchCategories } from '@/lib/supabase';
import Nav from '@/components/Nav';
import Hero from '@/components/Hero';
import SearchSection from '@/components/SearchSection';
import DishGrid from '@/components/DishGrid';
import WhySection from '@/components/WhySection';
import ExploreCategories from '@/components/ExploreCategories';
import Showcase from '@/components/Showcase';
import CtaBanner from '@/components/CtaBanner';
import Footer from '@/components/Footer';
import DishModal from '@/components/DishModal';
import LegalSheet from '@/components/LegalSheet';
import CookieConsent from '@/components/CookieConsent';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ categorie?: string; ville?: string; q?: string; page?: string }>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: 'meta' });

  let title = t('title');
  let description = t('description');

  if (sp.categorie && sp.ville) {
    title = t('titleWithCityCategory', { category: sp.categorie, city: sp.ville });
    description = t('descWithCityCategory', { category: sp.categorie, city: sp.ville });
  } else if (sp.categorie) {
    title = t('titleWithCategory', { category: sp.categorie });
  } else if (sp.ville) {
    title = t('titleWithCity', { city: sp.ville });
  }

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: 'https://dishrank.fr',
      siteName: 'DishRank',
      images: [{ url: 'https://dishrank.fr/img/play_store_feature_graphic.png', width: 1024, height: 500 }],
      locale: locale === 'fr' ? 'fr_FR' : locale,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['https://dishrank.fr/img/play_store_feature_graphic.png'],
    },
    alternates: (() => {
      const qs = new URLSearchParams();
      if (sp.categorie) qs.set('categorie', sp.categorie);
      if (sp.ville) qs.set('ville', sp.ville);
      const q = qs.toString() ? '?' + qs.toString() : '';
      const url = (l: string) => `https://dishrank.fr${l === 'fr' ? '' : '/' + l}${q}`;
      return {
        canonical: url(locale),
        languages: { fr: url('fr'), en: url('en'), es: url('es'), de: url('de'), it: url('it'), 'x-default': url('fr') },
      };
    })(),
  };
}

export default async function HomePage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;

  // SSR data fetching
  let dishes: Awaited<ReturnType<typeof fetchDishes>> = [];
  let categories: Awaited<ReturnType<typeof fetchCategories>> = [];
  try {
    [dishes, categories] = await Promise.all([
      fetchDishes(sp.categorie),
      fetchCategories(),
    ]);
  } catch (e) {
    console.error('SSR fetch error:', e);
  }

  // Filter by city server-side
  if (sp.ville) {
    dishes = dishes.filter((d) =>
      d.restaurant_city?.toLowerCase().includes(sp.ville!.toLowerCase())
    );
  }

  // JSON-LD for dish items (ItemList for SEO)
  const dishListJsonLd = dishes.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: sp.categorie && sp.ville
      ? `Best ${sp.categorie} in ${sp.ville}`
      : sp.categorie ? `Best ${sp.categorie}` : 'Top rated dishes',
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
        ...(d.latest_price ? { offers: { '@type': 'Offer', price: d.latest_price, priceCurrency: d.currency || 'EUR' } } : {}),
        brand: { '@type': 'Restaurant', name: d.restaurant_name, address: d.restaurant_address },
      },
    })),
  } : null;

  // BreadcrumbList
  const breadcrumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'DishRank', item: 'https://dishrank.fr' },
      ...(sp.ville ? [{ '@type': 'ListItem', position: 2, name: sp.ville, item: `https://dishrank.fr/?ville=${sp.ville}` }] : []),
      ...(sp.categorie ? [{ '@type': 'ListItem', position: sp.ville ? 3 : 2, name: sp.categorie, item: `https://dishrank.fr/?categorie=${sp.categorie}${sp.ville ? '&ville=' + sp.ville : ''}` }] : []),
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }} />
      {dishListJsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(dishListJsonLd) }} />}
      <Nav />
      <main id="main-content">
        <Hero />
        <SearchSection
          categories={categories}
          initialCategory={sp.categorie || ''}
          initialCity={sp.ville || ''}
          initialQuery={sp.q || ''}
        />
        <DishGrid
          initialDishes={dishes}
          initialCategory={sp.categorie || ''}
          initialCity={sp.ville || ''}
        />
        <CtaBanner />
        <WhySection />
        <ExploreCategories categories={categories} />
        <Showcase />
      </main>
      <Footer />
      <DishModal />
      <LegalSheet initialPage={sp.page || ''} />
      <CookieConsent />
    </>
  );
}
