import { requireOwnedRestaurant, isPremium, isComped } from '@/lib/pro/data';
import { stripeEnabled } from '@/lib/pro/stripe';
import AbonnementPanel from './AbonnementPanel';

export const metadata = { title: 'Abonnement' };

/**
 * Abonnement /pro. Premium reste porté par restaurants.subscription_tier ; ici on
 * ne fait qu'AFFICHER l'état + déclencher Checkout/Portal. v1 : le premium est
 * OFFERT (comp) → `stripeEnabled()` peut être false, le bouton devient « bientôt
 * disponible ». Les gates premium se déverrouillent dès que la ligne bascule.
 */
export default async function AbonnementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { id } = await params;
  const { checkout } = await searchParams;
  const resto = await requireOwnedRestaurant(id);

  return (
    <AbonnementPanel
      restaurantId={id}
      name={resto.name}
      premium={isPremium(resto)}
      comped={isComped(resto)}
      source={resto.subscription_source}
      expiresAt={resto.subscription_expires_at}
      billingEnabled={stripeEnabled()}
      checkout={checkout ?? null}
    />
  );
}
