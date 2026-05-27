/**
 * OSM restaurants — mobile-app fetcher.
 *
 * Replaces the Supabase Edge Function `fetch-osm-restaurants` so we offload
 * the invocations to Vercel (much more generous free quota than Supabase
 * edge functions). The wire contract is identical, so the mobile client only
 * has to swap the URL — no shape change.
 *
 * Cache strategy : `public.osm_zones_cache` table in Supabase, accessed via
 * the service-role client. Same cache, just read/written from a different
 * server. A warm zone returns features without ever calling Overpass.
 */

import { NextResponse } from 'next/server';
import { getAuthenticatedContext } from '@/lib/verifyAuth';
import { getCorsHeaders } from '@/lib/cors';
import { getSupabaseServiceClientFor } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 30;

type Bbox = { south: number; west: number; north: number; east: number };

const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

const USER_AGENT = 'DishRank/1.0 (contact: hello@dishrank.fr)';
const CACHE_TTL_DAYS = 30;
const OVERPASS_TIMEOUT_MS = 12000;
const DIET_KEYS = ['vegetarian', 'vegan', 'gluten_free', 'halal', 'kosher', 'dairy_free', 'pescatarian'] as const;

const PLACE_TYPE_AMENITIES: Record<string, string[]> = {
  restaurant: ['restaurant', 'fast_food'],
  bar: ['bar', 'pub', 'biergarten'],
  cafe: ['cafe', 'ice_cream'],
};
const CATEGORY_PLACE_TYPES: Record<string, string[]> = {
  eat: ['restaurant', 'cafe'],
  drink: ['bar'],
  coffee: ['cafe'],
};
const ALL_PLACE_TYPES = ['restaurant', 'bar', 'cafe'];

function amenitiesForPlaceTypes(placeTypes: string[]): string[] {
  const out = new Set<string>();
  for (const pt of placeTypes) for (const a of (PLACE_TYPE_AMENITIES[pt] ?? [])) out.add(a);
  return [...out];
}

/**
 * Defensive city sanitizer (same logic as the `cleanCity()` helper in
 * `osm/photos/route.ts`). The mobile client falls back to the outing's
 * `center_label` for the `city` field, but that label can be a full
 * geocoded address ("10 Rue Jean-Baptiste Lully, Vénissieux, 69200,
 * France"). When OSM venues are missing `addr:city`, this string would
 * land verbatim in `restaurants.city` and break every downstream
 * consumer that filters / searches / displays by city.
 *
 * Strips street/postal/country segments and keeps the last surviving
 * non-address part. Returns null when nothing usable remains, so the
 * row gets a NULL city instead of garbage — the app layer re-derives
 * via reverseGeocode at render time when needed.
 */
function cleanCity(city: string | null | undefined): string | null {
  if (!city) return null;
  const trimmed = city.trim();
  if (!trimmed) return null;
  if (!trimmed.includes(',')) return trimmed;
  const parts = trimmed.split(',').map((s) => s.trim()).filter(Boolean);
  const candidates = parts.filter((p) =>
    !/^\d{4,6}$/.test(p) &&
    !/^france$/i.test(p) &&
    !/^\d+\s/.test(p) &&
    !/(rue|avenue|av\.?|boulevard|bd\.?|place|impasse|chemin|all[ée]e|route)\b/i.test(p) &&
    p.length > 1
  );
  if (candidates.length === 0) return null;
  return candidates[candidates.length - 1];
}

function buildBbox(lat: number, lng: number, radiusKm: number): Bbox {
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  return {
    south: lat - latDelta, west: lng - lngDelta,
    north: lat + latDelta, east: lng + lngDelta,
  };
}

function overpassQuery(bbox: Bbox, amenities: string[], timeoutSec = 25): string {
  const b = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  const blocks = amenities.map((a) => `nwr["amenity"="${a}"](${b});`).join('');
  return `[out:json][timeout:${timeoutSec}];(${blocks});out center tags;`;
}

