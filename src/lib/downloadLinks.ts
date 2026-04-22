// DishRank — liens de telechargement
// Source de verite pour les URLs des stores

export const APP_STORE_URL = 'https://apps.apple.com/fr/app/dishrank/id6761752556';
export const APP_STORE_URL_UNIVERSAL = 'https://apps.apple.com/app/id6761752556';
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.dishrank.app';

// L'app Android est en beta ouverte : le bouton Play Store pointe directement vers la fiche.
export const ANDROID_LIVE = true;

export type Platform = 'ios' | 'android' | 'desktop';

/**
 * Detecte la plateforme cote client a partir du user agent.
 * Retourne 'desktop' cote serveur (SSR) pour un rendu neutre.
 */
export function detectPlatform(): Platform {
  if (typeof window === 'undefined') return 'desktop';
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}
