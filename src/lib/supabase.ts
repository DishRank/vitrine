import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { expandCategorySlug } from './categoryHierarchy';
import { citySlug, restaurantSlug } from './slug';

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

/** Service-role client for API routes that need to bypass RLS (OSM cache
 *  reads/writes, photo cache, etc.). Same singleton as the SSR readers above. */
export function getSupabaseServiceClient(): SupabaseClient {
  return getSupabase();
}

// One singleton per (url, key) combo. The dev-vs-prod selection happens via
// `getAuthenticatedContext` in verifyAuth.ts : it derives the project from
// the JWT iss, then routes call us with that project's url + key.
const _clientsByUrl = new Map<string, SupabaseClient>();
export function getSupabaseServiceClientFor(supabaseUrl: string, serviceRoleKey: string): SupabaseClient {
  const cached = _clientsByUrl.get(supabaseUrl);
  if (cached) return cached;
  const client = createClient(supabaseUrl, serviceRoleKey);
  _clientsByUrl.set(supabaseUrl, client);
  return client;
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
  data: Promise<T>;
  expires: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

/**
 * Cache mémoire par instance. On garde la PROMESSE : des appels simultanés pour la
 * même clé (une page, ses métadonnées et son bloc de liens) partagent une seule
 * requête au lieu d'en lancer une chacun. Un échec est retiré du cache.
 */
function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (entry && Date.now() < entry.expires) return entry.data;
  const data = fn();
  cache.set(key, { data, expires: Date.now() + ttlMs });
  data.catch(() => {
    if (cache.get(key)?.data === data) cache.delete(key);
  });
  return data;
}

/**
 * Toutes les lignes d'une requête, par pages de 1 000 (plafond PostgREST), en
 * pagination par clé (`id` croissant) : un ajout pendant le parcours ne fait ni
 * sauter ni doubler de ligne, et on s'arrête sur une page vide plutôt que sur une
 * page « incomplète » (un `max-rows` plus bas que 1 000 tronquerait sinon en silence).
 */
async function selectAllById<T extends { id: string }>(
  build: (afterId: string | null) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const out: T[] = [];
  let after: string | null = null;
  for (;;) {
    const { data, error } = await build(after);
    if (error) throw error;
    const page = data || [];
    if (page.length === 0) break;
    out.push(...page);
    after = page[page.length - 1].id;
  }
  return out;
}

// ── Data fetching (cached, server-side) ──

const FIVE_MIN = 5 * 60 * 1000;
const THIRTY_MIN = 30 * 60 * 1000;

/**
 * Plats les mieux notés (avec photo), d'une catégorie ou de toutes. Une catégorie
 * parente (asian, french, drinks…) est développée en ses descendants dans UN seul
 * appel : `get_feed_dishes` prend un tableau de slugs et renvoie chaque plat une
 * fois. Avant, un appel par descendant (75 pour `european`), chacun en
 * `.catch(() => [])` : sous charge, des comptes partiels passaient pour de vrais
 * et faisaient basculer des pages en noindex.
 */
export function fetchDishes(categorySlug?: string, limit = 10): Promise<DishRow[]> {
  const slugs = categorySlug ? expandCategorySlug(categorySlug) : null;
  const cacheKey = `dishes:${categorySlug || 'all'}:${limit}`;
  return cached(cacheKey, FIVE_MIN, async () => {
    const { data, error } = await getSupabase().rpc('get_feed_dishes', {
      user_lat: null,
      user_lng: null,
      radius_km: 50,
      p_category_slugs: slugs,
      p_sort: 'rating',
      p_limit: limit,
    });
    if (error) throw error;
    return ((data || []) as DishRow[]).filter((d) => d.cover_photo_url);
  });
}

/**
 * Catégories qui ont au moins un avis modéré — par la colonne historique
 * `reviews.category_id` OU par la table de liaison `review_categories` (avis
 * multi-catégories). Paginé : au-delà de 1 000 avis, PostgREST tronquait en silence.
 */
