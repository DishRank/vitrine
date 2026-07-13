'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import {
  createDefaultMenuAction,
  upsertSectionAction,
  translateMenuAction,
  type MenuActionState,
} from './menuActions';
import type { EditorMenu } from './menuData';
import SectionBlock from './SectionBlock';
import { inputCls, labelCls, FormError } from '../../../_components/fields';

export default function MenuEditor({
  restaurantId,
  menu,
  premium,
}: {
  restaurantId: string;
  menu: EditorMenu | null;
  premium: boolean;
}) {
  const [pending, start] = useTransition();
  const [addingSection, setAddingSection] = useState(false);
  const [notice, setNotice] = useState('');

  // ── Aucune carte encore ──────────────────────────────────────────────────
  if (!menu) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border2)] bg-[var(--surface)] p-8 text-center">
        <p className="text-[15px] font-semibold mb-1">Créez votre menu numérique</p>
        <p className="text-sm text-[var(--text2)] max-w-md mx-auto mb-5">
          Ajoutez vos catégories et vos plats. Vos clients y accèdent gratuitement via le QR code de
          table — édition en temps réel, allergènes et prix inclus.
        </p>
        <button
          onClick={() => start(async () => { await createDefaultMenuAction(restaurantId); })}
          disabled={pending}
          className="rounded-xl bg-[var(--primary)] px-5 py-3 text-[15px] font-bold text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? 'Création…' : 'Créer ma carte'}
        </button>
      </div>
    );
  }

  const sectionIds = menu.sections.map((s) => s.id);

  const translate = () =>
    start(async () => {
      setNotice('');
      const r = await translateMenuAction(restaurantId);
      const msg = r.error === 'network' ? 'Service de traduction injoignable. Réessayez.' : r.error;
      setNotice(r.ok ? `Traduction mise à jour (${r.translated ?? 0} champs).` : msg || 'Erreur.');
    });

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold">{menu.name}</h2>
          <p className="text-sm text-[var(--text2)]">
            Vos modifications sont visibles immédiatement sur le menu public.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/menu/${restaurantId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-[var(--border2)] px-3 py-2 text-sm font-semibold text-[var(--text2)] hover:border-[var(--primary)] hover:text-[var(--text)]"
          >
            Voir le menu public ↗
          </a>
          <a
            href={`/pro/r/${restaurantId}/menu/apparence`}
            className="rounded-lg border border-[var(--border2)] px-3 py-2 text-sm font-semibold text-[var(--text2)] hover:border-[var(--primary)] hover:text-[var(--text)]"
          >
            Apparence
          </a>
          <a
            href={`/pro/r/${restaurantId}/partage`}
            className="rounded-lg border border-[var(--border2)] px-3 py-2 text-sm font-semibold text-[var(--text2)] hover:border-[var(--primary)] hover:text-[var(--text)]"
          >
            Partager
          </a>
          {premium ? (
            <button
              onClick={translate}
              disabled={pending}
              className="rounded-lg border border-[var(--border2)] px-3 py-2 text-sm font-semibold text-[var(--text2)] hover:border-[var(--primary)] hover:text-[var(--text)] disabled:opacity-50"
            >
              Traduire (auto)
            </button>
          ) : null}
        </div>
      </div>

      {notice ? (
        <p className="rounded-lg border border-[var(--border2)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text2)]">{notice}</p>
      ) : null}

      {/* Catégories */}
      {menu.sections.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--border2)] bg-[var(--surface)] p-6 text-center text-sm text-[var(--text2)]">
          Votre carte est vide. Ajoutez une première catégorie (Entrées, Plats, Desserts…).
        </p>
      ) : (
        <div className="space-y-3">
          {menu.sections.map((s, i) => (
            <SectionBlock
              key={s.id}
              restaurantId={restaurantId}
              section={s}
              index={i}
              total={menu.sections.length}
              siblingIds={sectionIds}
            />
          ))}
        </div>
      )}

      {/* Ajouter une catégorie */}
      {addingSection ? (
        <AddSectionForm restaurantId={restaurantId} menuId={menu.id} onDone={() => setAddingSection(false)} />
      ) : (
        <button
          onClick={() => setAddingSection(true)}
          className="w-full rounded-2xl border border-dashed border-[var(--border2)] py-4 text-sm font-bold text-[var(--primary)] hover:bg-[var(--surface)]"
        >
          + Ajouter une catégorie
        </button>
      )}
    </div>
  );
}

function AddSectionForm({
  restaurantId,
  menuId,
  onDone,
}: {
  restaurantId: string;
  menuId: string;
  onDone: () => void;
}) {
  const [state, action] = useActionState<MenuActionState, FormData>(
    upsertSectionAction.bind(null, restaurantId),
    {}
  );
  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);
  return (
    <form action={action} className="rounded-2xl border border-[var(--border2)] bg-[var(--surface)] p-4 space-y-2">
      <input type="hidden" name="menuId" value={menuId} />
      <div>
        <label className={labelCls}>Nom de la catégorie</label>
        <input name="name" type="text" required maxLength={80} placeholder="Entrées, Plats, Desserts…" className={inputCls} autoFocus />
      </div>
      <FormError error={state.error} />
      <div className="flex items-center gap-2">
        <button type="submit" className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-bold text-white hover:opacity-90">Ajouter</button>
        <button type="button" onClick={onDone} className="rounded-lg px-3 py-2 text-sm font-semibold text-[var(--text2)] hover:text-[var(--text)]">Annuler</button>
      </div>
    </form>
  );
}
