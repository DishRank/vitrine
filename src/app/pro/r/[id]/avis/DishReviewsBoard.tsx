'use client';

import { useState } from 'react';
import ReviewCard, { type ProReview, type MenuItemRef } from './ReviewCard';
import OrphanWorklist, { type OrphanDish } from './OrphanWorklist';
import Modal from '../../../_components/Modal';

/** Un plat + ses avis (préparé côté serveur par la page). */
export interface DishGroup {
  name: string;
  avg: number | null;
  reviews: ProReview[];
  unanswered: number;
}

type OpenState = { kind: 'dish'; group: DishGroup } | { kind: 'orphan' } | null;

/**
 * Dashboard avis = une GRILLE de cartes par plat (vue d'ensemble scannable) ;
 * un clic ouvre une modale avec les avis de ce plat. Une carte à part
 * « Plats non reconnus » ouvre le worklist de rattachement + les avis orphelins.
 */
export default function DishReviewsBoard({
  restaurantId,
  premium,
  thankTemplate,
  menuItems,
  dishGroups,
  orphanReviews,
  orphans,
}: {
  restaurantId: string;
  premium: boolean;
  thankTemplate: string;
  menuItems: MenuItemRef[];
  dishGroups: DishGroup[];
  orphanReviews: ProReview[];
  orphans: OrphanDish[];
}) {
  const [open, setOpen] = useState<OpenState>(null);

  const card = (r: ProReview) => (
    <ReviewCard
      key={r.id}
      restaurantId={restaurantId}
      review={r}
      canPin={premium}
      thankTemplate={thankTemplate}
      menuItems={menuItems}
    />
  );

  const title = open?.kind === 'dish' ? open.group.name : open?.kind === 'orphan' ? 'Plats non reconnus' : '';
  const subtitle =
    open?.kind === 'dish'
      ? `${open.group.reviews.length} avis${open.group.avg != null ? ` · ★ ${open.group.avg.toFixed(1)}` : ''}`
      : open?.kind === 'orphan'
        ? `${orphanReviews.length} avis à rattacher`
        : undefined;

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* Carte « Plats non reconnus » — en tête, à traiter */}
        {orphanReviews.length > 0 ? (
          <button
            type="button"
            onClick={() => setOpen({ kind: 'orphan' })}
            className="flex flex-col justify-between gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/[0.06] p-4 text-left transition-colors hover:border-amber-500"
          >
            <span className="flex items-center gap-2 font-extrabold text-[var(--text)]">
              <span aria-hidden>🔍</span> Plats non reconnus
            </span>
            <span className="flex items-center gap-2">
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-600">
                {orphanReviews.length} avis
              </span>
              <span className="text-xs font-semibold text-amber-600">à rattacher →</span>
            </span>
          </button>
        ) : null}

        {/* Une carte par plat */}
        {dishGroups.map((g) => (
          <button
            key={g.name}
            type="button"
            onClick={() => setOpen({ kind: 'dish', group: g })}
            className="flex flex-col gap-3 rounded-2xl border border-[var(--border2)] bg-[var(--surface)] p-4 text-left shadow-[0_2px_10px_var(--card-shadow)] transition-colors hover:border-[var(--primary)]"
          >
            <span className="line-clamp-2 font-extrabold text-[var(--text)]">{g.name}</span>
            <span className="mt-auto flex flex-wrap items-center gap-2">
              {g.avg != null ? (
                <span className="rounded-md bg-[var(--surface-var)] px-1.5 py-0.5 text-xs font-bold text-[var(--text)]">
                  ★ {g.avg.toFixed(1)}
                </span>
              ) : null}
              <span className="text-xs text-[var(--text3)]">{g.reviews.length} avis</span>
              {g.unanswered > 0 ? (
                <span className="rounded-full bg-[var(--primary-container)] px-2 py-0.5 text-xs font-bold text-[var(--primary)]">
                  {g.unanswered} à répondre
                </span>
              ) : null}
            </span>
          </button>
        ))}
      </div>

      <Modal open={open != null} onClose={() => setOpen(null)} title={title} subtitle={subtitle} maxWidth="max-w-2xl">
        <div className="space-y-3">
          {open?.kind === 'orphan' ? (
            <>
              {orphans.length > 0 ? (
                <OrphanWorklist restaurantId={restaurantId} orphans={orphans} menuItems={menuItems} />
              ) : null}
              {orphanReviews.map(card)}
            </>
          ) : open?.kind === 'dish' ? (
            open.group.reviews.map(card)
          ) : null}
        </div>
      </Modal>
    </>
  );
}
