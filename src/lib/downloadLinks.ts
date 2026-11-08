// DishRank — liens de telechargement
// Source de verite pour les URLs des stores

export const APP_STORE_URL = 'https://apps.apple.com/fr/app/dishrank/id6761752556';
export const APP_STORE_URL_UNIVERSAL = 'https://apps.apple.com/app/id6761752556';

/**
 * URL Play Store CANONIQUE : la fiche publique de l'app.
 * À utiliser pour le JSON-LD `sameAs` / `downloadUrl` (Google App
 * Indexing s'attend à ce format), même tant que la prod n'est pas live —
 * Google indexera correctement quand la release Production sortira.
 */
export const PLAY_STORE_URL_CANONICAL = 'https://play.google.com/store/apps/details?id=com.dishrank.app';

/**
 * URL d'opt-in à la BÊTA OUVERTE (track Open Testing).
 * Tant qu'il n'y a pas de release Production sur Google Play, le store
 * public refuse d'afficher l'app aux utilisateurs non-testeurs : le seul
 * lien qui marche pour installer est ce lien d'opt-in. À retirer au
 * profit de PLAY_STORE_URL_CANONICAL une fois la prod live.
 */
export const PLAY_STORE_BETA_OPT_IN = 'https://play.google.com/apps/testing/com.dishrank.app';

/**
 * URL utilisée par les boutons cliquables (Nav, Footer, CtaBanner,
 * DownloadButtons, /join, /dish). L'app est en production sur Google Play
 * (fiche publique vérifiée le 08/11/2026) : la fiche du store, et non plus
 * la page d'inscription des testeurs, qui demandait de « devenir testeur »
 * avant d'installer.
 */
export const PLAY_STORE_URL = PLAY_STORE_URL_CANONICAL;

// L'app Android est publiée : le bouton Play Store ouvre la fiche du store.
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
