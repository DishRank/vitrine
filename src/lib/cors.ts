/**
 * CORS helper pour les routes API Google Places.
 *
 * Pourquoi pas un wildcard `*` :
 *   • Avec `*`, un site malveillant `evil.com` pourrait inciter un user
 *     authentifié à faire des requêtes GET/POST vers nos endpoints. Le
 *     Bearer token étant stocké dans le localStorage de dishrank.fr (donc
 *     isolé par origine), evil.com ne peut PAS le lire — c'est ça notre
 *     vraie barrière. Mais en défense en profondeur, on whiteliste quand
 *     même les origines connues côté CORS.
 *
 *   • Les apps natives (iOS / Android) NE FONT PAS de check CORS
 *     (l'header `Origin` n'est pas envoyé), donc on autorise les requêtes
 *     sans Origin pour qu'elles continuent de marcher.
 *
 *   • En dev (`NODE_ENV=development`), on whiteliste localhost.
 */

const ALLOWED_ORIGINS = [
  'https://dishrank.fr',
  'https://www.dishrank.fr',
  'https://app.dishrank.fr',
];

const DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
];

const BASE_HEADERS = {
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400', // cache preflight 24h
  'X-Content-Type-Options': 'nosniff',
};

/**
 * Returns the appropriate CORS headers for a given request.
 * - No Origin (native app) → allow `*`
 * - Whitelisted Origin (DishRank web/app) → allow that specific origin
 * - Other Origin → return null (browser will block the response)
 */
export function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin');
  const allowed = process.env.NODE_ENV === 'development'
    ? [...ALLOWED_ORIGINS, ...DEV_ORIGINS]
    : ALLOWED_ORIGINS;

  if (!origin) {
    // Native app or server-to-server — pas d'Origin envoyé, donc pas de
    // surface CORS à exploiter. On autorise.
    return {
      ...BASE_HEADERS,
      'Access-Control-Allow-Origin': '*',
    };
  }

  if (allowed.includes(origin)) {
    return {
      ...BASE_HEADERS,
      'Access-Control-Allow-Origin': origin,
      'Vary': 'Origin',
    };
  }

  // Origin présent mais non autorisé → le browser refusera de lire la response.
  // On retourne quand même les headers pour éviter une erreur côté serveur.
  return {
    ...BASE_HEADERS,
    'Access-Control-Allow-Origin': 'null',
    'Vary': 'Origin',
  };
}
