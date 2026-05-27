/**
 * OSM venue photo enrichment — mobile-app fetcher.
 *
 * Cascade per venue (first non-null wins) :
 *   1. Wikidata P18 (image) — set on most curated venues + heritage spots.
 *   2. Brand wikidata P154 (logo) — Starbucks/McDo/etc when `brand:wikidata`.
 *   3. Website extractor (og:image → apple-touch → icon → first img).
 *   4. Google favicon proxy from the site's domain (always returns something).
 *
 * Per-osm cascade : place_photos cache (Supabase) → above → negative-cache a
 * miss. Wikidata is FREE and rate-limit friendly, so it goes first — every
 * curated venue gets a real photo without us scraping anything.
 */

import { NextResponse } from 'next/server';
import { getAuthenticatedContext } from '@/lib/verifyAuth';
import { getCorsHeaders } from '@/lib/cors';
import { getSupabaseServiceClientFor } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 30;

const CACHE_TTL_DAYS = 30;
const MAX_ITEMS = 20;
const MAX_HTML_BYTES = 250_000;

// Real Chrome UA — many restaurant sites sit behind Cloudflare/Sucuri which
// reject anything that looks like a bot (403). The legacy "DishRankBot/1.0"
// string used to fail on roughly 1 venue in 3 (user-reported "only 1 in 10
// restaurants gets a photo"). Posing as a normal browser is fair use here :
// we're fetching a single <head> per venue, no aggressive crawling.
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';
const WIKIDATA_UA = 'DishRank/1.0 (contact: hello@dishrank.fr)';

function normalizeUrl(raw: string): string | null {
  let u = (raw || '').trim();
  if (!u) return null;
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  try { return new URL(u).toString(); } catch { return null; }
}

function toAbs(src: string, baseUrl: string): string | null {
  try {
    const abs = new URL(src, baseUrl).toString();
    return /^https?:\/\//i.test(abs) ? abs : null;
  } catch { return null; }
}

// Previously we returned a `https://www.google.com/s2/favicons?...` URL as
// a guaranteed visual fallback. In practice the 16-32 px favicon stretched
// to a 68 px tile looked worse than no image at all (blurry, washed out),
// so the client now shows a category-emoji placeholder when the cascade
// turns up nothing. Keeping the function as a stub returning null in case
// any caller still imports it.
function faviconFallback(_anyUrl: string): string | null {
  return null;
}

