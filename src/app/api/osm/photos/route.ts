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
// 250 KB used to be enough for restaurant-website <head>s but Bing
// Image Search pages start with ~300 KB of inline JS/metadata BEFORE
// the first result card — truncating at 250 KB meant zero mediaurl=
// matches and 0 % image_search coverage. Bing pages cap around 1 MB.
// Peak memory under burst (20 venues × 1.5 MB) is still well within
// the Vercel function memory ceiling.
const MAX_HTML_BYTES = 1_500_000;

// Real Chrome UA — many restaurant sites sit behind Cloudflare/Sucuri which
// reject anything that looks like a bot (403). The legacy "DishRankBot/1.0"
// string used to fail on roughly 1 venue in 3 (user-reported "only 1 in 10
// restaurants gets a photo"). Posing as a normal browser is fair use here :
// we're fetching a single <head> per venue, no aggressive crawling.
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';
const WIKIDATA_UA = 'DishRank/1.0 (contact: hello@dishrank.fr)';

/**
 * Strip address-like noise from a `city` value before sending it to
 * search engines. Some venues in our restaurants table have a
 * concatenated `<street>, <city>, <postal>, <country>` string in the
 * `city` column (data-quality issue from a buggy OSM ingest). When that
 * polluted string lands in our Bing query, the resulting URL is too
 * long and noisy for Bing to rank anything useful — image search
 * returns 0 results. This heuristic drops the street/postal/country
 * parts and keeps the cleanest remaining segment.
 */
function cleanCity(city: string | null | undefined): string | null {
  if (!city) return null;
  const trimmed = city.trim();
  if (!trimmed) return null;
  if (!trimmed.includes(',')) return trimmed;
  const parts = trimmed.split(',').map((s) => s.trim()).filter(Boolean);
  const candidates = parts.filter((p) =>
    !/^\d{4,6}$/.test(p) &&                  // not a postal code (4-6 digits)
    !/^france$/i.test(p) &&                  // not "France"
    !/^\d+\s/.test(p) &&                     // not a street line ("10 Rue …")
    !/(rue|avenue|av\.?|boulevard|bd\.?|place|impasse|chemin|allée|allee|route)\b/i.test(p) &&
    p.length > 1
  );
  if (candidates.length === 0) return null;
  // City is usually the last non-address segment (after the street, before
  // the postal code and country).
  return candidates[candidates.length - 1];
}

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

/**
 * Search Wikidata for an entity matching `<name>` near `<city>` and return
 * its P18 image if any. Covers notable venues that don't have a `wikidata`
 * tag in OSM but DO have a Wikidata entry (heritage spots, Michelin-rated,
 * famous chains). Free, no rate limit beyond Wikimedia's fair-use policy
 * (User-Agent identifies us). Returns null for small local restaurants
 * (no Wikidata entry) — that's expected.
 */
async function wikidataSearchByName(name: string, city: string | null): Promise<string | null> {
  const trimmed = name.trim();
  if (trimmed.length < 2) return null;
  // SPARQL : look for items with the given label whose admin-division
  // chain reaches the city. Restricted to instance-of restaurant / cafe /
  // bar / hotel to avoid matching unrelated entities (people, books, etc.)
  // sharing the venue's name. LIMIT 1 — first match wins.
  const cityClause = city
    ? `?item wdt:P131* / rdfs:label "${city.replace(/["\\]/g, '')}"@fr .`
    : '';
  const sparql = `
    SELECT ?item ?image WHERE {
      ?item rdfs:label "${trimmed.replace(/["\\]/g, '')}"@fr .
      ?item wdt:P18 ?image .
      ${cityClause}
      VALUES ?type { wd:Q11707 wd:Q30022 wd:Q1131017 wd:Q187456 wd:Q27686 wd:Q189445 } .
      ?item wdt:P31/wdt:P279* ?type .
    } LIMIT 1
  `;
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': WIKIDATA_UA, Accept: 'application/sparql-results+json' },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const json = await res.json();
    const bindings = json?.results?.bindings || [];
    for (const b of bindings) {
      const imageUrl = b?.image?.value;
      if (typeof imageUrl === 'string' && /^https?:\/\//.test(imageUrl)) {
        return imageUrl;
      }
    }
    return null;
  } catch { return null; }
  finally { clearTimeout(timer); }
}

/**
 * Generic web-search fallback via Bing HTML. Catches any venue with an
 * online presence : Uber Eats / Deliveroo / Just Eat / Tripadvisor /
 * the resto's own site / etc.
 *
 * We previously hit `lite.duckduckgo.com/lite/` but DDG anti-bot returns
 * 403 systematically from Vercel cloud IPs. Bing's regular HTML SERP is
 * far more tolerant — it's still a server-rendered page (no JS challenge)
 * and they're less aggressive about cloud-IP detection. Zero setup : no
 * key, no quota, no registration.
 *
 * We walk the top 3 results and use the first one that yields an og:image.
 * Best-effort : if Bing rate-limits us, we return null and let the venue
 * fall back to the emoji placeholder.
 */
