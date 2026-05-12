/**
 * Endpoint POST `/api/indexnow/submit` — déclenche une soumission IndexNow.
 *
 * Protocole : https://www.indexnow.org/documentation
 * Setup associé : `src/lib/indexnow.ts` + `public/c6fbedd4ce85838de39ac82edffa1ecc.txt`
 *
 * Auth : protégé par un Bearer token dans `Authorization: Bearer <secret>`,
 * où `<secret>` doit matcher la variable d'env `INDEXNOW_TRIGGER_SECRET`.
 * Sans ce header → 401. Empêche n'importe qui de spammer IndexNow en notre
 * nom (Bing rate-limit puis blacklist en cas d'abus).
 *
 * Modes :
 *  - `{ urls: ["https://dishrank.fr/...", ...] }` → submit ces URLs précises
 *  - `{ all: true }` → fetch le sitemap, extract toutes les URLs, submit
 *    en batch. À utiliser parcimonieusement (ex: après un redéploiement
 *    majeur). IndexNow limite à ~10k URLs/jour/host.
 *
 * Triggers typiques côté ops :
 *  - Vercel deploy hook : POST avec `{ all: true }` après un deploy prod
 *  - Webhook Supabase : POST avec les URLs d'une page nouvellement remplie
 *    de reviews (ex: nouvelle ville détectée → submit `/lyon`, `/lyon/burger`…)
 *  - Cron Vercel hebdo : POST `{ all: true }` pour rafraîchir l'indexation
 */

import { NextResponse } from 'next/server';
import { submitToIndexNow } from '@/lib/indexnow';

const SECRET = process.env.INDEXNOW_TRIGGER_SECRET;
const SITEMAP_URL = 'https://dishrank.fr/sitemap.xml';

// Force runtime Node — on a besoin de `fetch` pour appeler IndexNow et
// éventuellement le sitemap.xml, ce que l'edge supporte aussi mais le
// sitemap dépend de Supabase server-side (déjà en Node).
export const runtime = 'nodejs';

interface SubmitBody {
  urls?: string[];
  all?: boolean;
}

/** Parse le sitemap.xml et extrait toutes les URLs `<loc>...</loc>`. */
async function fetchSitemapUrls(): Promise<string[]> {
  const res = await fetch(SITEMAP_URL, {
    headers: { 'Cache-Control': 'no-store' },
  });
  if (!res.ok) {
    throw new Error(`sitemap fetch failed: ${res.status}`);
  }
  const xml = await res.text();
  // Regex simple — le sitemap est généré par Next, format stable et fiable.
  // Pas besoin d'un parser XML complet.
  const matches = xml.matchAll(/<loc>([^<]+)<\/loc>/g);
  const urls: string[] = [];
  for (const m of matches) {
    urls.push(m[1].trim());
  }
  return urls;
}

export async function POST(request: Request) {
  // 1) Auth
  if (!SECRET) {
    return NextResponse.json(
      { ok: false, error: 'INDEXNOW_TRIGGER_SECRET env var not set' },
      { status: 500 },
    );
  }
  const auth = request.headers.get('authorization');
  if (!auth || auth !== `Bearer ${SECRET}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  // 2) Parse body
  let body: SubmitBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }

  // 3) Build URL list
  let urls: string[] = [];
  if (body.all === true) {
    try {
      urls = await fetchSitemapUrls();
    } catch (e) {
      return NextResponse.json(
        { ok: false, error: 'sitemap fetch failed', detail: (e as Error).message },
        { status: 502 },
      );
    }
  } else if (Array.isArray(body.urls)) {
    urls = body.urls;
  } else {
    return NextResponse.json(
      { ok: false, error: 'body must contain `urls` array or `all: true`' },
      { status: 400 },
    );
  }

  if (urls.length === 0) {
    return NextResponse.json({ ok: true, submitted: 0, message: 'no urls to submit' });
  }

  // 4) Submit
  try {
    const result = await submitToIndexNow(urls);
    return NextResponse.json({
      ok: result.status >= 200 && result.status < 300,
      status: result.status,
      submitted: result.submittedCount,
      skipped: result.skippedUrls.length,
      ...(result.body ? { error: result.body.slice(0, 500) } : {}),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: 'indexnow request failed', detail: (e as Error).message },
      { status: 502 },
    );
  }
}

/** GET → info pratique : URL du fichier de vérification + état config.
 *  Pas protégé car l'info est publique (la clé est dans /public/ de toute
 *  façon). Utile pour vérifier que le routing est bien en place. */
export async function GET() {
  return NextResponse.json({
    enabled: !!SECRET,
    keyLocation: 'https://dishrank.fr/c6fbedd4ce85838de39ac82edffa1ecc.txt',
    docs: 'https://www.indexnow.org/documentation',
  });
}
