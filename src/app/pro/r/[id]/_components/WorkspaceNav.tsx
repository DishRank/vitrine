'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** Onglets du workspace resto — icône + libellé, avec pastille « avis à répondre ». */
export default function WorkspaceNav({ id, pendingReviews = 0 }: { id: string; pendingReviews?: number }) {
  const pathname = usePathname();
  const base = `/pro/r/${id}`;
  const tabs = [
    { href: base, label: 'Accueil', icon: HomeIcon },
    { href: `${base}/fiche`, label: 'Fiche', icon: StoreIcon },
    { href: `${base}/menu`, label: 'Menu', icon: MenuIcon },
    { href: `${base}/avis`, label: 'Avis', icon: ChatIcon, badge: pendingReviews },
    { href: `${base}/stats`, label: 'Stats', icon: ChartIcon },
    { href: `${base}/partage`, label: 'Partage', icon: ShareIcon },
  ];

  return (
    <nav className="no-scrollbar mt-5 flex gap-1 overflow-x-auto border-b border-[var(--border2)]">
      {tabs.map((t) => {
        const active = t.href === base ? pathname === base : pathname.startsWith(t.href);
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`-mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-bold transition-colors sm:px-4 ${
              active
                ? 'border-[var(--primary)] text-[var(--primary)]'
                : 'border-transparent text-[var(--text2)] hover:text-[var(--text)]'
            }`}
          >
            <Icon className="h-4 w-4" />
            {t.label}
            {t.badge ? (
              <span className="ml-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-[var(--primary)] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                {t.badge > 99 ? '99+' : t.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

// ── Icônes (stroke, currentColor) ────────────────────────────────────────────
type P = { className?: string };
const svg = (children: React.ReactNode) => (p: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className} aria-hidden>
    {children}
  </svg>
);
const HomeIcon = svg(<><path d="M3 21h18" /><path d="M5 21V7l7-4 7 4v14" /><path d="M9 21v-6h6v6" /></>);
const StoreIcon = svg(<><path d="M3 9l1.5-5h15L21 9" /><path d="M4 9v11h16V9" /><path d="M3 9h18" /><path d="M9 20v-6h6v6" /></>);
const MenuIcon = svg(<><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><circle cx="3.5" cy="6" r="1" /><circle cx="3.5" cy="12" r="1" /><circle cx="3.5" cy="18" r="1" /></>);
const ChatIcon = svg(<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />);
const ChartIcon = svg(<><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>);
const ShareIcon = svg(<><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.6" y1="13.5" x2="15.4" y2="17.5" /><line x1="15.4" y1="6.5" x2="8.6" y2="10.5" /></>);
