import { Suspense } from 'react';
import { requireOwnedRestaurant, isPremium } from '@/lib/pro/data';
import StatsContent, { StatsSkeleton } from './StatsContent';

export const metadata = { title: 'Statistiques' };

/**
 * Page /stats en STREAMING : le premium (dérivé du resto déjà en cache) est
 * connu instantanément → le squelette s'affiche tout de suite, puis les 3 RPC
 * analytics streament dans <StatsContent> via <Suspense>. Zéro attente perçue.
 */
export default async function StatsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resto = await requireOwnedRestaurant(id);
  const premium = isPremium(resto);

  return (
    <Suspense fallback={<StatsSkeleton premium={premium} />}>
      <StatsContent id={id} premium={premium} />
    </Suspense>
  );
}
