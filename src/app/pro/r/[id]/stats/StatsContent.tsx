import Link from 'next/link';
import { requireUser } from '@/lib/pro/data';

/**
 * Contenu analytics de la page /stats — ISOLÉ dans un composant async pour être
 * enveloppé par un <Suspense> côté page : les 3 RPC (potentiellement lourdes)
 * streament pendant que le squelette s'affiche INSTANTANÉMENT. « premium » est
 * connu tôt (dérivé du resto déjà en cache) → passé en prop, pas re-fetché.
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

const cardCls =
  'rounded-2xl border border-[var(--border2)] bg-[var(--surface)] p-4 shadow-[0_2px_10px_var(--card-shadow)] sm:p-5';

// ── Étoiles (fraction dorée clippée) ─────────────────────────────────────────
function Stars({ rating }: { rating: number }) {
  const pct = Math.max(0, Math.min(100, (rating / 5) * 100));
  return (
    <span className="relative inline-block align-middle text-lg leading-none" aria-hidden>
      <span className="text-[var(--border2)]">★★★★★</span>
      <span className="absolute inset-0 overflow-hidden whitespace-nowrap text-amber-400" style={{ width: `${pct}%` }}>
        ★★★★★
      </span>
    </span>
  );
}

// ── Tuile chiffre ────────────────────────────────────────────────────────────
function StatTile({ icon, label, value, sub }: { icon: string; label: string; value: string; sub?: string }) {
  return (
    <div className={cardCls}>
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--text3)]">
        <span aria-hidden>{icon}</span> {label}
      </p>
      <p className="tabular mt-1 text-2xl font-extrabold">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-[var(--text2)]">{sub}</p> : null}
    </div>
  );
}

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className={cardCls}>
      <div className="mb-3">
        <h3 className="text-sm font-extrabold text-[var(--text)]">{title}</h3>
        {hint ? <p className="mt-0.5 text-xs text-[var(--text3)]">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** Une ligne « label — barre — valeur » (funnel, verdicts, benchmark). */
function BarRow({
  label,
  sub,
  value,
  display,
  pct,
  color,
  strongLabel,
}: {
  label: string;
  sub?: string;
  value: string;
  display?: string;
  pct: number;
  color: string;
  strongLabel?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className={`w-24 shrink-0 text-xs sm:w-28 ${strongLabel ? 'font-bold text-[var(--primary)]' : 'font-semibold text-[var(--text2)]'}`}>
        {label}
        {sub ? <span className="font-normal text-[var(--text3)]"> · {sub}</span> : null}
      </span>
      <div className="h-7 flex-1 overflow-hidden rounded-lg bg-[var(--surface-var)]">
        <div className="h-full rounded-lg" style={{ width: `${Math.max(pct, 2)}%`, background: color }} />
      </div>
      <span className="tabular w-16 shrink-0 text-right text-sm font-extrabold">
        {value}
        {display ? <span className="ml-1 text-[11px] font-semibold text-[var(--text3)]">{display}</span> : null}
      </span>
    </div>
  );
}

// ── Funnel QR (scans → menu → inscription → 1er avis) ────────────────────────
function FunnelViz({ steps }: { steps: { label: string; value: number }[] }) {
  const top = steps[0]?.value ?? 0;
  if (top === 0) {
    return (
      <p className="text-sm text-[var(--text3)]">
        Aucun scan pour l&apos;instant — posez votre QR sur les tables et le parcours apparaîtra ici.
      </p>
    );
  }
  return (
    <div className="space-y-2.5">
      {steps.map((s, i) => {
        const conv = i > 0 && steps[i - 1].value > 0 ? `${Math.round((s.value / steps[i - 1].value) * 100)}%` : undefined;
        return (
          <BarRow
            key={s.label}
            label={s.label}
            value={String(s.value)}
            display={conv}
            pct={Math.round((s.value / top) * 100)}
            color="var(--primary)"
          />
        );
      })}
    </div>
  );
}

