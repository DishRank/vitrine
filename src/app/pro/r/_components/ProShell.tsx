'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import AnimatedLogo from '@/components/AnimatedLogo';
import ThemeToggle from '@/app/pro/_components/ThemeToggle';
import Modal from '@/app/pro/_components/Modal';
import ClaimClient from '@/app/pro/claim/ClaimClient';
import DigestToggle from '@/app/pro/compte/DigestToggle';
import { signOutAction } from '@/app/pro/actions';
import AnimatedOutlet from './AnimatedOutlet';

export interface ShellResto {
  id: string;
  name: string | null;
  photo_url: string | null;
  subscription_tier: string | null;
}

/**
 * Shell « dashboard » de l'espace pro : sidebar fixe (nav de l'établissement
 * actif) + topbar (cloche d'avis, sélecteur d'établissement) + contenu sur
 * fond lavande. Client car toute la nav dépend du pathname : l'id du resto
 * actif vit dans le segment [id] SOUS ce layout — on le déduit de l'URL,
 * comme le faisait le carrousel qu'il remplace.
 *
 * Sur mobile la sidebar devient un tiroir (hamburger dans la topbar).
 * Le changement de resto CONSERVE l'onglet courant (suffixe d'URL) en
 * soft-nav : ce shell reste monté, seul l'AnimatedOutlet se re-rend.
 */
