import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { fetchCities, fetchAllCategorySlugs } from '@/lib/supabase';
import { buildSeoMetadata } from '@/lib/seoMetadata';
import HomePageContent from '@/components/HomePageContent';

export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string; category: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale, category } = await params;
  const sp = await searchParams;
  // Validate against the raw category list (not filtered by reviews) so that
  // /c/pizza still renders even if no review is moderated yet for pizza.
  const all = await fetchAllCategorySlugs().catch(() => new Set<string>());
  if (!all.has(category)) return { robots: { index: false, follow: false } };
  return buildSeoMetadata({ locale, category, hasSearchQuery: !!sp.q });
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { locale, category } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;

  const [allCategorySlugs, allCities] = await Promise.all([
    fetchAllCategorySlugs().catch(() => new Set<string>()),
    fetchCities().catch(() => [] as string[]),
  ]);
  if (!allCategorySlugs.has(category)) notFound();

  return (
    <HomePageContent
      locale={locale}
      category={category}
      initialQuery={sp.q || ''}
      initialPage={sp.page || ''}
      allCities={allCities}
    />
  );
}
