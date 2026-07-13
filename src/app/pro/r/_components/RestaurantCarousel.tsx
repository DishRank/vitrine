'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export interface CarouselResto {
  id: string;
  name: string | null;
  photo_url: string | null;
  subscription_tier: string | null;
}

/**
 * Carrousel horizontal des établissements possédés (en haut du workspace).
 * Une card = photo + nom. Clic → bascule vers ce resto EN CONSERVANT l'onglet
 * courant (Fiche/Menu/Avis/Stats), en soft-nav : le layout parent reste monté,
 * seul le contenu dessous change (AnimatedOutlet). Prefetch au survol pour que
 * la bascule soit quasi-instantanée malgré le rendu dynamique.
 */
export default function RestaurantCarousel({ restaurants }: { restaurants: CarouselResto[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // /pro/r/<id><suffix>  → activeId + suffixe d'onglet (/menu, /menu/apparence…)
  const m = pathname.match(/^\/pro\/r\/([^/]+)(\/.*)?$/);
  const activeId = m?.[1] ?? null;
  const suffix = m?.[2] ?? '';

  const targetFor = (id: string) => `/pro/r/${id}${suffix}`;

  const go = (id: string) => {
    if (id === activeId) return;
    setPendingId(id);
    startTransition(() => router.push(targetFor(id)));
  };

  return (
    <div className="mt-5">
      <div
        ref={scrollerRef}
        className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1"
      >
        {restaurants.map((r) => {
          const active = r.id === activeId;
          const loading = isPending && pendingId === r.id;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => go(r.id)}
              onMouseEnter={() => router.prefetch(targetFor(r.id))}
              aria-current={active ? 'true' : undefined}
              className={`group relative flex w-[168px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border text-left transition-all ${
                active
                  ? 'border-[var(--primary)] ring-2 ring-[var(--primary-glow)]'
                  : 'border-[var(--border2)] hover:border-[var(--primary)]'
              } bg-[var(--surface)]`}
            >
              <div className="relative h-24 w-full bg-[var(--surface-var)]">
                {r.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.photo_url}
                    alt=""
                    className={`h-full w-full object-cover transition-transform duration-300 ${active ? '' : 'group-hover:scale-105'}`}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl">🍽️</div>
                )}
                {r.subscription_tier === 'premium' ? (
                  <span className="absolute right-1.5 top-1.5 rounded-full bg-[var(--primary)] px-1.5 py-0.5 text-[10px] font-bold text-white">
                    Premium
                  </span>
                ) : null}
                {loading ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-[var(--surface)]/60">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
                  </span>
                ) : null}
              </div>
              <div className="px-3 py-2">
                <p className={`truncate text-sm font-bold ${active ? 'text-[var(--primary)]' : 'text-[var(--text)]'}`}>
                  {r.name ?? 'Sans nom'}
                </p>
              </div>
              {active ? <span className="absolute inset-x-0 bottom-0 h-1 bg-[var(--primary)]" /> : null}
            </button>
          );
        })}

        {/* Card « + » revendiquer */}
        <button
          type="button"
          onClick={() => startTransition(() => router.push('/pro/claim'))}
          onMouseEnter={() => router.prefetch('/pro/claim')}
          className="flex w-[128px] shrink-0 snap-start flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-[var(--border2)] bg-[var(--surface)] py-4 text-[var(--text2)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
        >
          <span className="text-2xl leading-none">＋</span>
          <span className="text-xs font-bold">Revendiquer</span>
        </button>
      </div>
    </div>
  );
}