function extractCascade(html: string, baseUrl: string): string | null {
  // More permissive patterns : tolerate \s+ between attributes, multi-line
  // meta tags (some CMS pretty-print), single OR double quotes, and either
  // attribute order. The previous tight regex missed ~20% of og tags.
  const ogPatterns = [
    /<meta\b[^>]*?\b(?:property|name)\s*=\s*["'](?:og:image(?::url)?|twitter:image)["'][^>]*?\bcontent\s*=\s*["']([^"']+)["']/i,
    /<meta\b[^>]*?\bcontent\s*=\s*["']([^"']+)["'][^>]*?\b(?:property|name)\s*=\s*["'](?:og:image(?::url)?|twitter:image)["']/i,
  ];
  for (const re of ogPatterns) {
    const m = html.match(re);
    if (m?.[1]) { const abs = toAbs(m[1], baseUrl); if (abs) return abs; }
  }
  const apple = html.match(/<link[^>]+rel=["'](?:apple-touch-icon(?:-precomposed)?)["'][^>]*href=["']([^"']+)["']/i)
    ?? html.match(/<link[^>]+href=["']([^"']+)["'][^>]*rel=["'](?:apple-touch-icon(?:-precomposed)?)["']/i);
  if (apple?.[1]) { const abs = toAbs(apple[1], baseUrl); if (abs) return abs; }
  const iconRe = /<link[^>]+rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/gi;
  let im: RegExpExecArray | null;
  while ((im = iconRe.exec(html)) !== null) {
    const href = im[1];
    if (!href || /favicon\.ico(?:$|\?)/i.test(href)) continue;
    const abs = toAbs(href, baseUrl);
    if (abs) return abs;
  }
  const imgRe = /<img\b[^>]*src=["']([^"']+)["'][^>]*>/gi;
  let mm: RegExpExecArray | null;
  while ((mm = imgRe.exec(html)) !== null) {
    const tag = mm[0];
    const src = mm[1];
    if (!src) continue;
    if (src.startsWith('data:')) continue;
    if (/\b(?:width|height)=["']1["']/i.test(tag)) continue;
    if (/(?:pixel|tracker|spacer|blank|transparent|1x1)/i.test(src)) continue;
    const abs = toAbs(src, baseUrl);
    if (abs) return abs;
  }
  return null;
}

/**
 * Resolve a Wikidata QID to a Commons image URL via the structured
 * `claims` endpoint. Tries `properties` in order — defaults are P18
 * (image, for places) then P154 (logo, useful when we got handed the
 * BRAND's QID instead of the venue's). Returns null if the entity has
 * none of them set.
 */
async function wikidataImage(qid: string, properties: string[] = ['P18', 'P154']): Promise<string | null> {
  if (!/^Q\d+$/.test(qid)) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const url = `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`;
    const res = await fetch(url, {
      headers: { 'User-Agent': WIKIDATA_UA, Accept: 'application/json' },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    const entity = data?.entities?.[qid];
    if (!entity?.claims) return null;
    for (const prop of properties) {
      const claims = entity.claims[prop];
      if (!Array.isArray(claims)) continue;
      for (const claim of claims) {
        const file = claim?.mainsnak?.datavalue?.value;
        if (typeof file === 'string' && file.trim()) {
          return `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(file.trim())}`;
        }
      }
    }
    return null;
  } catch { return null; }
  finally { clearTimeout(timer); }
}

async function websitePhoto(website: string): Promise<string | null> {
  const url = normalizeUrl(website);
  if (!url) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 7000);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      signal: ctrl.signal,
      redirect: 'follow',
    });
    if (!res.ok) return faviconFallback(res.url || url);
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('text/html')) return faviconFallback(res.url || url);
    // Cap the read at MAX_HTML_BYTES — restaurant landing pages are usually
    // < 100KB, no need to slurp megabytes of analytics blobs.
    const reader = res.body?.getReader();
    if (!reader) {
      const t = await res.text();
      return extractCascade(t.slice(0, MAX_HTML_BYTES), res.url || url);
    }
    let received = 0; let html = '';
    const dec = new TextDecoder();
    while (received < MAX_HTML_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      html += dec.decode(value, { stream: true });
    }
    try { await reader.cancel(); } catch {}
    return extractCascade(html, res.url || url);
  } catch { return faviconFallback(url); }
  finally { clearTimeout(timer); }
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { headers: getCorsHeaders(request) });
}

export async function POST(request: Request) {
  const cors = getCorsHeaders(request);
  const auth = await getAuthenticatedContext(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: cors });

  type Item = {
    osm_id: number;
    website?: string | null;
    /** Wikidata QID for the venue itself (e.g. famous restaurants /
     *  heritage spots). Resolves to a P18 image when set. */
    wikidata?: string | null;
    /** Wikidata QID for the brand/chain. Resolves to P154 logo. */
    brand_wikidata?: string | null;
  };
  let body: { items?: Item[] };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'bad json' }, { status: 400, headers: cors }); }

  const items = (body.items || []).filter((it) => typeof it?.osm_id === 'number').slice(0, MAX_ITEMS);
  if (items.length === 0) return NextResponse.json({ photos: {} }, { headers: cors });

  const supabase = getSupabaseServiceClientFor(auth.supabaseUrl, auth.serviceRoleKey);
  const cutoff = Date.now() - CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;
  const ids = items.map((it) => it.osm_id);
  const { data: cached } = await supabase.from('place_photos').select('osm_id, url, fetched_at').in('osm_id', ids);
  const cacheMap = new Map<number, { url: string | null; fresh: boolean }>();
  for (const r of cached || []) {
    const row = r as { osm_id: number; url: string | null; fetched_at: string };
    cacheMap.set(row.osm_id, { url: row.url ?? null, fresh: new Date(row.fetched_at).getTime() > cutoff });
  }

  const photos: Record<string, string | null> = {};
  const toUpsert: { osm_id: number; url: string | null; source: string | null }[] = [];
  await Promise.all(items.map(async (it) => {
    const c = cacheMap.get(it.osm_id);
    if (c && c.fresh) { photos[it.osm_id] = c.url; return; }
    let url: string | null = null;
    let source: string | null = null;
    // Cascade : free + accurate sources first, then website scraping.
    if (!url && it.wikidata) {
      url = await wikidataImage(it.wikidata, ['P18', 'P154']);
      if (url) source = 'wikidata';
    }
    if (!url && it.brand_wikidata) {
      url = await wikidataImage(it.brand_wikidata, ['P154', 'P18']);
      if (url) source = 'brand_wikidata';
    }
    if (!url && it.website) {
      url = await websitePhoto(it.website);
      if (url) source = 'website';
    }
    photos[it.osm_id] = url;
    toUpsert.push({ osm_id: it.osm_id, url, source });
  }));

  if (toUpsert.length > 0) {
    try {
      await supabase.from('place_photos').upsert(
        toUpsert.map((u) => ({ ...u, fetched_at: new Date().toISOString() })),
        { onConflict: 'osm_id' },
      );
    } catch {}
  }

  return NextResponse.json({ photos }, { headers: cors });
}
