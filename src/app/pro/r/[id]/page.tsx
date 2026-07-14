import Link from 'next/link';
import { requireOwnedRestaurant, requireUser, getPendingReviewCount } from '@/lib/pro/data';
import SetupGuide from './SetupGuide';

export const metadata = { title: 'Accueil' };

// Icônes inline (stroke, currentColor).
const Ico = (children: React.ReactNode) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);
const ChatIco = Ico(<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />);
const MenuIco = Ico(<><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><circle cx="3.5" cy="6" r="1" /><circle cx="3.5" cy="12" r="1" /><circle cx="3.5" cy="18" r="1" /></>);
const ShareIco = Ico(<><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.6" y1="13.5" x2="15.4" y2="17.5" /><line x1="15.4" y1="6.5" x2="8.6" y2="10.5" /></>);
const StoreIco = Ico(<><path d="M3 9l1.5-5h15L21 9" /><path d="M4 9v11h16V9" /><path d="M3 9h18" /><path d="M9 20v-6h6v6" /></>);

interface OwnerStats {
  review_count?: number;
  avg_rating?: number | null;
  fiche_views_30d?: number | null;
}
interface QrStats {
  scans_30d?: number;
  menu_views_total?: number;
}

/** Cockpit d'accueil — l'écran par défaut d'un établissement : chiffres clés +
 *  actions rapides + guide de démarrage tant que la config est incomplète. */
export default async function CockpitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resto = await requireOwnedRestaurant(id);
  const { supabase } = await requireUser();

  const [pending, statsRes, qrRes, menuRes] = await Promise.all([
    getPendingReviewCount(id),
    supabase.rpc('get_owner_restaurant_stats', { p_restaurant_id: id }),
    supabase.rpc('get_qr_stats', { p_restaurant_id: id }),
    supabase.from('menu_items').select('id', { count: 'exact', head: true }).eq('restaurant_id', id),
  ]);

  const s = (Array.isArray(statsRes.data) ? statsRes.data[0] : statsRes.data) as OwnerStats | null;
  const qr = (Array.isArray(qrRes.data) ? qrRes.data[0] : qrRes.data) as QrStats | null;
  const rating = s?.avg_rating != null ? Number(s.avg_rating) : null;
  const menuCount = menuRes.count ?? 0;
  const hasMenu = menuCount > 0;
  const hasDescription = !!(resto.description && resto.description.trim());

  const base = `/pro/r/${id}`;
  const kpis: { label: string; value: string; accent?: boolean; href?: string }[] = [
    { label: 'Avis à répondre', value: String(pending), accent: pending > 0, href: `${base}/avis` },
    { label: 'Note moyenne', value: rating != null ? `${rating.toFixed(1)} ★` : '—' },
    { label: 'Scans QR (30 j)', value: String(qr?.scans_30d ?? 0) },
    { label: 'Vues du menu', value: String(qr?.menu_views_total ?? 0) },
  ];
  const actions: { icon: React.ReactNode; label: string; sub: string; href: string }[] = [
    { icon: ChatIco, label: 'Répondre aux avis', sub: pending > 0 ? `${pending} en attente` : 'Tout est à jour ✓', href: `${base}/avis` },
    { icon: MenuIco, label: 'Modifier le menu', sub: hasMenu ? `${menuCount} plat${menuCount > 1 ? 's' : ''}` : 'Créer ma carte', href: `${base}/menu` },
    { icon: ShareIco, label: 'Partager le QR', sub: 'Chevalet imprimable + lien', href: `${base}/partage` },
    { icon: StoreIco, label: 'Modifier ma fiche', sub: 'Infos, cuisines, contact', href: `${base}/fiche` },
  ];

  return (
    <div className="space-y-6">
      <SetupGuide id={id} hasDescription={hasDescription} hasMenu={hasMenu} />

      {/* Chiffres clés */}
      <section>
        <h2 className="mb-3 text-xs font-extrabold uppercase tracking-wide text-[var(--text3)]">Chiffres clés</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {kpis.map((k) => {
            const inner = (
              <div
                className={`h-full rounded-2xl border p-4 transition-colors ${
                  k.accent
                    ? 'border-[var(--primary)] bg-[var(--primary-container)]'
                    : 'border-[var(--border2)] bg-[var(--surface)]'
                } ${k.href ? 'hover:border-[var(--primary)]' : ''}`}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text3)]">{k.label}</p>
                <p className={`mt-1 text-2xl font-extrabold ${k.accent ? 'text-[var(--primary)]' : ''}`}>{k.value}</p>
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

      {/* Actions rapides */}
      <section>
        <h2 className="mb-3 text-xs font-extrabold uppercase tracking-wide text-[var(--text3)]">Actions rapides</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {actions.map((a) => (
            <Link
              key={a.label}
              href={a.href}
              className="flex items-center gap-3 rounded-2xl border border-[var(--border2)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--primary)]"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-container)] text-[var(--primary)]">
                {a.icon}
              </span>
              <div className="min-w-0">
                <p className="font-bold">{a.label}</p>
                <p className="text-sm text-[var(--text2)]">{a.sub}</p>
              </div>
              <span className="ml-auto text-lg text-[var(--text3)]">→</span>
            </Link>
          ))}
        </div>
      </section>

      <Link href={`${base}/stats`} className="inline-block text-sm font-semibold text-[var(--primary)] hover:underline">
        Voir toutes les statistiques →
      </Link>
    </div>
  );
}
