/**
 * OSM venue photo enrichment — mobile-app fetcher.
 *
 * Replaces the Supabase Edge Function `enrich-photos`. Hits restaurant
 * websites server-side (no CORS hassle, no client bandwidth) and runs a
 * cascade extractor : og:image → apple-touch-icon → <link rel=icon> →
 * first content <img> → Google's favicon proxy as a guaranteed visual.
 * Per-osm cascade : place_photos cache (Supabase) → website fetch →
 * negative-cache a miss.
 */

import { NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/verifyAuth';
import { getCorsHeaders } from '@/lib/cors';
import { getSupabaseServiceClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 30;

const CACHE_TTL_DAYS = 30;
const MAX_ITEMS = 20;
const MAX_HTML_BYTES = 250_000;
const USER_AGENT = 'Mozilla/5.0 (compatible; DishRankBot/1.0; +https://dishrank.fr)';

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

function faviconFallback(anyUrl: string): string | null {
  try {
    const host = new URL(anyUrl).hostname;
    if (!host) return null;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`;
  } catch { return null; }
}

function extractCascade(html: string, baseUrl: string): string | null {
  const ogPatterns = [
    /<meta[^>]+(?:property|name)=["']og:image(?::url)?["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']og:image(?::url)?["']/i,
    /<meta[^>]+(?:property|name)=["']twitter:image["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']twitter:image["']/i,
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
  return faviconFallback(baseUrl);
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
  const userId = await getAuthenticatedUserId(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: cors });

  type Item = { osm_id: number; website?: string | null };
  let body: { items?: Item[] };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'bad json' }, { status: 400, headers: cors }); }

  const items = (body.items || []).filter((it) => typeof it?.osm_id === 'number').slice(0, MAX_ITEMS);
  if (items.length === 0) return NextResponse.json({ photos: {} }, { headers: cors });

  const supabase = getSupabaseServiceClient();
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
    if (it.website) url = await websitePhoto(it.website);
    photos[it.osm_id] = url;
    toUpsert.push({ osm_id: it.osm_id, url, source: url ? 'website' : null });
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
