import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { fetchCities } from '@/lib/supabase';
import { buildSeoMetadata } from '@/lib/seoMetadata';
import { cityFromSlug } from '@/lib/slug';
import HomePageContent from '@/components/HomePageContent';
import { isIndexableWith, shownDishes } from '@/lib/indexable';

export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string; city: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale, city } = await params;
  const sp = await searchParams;
  // Sans `.catch` : une liste de villes vide par erreur donnerait un 404 sur une page
  // valable. Une erreur répond 500, Google repasse.
  const allCities = await fetchCities();
  const cityName = cityFromSlug(city, allCities);
  if (!cityName) return { robots: { index: false, follow: false } };
  // Les 152 villes de la base ont une page, la plupart sans un seul plat noté : on ne
  // fait indexer que celles qui ont du contenu (règle partagée avec le sitemap).
  const dishes = await shownDishes(undefined, cityName);
  const seo = await buildSeoMetadata({ locale, city: cityName, hasSearchQuery: !!sp.q, dishes });
  if (!isIndexableWith(dishes, undefined, cityName)) return { ...seo, robots: { index: false, follow: true } };
  return seo;
}

export default async function CityPage({ params, searchParams }: Props) {
  const { locale, city } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;

  // Sans `.catch` : une liste de villes vide par erreur donnerait un 404 sur une page
  // valable. Une erreur répond 500, Google repasse.
  const allCities = await fetchCities();

  const cityName = cityFromSlug(city, allCities);
  if (!cityName) notFound();

  return (
    <HomePageContent
      locale={locale}
      city={cityName}
      initialQuery={sp.q || ''}
      initialPage={sp.page || ''}
      allCities={allCities}
    />
  );
}
