import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Instrumentation de l'espace pro (lot 4.3) — télémétrie produit SERVEUR,
 * first-party, minimale. Sert le critère go/no-go Stripe (v2 §7 : « prouver que
 * les restaurateurs utilisent le dashboard ») : combien d'owners se connectent,
 * éditent leur fiche/menu, répondent aux avis.
 *
 * RGPD : événements d'un compte PRO authentifié (intérêt légitime, mesure
 * d'usage d'un outil B2B), pas de tracking comportemental consumer → pas de
 * bandeau de consentement. On ne stocke que event_type + restaurant_id ; le
 * user_id est l'owner (RLS analytics_events : user_id = auth.uid()).
 *
 * Best-effort : un échec d'insert ne casse JAMAIS l'action métier.
 */
export type ProEvent =
  | 'pro_login'
  | 'pro_listing_edit'
  | 'pro_menu_edit'
  | 'pro_review_reply'
  | 'pro_claim_completed';

export async function logProEvent(
  supabase: SupabaseClient,
  eventType: ProEvent,
  restaurantId?: string
): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('analytics_events').insert({
      user_id: user.id,
      event_type: eventType,
      event_data: restaurantId ? { restaurant_id: restaurantId } : {},
    });
  } catch {
    // télémétrie best-effort
  }
}
