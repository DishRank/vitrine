import Stripe from 'stripe';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Client Stripe (serveur uniquement — la clé secrète ne fuit JAMAIS côté client).
 * v1 : le premium est OFFERT (comp), Stripe n'a pas besoin de fonctionner.
 * Sans STRIPE_SECRET_KEY / STRIPE_PRICE_ID, `stripeEnabled()` est false et les
 * actions checkout/portal renvoient un état « bientôt disponible » au lieu de
 * planter → le cadre est en place, prêt à s'activer avec 3 variables d'env.
 */
let _stripe: Stripe | null = null;

export function stripeEnabled(): boolean {
  return !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_PRICE_ID;
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY manquant');
  if (!_stripe) {
    // apiVersion omise → version par défaut du compte (évite le drift de types).
    _stripe = new Stripe(key, { appInfo: { name: 'DishRank /pro' } });
  }
  return _stripe;
}

export function stripePriceId(): string {
  const id = process.env.STRIPE_PRICE_ID;
  if (!id) throw new Error('STRIPE_PRICE_ID manquant');
  return id;
}

/** Client Supabase service-role (bypass RLS) — pour le webhook non authentifié.
 *  Écrit UNIQUEMENT via l'RPC apply_stripe_subscription (chemin unique gardé). */
export function getServiceClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE service-role manquant');
  return createClient(url, key, { auth: { persistSession: false } });
}
