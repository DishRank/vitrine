'use server';

import { assertOwner } from '@/lib/pro/data';
import { getStripe, stripeEnabled, stripePriceId, getServiceClient } from '@/lib/pro/stripe';
import { logProEvent } from '@/lib/pro/instrument';

/**
 * Abonnement Stripe (/pro) — Checkout + Billing Portal.
 * v1 : sans clés Stripe, `stripeEnabled()` est false → on renvoie 'coming_soon'
 * (le premium est OFFERT via comp, pas d'achat). Aucun Stripe côté client :
 * Checkout + Portal sont des redirections hébergées (l'action renvoie l'URL).
 * Sécurité : ownership vérifié AVANT toute création de session (assertOwner) ;
 * on ne vend jamais par-dessus une comp ou un abonnement Stripe déjà actif.
 */

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://dishrank.fr';

export interface BillingResult {
  url?: string;
  error?: string;
}

interface BillingRow {
  subscription_tier: string | null;
  subscription_expires_at: string | null;
  subscription_source: string | null;
  stripe_customer_id: string | null;
}

export async function createCheckoutSession(restaurantId: string): Promise<BillingResult> {
  const ctx = await assertOwner(restaurantId);
  if (!ctx) return { error: "Tu n'es pas le propriétaire de cet établissement." };
  if (!stripeEnabled()) return { error: 'coming_soon' };
  const { supabase, user } = ctx;

  const { data } = await supabase
    .from('restaurants')
    .select('subscription_tier, subscription_expires_at, subscription_source, stripe_customer_id')
    .eq('id', restaurantId)
    .maybeSingle();
  const r = data as BillingRow | null;
  if (!r) return { error: 'Établissement introuvable.' };

  // Ne pas vendre par-dessus une comp (offert) ni un abonnement Stripe actif.
  if (r.subscription_source === 'founder_comp' || r.subscription_source === 'admin') {
    return { error: 'already_comped' };
  }
  const activePremium =
    r.subscription_tier === 'premium' &&
    (!r.subscription_expires_at || new Date(r.subscription_expires_at) > new Date());
  if (activePremium && r.subscription_source === 'stripe') return { error: 'already_premium' };

  const stripe = getStripe();

  // Un Customer Stripe PAR RESTO (le premium est 1:1). Réutilise l'existant,
  // sinon crée + persiste via service-role (le webhook confirmera l'id canonique).
  let customer = r.stripe_customer_id ?? undefined;
  if (!customer) {
    const created = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { restaurant_id: restaurantId, owner_id: user.id },
    });
    customer = created.id;
    try {
      await getServiceClient().from('restaurants').update({ stripe_customer_id: customer }).eq('id', restaurantId);
    } catch {
      /* le webhook réécrira l'id — best-effort */
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer,
    line_items: [{ price: stripePriceId(), quantity: 1 }],
    client_reference_id: restaurantId,
    metadata: { restaurant_id: restaurantId, owner_id: user.id },
    subscription_data: { metadata: { restaurant_id: restaurantId, owner_id: user.id } },
    allow_promotion_codes: true,
    locale: 'fr',
    automatic_tax: { enabled: false }, // franchise en base de TVA (art. 293 B)
    success_url: `${SITE}/pro/r/${restaurantId}/abonnement?checkout=success`,
    cancel_url: `${SITE}/pro/r/${restaurantId}/abonnement?checkout=cancel`,
  });

  await logProEvent(supabase, 'pro_upgrade_click', restaurantId);
  return { url: session.url ?? undefined };
}

export async function createPortalSession(restaurantId: string): Promise<BillingResult> {
  const ctx = await assertOwner(restaurantId);
  if (!ctx) return { error: "Tu n'es pas le propriétaire de cet établissement." };
  if (!stripeEnabled()) return { error: 'coming_soon' };
  const { supabase } = ctx;

  const { data } = await supabase
    .from('restaurants')
    .select('stripe_customer_id')
    .eq('id', restaurantId)
    .maybeSingle();
  const customer = (data as { stripe_customer_id: string | null } | null)?.stripe_customer_id;
  if (!customer) return { error: 'no_subscription' };

  const session = await getStripe().billingPortal.sessions.create({
    customer,
    return_url: `${SITE}/pro/r/${restaurantId}/abonnement`,
    locale: 'fr',
  });
  await logProEvent(supabase, 'pro_portal_open', restaurantId);
  return { url: session.url };
}
