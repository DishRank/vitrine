'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  createAliasAction,
  createDishFromReviewAction,
  type LinkActionState,
} from './linkActions';
import type { MenuItemRef } from './ReviewCard';
import DishSelect from './DishSelect';
import { FormError } from '../../../_components/fields';

/** Nom de plat noté par des clients mais absent de la carte (RPC get_unmatched_review_dishes). */
export interface OrphanDish {
  dish_name: string;
  review_count: number;
  last_at: string;
}

type Groups = [string, MenuItemRef[]][];

function groupBySection(items: MenuItemRef[]): Groups {
  const m = new Map<string, MenuItemRef[]>();
  for (const it of items) {
    const arr = m.get(it.section);
    if (arr) arr.push(it);
    else m.set(it.section, [it]);
  }
  return [...m.entries()];
}

export default function OrphanWorklist({
  restaurantId,
  orphans,
  menuItems,
}: {
  restaurantId: string;
  orphans: OrphanDish[];
  menuItems: MenuItemRef[];
}) {
  const groups = groupBySection(menuItems);
  return (
    <section className="rounded-2xl border border-[var(--border2)] bg-[var(--surface)] p-4">
      <p className="text-xs text-[var(--text2)]">
        Rattachez un nom de plat à une entrée de votre carte (tous les avis portant ce nom, présents
        et futurs, sont corrigés d’un coup) ou créez le plat directement.
      </p>
      <ul className="mt-3 space-y-2">
        {orphans.map((o) => (
          <OrphanRow key={o.dish_name} restaurantId={restaurantId} orphan={o} groups={groups} />
        ))}
      </ul>
    </section>
  );
}

function OrphanRow({
  restaurantId,
  orphan,
  groups,
}: {
  restaurantId: string;
  orphan: OrphanDish;
  groups: Groups;
}) {
  const [aliasState, alias] = useActionState<LinkActionState, FormData>(
    createAliasAction.bind(null, restaurantId),
    {}
  );
  const [createState, create] = useActionState<LinkActionState, FormData>(
    createDishFromReviewAction.bind(null, restaurantId),
    {}
  );
  // « Créer le plat » → onglet menu, éditeur ouvert sur le nouveau plat.
  const router = useRouter();
  useEffect(() => {
    if (createState.ok && createState.itemId) {
      router.push(`/pro/r/${restaurantId}/menu?edit=${createState.itemId}`);
    }
  }, [createState.ok, createState.itemId, restaurantId, router]);
  return (
    <li className="rounded-xl border border-[var(--border2)] px-3 py-2.5">
      <span className="text-sm font-semibold text-[var(--text)]">
        {orphan.dish_name}
        <span className="ml-1.5 text-xs font-normal text-[var(--text3)]">· {orphan.review_count} avis</span>
      </span>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {groups.length > 0 ? (
          <form action={alias} className="flex items-center gap-2">
            <input type="hidden" name="aliasLabel" value={orphan.dish_name} />
            <DishSelect groups={groups} />
            <button
              type="submit"
              className="shrink-0 rounded-lg bg-[var(--primary)] px-3.5 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              Rattacher
            </button>
          </form>
        ) : null}
        <form action={create}>
          <input type="hidden" name="dishName" value={orphan.dish_name} />
          <button
            type="submit"
            className="rounded-lg border border-[var(--primary)] px-3 py-1.5 text-xs font-bold text-[var(--primary)] hover:bg-[var(--primary-container)]"
          >
            {groups.length > 0 ? '+ Créer le plat' : '+ Créer ce plat dans ma carte'}
          </button>
        </form>
      </div>
      <FormError error={aliasState.error ?? createState.error} />
    </li>
  );
}
