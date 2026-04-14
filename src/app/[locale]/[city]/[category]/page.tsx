import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { fetchCities, fetchAllCategorySlugs } from '@/lib/supabase';
import { buildSeoMetadata } from '@/lib/seoMetadata';
import { cityFromSlug } from '@/lib/slug';
import HomePageContent from '@/components/HomePageContent';

export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string; city: string; category: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
};

async function resolveParams(city: string, category: string) {
  // Validate against the RAW list of categories (not the filtered-by-reviews
  // fetchCategories()) so that pages like /lyon/pizza still render even if
  // no review has been moderated yet for that combo — Google would otherwise
  // see a 404 and drop the URL from the index.
  const [allCities, allCategorySlugs] = await Promise.all([
    fetchCities().catch(() => [] as string[]),
    fetchAllCategorySlugs().catch(() => new Set<string>()),
  ]);
  const cityName = cityFromSlug(city, allCities);
  const validCategory = allCategorySlugs.has(category) ? category : null;
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