async function bingSearchByName(name: string, city: string | null): Promise<string | null> {
  const query = [name, city, 'restaurant'].filter(Boolean).join(' ').trim();
  if (query.length < 2) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&cc=fr&setlang=fr`;
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      },
      signal: ctrl.signal,
      redirect: 'follow',
    });
    if (!res.ok) { console.warn('[bingSearch] HTTP', res.status, query); return null; }
    const html = (await res.text()).slice(0, MAX_HTML_BYTES);

    // Bing wraps each result in <li class="b_algo">…<h2><a href="…">. The
    // regex tolerates extra classes on the <li> and arbitrary inner markup
    // between the wrapper and the <a> tag.
    const resultRe = /<li[^>]*class=["'][^"']*\bb_algo\b[^"']*["'][^>]*>[\s\S]*?<h2[^>]*>[\s\S]*?<a[^>]*href=["']([^"']+)["']/gi;
    const urls: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = resultRe.exec(html)) !== null && urls.length < 3) {
      const href = m[1];
      try {
        const u = new URL(href);
        if (!/^https?:/.test(u.protocol)) continue;
        if (/(?:^|\.)bing\.com$/i.test(u.hostname)) continue;
        if (/(?:^|\.)microsoft\.com$/i.test(u.hostname)) continue;
        urls.push(href);
      } catch { continue; }
    }
    if (urls.length === 0) { console.warn('[bingSearch] no result for', query); return null; }

    // Walk the top results until one returns a usable og:image. At most
    // 3 HTML fetches, each <head>-only. Skips sites that 403 our UA.
    for (const target of urls) {
      try {
        const venueRes = await fetch(target, {
          headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
          signal: ctrl.signal,
          redirect: 'follow',
        });
        if (!venueRes.ok) continue;
        const ct = venueRes.headers.get('content-type') || '';
        if (!ct.includes('text/html')) continue;
        const venueHtml = (await venueRes.text()).slice(0, MAX_HTML_BYTES);
        const img = extractCascade(venueHtml, venueRes.url || target);
        if (img) return img;
      } catch { continue; }
    }
    console.warn('[bingSearch] no og:image across top results for', query);
    return null;
  } catch (e) { console.warn('[bingSearch] exception', (e as Error).message); return null; }
  finally { clearTimeout(timer); }
}

/**
 * Final fallback : Bing Image Search. Instead of finding a page that
 * might have an og:image (web search), we ask Bing directly for images
 * matching the query and grab the first one's URL.
 *
 * Why this catches what bingSearchByName misses : aggregator pages
 * (Tripadvisor, Uber Eats, jimdosite, etc.) often 403 our UA when we
 * try to scrape their og:image. Bing Image Search has already indexed
 * those images and serves us the source URL directly — no scraping
 * needed, no anti-bot dance.
 *
 * Quality caveat : the returned image may be a logo, a food shot, a
 * Google Maps thumbnail, or sometimes a tangentially-related image.
 * It's always relevant enough to beat the emoji placeholder, but it's
 * not as accurate as a venue's own og:image. That's why it's the LAST
 * step — only used when nothing structured worked.
 */
async function bingImageSearchByName(
  name: string,
  city: string | null,
  diag?: Array<Record<string, unknown>>,
): Promise<string | null> {
  const query = [name, city, 'restaurant'].filter(Boolean).join(' ').trim();
  if (query.length < 2) return null;
  const ctrl = new AbortController();
  // 12 s : Bing Image Search is our last-and-best fallback. Under burst
  // load (20 parallel venues) the page can take 3-10 s to return, vs
  // ~700 ms in isolation. At 8 s we saw ~50 % of calls time out. Bumped
  // to 12 s — still leaves ~16 s of headroom under maxDuration 30 s for
  // the rest of the cascade.
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const searchUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC2&first=1`;
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      },
      signal: ctrl.signal,
      redirect: 'follow',
    });
    if (!res.ok) {
      diag?.push({ q: query, http: res.status });
      console.warn('[bingImg] HTTP', res.status, query);
      return null;
    }
    const html = (await res.text()).slice(0, MAX_HTML_BYTES);

    // Bing Image search current markup (verified Q2 2026) embeds each
    // result's source image URL in a `mediaurl=` query parameter inside
    // the result anchor's href. The href uses HTML-encoded ampersands
    // (`&amp;`), so the byte immediately before `mediaurl=` is `;` rather
    // than `&` — which means a `[?&]mediaurl=` regex misses everything.
    // We just look for `mediaurl=` literally (it's specific enough that
    // false positives don't happen) and URL-decode whatever follows up to
    // the next param separator / quote / whitespace.
    const occCount = (html.match(/mediaurl=/gi) || []).length;
    diag?.push({ q: query, bytes: html.length, occ: occCount });
    if (occCount === 0) {
      console.warn('[bingImg v4] no mediaurl in body, htmlBytes=', html.length, 'for', query);
      return null;
    }
    const re = /\bmediaurl=([^"'&\s]+)/gi;
    let m: RegExpExecArray | null;
    let attempts = 0;
    while ((m = re.exec(html)) !== null) {
      attempts++;
      try {
        const decoded = decodeURIComponent(m[1]);
        if (/^https?:\/\//i.test(decoded)) {
          console.log('[bingImg v4] FOUND', decoded.slice(0, 80), 'for', query);
          return decoded;
        }
      } catch { continue; }
    }
    console.warn('[bingImg v4] occCount=', occCount, 'attempts=', attempts, 'for', query);
    return null;
  } catch (e) { console.warn('[bingImg] exception', (e as Error).message); return null; }
  finally { clearTimeout(timer); }
}

