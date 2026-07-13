'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** Onglets du workspace resto. Le menu et les statistiques arrivent aux lots 3-4. */
export default function WorkspaceNav({ id }: { id: string }) {
  const pathname = usePathname();
  const base = `/pro/r/${id}`;
  const tabs = [
    { href: base, label: 'Fiche' },
    { href: `${base}/menu`, label: 'Menu' },
    { href: `${base}/avis`, label: 'Avis' },
    { href: `${base}/stats`, label: 'Stats' },
  ];

  return (
    <nav className="mt-5 flex gap-1 border-b border-[var(--border2)]">
      {tabs.map((t) => {
        const active = t.href === base ? pathname === base : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-bold transition-colors ${
              active
                ? 'border-[var(--primary)] text-[var(--primary)]'
                : 'border-transparent text-[var(--text2)] hover:text-[var(--text)]'
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
