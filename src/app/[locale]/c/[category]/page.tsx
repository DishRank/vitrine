import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { fetchCities, fetchAllCategorySlugs, fetchDishes } from '@/lib/supabase';
import { buildSeoMetadata } from '@/lib/seoMetadata';
import { hasChildren } from '@/lib/categoryHierarchy';
import HomePageContent from '@/components/HomePageContent';

export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string; category: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
};

/** Minimum dishes needed for a category page to warrant indexing. Prevents
 *  Google from picking up near-empty umbrellas (e.g. /c/north-american when
 *  there's a single poutine in DB). */
const MIN_DISHES_FOR_INDEX = 3;

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale, category } = await params;
  const sp = await searchParams;
  // Accept either a real DB slug OR a hierarchy-only virtual parent
  // (e.g. european, drinks, middle-eastern) — those don't exist in the DB
  // but aggregate real children via expandCategorySlug.
  const all = await fetchAllCategorySlugs().catch(() => new Set<string>());
  if (!all.has(category) && !hasChildren(category)) return { robots: { index: false, follow: false } };

  // Thin-content guard: if the DB can't provide at least MIN_DISHES_FOR_INDEX
  // dishes for this category, tell Google not to index it (but keep follow
  // so internal linking flows through).
  const dishes = await fetchDishes(category, MIN_DISHES_FOR_INDEX).catch(() => []);
  if (dishes.length < MIN_DISHES_FOR_INDEX) {
    return {
      ...(await buildSeoMetadata({ locale, category, hasSearchQuery: !!sp.q })),
      robots: { index: false, follow: true },
    };
  }
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
  if (!allCategorySlugs.has(category) && !hasChildren(category)) notFound();

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
