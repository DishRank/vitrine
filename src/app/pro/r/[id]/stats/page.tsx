import Link from 'next/link';
import { requireOwnedRestaurant, isPremium, requireUser } from '@/lib/pro/data';

export const metadata = { title: 'Statistiques' };

/**
 * Cockpit stats (lot 4.1). Consomme les RPC gatées SERVEUR telles quelles
 * (get_owner_restaurant_stats, get_qr_stats, get_owner_benchmark) : pour un
 * resto free, les champs détaillés sont NULL et le benchmark lève
 * PREMIUM_REQUIRED — on affiche alors des cartes verrouillées + upsell.
 */

interface OwnerStats {
  review_count: number;
  avg_rating: number | null;
  reviews_30d: number | null;
  distinct_dishes: number | null;
  reviews_with_photo: number | null;
  must_return_count: number | null;
  disappointing_count: number | null;
  bookmarks: number;
  replies_count: number | null;
  fiche_views_total: number;
  fiche_views_30d: number;
  dish_views_total: number | null;
  google_rating: number | null;
  google_review_count: number | null;
}

interface QrStats {
  scans_total: number;
  scans_30d: number;
  menu_views_total: number;
  signups_total: number;
  first_reviews_total: number;
}

interface Benchmark {
  my_avg: number | null;
  city_avg: number | null;
  city_venue_count: number;
  category_avg: number | null;
  category_venue_count: number;
}

function n(v: unknown): number | null {
  return v == null ? null : Number(v);
}

function KpiCard({ label, value, sub, locked }: { label: string; value: string; sub?: string; locked?: boolean }) {
  return (
    <div className={`rounded-2xl border border-[var(--border2)] bg-[var(--surface)] p-4 shadow-[0_2px_10px_var(--card-shadow)] ${locked ? 'opacity-70' : ''}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text3)]">{label}</p>
      <p className="tabular mt-1 text-2xl font-extrabold">{locked ? '🔒' : value}</p>
      {sub ? <p className="mt-0.5 text-xs text-[var(--text2)]">{sub}</p> : null}
    </div>
  );
}

export default async function StatsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resto = await requireOwnedRestaurant(id);
  const premium = isPremium(resto);
  const { supabase } = await requireUser();

  // RPC gatées serveur — appelées avec la session de l'owner.
  const [statsRes, qrRes, benchRes] = await Promise.all([
    supabase.rpc('get_owner_restaurant_stats', { p_restaurant_id: id }),
    supabase.rpc('get_qr_stats', { p_restaurant_id: id }),
    // Benchmark = premium ; le RPC lève PREMIUM_REQUIRED sinon → on ne l'appelle
    // que si premium (sinon on afficherait juste l'upsell).
    premium
      ? supabase.rpc('get_owner_benchmark', { p_restaurant_id: id })
      : Promise.resolve({ data: null, error: null }),
  ]);

  // Ne pas avaler silencieusement une erreur RPC (c'est ce qui a masqué le bug
  // de type google_rating : un RPC cassé montrait des « 0 » crédibles). À
  // brancher sur Sentry au lot 0.6 ; d'ici là au moins un log serveur.
  if (statsRes.error) console.error('[pro/stats] get_owner_restaurant_stats', statsRes.error.message);
  if (qrRes.error) console.error('[pro/stats] get_qr_stats', qrRes.error.message);
  if (benchRes.error) console.error('[pro/stats] get_owner_benchmark', benchRes.error.message);

  const s = (Array.isArray(statsRes.data) ? statsRes.data[0] : statsRes.data) as OwnerStats | null;
  const qr = (Array.isArray(qrRes.data) ? qrRes.data[0] : qrRes.data) as QrStats | null;
  const bench = (Array.isArray(benchRes.data) ? benchRes.data[0] : benchRes.data) as Benchmark | null;

  const rating = n(s?.avg_rating);
  const google = n(s?.google_rating);

  return (
    <div className="space-y-6">
      {/* KPI de base (gratuits) */}
      <section>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard label="Avis DishRank" value={String(s?.review_count ?? 0)} />
          <KpiCard label="Note moyenne" value={rating != null ? rating.toFixed(1) + ' ★' : '—'} />
          <KpiCard label="Vues de la fiche" value={String(s?.fiche_views_total ?? 0)} sub={`${s?.fiche_views_30d ?? 0} ce mois-ci`} />
          <KpiCard label="Enregistrements" value={String(s?.bookmarks ?? 0)} sub="clients qui ont bookmarké un plat" />
        </div>
        {google != null ? (
          <p className="mt-2 text-xs text-[var(--text3)]">
            Note Google : {google.toFixed(1)} ★ ({s?.google_review_count ?? 0} avis)
          </p>
        ) : null}
      </section>

      {/* Funnel QR */}
      {qr ? (
        <section>
          <h3 className="mb-2 text-sm font-extrabold">Menu par QR code</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard label="Scans" value={String(qr.scans_total)} sub={`${qr.scans_30d} ce mois-ci`} />
            <KpiCard label="Vues du menu" value={String(qr.menu_views_total)} />
            <KpiCard label="Inscriptions" value={String(qr.signups_total)} sub="via votre QR" />
            <KpiCard label="1ers avis" value={String(qr.first_reviews_total)} sub="clients convertis" />
          </div>
        </section>
      ) : null}

      {/* Détail analytics — PREMIUM */}
      <section>
        <div className="mb-2 flex items-center gap-2">
          <h3 className="text-sm font-extrabold">Analyse détaillée</h3>
          {!premium ? <span className="rounded-full bg-[var(--primary-container)] px-2 py-0.5 text-xs font-bold text-[var(--primary)]">Premium</span> : null}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard label="Avis (30 j)" value={String(s?.reviews_30d ?? 0)} locked={!premium} />
          <KpiCard label="Plats distincts notés" value={String(s?.distinct_dishes ?? 0)} locked={!premium} />
          <KpiCard label="« À refaire »" value={String(s?.must_return_count ?? 0)} locked={!premium} />
          <KpiCard label="« Déçu »" value={String(s?.disappointing_count ?? 0)} locked={!premium} />
        </div>

        {premium && bench ? (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <KpiCard label="Votre moyenne" value={bench.my_avg != null ? Number(bench.my_avg).toFixed(1) + ' ★' : '—'} />
            <KpiCard label="Moyenne de la ville" value={bench.city_avg != null ? Number(bench.city_avg).toFixed(1) + ' ★' : '—'} sub={`${bench.city_venue_count} établissements`} />
            <KpiCard label="Moyenne catégorie" value={bench.category_avg != null ? Number(bench.category_avg).toFixed(1) + ' ★' : '—'} sub={`${bench.category_venue_count} établissements`} />
          </div>
        ) : null}

        {!premium ? (
          <div className="mt-4 rounded-2xl border border-[var(--primary)]/30 bg-[var(--primary-container)] p-4">
            <p className="text-sm font-bold text-[var(--primary)]">Passez au Premium</p>
            <p className="mt-1 text-sm text-[var(--text2)]">
              Débloquez les tendances 30 jours, le détail par plat, les alertes « plat en difficulté »
              et le benchmark quartier &amp; catégorie.
            </p>
            <Link href={`/pro/r/${id}`} className="mt-3 inline-block text-sm font-semibold text-[var(--primary)] hover:underline">
              En savoir plus →
            </Link>
          </div>
        ) : null}
      </section>
    </div>
  );
}