export default function ProShell({
  restaurants,
  pending,
  email,
  digestOptOut,
  children,
}: {
  restaurants: ShellResto[];
  pending: Record<string, number>;
  email?: string | null;
  digestOptOut: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const mainRef = useRef<HTMLElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  // /pro/r/<id><suffix> → resto actif + onglet courant (préservé à la bascule).
  const m = pathname.match(/^\/pro\/r\/([^/]+)(\/.*)?$/);
  const activeId = m?.[1] ?? restaurants[0]?.id ?? null;
  const suffix = m?.[2] ?? '';
  const pendingCount = activeId ? (pending[activeId] ?? 0) : 0;

  // Toute navigation referme le tiroir mobile et remonte le contenu en haut
  // (le scroll vit dans <main>, plus dans window — Next ne le restaure pas).
  useEffect(() => {
    setDrawerOpen(false);
    mainRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  // Précharge TOUTES les sections du resto actif (payload complet, cache
  // client ~5 min) dès le montage → bascule d'onglet instantanée, sans
  // skeleton. router.prefetch (kind full) couvre aussi le mobile, où les
  // liens de la sidebar vivent dans le tiroir fermé (jamais visibles, donc
  // jamais préchargés par <Link> seul).
  useEffect(() => {
    if (!activeId) return;
    const base = `/pro/r/${activeId}`;
    for (const url of [base, `${base}/fiche`, `${base}/menu`, `${base}/avis`, `${base}/stats`, `${base}/partage`, `${base}/abonnement`]) {
      router.prefetch(url);
    }
  }, [activeId, router]);

  const sidebar = (
    <SidebarContent
      pathname={pathname}
      activeId={activeId}
      pendingCount={pendingCount}
      email={email}
      onAccount={() => {
        setDrawerOpen(false);
        setAccountOpen(true);
      }}
    />
  );

  return (
    // Cadre « app » plein écran : sidebar et topbar toujours visibles, SEUL
    // <main> scrolle. Pas de position:sticky ici — le `overflow-x: hidden`
    // global posé sur html/body (globals.css) casse sticky sur tout descendant.
    <div className="flex h-dvh overflow-hidden">
      {/* Sidebar desktop */}
      <aside className="hidden h-full w-60 shrink-0 flex-col border-r border-[var(--border2)] bg-[var(--surface)] lg:flex">
        {sidebar}
      </aside>

      {/* Tiroir mobile */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div
            className="absolute inset-0 bg-black/50"
            style={{ animation: 'fadeIn 0.15s ease-out both' }}
            onClick={() => setDrawerOpen(false)}
          />
          <div
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-[var(--border2)] bg-[var(--surface)]"
            style={{ animation: 'drawerIn 0.2s ease-out both' }}
          >
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Fermer le menu"
              className="absolute right-3 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text2)] hover:bg-[var(--surface-var)]"
            >
              <XIcon className="h-4 w-4" />
            </button>
            {sidebar}
          </div>
        </div>
      ) : null}

      {/* Colonne principale : topbar + contenu */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="relative z-40 shrink-0 border-b border-[var(--border2)] bg-[var(--surface)]">
          <div className="flex h-16 items-center gap-2 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Ouvrir le menu"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border2)] text-[var(--text2)] transition-colors hover:border-[var(--primary)] hover:text-[var(--text)] lg:hidden"
            >
              <BurgerIcon className="h-4.5 w-4.5" />
            </button>
            <Link href="/pro" className="flex items-center gap-2 text-[var(--text)] lg:hidden">
              <AnimatedLogo size={24} />
              <span className="hidden text-base font-extrabold tracking-tight sm:block">
                DishRank <span className="text-[var(--primary)]">Pro</span>
              </span>
            </Link>

            <div className="flex-1" />

            <ThemeToggle />
            <NotifBell restaurants={restaurants} pending={pending} activeId={activeId} />
            <RestoSwitcher
              restaurants={restaurants}
              activeId={activeId}
              suffix={suffix}
              onClaim={() => setClaimOpen(true)}
            />
          </div>
        </header>

        <main ref={mainRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
            <AnimatedOutlet>{children}</AnimatedOutlet>
          </div>
        </main>
      </div>

      <Modal
        open={claimOpen}
        onClose={() => setClaimOpen(false)}
        title="Revendiquer un établissement"
        subtitle="Retrouvez votre restaurant et prouvez que vous en êtes responsable."
        maxWidth="max-w-lg"
      >
        <ClaimClient onDone={() => setClaimOpen(false)} />
      </Modal>

      {/* Sheet « Mon compte » — les données (préférence digest) sont chargées
          par le layout serveur : ouverture instantanée, zéro navigation. */}
      <Modal open={accountOpen} onClose={() => setAccountOpen(false)} title="Mon compte" maxWidth="max-w-lg">
        <div className="space-y-4">
          <section className="rounded-2xl border border-[var(--border2)] bg-[var(--surface)] p-4">
            <h3 className="mb-1 text-sm font-extrabold">Compte</h3>
            <p className="text-sm text-[var(--text2)]">
              Connecté en tant que <strong>{email ?? '—'}</strong>.
            </p>
          </section>
          <section className="rounded-2xl border border-[var(--border2)] bg-[var(--surface)] p-4">
            <h3 className="mb-3 text-sm font-extrabold">Notifications par email</h3>
            <DigestToggle initialOptOut={digestOptOut} />
          </section>
          <section className="rounded-2xl border border-[var(--border2)] bg-[var(--surface)] p-4">
            <h3 className="mb-1 text-sm font-extrabold">Données personnelles</h3>
            <p className="text-sm text-[var(--text2)]">
              Pour exporter ou supprimer vos données, écrivez-nous à{' '}
              <a href="mailto:contact@dishrank.fr" className="text-[var(--primary)] hover:underline">
                contact@dishrank.fr
              </a>
              .
            </p>
          </section>
        </div>
      </Modal>
    </div>
  );
}

/** Contenu de la sidebar (partagé desktop / tiroir mobile). */
function SidebarContent({
  pathname,
  activeId,
  pendingCount,
  email,
  onAccount,
}: {
  pathname: string;
  activeId: string | null;
  pendingCount: number;
  email?: string | null;
  onAccount: () => void;
}) {
  const base = activeId ? `/pro/r/${activeId}` : '/pro';
  const menu = [
    { href: base, label: 'Tableau de bord', icon: HomeIcon, exact: true },
    { href: `${base}/fiche`, label: 'Fiche', icon: StoreIcon },
    { href: `${base}/menu`, label: 'Menu', icon: MenuIcon },
    { href: `${base}/avis`, label: 'Avis', icon: ChatIcon, badge: pendingCount },
    { href: `${base}/stats`, label: 'Statistiques', icon: ChartIcon },
    { href: `${base}/partage`, label: 'Partage', icon: ShareIcon },
    { href: `${base}/abonnement`, label: 'Abonnement', icon: StarIcon },
  ];

  const item = (active: boolean) =>
    `relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
      active
        ? 'bg-[var(--primary-container)] text-[var(--primary)]'
        : 'text-[var(--text2)] hover:bg-[var(--surface-var)] hover:text-[var(--text)]'
    }`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Link href="/pro" className="flex items-center gap-2.5 px-5 pb-4 pt-5 text-[var(--text)]">
        <AnimatedLogo size={28} />
        <span className="text-lg font-extrabold tracking-tight">
          DishRank <span className="text-[var(--primary)]">Pro</span>
        </span>
      </Link>

      <nav className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <p className="px-3 pb-2 pt-3 text-[11px] font-bold uppercase tracking-wider text-[var(--text3)]">Menu</p>
        <ul className="space-y-1">
          {menu.map((t) => {
            const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
            const Icon = t.icon;
            return (
              <li key={t.href}>
                {/* prefetch complet (données incluses) : les liens de la
                    sidebar sont toujours visibles sur desktop → tout le
                    workspace est préchargé dès l'arrivée. */}
                <Link href={t.href} prefetch={true} className={item(active)} aria-current={active ? 'page' : undefined}>
                  {active ? (
                    <span className="absolute -left-4 top-1/2 h-6 w-1.5 -translate-y-1/2 rounded-r-full bg-[var(--primary)]" />
                  ) : null}
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  <span className="truncate">{t.label}</span>
                  {t.badge ? (
                    <span className="ml-auto inline-flex min-w-[20px] items-center justify-center rounded-full bg-[var(--primary)] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                      {t.badge > 99 ? '99+' : t.badge}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>

        <p className="px-3 pb-2 pt-6 text-[11px] font-bold uppercase tracking-wider text-[var(--text3)]">Autres</p>
        <ul className="space-y-1">
          <li>
            {/* Sheet (pas de navigation) : données déjà chargées par le
                layout → ouverture instantanée. */}
            <button type="button" onClick={onAccount} className={`w-full ${item(false)}`}>
              <UserIcon className="h-[18px] w-[18px] shrink-0" />
              Mon compte
            </button>
          </li>
          {activeId ? (
            <li>
              <a href={`/menu/${activeId}`} target="_blank" rel="noopener noreferrer" className={item(false)}>
                <ExternalIcon className="h-[18px] w-[18px] shrink-0" />
                Aperçu public
              </a>
            </li>
          ) : null}
        </ul>
      </nav>

      {/* Pied : identité + déconnexion */}
      <div className="flex items-center gap-2.5 border-t border-[var(--border2)] px-4 py-3.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--primary-container)] text-sm font-extrabold uppercase text-[var(--primary)]">
          {(email ?? '?').charAt(0)}
        </span>
        <p className="min-w-0 flex-1 truncate text-xs font-semibold text-[var(--text2)]">{email ?? 'Mon compte'}</p>
        <form action={signOutAction}>
          <button
            type="submit"
            title="Se déconnecter"
            aria-label="Se déconnecter"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text2)] transition-colors hover:bg-[var(--surface-var)] hover:text-[var(--text)]"
          >
            <LogoutIcon className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

/**
 * Cloche de notifications — panneau listant, par établissement, les avis
 * publiés qui attendent une réponse (la tâche récurrente n°1 de l'owner).
 * Données déjà en mémoire (map chargée par le layout) → ouverture instantanée.
 */
function NotifBell({
  restaurants,
  pending,
  activeId,
}: {
  restaurants: ShellResto[];
  pending: Record<string, number>;
  activeId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const items = restaurants
    .map((r) => ({ ...r, count: pending[r.id] ?? 0 }))
    .filter((r) => r.count > 0)
    // Resto actif d'abord, puis par volume décroissant.
    .sort((a, b) => (a.id === activeId ? -1 : b.id === activeId ? 1 : b.count - a.count));
  const total = items.reduce((s, r) => s + r.count, 0);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={total > 0 ? `Notifications — ${total} avis à répondre` : 'Notifications'}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border2)] text-[var(--text2)] transition-colors hover:border-[var(--primary)] hover:text-[var(--text)]"
      >
        <BellIcon className="h-4.5 w-4.5" />
        {total > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white">
            {total > 9 ? '9+' : total}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          // Mobile : ancré au viewport (la cloche n'est pas au bord droit, un
          // panneau ancré déborderait à gauche) ; desktop : ancré à la cloche.
          className="fixed inset-x-4 top-[72px] z-50 rounded-2xl border border-[var(--border2)] bg-[var(--surface)] p-2 shadow-[0_12px_32px_var(--card-shadow)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80"
          style={{ animation: 'dropDownIn 0.15s ease-out both' }}
        >
          <p className="px-2.5 pb-1.5 pt-1 text-[11px] font-bold uppercase tracking-wider text-[var(--text3)]">
            Notifications
          </p>
          {items.length === 0 ? (
            <p className="px-2.5 pb-2 text-sm text-[var(--text2)]">
              <span className="font-semibold text-[var(--accent-success)]">Tout est à jour ✓</span>
              <br />
              Aucun avis n’attend de réponse.
            </p>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {items.map((r) => (
                <Link
                  key={r.id}
                  href={`/pro/r/${r.id}/avis`}
                  prefetch={true}
                  onClick={() => setOpen(false)}
                  className="flex items-start gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-[var(--surface-var)]"
                >
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-container)] text-[var(--primary)]">
                    <ChatIcon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{r.name ?? 'Sans nom'}</span>
                    <span className="text-xs text-[var(--text2)]">
                      {r.count} avis {r.count > 1 ? 'attendent' : 'attend'} votre réponse
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Sélecteur d'établissement de la topbar (remplace le carrousel). */
function RestoSwitcher({
  restaurants,
  activeId,
  suffix,
  onClaim,
}: {
  restaurants: ShellResto[];
  activeId: string | null;
  suffix: string;
  onClaim: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const active = restaurants.find((r) => r.id === activeId) ?? null;
  const targetFor = (id: string) => `/pro/r/${id}${suffix}`;

  // Dès l'ouverture du dropdown, précharge la cible de CHAQUE resto (onglet
  // courant conservé) → la bascule est instantanée, pas seulement au survol.
  useEffect(() => {
    if (!open) return;
    for (const r of restaurants) {
      if (r.id !== activeId) router.prefetch(targetFor(r.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const go = (id: string) => {
    if (id === activeId) {
      setOpen(false);
      return;
    }
    setPendingId(id);
    startTransition(() => {
      router.push(targetFor(id));
      setOpen(false);
    });
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border border-[var(--border2)] py-1 pl-1 pr-2.5 transition-colors hover:border-[var(--primary)]"
      >
        <Thumb resto={active} className="h-8 w-8 rounded-full" />
        <span className="hidden max-w-[150px] truncate text-sm font-bold sm:block">
          {active?.name ?? 'Mes établissements'}
        </span>
        <ChevronIcon className={`h-3.5 w-3.5 text-[var(--text3)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <div
          role="listbox"
          className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-[var(--border2)] bg-[var(--surface)] p-2 shadow-[0_12px_32px_var(--card-shadow)]"
          style={{ animation: 'dropDownIn 0.15s ease-out both' }}
        >
          <div className="max-h-80 overflow-y-auto">
            {restaurants.map((r) => {
              const isActive = r.id === activeId;
              const loading = isPending && pendingId === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => go(r.id)}
                  onMouseEnter={() => router.prefetch(targetFor(r.id))}
                  className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors ${
                    isActive ? 'bg-[var(--primary-container)]' : 'hover:bg-[var(--surface-var)]'
                  }`}
                >
                  <Thumb resto={r} className="h-9 w-9 rounded-lg" />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm font-bold ${isActive ? 'text-[var(--primary)]' : ''}`}>
                      {r.name ?? 'Sans nom'}
                    </span>
                    {r.subscription_tier === 'premium' ? (
                      <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--primary)]">Premium</span>
                    ) : null}
                  </span>
                  {loading ? (
                    <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
                  ) : isActive ? (
                    <CheckIcon className="h-4 w-4 shrink-0 text-[var(--primary)]" />
                  ) : null}
                </button>
              );
            })}
          </div>
          <div className="mt-1 border-t border-[var(--border2)] pt-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onClaim();
              }}
              className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm font-bold text-[var(--primary)] transition-colors hover:bg-[var(--primary-container)]"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-dashed border-[var(--primary)]/50 text-base leading-none">
                ＋
              </span>
              Revendiquer un établissement
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Vignette photo d'un resto (fallback assiette). */
function Thumb({ resto, className }: { resto: ShellResto | null; className: string }) {
  return (
    <span className={`block shrink-0 overflow-hidden bg-[var(--surface-var)] ${className}`}>
      {resto?.photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={resto.photo_url} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-sm">🍽️</span>
      )}
    </span>
  );
}

// ── Icônes (stroke, currentColor) ────────────────────────────────────────────
type P = { className?: string };
const svg = (children: React.ReactNode) => {
  const Icon = (p: P) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className} aria-hidden>
      {children}
    </svg>
  );
  return Icon;
};
const HomeIcon = svg(<><path d="M3 21h18" /><path d="M5 21V7l7-4 7 4v14" /><path d="M9 21v-6h6v6" /></>);
const StoreIcon = svg(<><path d="M3 9l1.5-5h15L21 9" /><path d="M4 9v11h16V9" /><path d="M3 9h18" /><path d="M9 20v-6h6v6" /></>);
const MenuIcon = svg(<><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><circle cx="3.5" cy="6" r="1" /><circle cx="3.5" cy="12" r="1" /><circle cx="3.5" cy="18" r="1" /></>);
const ChatIcon = svg(<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />);
const ChartIcon = svg(<><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>);
const ShareIcon = svg(<><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.6" y1="13.5" x2="15.4" y2="17.5" /><line x1="15.4" y1="6.5" x2="8.6" y2="10.5" /></>);
const StarIcon = svg(<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />);
const UserIcon = svg(<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>);
const ExternalIcon = svg(<><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><path d="M15 3h6v6" /><path d="M10 14L21 3" /></>);
const LogoutIcon = svg(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></>);
const BellIcon = svg(<><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>);
const ChevronIcon = svg(<path d="M6 9l6 6 6-6" />);
const BurgerIcon = svg(<><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>);
const XIcon = svg(<><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>);
const CheckIcon = svg(<path d="M20 6L9 17l-5-5" />);
