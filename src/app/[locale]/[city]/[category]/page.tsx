import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { fetchCities, fetchCategories } from '@/lib/supabase';
import { buildSeoMetadata } from '@/lib/seoMetadata';
import { cityFromSlug } from '@/lib/slug';
import HomePageContent from '@/components/HomePageContent';

export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string; city: string; category: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
};

async function resolveParams(city: string, category: string) {
  const [allCities, categories] = await Promise.all([
    fetchCities().catch(() => [] as string[]),
    fetchCategories().catch(() => [] as Array<{ slug: string }>),
  ]);
  const cityName = cityFromSlug(city, allCities);
  const validCategory = categories.some((c) => c.slug === category) ? category : null;
  return { cityName, validCategory, allCities };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale, city, category } = await params;
  const sp = await searchParams;
  const { cityName, validCategory } = await resolveParams(city, category);
  if (!cityName || !validCategory) return { robots: { index: false, follow: false } };
  return buildSeoMetadata({ locale, city: cityName, category: validCategory, hasSearchQuery: !!sp.q });
}

export default async function CityCategoryPage({ params, searchParams }: Props) {
  const { locale, city, category } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;

  const { cityName, validCategory, allCities } = await resolveParams(city, category);
  if (!cityName || !validCategory) notFound();

  return (
    <HomePageContent
      locale={locale}
      city={cityName}
      category={validCategory}
      initialQuery={sp.q || ''}
      initialPage={sp.page || ''}
      allCities={allCities}
    />
  );
}
