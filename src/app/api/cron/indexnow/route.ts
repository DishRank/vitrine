/**
 * Cron Vercel hebdo : `GET /api/cron/indexnow`.
 *
 * Schedule défini dans `vercel.json` → `0 6 * * 1` (chaque lundi 06:00 UTC).
 * Vercel invoque cet endpoint depuis son infra de cron, en injectant le
 * header `Authorization: Bearer <CRON_SECRET>` si la variable d'env
 * `CRON_SECRET` est définie côté projet.
 *
 * Auth (par ordre de priorité) :
 *   1. `Authorization: Bearer <CRON_SECRET>` — convention Vercel
 *   2. `Authorization: Bearer <INDEXNOW_TRIGGER_SECRET>` — fallback si
 *      l'utilisateur n'a configuré qu'un seul secret (le nôtre)
 *
 * Sans aucune des deux variables définies → l'endpoint refuse tout
 * (500 explicite plutôt qu'auth bypass).
 *
 * Action : fetch sitemap.xml, extract toutes les URLs, batch submit à
 * api.indexnow.org (Bing + Yandex + autres compatibles).
 *
 * Logs lisibles dans le dashboard Vercel (Functions → Cron Jobs).
 */

import { NextResponse } from 'next/server';
import { submitToIndexNow } from '@/lib/indexnow';
import { redisHeartbeat } from '@/lib/pro/rateLimit';

const SITEMAP_URL = 'https://dishrank.fr/sitemap.xml';

export const runtime = 'nodejs';
// `maxDuration` = limite max d'exécution. Sitemap < 300 URLs aujourd'hui,
// IndexNow répond en < 2s → 30s est très large.
export const maxDuration = 30;

async function fetchSitemapUrls(): Promise<string[]> {
  const res = await fetch(SITEMAP_URL, { headers: { 'Cache-Control': 'no-store' } });
  if (!res.ok) throw new Error(`sitemap fetch failed: ${res.status}`);
  const xml = await res.text();
  const matches = xml.matchAll(/<loc>([^<]+)<\/loc>/g);
  const urls: string[] = [];
  for (const m of matches) urls.push(m[1].trim());
  return urls;
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const indexNowSecret = process.env.INDEXNOW_TRIGGER_SECRET;

  if (!cronSecret && !indexNowSecret) {
    return NextResponse.json(
      { ok: false, error: 'neither CRON_SECRET nor INDEXNOW_TRIGGER_SECRET is set' },
      { status: 500 },
    );
  }

  const auth = request.headers.get('authorization') || '';
  const expected = [
    cronSecret ? `Bearer ${cronSecret}` : null,
    indexNowSecret ? `Bearer ${indexNowSecret}` : null,
  ].filter((v): v is string => v !== null);

  if (!expected.includes(auth)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  // Garde la base Upstash active (elle n'est sinon sollicitée que par les
  // formulaires auth pro, absents avant l'ouverture publique → suppression pour
  // inactivité). Non bloquant : n'affecte jamais le job IndexNow, et ne throw
  // pas si Redis est down/non configuré. Cf. lib/pro/rateLimit.ts.
  const heartbeat = await redisHeartbeat();
  console.log(`[cron/indexnow] upstash heartbeat=${heartbeat}`);

  let urls: string[];
  try {
    urls = await fetchSitemapUrls();
  } catch (e) {
    console.error('[cron/indexnow] sitemap fetch failed:', e);
    return NextResponse.json(
      { ok: false, error: 'sitemap fetch failed', detail: (e as Error).message },
      { status: 502 },
    );
  }

  if (urls.length === 0) {
    console.warn('[cron/indexnow] sitemap returned 0 urls');
    return NextResponse.json({ ok: true, submitted: 0, message: 'no urls in sitemap' });
  }

  try {
    const result = await submitToIndexNow(urls);
    // Log conservé en clair pour le dashboard Vercel — utile pour vérifier
    // que le cron tourne effectivement chaque semaine.
    console.log(
      `[cron/indexnow] submitted=${result.submittedCount} skipped=${result.skippedUrls.length} status=${result.status}`,
    );
    return NextResponse.json({
      ok: result.status >= 200 && result.status < 300,
      status: result.status,
      submitted: result.submittedCount,
      skipped: result.skippedUrls.length,
      heartbeat,
      ...(result.body ? { error: result.body.slice(0, 500) } : {}),
    });
  } catch (e) {
    console.error('[cron/indexnow] indexnow request failed:', e);
    return NextResponse.json(
      { ok: false, error: 'indexnow request failed', detail: (e as Error).message },
      { status: 502 },
    );
  }
}
