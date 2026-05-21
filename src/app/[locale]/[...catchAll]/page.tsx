import { notFound } from 'next/navigation';

/**
 * Catch-all route at the locale level. Matches any URL under /{locale}/...
 * that doesn't match a more specific route (home, city, city/category,
 * city/r/restaurant, c/category).
 *
 * Why it exists : sans cette route, Next.js renvoie sa page 404 par défaut
 * (texte brut "404 | This page could not be found") quand une URL a trop de
 * segments pour matcher un pattern défini — ex. `/lyon/c/azidessi` (3 segs
 * après locale, aucun pattern à 3 dynamic segs au même niveau que `c`).
 *
 * Calling notFound() ici déclenche le `[locale]/not-found.tsx` localisé.
 *
 * Précédence : Next.js privilégie toujours les routes statiques + dynamiques
 * spécifiques avant les catch-all, donc cette route n'intercepte que ce qui
 * ne matche aucun autre pattern.
 */
export default function CatchAll() {
  notFound();
}
