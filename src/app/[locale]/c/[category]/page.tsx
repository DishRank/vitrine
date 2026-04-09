import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { fetchCities, fetchCategories } from '@/lib/supabase';
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
  const categories = await fetchCategories().catch(() => [] as Array<{ slug: string }>);
  const valid = categories.some((c) => c.slug === category);
  if (!valid) return { robots: { index: false, follow: false } };
  return buildSeoMetadata({ locale, category, hasSearchQuery: !!sp.q });
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { locale, category } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;

  const [categories, allCities] = await Promise.all([
    fetchCategories().catch(() => [] as Array<{ slug: string }>),
    fetchCities().catch(() => [] as string[]),
  ]);
  const valid = categories.some((c) => c.slug === category);
  if (!valid) notFound();

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
