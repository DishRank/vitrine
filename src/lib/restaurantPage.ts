/**
 * Une fiche restaurant existe-t-elle, et sous quelle forme ? — UNE résolution
 * partagée par le layout (garde 404), les métadonnées et la page.
 *
 * Pourquoi un layout : la route a un `loading.tsx`, donc la page est rendue dans un
 * <Suspense> et la réponse part en 200 avant qu'elle ne s'exécute. Un `notFound()`
 * dans la page devenait un 200 + <meta robots noindex> (doc Next « The HTTP
 * contract ») : les fiches disparues (renommées, sans avis, hors pilote) remontaient
 * dans la Search Console en « exclue par noindex » au lieu de 404, et Google les
 * recrawlait sans fin. Le layout s'exécute AVANT le Suspense : son `notFound()` est
 * un vrai 404, une erreur de la base un vrai 500.
 *
 * Mêmes appels (et mêmes caches) que la page : la garde ne coûte aucune requête de plus.
 */
import { cache } from 'react';
import { fetchMenuTree, type MenuTree } from './menu';
import { MIN_PLATS_CARTE, compterPlats, estVilleCarte } from './menuOnly';
import {
  fetchCities,
  fetchDishesForRestaurant,
  fetchRestaurantBySlug,
  type DishRow,
  type RestaurantRow,
} from './supabase';
import { cityFromSlug } from './slug';

export type RestaurantPageData =
  | { kind: 'notes'; allCities: string[]; cityName: string; restaurant: RestaurantRow; dishes: DishRow[] }
  | { kind: 'carte'; allCities: string[]; cityName: string; restaurant: RestaurantRow; menus: MenuTree[] };

/** `null` = la fiche n'existe pas (404). Lève si la base ne répond pas (500). */
export const resolveRestaurantPage = cache(
  async (city: string, restoSlug: string): Promise<RestaurantPageData | null> => {
    const allCities = await fetchCities();
    const cityName = cityFromSlug(city, allCities);
    if (!cityName) return null;

    const restaurant = await fetchRestaurantBySlug(cityName, restoSlug);
    if (!restaurant) return null;

    // Tous les plats notés (avec ou sans photo) : stats, moyenne, JSON-LD.
    const dishes = await fetchDishesForRestaurant(restaurant.id);
    if (dishes.length > 0) return { kind: 'notes', allCities, cityName, restaurant, dishes };

    // Aucun plat noté : fiche « carte relevée », seulement dans les villes du pilote et
    // au-delà du seuil de plats (lib/menuOnly, partagé avec le sitemap).
    if (!estVilleCarte(cityName)) return null;
    const menus = await fetchMenuTree(restaurant.id);
    if (compterPlats(menus) < MIN_PLATS_CARTE) return null;
    return { kind: 'carte', allCities, cityName, restaurant, menus };
  },
);
