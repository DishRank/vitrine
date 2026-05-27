/**
 * Diagnostic-only : fire N parallel Bing Image Search calls from the
 * Vercel datacenter IP and report what each one got back. This tests
 * whether Bing serves a degraded HTML when bursted (vs. a single call
 * which the /api/debug/bing-img endpoint already showed works fine).
 *
 * GET /api/debug/bing-burst?n=5
 */
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

const TEST_QUERIES = [
  // Same names as the 6 venues currently NULL in DB. Notice city is
  // sometimes null (Le 131, L'Avenue) which matches the post-rescroll
  // state — testing both with and without city.
  'Big M Lyon restaurant',
  'Big M restaurant',                           // no city, like in cascade
  'Nokyo Vénissieux restaurant',
  'Nokyo restaurant',
  'Le 131 restaurant',                          // city null in DB now
  'L\'Avenue restaurant',                       // city null in DB now
  'Le Lyon de l\'Atlas restaurant',
  'Café du XXe siècle restaurant',
];

async function fetchOne(query: string) {
  const t0 = Date.now();
  const target = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC2&first=1`;
  try {
    const res = await fetch(target, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
    });
    const html = await res.text();
    const elapsedMs = Date.now() - t0;
    const occ = (html.match(/mediaurl=/gi) || []).length;
    const reMatch = /\bmediaurl=([^"'&\s]+)/i.exec(html);
    let firstUrl: string | null = null;
    if (reMatch) {
      try {
        const decoded = decodeURIComponent(reMatch[1]);
        if (/^https?:\/\//i.test(decoded)) firstUrl = decoded;
      } catch { /* */ }
    }
    return {
      q: query,
      elapsedMs,
      status: res.status,
      bytes: html.length,
      occ,
      firstUrl: firstUrl ? firstUrl.slice(0, 120) : null,
      headSample: html.slice(0, 300).replace(/\s+/g, ' '),
    };
  } catch (e) {
    return { q: query, elapsedMs: Date.now() - t0, error: (e as Error).message };
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const n = Math.min(parseInt(url.searchParams.get('n') || '5', 10), TEST_QUERIES.length);
  const queries = TEST_QUERIES.slice(0, n);
  const t0 = Date.now();
  const results = await Promise.all(queries.map(fetchOne));
  return NextResponse.json({
    parallel: n,
    totalElapsedMs: Date.now() - t0,
    results,
  });
}
