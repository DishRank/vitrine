/**
 * Cron Vercel quotidien : `GET /api/cron/owner-digest` (lot 4.4).
 *
 * Schedule dans vercel.json. Vercel injecte `Authorization: Bearer <CRON_SECRET>`.
 * Envoie à chaque restaurateur (non désabonné) un digest des avis RÉCENTS
 * (< 24 h) laissés SANS réponse sur ses établissements — pour l'inciter à
 * répondre. Sélection via le RPC service-role `get_owner_review_digest`.
 *
 * `?dry=1` : renvoie le plan (nb d'owners/avis) SANS envoyer — pour tester
 * sans spammer. `?hours=N` : fenêtre (défaut 24).
 */
import { NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { sendOwnerEmail, buildDigestEmail, type DigestItem } from '@/lib/pro/email';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface DigestRow {
  owner_id: string;
  email: string;
  items: DigestItem[];
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ ok: false, error: 'CRON_SECRET not set' }, { status: 500 });
  }
  const auth = request.headers.get('authorization') || '';
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const dry = url.searchParams.get('dry') === '1';
  const hours = Math.min(168, Math.max(1, Number(url.searchParams.get('hours')) || 24));

  const supabase = getSupabaseServiceClient();
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
