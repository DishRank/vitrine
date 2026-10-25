import { notFound } from 'next/navigation';
import { resolveRestaurantPage } from '@/lib/restaurantPage';

/**
 * Garde 404 de la fiche restaurant, AVANT le <Suspense> de `loading.tsx` : une fiche
 * inexistante répond un vrai 404 (et non 200 + noindex), une panne de la base un vrai
 * 500 que Google repassera. Détails : lib/restaurantPage.
 */
export default async function RestaurantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string; city: string; restoSlug: string }>;
}) {
  const { city, restoSlug } = await params;
  if (!(await resolveRestaurantPage(city, restoSlug))) notFound();
  return children;
}