async function websitePhoto(website: string): Promise<string | null> {
  const url = normalizeUrl(website);
  if (!url) return null;
  const ctrl = new AbortController();
  // 4 s : if a venue's own site doesn't respond fast it's probably down
  // (jimdosite, custom CMS, etc.). Was 7 s but with 20 venues × cascade
  // running in parallel that ate too much time budget.
  const timer = setTimeout(() => ctrl.abort(), 4000);
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
    /** Venue display name — used as the last-resort search key for
     *  name-based fallbacks (Wikidata SPARQL, Brave Search) when the
     *  venue has no website/wikidata in OSM. */
    name?: string | null;
    /** Venue city — disambiguates name-based searches (a "Le 131" in
     *  Paris vs one in Lyon). */
    city?: string | null;
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
  const bingImgDiag: Array<Record<string, unknown>> = [];
  await Promise.all(items.map(async (it) => {
    const c = cacheMap.get(it.osm_id);
    if (c && c.fresh) { photos[it.osm_id] = c.url; return; }
    let url: string | null = null;
    let source: string | null = null;
    // Cascade : structured sources (Wikidata QID) first, then website
    // scraping, then last-resort name-based searches. Each step is gated
    // on having the right signal so we don't burn time on impossible
    // lookups (eg. no Wikidata SPARQL for a venue without a name).
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
    // Name-based fallbacks for venues with no OSM web-presence signal
    // (small local restaurants like "Le 131"). Wikidata SPARQL catches
    // heritage / curated spots ; the Bing search step catches everyday
    // venues referenced on Uber Eats / Deliveroo / Just Eat / Tripadvisor /
    // their own site.
    // Cleaned city — some venues have a polluted `city` field carrying a
    // full street address. Strip the noise once before reusing for Bing.
    const cityForSearch = cleanCity(it.city);
    // Bing Image Search : the workhorse fallback. We used to chain
    // wikidata_search (SPARQL) + bing web search before it, but those two
    // steps timed out at 6s for ~80 % of venues without ever yielding a
    // photo — and they ate so much time-budget that bing_image itself
    // timed out for the venues that needed it most (Promise.all of 20
    // venues × multiple slow steps = function near maxDuration, late
    // steps abort). Skipping straight to image search after the
    // structured signals (wikidata QID / brand / website) gives the same
    // coverage in a fraction of the time, with much higher hit-rate.
    let bingImgTried = false;
    const diagBefore = bingImgDiag.length;
    if (!url && it.name) {
      bingImgTried = true;
      url = await bingImageSearchByName(it.name, cityForSearch, bingImgDiag);
      if (url) source = 'image_search';
    }
    photos[it.osm_id] = url;
    // For null URLs, encode in `source` which step was last attempted +
    // what bing image's diag said (occ = #mediaurl in body, http = http
    // status). Helps us tell rate-limiting (occ=0) from regex/parse bugs
    // (occ>0 but null returned). Strip after cascade is stable.
    const lastDiag = bingImgTried ? bingImgDiag[diagBefore] : null;
    const debugSource = url
      ? source
      : bingImgTried
        ? (lastDiag && typeof lastDiag.occ === 'number'
            ? `_null_img_occ${lastDiag.occ}_b${lastDiag.bytes}`
            : lastDiag && typeof lastDiag.http === 'number'
              ? `_null_img_http${lastDiag.http}`
              : '_null_img_abort')
        : it.name
          ? '_null_no_name'
          : '_null_no_signal';
    toUpsert.push({ osm_id: it.osm_id, url, source: debugSource });
  }));

  if (toUpsert.length > 0) {
    try {
      await supabase.from('place_photos').upsert(
        toUpsert.map((u) => ({ ...u, fetched_at: new Date().toISOString() })),
        { onConflict: 'osm_id' },
      );
    } catch {}
  }

  return NextResponse.json(
    { photos, _diag: { bingImg: bingImgDiag } },
    { headers: { ...cors, 'X-Photos-Cascade-Version': 'v4-mediaurl' } },
  );
}