export function fetchCategories(): Promise<CategoryRow[]> {
  return cached('categories', THIRTY_MIN, async () => {
    const supabase = getSupabase();
    const [catsResult, reviews] = await Promise.all([
      supabase
        .from('dish_categories')
        .select('id, slug, icon')
        .order('created_at', { ascending: true }),
      selectAllById<{ id: string; category_id: string | null; review_categories: { category_id: string }[] | null }>(
        (after) => {
          let q = supabase
            .from('reviews')
            .select('id, category_id, review_categories(category_id)')
            .not('pending_moderation', 'is', true)
            .order('id')
            .limit(1000);
          if (after) q = q.gt('id', after);
          return q;
        },
      ),
    ]);
    if (catsResult.error) throw catsResult.error;

    const usedIds = new Set<string>();
    for (const r of reviews) {
      if (r.category_id) usedIds.add(r.category_id);
      for (const j of r.review_categories || []) usedIds.add(j.category_id);
    }
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
 * Toutes les villes de `restaurants`. Paginé : PostgREST plafonne une réponse à
 * 1 000 lignes et la table en compte ~4 900. Sans pagination (avant le 25/10),
 * seules les villes des 1 000 premières lignes existaient pour le site — 48 sur 152 :
 * /bordeaux, /bordeaux/r/osteria-palatino (une des rares pages qui recevait des
 * clics) répondaient 404 ou noindex selon l'ordre renvoyé par la base.
 */
export function fetchCities(): Promise<string[]> {
  return cached('cities:all', THIRTY_MIN, async () => {
    const supabase = getSupabase();
    const rows = await selectAllById<{ id: string; city: string | null }>((after) => {
      let q = supabase.from('restaurants').select('id, city').not('city', 'is', null).order('id').limit(1000);
      if (after) q = q.gt('id', after);
      return q;
    });
    const set = new Set<string>();
    for (const row of rows) if (row.city) set.add(row.city);
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
  cuisines: string[] | null;
  phone: string | null;
  // Per-service opening windows : { d: 0=Mon…6=Sun, s: start min, e: end min }.
  opening_intervals: { d: number; s: number; e: number }[] | null;
}

/**
 * Deux restaurants d'une ville au même slug (« Le Bistrot ») : on retient celui que le
 * sitemap annonce — le plus de plats notés, sinon celui qui a une carte publiée, sinon
 * un restaurant ouvert —, pour que l'URL listée mène à la même fiche.
 */
async function pickTwin(hits: { id: string; closed_at: string | null }[]): Promise<string> {
  const withDishes = new Map((await fetchRestaurantsWithDishes()).map((r) => [r.id, r.dish_count]));
  const best = [...hits].sort((a, b) => (withDishes.get(b.id) ?? 0) - (withDishes.get(a.id) ?? 0))[0];
  if ((withDishes.get(best.id) ?? 0) > 0) return best.id;
  const withMenu = new Set((await fetchRestaurantsWithMenu()).map((r) => r.id));
  const open = hits.filter((h) => !h.closed_at);
  return (open.find((h) => withMenu.has(h.id)) ?? open[0] ?? hits[0]).id;
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
    const supabase = getSupabase();

    // Le slug n'existe pas en base : il se recalcule depuis le nom, donc on balaie la
    // ville. PostgREST plafonne une réponse à 1 000 lignes — et Lyon en compte 4 219 :
    // on pagine sur trois colonnes (léger), puis on charge la ligne complète par id.
    //
    // Toutes les graphies de la ville qui donnent le même slug (« Saint-Étienne » /
    // « Saint-Etienne », « LYON », espace final…) : c'est ainsi que le sitemap les
    // regroupe, sinon il annonçait des fiches que la route ne retrouvait pas (404).
    const target = citySlug(cityName);
    const variants = (await fetchCities()).filter((c) => citySlug(c) === target);
    if (variants.length === 0) variants.push(cityName);
    const rows = await selectAllById<{ id: string; name: string | null; closed_at: string | null }>((after) => {
      let q = supabase
        .from('restaurants')
        .select('id, name, closed_at')
        .in('city', variants)
        .order('id')
        .limit(1000);
      if (after) q = q.gt('id', after);
      return q;
    });
    const hits = rows.filter((r) => r.name && restaurantSlug(r.name) === restoSlug);
    const id = hits.length <= 1 ? (hits[0]?.id ?? null) : await pickTwin(hits);
    if (!id) return null;

    // Colonnes confirmées sur `restaurants` (+ cuisines/phone/opening_intervals
    // pour enrichir le JSON-LD Restaurant — servesCuisine/telephone/horaires).
    const { data: row, error: rowErr } = await supabase
      .from('restaurants')
      .select('id, name, city, address, latitude, longitude, cuisines, phone, opening_intervals')
      .eq('id', id)
      .maybeSingle();
    if (rowErr) throw rowErr;
    if (!row) return null;
    const r = row as {
      id: string;
      name: string;
      city: string;
      address: string | null;
      latitude: number | null;
      longitude: number | null;
      cuisines: string[] | null;
      phone: string | null;
      opening_intervals: { d: number; s: number; e: number }[] | null;
    };
    return {
      id: r.id,
      name: r.name,
      city: r.city,
      address: r.address ?? null,
      lat: r.latitude ?? null,
      lng: r.longitude ?? null,
      cuisines: r.cuisines ?? null,
      phone: r.phone ?? null,
      opening_intervals: r.opening_intervals ?? null,
    };
  });
}

/**
 * Tous les plats notés (avis modérés) d'un restaurant, AVEC ou SANS photo.
 *
 * On s'appuie sur la RPC `get_feed_dishes` (agrégation déjà faite côté DB)
 * puis on filtre par `restaurant_id` côté Node. Oct. 2026 : avant, la limite
 * de 500 portait sur TOUTE la plateforme (les plats les moins bien notés d'un
 * resto pouvaient sortir du lot) et les plats sans photo étaient écartés —
 * la moyenne du resto était donc gonflée. La limite est maintenant assez
 * haute pour couvrir la base ; quand elle grossira, remplacer par une RPC
 * dédiée `get_dishes_by_restaurant(restaurant_id)` filtrée côté SQL.
 * Les composants qui affichent une photo filtrent eux-mêmes `cover_photo_url`.
 */
export function fetchDishesForRestaurant(restaurantId: string): Promise<DishRow[]> {
  const cacheKey = `restaurant-dishes:${restaurantId}`;
  return cached(cacheKey, FIVE_MIN, async () => {
    const { data, error } = await getSupabase().rpc('get_feed_dishes', {
      user_lat: null,
      user_lng: null,
      radius_km: 50,
      p_category_slugs: null,
      p_sort: 'rating',
      p_limit: 100000,
    });
    if (error) throw error;
    return ((data || []) as DishRow[]).filter((d) => d.restaurant_id === restaurantId);
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
/**
 * Restaurants dont la CARTE est publiée (relevée sur leur site ou photographiée), avec
 * le nombre de plats visibles. Sert au sitemap : ces fiches n'ont pas d'avis, donc
 * `fetchRestaurantsWithDishes` les ignore, et elles restaient invisibles (19/09).
 */
export function fetchRestaurantsWithMenu(minItems = 10): Promise<RestaurantSitemapRow[]> {
  return cached(`restaurants:with-menu:${minItems}`, THIRTY_MIN, async () => {
    const supabase = getSupabase();

    // PostgREST plafonne une réponse à 1 000 lignes : sans pagination explicite, on
    // perdrait silencieusement les menus au-delà (1 390 en prod) — et un sitemap amputé
    // ne fait pas d'erreur, il oublie juste des pages.
    const countByResto = new Map<string, number>();
    const PAGE = 500;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('restaurant_menus')
        .select('restaurant_id, menu_sections(is_visible, menu_items(is_visible, kind))')
        .eq('is_active', true)
        .eq('status', 'published')
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const page = (data || []) as Array<{
        restaurant_id: string;
        menu_sections: Array<{ is_visible: boolean; menu_items: Array<{ is_visible: boolean; kind: string }> }>;
      }>;
      for (const m of page) {
        let n = 0;
        for (const s of m.menu_sections || []) {
          if (!s.is_visible) continue;
          n += (s.menu_items || []).filter((i) => i.is_visible && i.kind === 'item').length;
        }
        countByResto.set(m.restaurant_id, (countByResto.get(m.restaurant_id) || 0) + n);
      }
      if (page.length < PAGE) break;
    }

    const ids = [...countByResto.entries()].filter(([, n]) => n >= minItems).map(([id]) => id);
    if (ids.length === 0) return [];

    // `.in('id', ids)` part dans l'URL : avec 800 UUID elle dépasse la taille admise et
    // PostgREST répond « Bad Request ». On interroge par paquets.
    const rows: Array<{ id: string; name: string; city: string }> = [];
    const LOT = 150;
    for (let i = 0; i < ids.length; i += LOT) {
      const { data, error } = await supabase
        .from('restaurants')
        .select('id, name, city')
        .in('id', ids.slice(i, i + LOT))
        .is('closed_at', null)
        .not('city', 'is', null)
        .not('name', 'is', null);
      if (error) throw error;
      rows.push(...((data || []) as Array<{ id: string; name: string; city: string }>));
    }
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      city: r.city,
      dish_count: countByResto.get(r.id) || 0,
    }));
  });
}

export function fetchRestaurantsWithDishes(): Promise<RestaurantSitemapRow[]> {
  return cached('restaurants:with-dishes', THIRTY_MIN, async () => {
    const supabase = getSupabase();
    // Paginé : au-delà de 1 000 avis, PostgREST tronquait en silence.
    const reviews = await selectAllById<{ id: string; restaurant_id: string; dish_name: string }>((after) => {
      let q = supabase
        .from('reviews')
        .select('id, restaurant_id, dish_name')
        .not('pending_moderation', 'is', true)
        .order('id')
        .limit(1000);
      if (after) q = q.gt('id', after);
      return q;
    });

    // Compter les plats DISTINCTS par resto (un plat = même nom normalisé)
    const dishesByResto = new Map<string, Set<string>>();
    for (const rv of reviews) {
      const key = (rv.dish_name || '').toLowerCase().trim();
      if (!key) continue;
      const set = dishesByResto.get(rv.restaurant_id) || new Set<string>();
      set.add(key);
      dishesByResto.set(rv.restaurant_id, set);
    }

    // On charge les restaurants PAR ID depuis les avis, et non la table entière :
    // PostgREST plafonne une réponse à 1 000 lignes et la table en compte plus de
    // 7 000, donc l'ancien parcours perdait en silence les restos notés situés
    // au-delà — invisibles dans le sitemap sans la moindre erreur.
    const ids = [...dishesByResto.keys()];
    if (ids.length === 0) return [];
    const result: RestaurantSitemapRow[] = [];
    const LOT = 150;
    for (let i = 0; i < ids.length; i += LOT) {
      const { data, error } = await supabase
        .from('restaurants')
        .select('id, name, city')
        .in('id', ids.slice(i, i + LOT))
        .is('closed_at', null)
        .not('city', 'is', null)
        .not('name', 'is', null);
      if (error) throw error;
      for (const r of (data || []) as Array<{ id: string; name: string; city: string }>) {
        const dishes = dishesByResto.get(r.id);
        if (!dishes || dishes.size === 0) continue;
        result.push({ id: r.id, name: r.name, city: r.city, dish_count: dishes.size });
      }
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

/**
 * Recent moderated reviews *with a written comment* across the whole
 * restaurant — feeds the `Review[]` array of the Restaurant JSON-LD so AI
 * answer engines can quote real, attributed opinions. Unlike `fetchReviews`,
 * a photo is not required (we want the text), and results span every dish.
 */
export function fetchReviewsForRestaurant(restaurantId: string, limit = 8): Promise<ReviewRow[]> {
  const cacheKey = `restaurant-reviews:${restaurantId}`;
  return cached(cacheKey, FIVE_MIN, async () => {
    const { data, error } = await getSupabase()
      .from('reviews')
      .select('id, dish_name, rating, comment, price, currency, photo_url, created_at, profiles:user_id(avatar_url, display_name)')
      .eq('restaurant_id', restaurantId)
      .not('pending_moderation', 'is', true)
      .not('comment', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return ((data || []) as unknown as ReviewRow[]).filter(
      (r) => (r.comment || '').trim().length > 0,
    );
  });
}
