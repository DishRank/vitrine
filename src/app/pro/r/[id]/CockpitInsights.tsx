import Link from 'next/link';
import { requireUser } from '@/lib/pro/data';
import SetupGuide from './SetupGuide';

/**
 * Guide de démarrage + KPIs du cockpit — ISOLÉS dans un composant async
 * (enveloppé par un <Suspense> côté page) : les 2 RPC de stats streament pendant
 * que le squelette s'affiche. Le bonjour + les actions rapides (données déjà en
 * cache) restent instantanés côté page.
 */

interface OwnerStats {
  avg_rating?: number | null;
  fiche_views_30d?: number | null;
}
interface QrStats {
  scans_30d?: number;
  menu_views_total?: number;
}

/** Squelette (chrome instantané) — guide + grille de 4 KPIs. */
export function CockpitInsightsSkeleton() {
  const block = 'rounded-2xl border border-[var(--border2)] bg-[var(--surface)]';
  return (
    <div className="space-y-6 pro-swap">
      <div className={`${block} h-40`} />
      <div>
        <div className="mb-3 h-4 w-32 rounded bg-[var(--surface-var)]" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`${block} h-24`} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default async function CockpitInsights({
  id,
  pending,
  hasDescription,
  hasCover,
  hasMenu,
}: {
  id: string;
  pending: number;
  hasDescription: boolean;
  hasCover: boolean;
  hasMenu: boolean;
}) {
  const { supabase } = await requireUser();
  const [statsRes, qrRes] = await Promise.all([
    supabase.rpc('get_owner_restaurant_stats', { p_restaurant_id: id }),
    supabase.rpc('get_qr_stats', { p_restaurant_id: id }),
  ]);

  const s = (Array.isArray(statsRes.data) ? statsRes.data[0] : statsRes.data) as OwnerStats | null;
  const qr = (Array.isArray(qrRes.data) ? qrRes.data[0] : qrRes.data) as QrStats | null;
  const rating = s?.avg_rating != null ? Number(s.avg_rating) : null;
  const scans = qr?.scans_30d ?? 0;
  const menuViews = qr?.menu_views_total ?? 0;
  const hasFirstScan = scans > 0 || menuViews > 0;

  const base = `/pro/r/${id}`;

  // KPI avec recadrage positif des zéros (jamais de rouge, jamais de faux chiffre).
  const kpis: { label: string; value: string; caption: string; captionOk?: boolean; accent?: boolean; href?: string }[] = [
    {
      label: 'Avis à répondre',
      value: String(pending),
      caption: pending > 0 ? 'à traiter' : 'Vous êtes à jour ✓',
      captionOk: pending === 0,
      accent: pending > 0,
      href: `${base}/avis`,
    },
    {
      label: 'Note moyenne',
      value: rating != null ? `${rating.toFixed(1)} ★` : 'Pas encore',
      caption: rating != null ? 'sur vos avis' : 'Dès vos premiers avis',
    },
    {
      label: 'Scans QR (30 j)',
      value: String(scans),
      caption: scans > 0 ? 'sur 30 jours' : 'Après le premier scan',
    },
    {
      label: 'Vues du menu',
      value: String(menuViews),
      caption: menuViews > 0 ? 'au total' : 'Dès vos premiers scans',
    },
  ];

  return (
    <div className="space-y-6 pro-swap">
      <SetupGuide id={id} hasDescription={hasDescription} hasCover={hasCover} hasMenu={hasMenu} hasFirstScan={hasFirstScan} />

      {/* Chiffres clés */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-[var(--text2)]">En un coup d’œil</h2>
          <Link
            href={`${base}/stats`}
            className="rounded-lg bg-[var(--primary-container)] px-3 py-1.5 text-xs font-bold text-[var(--primary)] transition-opacity hover:opacity-80"
          >
            Voir le rapport
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {kpis.map((k, i) => {
            const inner = (
              <div
                className={`h-full rounded-2xl border p-4 shadow-[0_2px_10px_var(--card-shadow)] transition-colors ${
                  k.accent
                    ? 'border-[var(--primary)] bg-[var(--primary-container)]'
                    : 'border-[var(--border2)] bg-[var(--surface)]'
                } ${k.href ? 'hover:border-[var(--primary)]' : ''}`}
                style={{ animation: 'fadeUp 0.4s ease-out both', animationDelay: `${i * 55}ms` }}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text3)]">{k.label}</p>
                <p className={`tabular mt-1 text-2xl font-extrabold ${k.accent ? 'text-[var(--primary)]' : k.value === 'Pas encore' ? 'text-[var(--text3)]' : ''}`}>
                  {k.value}
                </p>
                <p className={`mt-0.5 text-xs ${k.captionOk ? 'font-semibold text-[var(--accent-success)]' : 'text-[var(--text2)]'}`}>{k.caption}</p>
              </div>
            );
            return k.href ? (
              <Link key={k.label} href={k.href} className="block">
                {inner}
              </Link>
            ) : (
              <div key={k.label}>{inner}</div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
