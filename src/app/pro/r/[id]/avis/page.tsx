import { Suspense } from 'react';
import { requireOwnedRestaurant, isPremium } from '@/lib/pro/data';
import ThankSettings from './ThankSettings';
import ReviewsContent, { ReviewsSkeleton } from './ReviewsContent';
import { DEFAULT_THANK } from '@/lib/pro/thanks';

export const metadata = { title: 'Avis' };

/**
 * Page /avis en STREAMING : les réglages « remerciement » + l'intro (données
 * du resto déjà en cache) s'affichent INSTANTANÉMENT ; le board des avis (lecture
 * + regroupement par plat) streame dans <ReviewsContent> via <Suspense>.
 */
// URL lisible : un seul param `?avis=<slug fr>` encode la vue liste + le filtre
// (absent = vue « par plat »). Partagée par les accès rapides cockpit/stats.
const AVIS_SLUG_TO_FILTER: Record<string, 'all' | 'unanswered' | 'negative' | 'positive'> = {
  tous: 'all',
  'a-repondre': 'unanswered',
  negatifs: 'negative',
  positifs: 'positive',
};

export default async function ReviewsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ avis?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const resto = await requireOwnedRestaurant(id);
  const premium = isPremium(resto);
  const thankTemplate = resto.thank_template?.trim() || DEFAULT_THANK;

  // `?avis=negatifs` (etc.) → vue liste + filtre ; sinon vue « par plat ».
  const initialFilter = sp.avis ? AVIS_SLUG_TO_FILTER[sp.avis] : undefined;
  const initialView = initialFilter ? ('list' as const) : undefined;

  return (
    <div className="space-y-4">
      <ThankSettings id={id} initialEnabled={resto.auto_thank_enabled} initialTemplate={resto.thank_template} />

      <p className="text-sm text-[var(--text2)]">
        Vos avis, par plat ou en liste filtrable. Répondez, ou rattachez un avis dont le plat n&apos;est pas reconnu.
        {premium
          ? ' Vous pouvez épingler une réponse en haut de votre fiche.'
          : ' L’épinglage d’une réponse est réservé au forfait Premium.'}
      </p>

      <Suspense fallback={<ReviewsSkeleton />}>
        <ReviewsContent
          id={id}
          premium={premium}
          thankTemplate={thankTemplate}
          initialView={initialView}
          initialFilter={initialFilter}
        />
      </Suspense>
    </div>
  );
}
