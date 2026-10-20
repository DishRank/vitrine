import type { DishRow } from './supabase';

/**
 * Classement honnête des plats (oct. 2026).
 *
 * Tant qu'il n'y a pas assez de plats avec plusieurs avis, un « Top 10 »
 * n'est que du bruit (des 5,0 sur 1 avis). On affiche alors les plats
 * fraîchement notés, sans rang. Dès que le volume le permet, le classement
 * revient tout seul, trié par moyenne pondérée : un 5,0 sur 1 avis ne passe
 * plus devant un 4,7 sur 30 avis.
 */

export type DisplayMode = 'ranking' | 'fresh';

/** Nombre d'avis à partir duquel un plat compte pour le classement. */
export const MIN_REVIEWS_FOR_RANK = 3;

/** Poids de l'a priori (nombre d'avis « virtuels » à la moyenne générale). */
const PRIOR_WEIGHT = 3;

/**
 * `ranking` si au moins `threshold` plats ont MIN_REVIEWS_FOR_RANK avis ou plus.
 * Home : 10 (pour remplir un Top 10) ; pages ville/catégorie : 3.
 */
export function displayMode(dishes: DishRow[], threshold: number): DisplayMode {
  const solid = dishes.filter((d) => Number(d.review_count) >= MIN_REVIEWS_FOR_RANK).length;
  return solid >= threshold ? 'ranking' : 'fresh';
}

/** Moyenne bayésienne : (v·R + m·C) / (v + m). */
export function weightedScore(d: DishRow, globalMean: number, m = PRIOR_WEIGHT): number {
  const v = Number(d.review_count) || 0;
  const r = Number(d.avg_rating) || 0;
  return (v * r + m * globalMean) / (v + m);
}

export function orderDishes(dishes: DishRow[], mode: DisplayMode): DishRow[] {
  const list = [...dishes];
  if (mode === 'fresh') {
    return list.sort(
      (a, b) => new Date(b.latest_review_at).getTime() - new Date(a.latest_review_at).getTime(),
    );
  }
  const mean = list.length ? list.reduce((s, d) => s + (Number(d.avg_rating) || 0), 0) / list.length : 0;
  return list.sort((a, b) => {
    const diff = weightedScore(b, mean) - weightedScore(a, mean);
    if (diff !== 0) return diff;
    return Number(b.review_count) - Number(a.review_count);
  });
}
