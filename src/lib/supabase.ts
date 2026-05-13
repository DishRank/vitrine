import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { expandCategorySlug } from './categoryHierarchy';
import { restaurantSlug } from './slug';

// Server-only: lazy init to avoid build-time errors
let _supabase: SupabaseClient | null = null;

function getSupabase() {
  if (!_supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    _supabase = createClient(url, key);
  }
  return _supabase;
}

// ── Types ──

export interface DishRow {
  restaurant_id: string;
  restaurant_name: string;
  restaurant_address: string;
  restaurant_city: string;
  restaurant_lat: number | null;
  restaurant_lng: number | null;
  dish_name: string;
  avg_rating: number;
  review_count: number;
  latest_price: number | null;
  currency: string;
  cover_photo_url: string;
  category_slug: string | null;
  category_icon: string | null;
  latest_review_at: string;
  total_likes: number;
  reviewer_avatars: string[];
}

export interface ReviewRow {
  id: string;
  dish_name: string;
  rating: number;
  comment: string | null;
  price: number | null;
  currency: string;
  photo_url: string;
  created_at: string;
  profiles: { avatar_url: string | null; display_name: string | null } | null;
}

export interface CategoryRow {
  id: string;
  slug: string;
  icon: string;
}

/**
 * Row used by the "En direct" feed marquee (`<SocialProof />`).
 * Joins reviews + restaurants + profiles to get the displayable info in one query.
 * Only the fields we actually render are pulled — keep this lean.
 */
export interface RecentReviewRow {
  id: string;
  dish_name: string;
  rating: number;
  created_at: string;
  restaurant_name: string;
  user_id: string | null;
  /** display_name | null — null = profil anonyme (rare).
   *  Note : la colonne `username` a été retirée de `profiles` lors de la
   *  release sociale ; seul `display_name` reste comme identifiant lisible. */
  display_name: string | null;
}

// ── Simple server-side cache to avoid hammering Supabase ──

interface CacheEntry<T> {
  data: T;
  expires: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (entry && Date.now() < entry.expires) {
    return Promise.resolve(entry.data);
  }
  return fn().then((data) => {
    cache.set(key, { data, expires: Date.now() + ttlMs });
    return data;
  });
}

// ── Data fetching (cached, server-side) ──

const FIVE_MIN = 5 * 60 * 1000;
const THIRTY_MIN = 30 * 60 * 1000;

/**
 * Fetch top dishes. When the slug has children in `categoryHierarchy`, fires
 * one RPC per descendant slug in parallel, then merges + dedupes + re-sorts.
 *
 * Why parallel calls (and not a single `slug = ANY(...)` call): the prod RPC
 * still has the scalar signature `p_category_slug TEXT`. The array signature
 * exists only on the dev DB so far — when prod migrates we'll collapse this
 * back into a single call.
 */
