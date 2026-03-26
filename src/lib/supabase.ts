import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, key);

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
  profiles: { username: string; avatar_url: string | null; display_name: string | null } | null;
}

export interface CategoryRow {
  id: string;
  slug: string;
  icon: string;
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

export function fetchDishes(categorySlug?: string, limit = 10): Promise<DishRow[]> {
  const cacheKey = `dishes:${categorySlug || 'all'}:${limit}`;
  return cached(cacheKey, FIVE_MIN, async () => {
    const { data, error } = await supabase.rpc('get_feed_dishes', {
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
    const { data, error } = await supabase
      .from('dish_categories')
      .select('id, slug, icon')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data || []) as CategoryRow[];
  });
}

export function fetchReviews(restaurantId: string, dishName: string): Promise<ReviewRow[]> {
  const cacheKey = `reviews:${restaurantId}:${dishName}`;
  return cached(cacheKey, FIVE_MIN, async () => {
    const { data, error } = await supabase
      .from('reviews')
      .select('id, dish_name, rating, comment, price, currency, photo_url, created_at, profiles:user_id(username, avatar_url, display_name)')
      .eq('restaurant_id', restaurantId)
      .ilike('dish_name', dishName)
      .not('photo_url', 'is', null)
      .order('likes_count', { ascending: false })
      .limit(10);
    if (error) throw error;
    return ((data || []) as unknown as ReviewRow[]).filter((r) => r.photo_url);
  });
}
