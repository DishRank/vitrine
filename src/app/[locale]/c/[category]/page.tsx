import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { fetchCities, fetchAllCategorySlugs } from '@/lib/supabase';
import { buildSeoMetadata } from '@/lib/seoMetadata';
import { hasChildren } from '@/lib/categoryHierarchy';
import { isIndexableWith, shownDishes } from '@/lib/indexable';
import HomePageContent from '@/components/HomePageContent';

export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string; category: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale, category } = await params;
  const sp = await searchParams;
  // Accept either a real DB slug OR a hierarchy-only virtual parent
  // (e.g. european, drinks, middle-eastern) — those don't exist in the DB
  // but aggregate real children via expandCategorySlug.
  const all = await fetchAllCategorySlugs().catch(() => new Set<string>());
  if (!all.has(category) && !hasChildren(category)) return { robots: { index: false, follow: false } };

  // Page trop maigre (moins de MIN_DISHES_FOR_INDEX plats affichés) : noindex, mais
  // follow pour que le maillage interne passe. Règle partagée avec le sitemap.
  const dishes = await shownDishes(category);
  const seo = await buildSeoMetadata({ locale, category, hasSearchQuery: !!sp.q, dishes });
  if (!isIndexableWith(dishes, category)) return { ...seo, robots: { index: false, follow: true } };
  return seo;
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