export async function fetchDishes(categorySlug?: string, limit = 10): Promise<DishRow[]> {
  const slugs = categorySlug ? expandCategorySlug(categorySlug) : [undefined];
  if (slugs.length === 1) {
    return fetchDishesForSlug(slugs[0], limit);
  }
  const cacheKey = `dishes:agg:${categorySlug}:${limit}`;
  return cached(cacheKey, FIVE_MIN, async () => {
    const perSlugLimit = Math.max(limit, 30);
    const results = await Promise.all(
      slugs.map((s) => fetchDishesForSlug(s, perSlugLimit).catch(() => [] as DishRow[])),
    );
    const seen = new Set<string>();
    const merged: DishRow[] = [];
    for (const list of results) {
      for (const d of list) {
        const key = `${d.restaurant_id}::${d.dish_name.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(d);
      }
    }
    merged.sort((a, b) => {
      const byRating = Number(b.avg_rating) - Number(a.avg_rating);
      if (byRating !== 0) return byRating;
      return Number(b.review_count) - Number(a.review_count);
    });
    return merged.slice(0, limit);
  });
}

function fetchDishesForSlug(categorySlug: string | undefined, limit: number): Promise<DishRow[]> {
  const cacheKey = `dishes:${categorySlug || 'all'}:${limit}`;
  return cached(cacheKey, FIVE_MIN, async () => {
    const { data, error } = await getSupabase().rpc('get_feed_dishes', {
      user_lat: null,
      user_lng: null,
      radius_km: 50,
      p_category_slug: categorySlug || null,
      p_sort: 'rating',
      p_limit: limit,
    });
    if (error) throw error;
    return ((data || []) as DishRow[]).filter((d) => d.cover_photo_url);
  });
}

export function fetchCategories(): Promise<CategoryRow[]> {
  return cached('categories', THIRTY_MIN, async () => {
    const supabase = getSupabase();
    const [catsResult, reviewsResult] = await Promise.all([
      supabase
        .from('dish_categories')
        .select('id, slug, icon')
        .order('created_at', { ascending: true }),
      supabase
        .from('reviews')
        .select('category_id')
        .not('category_id', 'is', null)
        .not('pending_moderation', 'is', true),
    ]);
    if (catsResult.error) throw catsResult.error;
    if (reviewsResult.error) throw reviewsResult.error;

    const usedIds = new Set(
      (reviewsResult.data || []).map((r) => r.category_id as string)
    );
    return ((catsResult.data || []) as CategoryRow[]).filter((c) => usedIds.has(c.id));
  });
}

/**
 * All categories from `dish_categories` without the "has-reviews" filter.
 * Used for URL validation in dynamic routes (e.g. `/lyon/pizza`) so that a
 * valid category URL still renders (as an empty-state page with a CityGuide)
 * even before any review has been moderated for it.
 *
 * `fetchCategories()` stays filtered so that the SearchSection chips don't
 * show categories that would lead to empty grids.
 */
export function fetchAllCategorySlugs(): Promise<Set<string>> {
  return cached('categories:all-slugs', THIRTY_MIN, async () => {
    const { data, error } = await getSupabase()
      .from('dish_categories')
      .select('slug');
    if (error) throw error;
    return new Set(((data || []) as Array<{ slug: string }>).map((c) => c.slug));
  });
}

/**
 * All (city, category-slug) pairs that have at least one moderated review,
 * with the dish count per pair. Drives the sitemap so every page that
 * actually has content is referenced for indexing.
 *
 * Uses both the junction `review_categories` (multi-category reviews) and
 * the legacy `reviews.category_id` so a review without junction rows still
 * surfaces under its primary category. A review tagged with N categories
 * generates N sitemap entries — wanted, since each /<city>/<cat> page
 * legitimately renders that dish.
 */
export interface CityCategoryPair {
  city: string;
  category_slug: string;
  dish_count: number;
}
export function fetchCityCategoryPairs(): Promise<CityCategoryPair[]> {
  return cached('city-category-pairs', THIRTY_MIN, async () => {
    const supabase = getSupabase();
    // Single query, joins reviews → restaurants (city) and falls back from the
    // junction to the legacy column when the junction has no row for a review.
    const { data, error } = await supabase.rpc('get_city_category_pairs');
    if (!error && data) return (data || []) as CityCategoryPair[];
    // Fallback: assemble client-side if the RPC doesn't exist yet.
    const [reviewsRes, junctionRes, restosRes, catsRes] = await Promise.all([
      supabase
        .from('reviews')
        .select('id, restaurant_id, category_id')
        .not('pending_moderation', 'is', true),
      supabase.from('review_categories').select('review_id, category_id'),
      supabase.from('restaurants').select('id, city').not('city', 'is', null),
      supabase.from('dish_categories').select('id, slug'),
    ]);
    if (reviewsRes.error) throw reviewsRes.error;
    if (restosRes.error) throw restosRes.error;
    if (catsRes.error) throw catsRes.error;

    const cityById = new Map<string, string>();
    for (const r of (restosRes.data || []) as Array<{ id: string; city: string | null }>) {
      if (r.city) cityById.set(r.id, r.city);
    }
    const slugById = new Map<string, string>();
    for (const c of (catsRes.data || []) as Array<{ id: string; slug: string }>) {
      slugById.set(c.id, c.slug);
    }
    const junctionByReview = new Map<string, Set<string>>();
    for (const j of (junctionRes.data || []) as Array<{ review_id: string; category_id: string }>) {
      const set = junctionByReview.get(j.review_id) || new Set<string>();
      set.add(j.category_id);
      junctionByReview.set(j.review_id, set);
    }

    const counts = new Map<string, { city: string; category_slug: string; n: number }>();
    for (const rv of (reviewsRes.data || []) as Array<{ id: string; restaurant_id: string; category_id: string | null }>) {
      const city = cityById.get(rv.restaurant_id);
      if (!city) continue;
      const catIds = junctionByReview.get(rv.id) || (rv.category_id ? new Set([rv.category_id]) : new Set<string>());
      for (const cid of catIds) {
        const slug = slugById.get(cid);
        if (!slug) continue;
        const key = `${city}::${slug}`;
        const cur = counts.get(key);
        if (cur) cur.n += 1;
        else counts.set(key, { city, category_slug: slug, n: 1 });
      }
    }
    return [...counts.values()].map((v) => ({ city: v.city, category_slug: v.category_slug, dish_count: v.n }));
  });
}

export function fetchCities(): Promise<string[]> {
  return cached('cities:all', THIRTY_MIN, async () => {
    const { data, error } = await getSupabase()
      .from('restaurants')
      .select('city')
      .not('city', 'is', null);
    if (error) throw error;
    const set = new Set<string>();
    for (const row of (data || []) as Array<{ city: string | null }>) {
      if (row.city) set.add(row.city);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  });
}

/**
 * Fetch the N most recent moderated reviews for the homepage "En direct" feed.
 * Joins to `restaurants` (for the resto name) and `profiles` (for display name).
 *
 * Note : `user_id` est récupéré DIRECTEMENT depuis la table `reviews`
 * (FK column) plutôt que depuis le join profiles, car la table `profiles` n'a
 * pas de colonne `user_id` (sa PK est `id`). On évite ainsi un select sur une
 * colonne inexistante côté join.
 *
 * Caching : 60s — short enough that the feed feels live, long enough to avoid
 * hammering Supabase on every page hit.
 */
export function fetchRecentReviews(limit = 12): Promise<RecentReviewRow[]> {
  const cacheKey = `recent-reviews:${limit}`;
  return cached(cacheKey, 60_000, async () => {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('reviews')
      .select(
        'id, dish_name, rating, created_at, user_id, restaurants:restaurant_id(name), profiles:user_id(display_name)'
      )
      .not('pending_moderation', 'is', true)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) {
      console.error('[fetchRecentReviews]', error);
      return [];
    }
    type Joined = {
      id: string;
      dish_name: string;
      rating: number;
      created_at: string;
      user_id: string | null;
      restaurants: { name: string } | null;
      profiles: { display_name: string | null } | null;
    };
    return ((data || []) as unknown as Joined[])
      .filter((r) => r.restaurants?.name) // skip orphans
      .map((r) => ({
        id: r.id,
        dish_name: r.dish_name,
        rating: Number(r.rating),
        created_at: r.created_at,
        restaurant_name: r.restaurants!.name,
        user_id: r.user_id || null,
        display_name: r.profiles?.display_name || null,
      }));
  });
}

// ── Restaurant pages ──

export interface RestaurantRow {
  id: string;
  name: string;
  address: string | null;
  city: string;
  lat: number | null;
  lng: number | null;
}

/**
 * Find a restaurant by its URL slug within a given city. Uses the same
 * `restaurantSlug()` function used at sitemap generation time so a URL
 * roundtrip is guaranteed lossless.
 *
 * Returns the first match if multiple restaurants in the same city share
 * the same slug (collisions are rare given the slug includes the full
 * normalized name). For production, consider adding a generated `slug`
 * column to `restaurants` and a unique index on `(city, slug)`.
 */
export function fetchRestaurantBySlug(
  cityName: string,
  restoSlug: string,
): Promise<RestaurantRow | null> {
  const cacheKey = `restaurant:${cityName.toLowerCase()}:${restoSlug}`;
  return cached(cacheKey, FIVE_MIN, async () => {
    // On ne SELECT que les colonnes confirmées sur la table `restaurants`
    // (id, name, city). L'adresse + lat/lng vivent côté reviews-aggregat
    // (RPC `get_feed_dishes`) où elles sont déjà jointes en
    // `restaurant_address`, `restaurant_lat`, `restaurant_lng` — la page
    // resto les pull depuis dishes[0] pour le JSON-LD geo.
    const { data, error } = await getSupabase()
      .from('restaurants')
      .select('id, name, city')
      .ilike('city', cityName);
    if (error) throw error;
    for (const r of (data || []) as { id: string; name: string; city: string }[]) {
      if (restaurantSlug(r.name) === restoSlug) {
        return { id: r.id, name: r.name, city: r.city, address: null, lat: null, lng: null };
      }
    }
    return null;
  });
}

/**
 * Fetch all moderated dishes for a single restaurant, sorted by rating.
 *
 * Implementation note : on s'appuie sur la RPC `get_feed_dishes` existante
 * pour profiter de l'agrégation (review_count, avg_rating, latest_price)
 * déjà calculée côté DB, puis on filtre par `restaurant_id` côté Node.
 * Acceptable tant que l'inventaire de plats par resto reste faible
 * (< 30 plats pour 99% des restos). Quand la base grossit, ajouter
 * une RPC dédiée `get_dishes_by_restaurant(restaurant_id)` qui filtre
 * côté SQL.
 */
export function fetchDishesForRestaurant(restaurantId: string): Promise<DishRow[]> {
  const cacheKey = `restaurant-dishes:${restaurantId}`;
  return cached(cacheKey, FIVE_MIN, async () => {
    const { data, error } = await getSupabase().rpc('get_feed_dishes', {
      user_lat: null,
      user_lng: null,
      radius_km: 50,
      p_category_slug: null,
      p_sort: 'rating',
      p_limit: 500,
    });
    if (error) throw error;
    return ((data || []) as DishRow[])
      .filter((d) => d.restaurant_id === restaurantId && d.cover_photo_url);
  });
}

export interface RestaurantSitemapRow {
  id: string;
  name: string;
  city: string;
  dish_count: number;
}

/**
 * Liste tous les restaurants ayant au moins 1 plat noté (review modérée).
 * Utilisé par le sitemap pour générer les URLs `/[city]/r/[slug]` —
 * seuls les restos avec contenu sont indexés (évite les soft-404).
 */
export function fetchRestaurantsWithDishes(): Promise<RestaurantSitemapRow[]> {
  return cached('restaurants:with-dishes', THIRTY_MIN, async () => {
    const supabase = getSupabase();
    const [reviewsRes, restosRes] = await Promise.all([
      supabase
        .from('reviews')
        .select('restaurant_id, dish_name')
        .not('pending_moderation', 'is', true),
      supabase
        .from('restaurants')
        .select('id, name, city')
        .not('city', 'is', null)
        .not('name', 'is', null),
    ]);
    if (reviewsRes.error) throw reviewsRes.error;
    if (restosRes.error) throw restosRes.error;

    // Compter les plats DISTINCTS par resto (un plat = même nom normalisé)
    const dishesByResto = new Map<string, Set<string>>();
    for (const rv of (reviewsRes.data || []) as Array<{
      restaurant_id: string;
      dish_name: string;
    }>) {
      const key = (rv.dish_name || '').toLowerCase().trim();
      if (!key) continue;
      const set = dishesByResto.get(rv.restaurant_id) || new Set<string>();
      set.add(key);
      dishesByResto.set(rv.restaurant_id, set);
    }

    const result: RestaurantSitemapRow[] = [];
    for (const r of (restosRes.data || []) as Array<{
      id: string;
      name: string;
      city: string;
    }>) {
      const dishes = dishesByResto.get(r.id);
      if (!dishes || dishes.size === 0) continue;
      result.push({
        id: r.id,
        name: r.name,
        city: r.city,
        dish_count: dishes.size,
      });
    }
    return result;
  });
}

export function fetchReviews(restaurantId: string, dishName: string): Promise<ReviewRow[]> {
  const cacheKey = `reviews:${restaurantId}:${dishName}`;
  return cached(cacheKey, FIVE_MIN, async () => {
    const { data, error } = await getSupabase()
      .from('reviews')
      .select('id, dish_name, rating, comment, price, currency, photo_url, created_at, profiles:user_id(avatar_url, display_name)')
      .eq('restaurant_id', restaurantId)
      .ilike('dish_name', dishName)
      .not('photo_url', 'is', null)
      .order('likes_count', { ascending: false })
      .limit(10);
    if (error) throw error;
    return ((data || []) as unknown as ReviewRow[]).filter((r) => r.photo_url);
  });
}
