import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { fetchCities } from '@/lib/supabase';
import { buildSeoMetadata } from '@/lib/seoMetadata';
import { cityFromSlug } from '@/lib/slug';
import HomePageContent from '@/components/HomePageContent';

export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string; city: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale, city } = await params;
  const sp = await searchParams;
  let allCities: string[] = [];
  try {
    allCities = await fetchCities();
  } catch {}
  const cityName = cityFromSlug(city, allCities);
  if (!cityName) return { robots: { index: false, follow: false } };
  return buildSeoMetadata({ locale, city: cityName, hasSearchQuery: !!sp.q });
}

export default async function CityPage({ params, searchParams }: Props) {
  const { locale, city } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;

  let allCities: string[] = [];
  try {
    allCities = await fetchCities();
  } catch {}

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