async function tryOverpass(url: string, query: string, method: 'POST' | 'GET', timeoutMs = OVERPASS_TIMEOUT_MS): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const body = `data=${encodeURIComponent(query)}`;
    const req = method === 'GET'
      ? fetch(`${url}?${body}`, { method: 'GET', headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, signal: ctrl.signal })
      : fetch(url, { method: 'POST', headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body, signal: ctrl.signal });
    const res = await req;
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`${method} ${url}: HTTP ${res.status} — ${text.slice(0, 160)}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchOverpass(query: string, timeoutMs = OVERPASS_TIMEOUT_MS): Promise<{ elements?: unknown[] }> {
  const errors: string[] = [];
  for (const url of OVERPASS_MIRRORS) {
    for (const method of ['POST', 'GET'] as const) {
      try { return await tryOverpass(url, query, method, timeoutMs) as { elements?: unknown[] }; }
      catch (e) { errors.push(String(e)); console.error(`[overpass] ${method} ${url} failed:`, e); }
    }
  }
  throw new Error(`all mirrors failed: ${errors.join(' | ')}`);
}

function priceFromTag(tag?: string): number | null {
  if (!tag) return null;
  const m = tag.toLowerCase();
  if (['cheap', 'budget', 'low', '$'].includes(m)) return 1;
  if (['mid', 'moderate', 'medium', '$$'].includes(m)) return 2;
  if (['expensive', 'upscale', 'high', '$$$'].includes(m)) return 3;
  if (['luxury', 'fine_dining', '$$$$'].includes(m)) return 4;
  return null;
}

function cuisinesFromTag(tag?: string): string[] | null {
  if (!tag) return null;
  const items = tag.split(';').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return items.length > 0 ? items : null;
}

function photoFromTags(tags: Record<string, string>): string | null {
  const direct = tags['image'] || tags['image:url'];
  if (direct && /^https?:\/\//.test(direct)) return direct;
  const wc = tags['wikimedia_commons'];
  if (wc) {
    const file = wc.replace(/^File:/i, '').trim();
    if (file) return `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(file)}`;
  }
  return null;
}

function featuresFromTags(tags: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const t = (k: string): string | undefined => { const v = tags[k]; return v && String(v).trim() ? String(v).trim() : undefined; };
  const phone = t('contact:phone') || t('phone'); if (phone) out.phone = phone;
  const website = t('contact:website') || t('website'); if (website) out.website = website;
  const email = t('contact:email') || t('email'); if (email) out.email = email;
  const takeaway = t('takeaway'); if (takeaway === 'yes' || takeaway === 'no' || takeaway === 'only') out.takeaway = takeaway;
  const delivery = t('delivery'); if (delivery === 'yes' || delivery === 'no') out.delivery = delivery;
  const wheelchair = t('wheelchair'); if (['yes', 'no', 'limited'].includes(wheelchair || '')) out.wheelchair = wheelchair;
  const outdoor = t('outdoor_seating'); if (outdoor === 'yes' || outdoor === 'no') out.outdoor_seating = outdoor;
  const wifi = t('internet_access') || t('wifi'); if (wifi) out.wifi = wifi;
  const smoking = t('smoking'); if (smoking) out.smoking = smoking;
  const dog = t('dog'); if (dog) out.dog = dog;
  const reservation = t('reservation'); if (reservation) out.reservation = reservation;
  const diet: string[] = [];
  for (const k of DIET_KEYS) { const v = t(`diet:${k}`)?.toLowerCase(); if (v === 'yes' || v === 'only') diet.push(k); }
  if (diet.length > 0) out.diet = diet;
  const payment: Record<string, string> = {};
  for (const k of ['payment:credit_cards', 'payment:cash', 'payment:contactless'] as const) {
    const v = t(k); if (v) payment[k.replace('payment:', '')] = v;
  }
  if (Object.keys(payment).length > 0) out.payment = payment;
  for (const k of ['brand', 'wikipedia', 'wikidata', 'stars']) {
    const v = t(k); if (v) out[k] = v;
  }
  // brand:wikidata is the QID of the chain (Starbucks, McDo…). Used as a
  // logo fallback by the photo enrichment route when the venue itself has
  // neither website nor wikidata. Different field name so renderers can
  // tell "real venue image" apart from "branded logo".
  const brandWikidata = t('brand:wikidata');
  if (brandWikidata) out.brand_wikidata = brandWikidata;
  return out;
}

// Opening-hours → normalized weekly intervals (mirrors lib/openingHours.ts).
type OhInterval = { d: number; s: number; e: number };
const OH_DAY_MAP: Record<string, number> = { mo: 0, tu: 1, we: 2, th: 3, fr: 4, sa: 5, su: 6 };

function ohParseDays(tok: string): number[] | null {
  const days: number[] = [];
  for (const part of tok.split(',')) {
    const range = part.trim(); if (!range) continue;
    const m = range.match(/^([A-Za-z]{2})(?:-([A-Za-z]{2}))?$/); if (!m) return null;
    const start = OH_DAY_MAP[m[1].toLowerCase()]; if (start === undefined) return null;
    if (!m[2]) { days.push(start); continue; }
    const end = OH_DAY_MAP[m[2].toLowerCase()]; if (end === undefined) return null;
    if (end >= start) { for (let d = start; d <= end; d++) days.push(d); }
    else { for (let d = start; d <= 6; d++) days.push(d); for (let d = 0; d <= end; d++) days.push(d); }
  }
  return days.length ? days : null;
}

function ohParseTimes(tok: string): { s: number; e: number }[] | null {
  const out: { s: number; e: number }[] = [];
  for (const part of tok.split(',')) {
    const m = part.trim().match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/); if (!m) return null;
    out.push({ s: (+m[1]) * 60 + (+m[2]), e: (+m[3]) * 60 + (+m[4]) });
  }
  return out.length ? out : null;
}

function ohPushWindow(acc: OhInterval[], days: number[], s: number, e: number) {
  for (const d of days) {
    if (e > s) acc.push({ d, s, e: Math.min(e, 1440) });
    else if (e < s) {
      acc.push({ d, s, e: 1440 });
      if (e > 0) acc.push({ d: (d + 1) % 7, s: 0, e });
    }
  }
}

function computeOpeningIntervals(raw: string | null | undefined): OhInterval[] | null {
  if (!raw) return null;
  const r = raw.trim(); if (!r) return null;
  if (/^24\/7$/.test(r)) {
    const acc: OhInterval[] = [];
    for (let d = 0; d < 7; d++) acc.push({ d, s: 0, e: 1440 });
    return acc;
  }
  const acc: OhInterval[] = []; const offDays = new Set<number>();
  for (const chunk of r.split(';')) {
    const c = chunk.trim(); if (!c) continue;
    const offMatch = c.match(/^([A-Za-z]{2}(?:-[A-Za-z]{2})?(?:,[A-Za-z]{2}(?:-[A-Za-z]{2})?)*)\s+(off|closed)$/i);
    if (offMatch) { const days = ohParseDays(offMatch[1]); if (!days) return null; days.forEach((d) => offDays.add(d)); continue; }
    const m = c.match(/^([A-Za-z]{2}(?:-[A-Za-z]{2})?(?:,[A-Za-z]{2}(?:-[A-Za-z]{2})?)*)\s+(\d{1,2}:\d{2}-\d{1,2}:\d{2}(?:,\d{1,2}:\d{2}-\d{1,2}:\d{2})*)$/);
    if (m) { const days = ohParseDays(m[1]); const times = ohParseTimes(m[2]); if (!days || !times) return null; for (const t of times) ohPushWindow(acc, days, t.s, t.e); continue; }
    const t = c.match(/^\d{1,2}:\d{2}-\d{1,2}:\d{2}(?:,\d{1,2}:\d{2}-\d{1,2}:\d{2})*$/);
    if (t) { const times = ohParseTimes(c); if (!times) return null; for (const tm of times) ohPushWindow(acc, [0, 1, 2, 3, 4, 5, 6], tm.s, tm.e); continue; }
    return null;
  }
  return acc.filter((iv) => !offDays.has(iv.d));
}

function placeTypeFromAmenity(amenity: string | undefined): 'restaurant' | 'bar' | 'cafe' | null {
  switch (amenity) {
    case 'restaurant': case 'fast_food': return 'restaurant';
    case 'bar': case 'pub': case 'biergarten': return 'bar';
    case 'cafe': case 'ice_cream': return 'cafe';
    default: return null;
  }
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { headers: getCorsHeaders(request) });
}

export async function POST(request: Request) {
  const cors = getCorsHeaders(request);
  const auth = await getAuthenticatedContext(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: cors });

  type Body = {
    lat?: number; lng?: number; radius_km?: number; city?: string | null; force?: boolean;
    bbox?: { south?: number; west?: number; north?: number; east?: number };
    category?: string | null;
    return_only?: boolean;
  };
  let body: Body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'bad json' }, { status: 400, headers: cors }); }

  // Sanitize upstream — the mobile app sometimes passes a full address as
  // `city` (it copies `outingLocation.label` verbatim). Without this guard
  // that address ends up in `restaurants.city` whenever an OSM venue is
  // missing `addr:city`, polluting every city-based query.
  const city = cleanCity(body.city);
  const force = !!body.force;
  const wantPlaceTypes = (body.category && CATEGORY_PLACE_TYPES[body.category]) ? CATEGORY_PLACE_TYPES[body.category] : ALL_PLACE_TYPES;
  const amenities = amenitiesForPlaceTypes(wantPlaceTypes);

  let bbox: Bbox; let isCityScope = false; const MAX_SPAN_DEG = 0.9;
  if (body.bbox && typeof body.bbox.south === 'number' && typeof body.bbox.north === 'number' && typeof body.bbox.west === 'number' && typeof body.bbox.east === 'number' && body.bbox.north > body.bbox.south && body.bbox.east > body.bbox.west) {
    const b = body.bbox;
    if ((b.north! - b.south!) > MAX_SPAN_DEG || (b.east! - b.west!) > MAX_SPAN_DEG) return NextResponse.json({ error: 'bbox too large' }, { status: 400, headers: cors });
    bbox = { south: b.south!, west: b.west!, north: b.north!, east: b.east! };
    isCityScope = true;
  } else {
    const { lat, lng } = body;
    if (typeof lat !== 'number' || typeof lng !== 'number') return NextResponse.json({ error: 'lat/lng or bbox required' }, { status: 400, headers: cors });
    const radiusKm = Math.max(0.5, Math.min(body.radius_km ?? 5, 15));
    bbox = buildBbox(lat, lng, radiusKm);
  }

  const supabase = getSupabaseServiceClientFor(auth.supabaseUrl, auth.serviceRoleKey);
  const cutoffMs = Date.now() - CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;

  const { data: candidates } = await supabase
    .from('osm_zones_cache')
    .select('id, restaurant_count, last_fetched_at, place_types, features')
    .lte('min_lat', bbox.south).gte('max_lat', bbox.north)
    .lte('min_lng', bbox.west).gte('max_lng', bbox.east)
    .limit(1);
  const existingZone = candidates && candidates.length > 0 ? candidates[0] : null;
  const cachedTypes = (existingZone?.place_types ?? null) as string[] | null;
  const coversTypes = cachedTypes === null ? true : wantPlaceTypes.every((t) => cachedTypes.includes(t));
  const cachedCount = (existingZone?.restaurant_count ?? 0) as number;
  const isFresh = !!existingZone && cachedCount > 0 && coversTypes && new Date(existingZone.last_fetched_at).getTime() > cutoffMs;

  // Live-OSM cache short-circuit — return cached features filtered to bbox.
  if (body.return_only && isFresh && !force && Array.isArray(existingZone!.features)) {
    const allFeatures = existingZone!.features as Array<{ latitude?: number; longitude?: number; place_type?: string }>;
    const filtered = allFeatures.filter((f) => {
      if (!f) return false;
      if (typeof f.latitude !== 'number' || typeof f.longitude !== 'number') return false;
      if (f.latitude < bbox.south || f.latitude > bbox.north) return false;
      if (f.longitude < bbox.west || f.longitude > bbox.east) return false;
      if (wantPlaceTypes.length > 0 && f.place_type && !wantPlaceTypes.includes(f.place_type)) return false;
      return true;
    });
    return NextResponse.json({ return_only: true, source: 'cache', total_found: filtered.length, features: filtered }, { headers: cors });
  }

  if (isFresh && !force && !body.return_only) {
    return NextResponse.json({ cached: true, zone_id: existingZone!.id, restaurant_count: existingZone!.restaurant_count }, { headers: cors });
  }

  const overpass = await fetchOverpass(overpassQuery(bbox, amenities, isCityScope ? 60 : 25), isCityScope ? 25000 : OVERPASS_TIMEOUT_MS);
  const elements = (overpass.elements ?? []) as Array<{ type?: string; id?: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }>;

  // Telemetry — best effort.
  try { await supabase.from('api_usage').insert({ provider: 'osm', endpoint: 'overpass' }); } catch {}

  const nodes = elements.map((el) => {
    const tags = el.tags ?? {};
    const name = tags.name; if (!name) return null;
    const placeType = placeTypeFromAmenity(tags.amenity); if (!placeType) return null;
    const centroid = el.type === 'node' ? { lat: el.lat!, lon: el.lon! } : el.center ?? null;
    if (!centroid) return null;
    return {
      osm_id: el.id as number,
      name,
      latitude: centroid.lat,
      longitude: centroid.lon,
      address: [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ') || null,
      city: tags['addr:city'] ?? city,
      country: tags['addr:country'] ?? null,
      country_code: tags['addr:country'] ?? null,
      postal_code: tags['addr:postcode'] ?? null,
      cuisines: cuisinesFromTag(tags.cuisine),
      price_level: priceFromTag(tags['price'] ?? tags['price:range']),
      opening_hours_raw: tags.opening_hours ?? null,
      opening_intervals: computeOpeningIntervals(tags.opening_hours),
      photo_url: photoFromTags(tags),
      features: featuresFromTags(tags),
      place_type: placeType,
    };
  }).filter(Boolean) as Array<Record<string, unknown>>;

  // Warm the zone cache so the next request short-circuits Overpass.
  if (body.return_only) {
    try {
      const nowIso = new Date().toISOString();
      if (existingZone) {
        await supabase.from('osm_zones_cache').update({
          features: nodes, restaurant_count: nodes.length, place_types: wantPlaceTypes, last_fetched_at: nowIso,
        }).eq('id', existingZone.id);
      } else {
        await supabase.from('osm_zones_cache').insert({
          min_lat: bbox.south, min_lng: bbox.west,
          max_lat: bbox.north, max_lng: bbox.east,
          features: nodes, restaurant_count: nodes.length, place_types: wantPlaceTypes,
          last_fetched_at: nowIso,
        });
      }
    } catch {}
    return NextResponse.json({ return_only: true, source: 'overpass', total_found: nodes.length, features: nodes }, { headers: cors });
  }

  return NextResponse.json({ return_only: false, source: 'overpass', total_found: nodes.length, features: nodes }, { headers: cors });
}
