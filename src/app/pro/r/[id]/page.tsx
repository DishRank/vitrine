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
  avg_rating?: number | null;
  fiche_views_30d?: number | null;
}
interface QrStats {
  scans_30d?: number;
  menu_views_total?: number;
}

/** Cockpit d'accueil — écran par défaut d'un établissement : salut + statut,
 *  guide de démarrage (tant que non prêt), chiffres clés (recadrés positivement
 *  quand vides) et actions rapides. */
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
  const scans = qr?.scans_30d ?? 0;
  const menuViews = qr?.menu_views_total ?? 0;
  const menuCount = menuRes.count ?? 0;
  const hasMenu = menuCount > 0;
  const hasDescription = !!(resto.description && resto.description.trim());
  const setupDone = hasDescription && hasMenu;
  const hasFirstScan = scans > 0 || menuViews > 0;

  const base = `/pro/r/${id}`;

  // Une seule phrase de statut, adaptée à l'état.
  const statusLine = !setupDone
    ? 'Suivez le guide ci-dessous pour mettre votre carte en ligne.'
    : pending > 0
      ? `${pending} avis ${pending > 1 ? 'attendent' : 'attend'} votre réponse.`
      : 'Tout est à jour. Belle journée !';

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

  const actions: { icon: React.ReactNode; label: string; sub: string; href: string }[] = [
    { icon: ChatIco, label: 'Répondre aux avis', sub: pending > 0 ? `${pending} en attente` : 'Tout est à jour ✓', href: `${base}/avis` },
    { icon: MenuIco, label: 'Modifier le menu', sub: hasMenu ? `${menuCount} plat${menuCount > 1 ? 's' : ''}` : 'Créer ma carte', href: `${base}/menu` },
    { icon: ShareIco, label: 'Partager le QR', sub: 'Chevalet imprimable + lien', href: `${base}/partage` },
    { icon: StoreIco, label: 'Modifier ma fiche', sub: 'Infos, cuisines, contact', href: `${base}/fiche` },
  ];

  return (
    <div className="space-y-6">
      {/* Salut + statut (le nom du resto est déjà dans l'en-tête au-dessus des onglets) */}
      <div>
        <p className="text-lg font-extrabold">Bonjour 👋</p>
        <p className="mt-0.5 text-sm text-[var(--text2)]">{statusLine}</p>
      </div>

      <SetupGuide id={id} hasDescription={hasDescription} hasMenu={hasMenu} hasFirstScan={hasFirstScan} />

      {/* Chiffres clés */}
      <section>
        <h2 className="mb-3 text-sm font-bold text-[var(--text2)]">En un coup d’œil</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {kpis.map((k, i) => {
            const inner = (
              <div
                className={`h-full rounded-2xl border p-4 transition-colors ${
                  k.accent
                    ? 'border-[var(--primary)] bg-[var(--primary-container)]'
                    : 'border-[var(--border2)] bg-[var(--surface)]'
                } ${k.href ? 'hover:border-[var(--primary)]' : ''}`}
                style={{ animation: 'fadeUp 0.4s ease-out both', animationDelay: `${i * 55}ms` }}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text3)]">{k.label}</p>
                <p className={`mt-1 text-2xl font-extrabold ${k.accent ? 'text-[var(--primary)]' : k.value === 'Pas encore' ? 'text-[var(--text3)]' : ''}`}>
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

      {/* Actions rapides — masquées pendant l'onboarding (le guide couvre déjà tout) */}
      {setupDone ? (
        <section>
          <h2 className="mb-3 text-sm font-bold text-[var(--text2)]">Que faire aujourd’hui ?</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {actions.map((a, i) => (
              <Link
                key={a.label}
                href={a.href}
                className="flex items-center gap-3 rounded-2xl border border-[var(--border2)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--primary)]"
                style={{ animation: 'fadeUp 0.4s ease-out both', animationDelay: `${i * 55}ms` }}
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
      ) : null}

      <Link href={`${base}/stats`} className="inline-block text-sm font-semibold text-[var(--primary)] hover:underline">
        Voir toutes mes statistiques →
      </Link>
    </div>
  );
}
