import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe, getServiceClient } from '@/lib/pro/stripe';

// Webhook Stripe — NON authentifié : la signature est le SEUL garde. Corps BRUT
// obligatoire (jamais req.json() avant constructEvent). runtime nodejs (le SDK
// stripe n'est pas edge-safe). proxy.ts exclut déjà /api → pas de session.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  // v1 : Stripe pas encore branché → 200 no-op (pas de retries inutiles).
  if (!process.env.STRIPE_SECRET_KEY || !secret) {
    return NextResponse.json({ received: true, stripe: 'not_configured' });
  }

  const sig = req.headers.get('stripe-signature');
  if (!sig) return new NextResponse('missing signature', { status: 400 });
  const body = await req.text(); // RAW

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (e) {
    return new NextResponse(`signature: ${(e as Error).message}`, { status: 400 });
  }

  try {
    const sub = await resolveSubscription(stripe, event);
    if (!sub) return NextResponse.json({ received: true, ignored: event.type });

    const rid = sub.metadata?.restaurant_id;
    if (!rid) return NextResponse.json({ received: true, no_restaurant: true });

    // Basil : la période vit sur l'item, plus sur la subscription (fallback au cas où).
    const item = sub.items?.data?.[0] as unknown as { current_period_end?: number } | undefined;
    const periodEndSec =
      item?.current_period_end ?? (sub as unknown as { current_period_end?: number }).current_period_end ?? null;
    const customerId = typeof sub.customer === 'string' ? sub.customer : (sub.customer?.id ?? null);

    const { data, error } = await getServiceClient().rpc('apply_stripe_subscription', {
      p_event_id: event.id,
      p_event_created: new Date(event.created * 1000).toISOString(),
      p_type: event.type,
      p_restaurant_id: rid,
      p_customer_id: customerId,
      p_subscription_id: sub.id,
      p_status: sub.status,
      p_current_period_end: periodEndSec ? new Date(periodEndSec * 1000).toISOString() : null,
      p_payload: null,
    });

    // Le RPC RAISE seulement sur premium+period_end NULL (anomalie) → 500 pour que
    // Stripe réessaie ; duplicate/comp_protected/stale/not_found renvoient applied:false → 200.
    if (error) return new NextResponse(`rpc: ${error.message}`, { status: 500 });
    return NextResponse.json({ received: true, result: data });
  } catch (e) {
    return new NextResponse(`handler: ${(e as Error).message}`, { status: 500 });
  }
}

/** Récupère la Subscription (items expand) selon le type d'évènement, ou null si non pertinent. */
async function resolveSubscription(stripe: Stripe, event: Stripe.Event): Promise<Stripe.Subscription | null> {
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const s = event.data.object as Stripe.Subscription;
      return stripe.subscriptions.retrieve(s.id, { expand: ['items'] });
    }
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
      return subId ? stripe.subscriptions.retrieve(subId, { expand: ['items'] }) : null;
    }
    case 'invoice.paid':
    case 'invoice.payment_failed': {
      const inv = event.data.object as unknown as {
        subscription?: string | { id: string } | null;
        parent?: { subscription_details?: { subscription?: string | { id: string } | null } };
      };
      const raw = inv.subscription ?? inv.parent?.subscription_details?.subscription ?? null;
      const subId = typeof raw === 'string' ? raw : (raw?.id ?? null);
      return subId ? stripe.subscriptions.retrieve(subId, { expand: ['items'] }) : null;
    }
    default:
      return null;
  }
}