// ── Écran gratuit : teaser Premium ───────────────────────────────────────────
function PremiumTeaser({ id }: { id: string }) {
  const feats = [
    ['📊', 'Le parcours de vos clients', 'scans → menu → inscription → avis, avec les taux de conversion'],
    ['⭐', 'Les verdicts', '« à refaire » vs « déçu », avis avec photo, plats notés'],
    ['🏆', 'Le benchmark', 'votre note comparée à votre quartier et votre catégorie'],
    ['👀', 'Votre visibilité', 'vues de la fiche, enregistrements, tendance du mois'],
  ];
  return (
    <section className="relative overflow-hidden rounded-2xl border border-[var(--primary)]/30 bg-[var(--primary-container)] p-5 sm:p-6">
      {/* Mock de funnel décoratif, flou, à droite */}
      <div aria-hidden className="pointer-events-none absolute inset-y-6 right-5 hidden w-40 flex-col justify-center gap-2 opacity-25 blur-[1.5px] sm:flex">
        {[100, 68, 34, 16].map((w, i) => (
          <div key={i} className="h-5 rounded-lg bg-[var(--primary)]" style={{ width: `${w}%` }} />
        ))}
      </div>
      <div className="relative max-w-md">
        <span className="inline-block rounded-full bg-[var(--primary)] px-2.5 py-1 text-xs font-bold text-white">
          Premium
        </span>
        <h3 className="mt-2 text-lg font-extrabold text-[var(--text)]">Débloquez vos analytics</h3>
        <p className="mt-1 text-sm text-[var(--text2)]">
          Comprenez d&apos;un coup d&apos;œil comment vos clients arrivent et ce qu&apos;ils pensent.
        </p>
        <ul className="mt-3 space-y-2">
          {feats.map(([icon, title, desc]) => (
            <li key={title} className="flex gap-2.5 text-sm">
              <span aria-hidden className="mt-0.5">{icon}</span>
              <span>
                <b className="text-[var(--text)]">{title}</b>{' '}
                <span className="text-[var(--text2)]">— {desc}</span>
              </span>
            </li>
          ))}
        </ul>
        <Link
          href={`/pro/r/${id}/abonnement`}
          className="mt-4 inline-block rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
        >
          Passer au Premium
        </Link>
      </div>
    </section>
  );
}

/** Squelette (chrome instantané) — même géométrie que le contenu réel. */
export function StatsSkeleton({ premium }: { premium: boolean }) {
  const block = 'rounded-2xl border border-[var(--border2)] bg-[var(--surface)]';
  return (
    <div className="space-y-4 pro-swap">
      <div className={`${block} h-28`} />
      <div className="grid grid-cols-2 gap-3">
        <div className={`${block} h-24`} />
        <div className={`${block} h-24`} />
      </div>
      {premium ? (
        <>
          <div className={`${block} h-44`} />
          <div className={`${block} h-52`} />
          <div className={`${block} h-40`} />
        </>
      ) : (
        <div className={`${block} h-56`} />
      )}
    </div>
  );
}

