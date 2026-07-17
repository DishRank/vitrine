'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import {
  createAliasAction,
  deleteAliasAction,
  type LinkActionState,
} from '../avis/linkActions';
import type { MenuItemAlias } from './menuData';
import { FormError } from '../../../_components/fields';
import ConfirmDialog from '../../../_components/ConfirmDialog';

/**
 * Noms alternatifs d'un plat (mig 112). Un avis client portant un de ces noms
 * (faute de frappe, variante, ancien nom…) compte pour ce plat — corrige TOUS
 * les avis du nom d'un coup, présents et futurs. Écritures immédiates (create /
 * delete alias), indépendantes de l'enregistrement du plat.
 */
export default function ItemAliases({
  restaurantId,
  itemId,
  initialAliases,
}: {
  restaurantId: string;
  itemId: string;
  initialAliases: MenuItemAlias[];
}) {
  const [addState, add] = useActionState<LinkActionState, FormData>(
    createAliasAction.bind(null, restaurantId),
    {}
  );
  const [pending, startDelete] = useTransition();
  const [toDelete, setToDelete] = useState<MenuItemAlias | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Après un ajout réussi, revalidatePath re-rend l'arbre (nouvel alias en prop) ;
  // on vide le champ.
  useEffect(() => {
    if (addState.ok) formRef.current?.reset();
  }, [addState.ok]);

  const open = initialAliases.length > 0;

  return (
    <details
      open={open}
      className="rounded-xl border border-[var(--border2)] bg-[var(--surface)] px-3.5 py-2.5"
    >
      <summary className="cursor-pointer select-none text-sm font-bold text-[var(--text2)] hover:text-[var(--text)]">
        Noms alternatifs
        <span className="font-normal text-[var(--text3)]"> · {initialAliases.length}</span>
      </summary>
      <div className="mt-3 space-y-2.5">
        <p className="text-xs text-[var(--text3)]">
          Les avis clients portant un de ces noms comptent pour ce plat (faute de frappe, variante,
          ancien nom…). Un nom ajouté corrige tous les avis correspondants, présents et futurs.
        </p>

        {initialAliases.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {initialAliases.map((a) => (
              <span
                key={a.id}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border2)] bg-[var(--bg)] px-2.5 py-1 text-xs font-semibold text-[var(--text)]"
              >
                {a.alias_label}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setToDelete(a)}
                  aria-label={`Retirer « ${a.alias_label} »`}
                  className="text-[var(--text3)] transition-colors hover:text-red-500 disabled:opacity-40"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        ) : null}

        <form ref={formRef} action={add} className="flex items-center gap-1.5">
          <input type="hidden" name="menuItemId" value={itemId} />
          <input
            name="aliasLabel"
            type="text"
            required
            maxLength={200}
            placeholder="Ex. « bol », « ramen », ancien nom…"
            className="flex-1 rounded-lg border border-[var(--border2)] bg-[var(--bg)] px-2.5 py-1.5 text-sm text-[var(--text)] placeholder-[var(--text3)] outline-none focus:border-[var(--primary)]"
          />
          <button
            type="submit"
            className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-sm font-bold text-white hover:opacity-90"
          >
            Ajouter
          </button>
        </form>
        <FormError error={addState.error} />
      </div>

      <ConfirmDialog
        open={!!toDelete}
        title="Retirer ce nom alternatif"
        message={
          <>
            «{' '}
            <strong className="text-[var(--text)]">{toDelete?.alias_label}</strong> » ne comptera plus
            pour ce plat. Les avis portant ce nom retomberont sur le rapprochement automatique par nom.
          </>
        }
        confirmLabel="Retirer"
        onConfirm={() => {
          const id = toDelete?.id;
          if (id) startDelete(async () => { await deleteAliasAction(restaurantId, id); });
        }}
        onClose={() => setToDelete(null)}
      />
    </details>
  );
}
