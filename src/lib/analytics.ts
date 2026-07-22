// Wrapper léger pour les événements custom GA4.
//
// Conformité CNIL stricte :
//   1. `init.js` initialise gtag avec `analytics_storage: 'denied'` par
//      défaut → tant que pas d'accept, gtag.js n'est pas chargé et aucun
//      cookie GA n'est posé.
//   2. `CookieConsent` charge gtag.js + bascule `analytics_storage` à
//      `granted` UNIQUEMENT si l'user clique "Accepter tout" ou cocher
//      les analytics dans "Personnaliser".
//   3. Ce wrapper vérifie explicitement le consentement stocké AVANT
//      tout push dans `dataLayer`. Sans ça, les events s'accumuleraient
//      en mémoire et seraient envoyés à Google rétroactivement si l'user
//      acceptait plus tard → violation CNIL.
//
// Ne PAS appeler ce wrapper depuis CookieConsent lui-même (boucle
// circulaire) : les events GA techniques (consent update) sont gérés
// directement par CookieConsent via `gtag('consent', 'update', ...)`.

type GtagFn = (...args: unknown[]) => void;

const CONSENT_KEY = 'dishrank_cookie_consent';

/**
 * True UNIQUEMENT si l'utilisateur a explicitement accepté les analytics.
 * Inconnu / refusé / pas encore choisi → false.
 */
function hasAnalyticsConsent(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(CONSENT_KEY) === 'granted';
  } catch {
    return false;
  }
}

function getGtag(): GtagFn | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { gtag?: GtagFn };
  return w.gtag || null;
}

/**
 * Envoie un événement GA4 custom.
 * No-op si :
 *   • SSR (window undefined)
 *   • Consentement non donné (CNIL strict)
 *   • gtag pas encore chargé (CookieConsent vient juste d'accepter)
 *   • ad blocker actif
 */
export function trackEvent(name: string, params?: Record<string, unknown>) {
  if (!hasAnalyticsConsent()) return;
  const gtag = getGtag();
  if (!gtag) return;
  gtag('event', name, params || {});
}

/**
 * Click sur un bouton de téléchargement.
 *
 * @param store     'play' (Google Play) ou 'apple' (App Store)
 * @param placement Position dans la page : 'nav', 'footer', 'cta_banner',
 *                  'dish_redirect', 'join', 'dish_modal'
 */
export function trackDownloadClick(store: 'play' | 'apple', placement: string) {
  trackEvent('download_click', {
    store,
    placement,
    // GA4 reconnait `value` pour des conversions custom — utile si on
    // configure une "conversion goal" plus tard.
    value: 1,
  });
}

/**
 * Section vue (intersection observer 50%).
 *
 * @param section Identifiant arbitraire : 'social_features', 'why', 'faq'…
 */
export function trackSectionView(section: string) {
  trackEvent('section_view', { section });
}