export default async function StatsContent({ id, premium }: { id: string; premium: boolean }) {
  const { supabase } = await requireUser();

  const [statsRes, qrRes, benchRes] = await Promise.all([
    supabase.rpc('get_owner_restaurant_stats', { p_restaurant_id: id }),
    supabase.rpc('get_qr_stats', { p_restaurant_id: id }),
    premium
      ? supabase.rpc('get_owner_benchmark', { p_restaurant_id: id })
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (statsRes.error) console.error('[pro/stats] get_owner_restaurant_stats', statsRes.error.message);
  if (qrRes.error) console.error('[pro/stats] get_qr_stats', qrRes.error.message);
  if (benchRes.error) console.error('[pro/stats] get_owner_benchmark', benchRes.error.message);

  const s = (Array.isArray(statsRes.data) ? statsRes.data[0] : statsRes.data) as OwnerStats | null;
  const qr = (Array.isArray(qrRes.data) ? qrRes.data[0] : qrRes.data) as QrStats | null;
  const bench = (Array.isArray(benchRes.data) ? benchRes.data[0] : benchRes.data) as Benchmark | null;

  const rating = n(s?.avg_rating);
  const reviewCount = s?.review_count ?? 0;
  const scans30d = qr?.scans_30d ?? 0;

  // Phrase de contexte du hero (benchmark ville si premium).
  let heroLine = reviewCount > 0 ? 'La note moyenne de vos plats sur DishRank.' : 'Vos premiers avis apparaîtront ici.';
  const cityAvg = n(bench?.city_avg);
  if (rating != null && cityAvg != null) {
    const diff = rating - cityAvg;
    heroLine =
      diff >= 0.05
        ? `Au-dessus de la moyenne de votre quartier (${cityAvg.toFixed(1)} ★).`
        : diff <= -0.05
          ? `Sous la moyenne de votre quartier (${cityAvg.toFixed(1)} ★).`
          : `Dans la moyenne de votre quartier (${cityAvg.toFixed(1)} ★).`;
  }

  const mustReturn = s?.must_return_count ?? 0;
  const disappointing = s?.disappointing_count ?? 0;
  const verdictMax = Math.max(mustReturn, disappointing, 1);

  const google = n(s?.google_rating);

  return (
    <div className="space-y-4 pro-swap">
      {/* HERO — note (gratuit) */}
      <section className={cardCls}>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="text-center">
            <p className="tabular text-5xl font-black leading-none">{rating != null ? rating.toFixed(1) : '—'}</p>
            <div className="mt-2">
              <Stars rating={rating ?? 0} />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold text-[var(--text)]">
              {reviewCount > 0 ? `${reviewCount} avis` : "Pas encore d'avis"}
              {scans30d > 0 ? ` · ${scans30d} scans ce mois` : ''}
            </p>
            <p className="mt-0.5 text-sm text-[var(--text2)]">{heroLine}</p>
            {google != null ? (
              <p className="mt-1 text-xs text-[var(--text3)]">
                Note Google : {google.toFixed(1)} ★ ({s?.google_review_count ?? 0} avis)
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {/* Coup d'œil gratuit — avis + scans QR ce mois */}
      <div className="grid grid-cols-2 gap-3">
        <StatTile icon="💬" label="Avis reçus" value={String(reviewCount)} sub="sur DishRank" />
        <StatTile
          icon="📲"
          label="Scans QR ce mois"
          value={String(scans30d)}
          sub={qr ? `${qr.scans_total} au total` : undefined}
        />
      </div>

      {premium ? (
        <>
          {/* Funnel de conversion */}
          <Card title="Le parcours de vos clients" hint="De la table à l'avis, étape par étape, via votre QR.">
            <FunnelViz
              steps={[
                { label: 'Scans du QR', value: qr?.scans_total ?? 0 },
                { label: 'Vues du menu', value: qr?.menu_views_total ?? 0 },
                { label: 'Inscriptions', value: qr?.signups_total ?? 0 },
                { label: '1ers avis', value: qr?.first_reviews_total ?? 0 },
              ]}
            />
          </Card>

          {/* Verdicts + détail avis */}
          <Card title="Ce que pensent vos clients">
            {mustReturn + disappointing > 0 ? (
              <div className="space-y-2">
                {/* Cliquables : ouvrent la liste des avis filtrée (accès rapide). */}
                <Link
                  href={`/pro/r/${id}/avis?avis=positifs`}
                  className="block rounded-lg px-1 -mx-1 transition-colors hover:bg-[var(--surface-var)]"
                  title="Voir les avis positifs"
                >
                  <BarRow label="⭐ À refaire" value={String(mustReturn)} pct={(mustReturn / verdictMax) * 100} color="var(--accent-success)" />
                </Link>
                <Link
                  href={`/pro/r/${id}/avis?avis=negatifs`}
                  className="block rounded-lg px-1 -mx-1 transition-colors hover:bg-[var(--surface-var)]"
                  title="Voir les avis négatifs"
                >
                  <BarRow label="👎 Déçu" value={String(disappointing)} pct={(disappointing / verdictMax) * 100} color="#ef4444" />
                </Link>
              </div>
            ) : (
              <p className="text-sm text-[var(--text3)]">Pas encore de verdict tranché sur vos plats.</p>
            )}
            <div className="mt-4 grid grid-cols-3 gap-3">
              <StatTile icon="🗓️" label="Avis (30 j)" value={String(s?.reviews_30d ?? 0)} />
              <StatTile icon="🍽️" label="Plats notés" value={String(s?.distinct_dishes ?? 0)} sub="plats distincts" />
              <StatTile icon="📸" label="Avis avec photo" value={String(s?.reviews_with_photo ?? 0)} />
            </div>
          </Card>

          {/* Benchmark */}
          {bench ? (
            <Card title="Comment vous vous situez" hint="Votre note comparée aux autres restaurants (sur 5).">
              <div className="space-y-2">
                <BarRow
                  label="Vous"
                  strongLabel
                  value={n(bench.my_avg) != null ? Number(bench.my_avg).toFixed(1) : '—'}
                  display="★"
                  pct={n(bench.my_avg) != null ? (Number(bench.my_avg) / 5) * 100 : 0}
                  color="var(--primary)"
                />
                <BarRow
                  label="Votre ville"
                  sub={`${bench.city_venue_count} restos`}
                  value={n(bench.city_avg) != null ? Number(bench.city_avg).toFixed(1) : '—'}
                  display="★"
                  pct={n(bench.city_avg) != null ? (Number(bench.city_avg) / 5) * 100 : 0}
                  color="var(--text3)"
                />
                <BarRow
                  label="Votre catégorie"
                  sub={`${bench.category_venue_count} restos`}
                  value={n(bench.category_avg) != null ? Number(bench.category_avg).toFixed(1) : '—'}
                  display="★"
                  pct={n(bench.category_avg) != null ? (Number(bench.category_avg) / 5) * 100 : 0}
                  color="var(--text3)"
                />
              </div>
            </Card>
          ) : null}

          {/* Visibilité */}
          <Card title="Votre visibilité">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile
                icon="👁️"
                label="Vues de la fiche"
                value={String(s?.fiche_views_total ?? 0)}
                sub={`${s?.fiche_views_30d ?? 0} ce mois-ci`}
              />
              <StatTile icon="🔖" label="Enregistrements" value={String(s?.bookmarks ?? 0)} sub="plats bookmarkés" />
              <StatTile icon="📖" label="Vues du menu" value={String(qr?.menu_views_total ?? 0)} />
              <StatTile icon="✍️" label="Réponses aux avis" value={String(s?.replies_count ?? 0)} />
            </div>
          </Card>
        </>
      ) : (
        <PremiumTeaser id={id} />
      )}
    </div>
  );
}
