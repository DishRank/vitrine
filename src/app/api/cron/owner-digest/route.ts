/**
 * Digest « avis à répondre » des restaurateurs (lot 4.4).
 *
 * DÉCLENCHEMENT : par `pg_cron` côté Supabase (GRATUIT — pas de Vercel Cron),
 * qui appelle cet endpoint chaque jour via `pg_net` en `Authorization: Bearer
 * <secret DB>` (cf. migration 106, `ensure_owner_digest_cron`). L'endpoint
 * accepte aussi un déclenchement manuel avec `INDEXNOW_TRIGGER_SECRET` /
 * `CRON_SECRET`.
 *
 * Envoie à chaque restaurateur (non désabonné) un digest des avis RÉCENTS
 * (< 24 h) laissés SANS réponse sur ses établissements. Sélection via le RPC
 * service-role `get_owner_review_digest`, envoi via SMTP OVH.
 *
 * `?dry=1` : renvoie le plan (nb d'owners/avis) SANS envoyer. `?hours=N` :
 * fenêtre (défaut 24, max 168).
 */
import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { sendOwnerEmail, buildDigestEmail, type DigestItem } from '@/lib/pro/email';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface DigestRow {
  owner_id: string;
  email: string;
  items: DigestItem[];
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Autorise l'appel si le Bearer correspond à un secret d'env (déclenchement
 * manuel) OU au secret stocké en base `owner_digest_cron_secret` (que pg_cron
 * lit et transmet). Le secret DB n'est lisible que par le service-role, jamais
 * exposé au public — voir migration 106.
 */
async function isAuthorized(request: Request, supabase: SupabaseClient): Promise<boolean> {
  const header = request.headers.get('authorization') || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!bearer) return false;

  const envSecrets = [process.env.CRON_SECRET, process.env.INDEXNOW_TRIGGER_SECRET].filter(
    (s): s is string => !!s
  );
  if (envSecrets.some((s) => safeEqual(bearer, s))) return true;

  const { data } = await supabase
    .from('app_internal_config')
    .select('value')
    .eq('key', 'owner_digest_cron_secret')
    .maybeSingle();
  const dbSecret = (data as { value?: string } | null)?.value;
  return !!dbSecret && safeEqual(bearer, dbSecret);
}

async function handle(request: Request) {
  const supabase = getSupabaseServiceClient();

  if (!(await isAuthorized(request, supabase))) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const dry = url.searchParams.get('dry') === '1';
  const hours = Math.min(168, Math.max(1, Number(url.searchParams.get('hours')) || 24));

  const { data, error } = await supabase.rpc('get_owner_review_digest', { p_since_hours: hours });
  if (error) {
    console.error('[cron/owner-digest] rpc failed:', error.message);
    return NextResponse.json({ ok: false, error: 'rpc failed', detail: error.message }, { status: 502 });
  }

  const rows = (data ?? []) as DigestRow[];
  const totalOwners = rows.length;
  const totalReviews = rows.reduce((s, r) => s + r.items.reduce((a, i) => a + i.count, 0), 0);

  if (dry) {
    return NextResponse.json({
      ok: true,
      dry: true,
      owners: totalOwners,
      reviews: totalReviews,
      preview: rows.slice(0, 5).map((r) => ({ email: r.email.replace(/(.).*(@.*)/, '$1***$2'), items: r.items })),
    });
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const r of rows) {
    const { subject, html, text } = buildDigestEmail(r.owner_id, r.items);
    const res = await sendOwnerEmail({ to: r.email, subject, html, text });
    if (res.ok) sent++;
    else if (res.skipped) skipped++;
    else {
      failed++;
      console.error(`[cron/owner-digest] send failed to ${r.owner_id}: ${res.error}`);
    }
  }

  console.log(`[cron/owner-digest] owners=${totalOwners} sent=${sent} skipped=${skipped} failed=${failed}`);
  return NextResponse.json({ ok: true, owners: totalOwners, reviews: totalReviews, sent, skipped, failed });
}

// pg_cron appelle en POST (net.http_post) ; GET reste pratique pour `?dry=1`
// depuis un navigateur/curl.
export const GET = handle;
export const POST = handle;
