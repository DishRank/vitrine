import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { fetchCities, fetchAllCategorySlugs } from '@/lib/supabase';
import { buildSeoMetadata } from '@/lib/seoMetadata';
import { hasChildren } from '@/lib/categoryHierarchy';
import { cityFromSlug } from '@/lib/slug';
import HomePageContent from '@/components/HomePageContent';
import { isIndexableWith, shownDishes } from '@/lib/indexable';

export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string; city: string; category: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
};

function categoryPath(locale: string, category: string): string {
  return `${locale === 'fr' ? '' : `/${locale}`}/c/${category}`;
}

async function resolveParams(city: string, category: string) {
  // Pas de `.catch` : une liste vide par erreur ferait conclure « ville inconnue » et
  // redirigerait une page valable. Une erreur répond 500, Google repasse.
  const [allCities, allCategorySlugs] = await Promise.all([fetchCities(), fetchAllCategorySlugs()]);
  const cityName = cityFromSlug(city, allCities);
  const validCategory = (allCategorySlugs.has(category) || hasChildren(category)) ? category : null;
  return { cityName, validCategory, allCities };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale, city, category } = await params;
  const sp = await searchParams;
  const { cityName, validCategory } = await resolveParams(city, category);
  // Même redirection que la page (cf. plus bas).
  if (!cityName && validCategory) redirect(categoryPath(locale, validCategory));
  if (!cityName || !validCategory) return { robots: { index: false, follow: false } };

  // Plats de CETTE ville affichés par la page (avant : le top 50 national filtré par
  // sous-chaîne, qui comptait faux). Règle partagée avec le sitemap.
  const dishes = await shownDishes(validCategory, cityName);
  const seo = await buildSeoMetadata({
    locale,
    city: cityName,
    category: validCategory,
    hasSearchQuery: !!sp.q,
    dishes,
  });
  if (!isIndexableWith(dishes, validCategory, cityName)) return { ...seo, robots: { index: false, follow: true } };
  return seo;
}

export default async function CityCategoryPage({ params, searchParams }: Props) {
  const { locale, city, category } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;

  const { cityName, validCategory, allCities } = await resolveParams(city, category);
  // Ville inconnue mais catégorie valable : les anciennes URL (?categorie=…&ville=Rouen,
  // redirigées par le proxy vers /rouen/<cat>) et les villes sans restaurant mènent à la
  // page catégorie plutôt qu'à un 404 — 1 227 URL en « Introuvable » dans Search Console.
  // Redirection TEMPORAIRE (307) : la ville peut avoir des restaurants demain, et une
  // 308 resterait gravée dans les navigateurs et chez Google. Rendue avant tout
  // <Suspense> (pas de loading.tsx ici) : c'est un vrai en-tête HTTP.
  if (!cityName && validCategory) redirect(categoryPath(locale, validCategory));
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
