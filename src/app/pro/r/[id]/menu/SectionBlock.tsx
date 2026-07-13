'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import {
  deleteSectionAction,
  setSectionVisibleAction,
  upsertSectionAction,
  deleteItemAction,
  setItemFlagAction,
  reorderAction,
  type MenuActionState,
} from './menuActions';
import type { EditorSection, EditorItem } from './menuData';
import { ALLERGEN_LABEL, DIET_LABEL, formatPrice } from './vocab';
import ItemForm from './ItemForm';
import PhotoControl from './PhotoControl';
import { inputCls, labelCls, FormError } from '../../../_components/fields';

export default function SectionBlock({
  restaurantId,
  menuId,
  section,
  index,
  total,
  siblingIds,
  isChild = false,
}: {
  restaurantId: string;
  menuId: string;
  section: EditorSection;
  index: number;
  total: number;
  siblingIds: string[];
  /** Sous-catégorie : pas de « + Sous-catégorie » (profondeur bornée à 1). */
  isChild?: boolean;
}) {
  const [pending, start] = useTransition();
  const [editingSection, setEditingSection] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [addingSub, setAddingSub] = useState(false);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [err, setErr] = useState('');

  const run = (p: Promise<MenuActionState>) =>
    start(async () => {
      setErr('');
      const r = await p;
      if (r.error) setErr(r.error);
    });

  const moveSection = (dir: -1 | 1) => {
    const next = [...siblingIds];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    run(reorderAction(restaurantId, 'menu_sections', next));
  };

  const moveItem = (items: EditorItem[], i: number, dir: -1 | 1) => {
    const ids = items.map((it) => it.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    run(reorderAction(restaurantId, 'menu_items', ids));
  };

  return (
    <section className={`rounded-2xl border border-[var(--border2)] bg-[var(--surface)] ${section.is_visible ? '' : 'opacity-60'}`}>
      {/* En-tête de catégorie */}
      <header className="flex items-start justify-between gap-3 p-4 border-b border-[var(--border2)]">
        {editingSection ? (
          <SectionForm
            restaurantId={restaurantId}
            section={section}
            onDone={() => setEditingSection(false)}
          />
        ) : (
          <>
            <div className="min-w-0">
              <h3 className="font-extrabold truncate">
                {section.name}
                {!section.is_visible ? <span className="ml-2 text-xs font-semibold text-[var(--text3)]">(masquée)</span> : null}
              </h3>
              {section.description ? <p className="text-sm text-[var(--text2)] truncate">{section.description}</p> : null}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button title="Monter" disabled={pending || index === 0} onClick={() => moveSection(-1)} className="rounded p-1 text-[var(--text2)] hover:text-[var(--text)] disabled:opacity-30">↑</button>
              <button title="Descendre" disabled={pending || index === total - 1} onClick={() => moveSection(1)} className="rounded p-1 text-[var(--text2)] hover:text-[var(--text)] disabled:opacity-30">↓</button>
              <button onClick={() => run(setSectionVisibleAction(restaurantId, section.id, !section.is_visible))} disabled={pending} className="rounded px-2 py-1 text-xs font-semibold text-[var(--text2)] hover:text-[var(--primary)]">
                {section.is_visible ? 'Masquer' : 'Afficher'}
              </button>
              <button onClick={() => setEditingSection(true)} className="rounded px-2 py-1 text-xs font-semibold text-[var(--text2)] hover:text-[var(--primary)]">Renommer</button>
              <button
                onClick={() => { if (confirm(`Supprimer la catégorie « ${section.name} » et tous ses plats ?`)) run(deleteSectionAction(restaurantId, section.id)); }}
                disabled={pending}
                className="rounded px-2 py-1 text-xs font-semibold text-red-500 hover:underline"
              >Supprimer</button>
            </div>
          </>
        )}
      </header>

      {/* Plats */}
      <ul className="divide-y divide-[var(--border2)]">
        {section.items.map((it, i) => (
          <li key={it.id} className="p-4">
            {editItemId === it.id ? (
              <ItemForm restaurantId={restaurantId} sectionId={section.id} item={it} onDone={() => setEditItemId(null)} />
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-bold ${it.is_visible ? '' : 'text-[var(--text3)] line-through'}`}>{it.name}</span>
                    {it.price != null ? <span className="text-sm font-semibold text-[var(--text2)]">{formatPrice(it.price, it.currency)}</span> : null}
                    {it.is_signature ? <span className="text-xs font-bold text-[var(--primary)]">⭐ Signature</span> : null}
                    {!it.is_available ? <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-xs font-bold text-red-500">Épuisé</span> : null}
                  </div>
                  {it.description ? <p className="mt-0.5 text-sm text-[var(--text2)] line-clamp-2">{it.description}</p> : null}
                  {it.allergens.length || it.diet_tags.length ? (
                    <p className="mt-1 text-xs text-[var(--text3)]">
                      {[...it.diet_tags.map((d) => DIET_LABEL[d] ?? d), ...it.allergens.map((a) => `⚠ ${ALLERGEN_LABEL[a] ?? a}`)].join(' · ')}
                    </p>
                  ) : null}
                  {it.kind === 'item' ? (
                    <div className="mt-2">
                      <PhotoControl restaurantId={restaurantId} itemId={it.id} photoUrl={it.photo_url} />
                    </div>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <div className="flex items-center gap-1">
                    <button title="Monter" disabled={pending || i === 0} onClick={() => moveItem(section.items, i, -1)} className="rounded p-1 text-[var(--text2)] hover:text-[var(--text)] disabled:opacity-30">↑</button>
                    <button title="Descendre" disabled={pending || i === section.items.length - 1} onClick={() => moveItem(section.items, i, 1)} className="rounded p-1 text-[var(--text2)] hover:text-[var(--text)] disabled:opacity-30">↓</button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => run(setItemFlagAction(restaurantId, it.id, 'is_available', !it.is_available))} disabled={pending} className="text-xs font-semibold text-[var(--text2)] hover:text-[var(--primary)]">
                      {it.is_available ? 'Marquer épuisé' : 'Rendre dispo'}
                    </button>
                    {it.kind === 'formula' ? (
                      // Les formules (slots/suppléments) s'éditent dans l'app —
                      // l'éditeur web ne gère pas leur configuration (audit F1).
                      <span className="text-xs font-semibold text-[var(--text3)]" title="Éditable dans l'application">Formule</span>
                    ) : (
                      <button onClick={() => setEditItemId(it.id)} className="text-xs font-semibold text-[var(--primary)] hover:underline">Modifier</button>
                    )}
                    <button onClick={() => { if (confirm(`Supprimer « ${it.name} » ?`)) run(deleteItemAction(restaurantId, it.id)); }} disabled={pending} className="text-xs font-semibold text-red-500 hover:underline">Suppr.</button>
                  </div>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      {/* Ajouter un plat / une sous-catégorie */}
      <div className="p-4 pt-3">
        {addingItem ? (
          <ItemForm restaurantId={restaurantId} sectionId={section.id} onDone={() => setAddingItem(false)} />
        ) : (
          <div className="flex flex-wrap items-center gap-4">
            <button onClick={() => setAddingItem(true)} className="text-sm font-bold text-[var(--primary)] hover:underline">+ Ajouter un plat</button>
            {!isChild ? (
              <button onClick={() => setAddingSub(true)} className="text-sm font-semibold text-[var(--text2)] hover:text-[var(--primary)]">+ Sous-catégorie</button>
            ) : null}
          </div>
        )}
      </div>

      {/* Sous-catégories (1 niveau) */}
      {!isChild && (section.children.length > 0 || addingSub) ? (
        <div className="space-y-3 border-t border-[var(--border2)] bg-[var(--bg)]/50 p-4 pl-5 sm:pl-6">
          {section.children.map((child, ci) => (
            <SectionBlock
              key={child.id}
              restaurantId={restaurantId}
              menuId={menuId}
              section={child}
              index={ci}
              total={section.children.length}
              siblingIds={section.children.map((c) => c.id)}
              isChild
            />
          ))}
          {addingSub ? (
            <AddSubSectionForm restaurantId={restaurantId} menuId={menuId} parentId={section.id} onDone={() => setAddingSub(false)} />
          ) : null}
        </div>
      ) : null}

      {err ? <p className="px-4 pb-3 text-[13px] font-medium text-red-500">{err}</p> : null}
    </section>
  );
}

/** Formulaire compact d'ajout d'une sous-catégorie (parent_section_id posé). */
function AddSubSectionForm({
  restaurantId,
  menuId,
  parentId,
  onDone,
}: {
  restaurantId: string;
  menuId: string;
  parentId: string;
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
    <form action={action} className="rounded-xl border border-[var(--border2)] bg-[var(--surface)] p-3 space-y-2">
      <input type="hidden" name="menuId" value={menuId} />
      <input type="hidden" name="parentSectionId" value={parentId} />
      <label className={labelCls}>Nom de la sous-catégorie</label>
      <input name="name" type="text" required maxLength={80} placeholder="Rouges, Blancs, Au verre…" className={inputCls} autoFocus />
      <FormError error={state.error} />
      <div className="flex items-center gap-2">
        <button type="submit" className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-bold text-white hover:opacity-90">Ajouter</button>
        <button type="button" onClick={onDone} className="rounded-lg px-3 py-2 text-sm font-semibold text-[var(--text2)] hover:text-[var(--text)]">Annuler</button>
      </div>
    </form>
  );
}

/** Formulaire inline de renommage/description de catégorie. */
function SectionForm({
  restaurantId,
  section,
  onDone,
}: {
  restaurantId: string;
  section: EditorSection;
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
    <form action={action} className="w-full space-y-2">
      <input type="hidden" name="id" value={section.id} />
      <div>
        <label className={labelCls}>Nom de la catégorie</label>
        <input name="name" type="text" required maxLength={80} defaultValue={section.name} className={inputCls} autoFocus />
      </div>
      <div>
        <label className={labelCls}>Description (optionnel)</label>
        <input name="description" type="text" maxLength={200} defaultValue={section.description ?? ''} className={inputCls} />
      </div>
      <FormError error={state.error} />
      <div className="flex items-center gap-2">
        <button type="submit" className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-bold text-white hover:opacity-90">Enregistrer</button>
        <button type="button" onClick={onDone} className="rounded-lg px-3 py-2 text-sm font-semibold text-[var(--text2)] hover:text-[var(--text)]">Annuler</button>
      </div>
    </form>
  );
}
