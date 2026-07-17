'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  deleteSectionAction,
  setSectionVisibleAction,
  upsertSectionAction,
  deleteItemAction,
  setItemFlagAction,
  type MenuActionState,
} from './menuActions';
import type { EditorSection, EditorItem, MenuItemI18n } from './menuData';
import type { FormulaSources } from './menuSources';
import type { DragData } from './menuDnd';
import FlagIcon from '@/components/FlagIcon';
import { ALLERGEN_LABEL, DIET_LABEL, formatPrice } from './vocab';
import ItemForm from './ItemForm';
import FormulaForm from './FormulaForm';
import PhotoControl from './PhotoControl';
import Modal from '../../../_components/Modal';
import ConfirmDialog from '../../../_components/ConfirmDialog';
import { inputCls, labelCls, FormError } from '../../../_components/fields';

export default function SectionBlock({
  restaurantId,
  menuId,
  section,
  sources,
  menuLanguages,
  premium,
  initialEditItemId,
  isChild = false,
}: {
  restaurantId: string;
  menuId: string;
  section: EditorSection;
  sources: FormulaSources;
  menuLanguages: string[];
  premium: boolean;
  /** Deep-link `?edit=<id>` : ouvre la modale d'édition si le plat est ici. */
  initialEditItemId?: string;
  /** Sous-catégorie : pas de « + Sous-catégorie » (profondeur bornée à 1). */
  isChild?: boolean;
}) {
  const [pending, start] = useTransition();
  const [editingSection, setEditingSection] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [addingFormula, setAddingFormula] = useState(false);
  const [addingSub, setAddingSub] = useState(false);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [editFormulaId, setEditFormulaId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{ title: string; message: React.ReactNode; action: () => void } | null>(null);
  const [err, setErr] = useState('');

  // Deep-link « Créer ce plat » (?edit=<id>) : ouvre la modale d'édition si le
  // plat est dans CETTE catégorie (une seule y correspond). On nettoie l'URL
  // sans re-fetch (history.replaceState) → le param a joué son rôle.
  useEffect(() => {
    if (initialEditItemId && section.items.some((it) => it.id === initialEditItemId && it.kind === 'item')) {
      setEditItemId(initialEditItemId);
      window.history.replaceState(null, '', window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialEditItemId]);

  // La catégorie est déplaçable (poignée dans l'en-tête) parmi ses sœurs…
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
    data: { type: 'section', parentId: section.parent_section_id ?? null, label: section.name } satisfies DragData,
  });
  // …et sert de zone de dépôt pour les plats (y compris quand elle est vide).
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `container:${section.id}`,
    data: { type: 'container', sectionId: section.id } satisfies DragData,
  });

  const run = (p: Promise<MenuActionState>) =>
    start(async () => {
      setErr('');
      const r = await p;
      if (r.error) setErr(r.error);
    });

  const editingItem = editItemId ? section.items.find((it) => it.id === editItemId) : undefined;
  const editingFormula = editFormulaId ? section.items.find((it) => it.id === editFormulaId) : undefined;

  const itemIds = section.items.map((i) => i.id);
  const childIds = section.children.map((c) => c.id);
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <section
      ref={setNodeRef}
      style={style}
      className={`overflow-hidden rounded-2xl border bg-[var(--surface)] ${isDragging ? 'z-10 border-[var(--primary)] shadow-[0_12px_32px_var(--card-shadow)]' : 'border-[var(--border2)]'} ${section.is_visible ? '' : 'opacity-60'}`}
    >
      {/* En-tête de catégorie */}
      <header className="flex items-start justify-between gap-2 border-b border-[var(--border2)] bg-[var(--surface-var)]/40 p-4">
        <div className="flex min-w-0 items-start gap-2">
          <DragHandle attributes={attributes} listeners={listeners} label="Déplacer la catégorie" />
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 font-extrabold">
              <span className="truncate">{section.name}</span>
              {!section.is_visible ? (
                <span className="shrink-0 rounded-full bg-[var(--surface-var)] px-2 py-0.5 text-[11px] font-bold text-[var(--text3)]">Masquée</span>
              ) : null}
            </h3>
            {section.description ? <p className="mt-0.5 text-sm text-[var(--text2)]">{section.description}</p> : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <IconBtn
            title={section.is_visible ? 'Masquer sur le menu' : 'Afficher sur le menu'}
            disabled={pending}
            onClick={() => run(setSectionVisibleAction(restaurantId, section.id, !section.is_visible))}
          >
            {section.is_visible ? <Eye /> : <EyeOff />}
          </IconBtn>
          <IconBtn title="Renommer la catégorie" onClick={() => setEditingSection(true)}>
            <Pencil />
          </IconBtn>
          <IconBtn
            title="Supprimer la catégorie"
            danger
            disabled={pending}
            onClick={() =>
              setConfirming({
                title: 'Supprimer la catégorie',
                message: (
                  <>
                    La catégorie <strong className="text-[var(--text)]">« {section.name} »</strong>
                    {section.items.length > 0 ? ` et ses ${section.items.length} plat${section.items.length > 1 ? 's' : ''}` : ''} seront supprimés. Cette action est définitive.
                  </>
                ),
                action: () => run(deleteSectionAction(restaurantId, section.id)),
              })
            }
          >
            <Trash />
          </IconBtn>
        </div>
      </header>

      {/* Plats (zone de dépôt) */}
      <div ref={setDropRef} className={isOver ? 'bg-[var(--primary-container)]/40' : ''}>
        {section.items.length > 0 ? (
          <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
            <ul className="divide-y divide-[var(--border2)]">
              {section.items.map((it) => (
                <SortableItemRow
                  key={it.id}
                  restaurantId={restaurantId}
                  sectionId={section.id}
                  item={it}
                  pending={pending}
                  onEdit={() => (it.kind === 'formula' ? setEditFormulaId(it.id) : setEditItemId(it.id))}
                  onToggleAvailable={() => run(setItemFlagAction(restaurantId, it.id, 'is_available', !it.is_available))}
                  onDelete={() =>
                    setConfirming({
                      title: it.kind === 'formula' ? 'Supprimer la formule' : 'Supprimer le plat',
                      message: (
                        <>
                          <strong className="text-[var(--text)]">« {it.name} »</strong> sera définitivement supprimé de votre carte.
                        </>
                      ),
                      action: () => run(deleteItemAction(restaurantId, it.id)),
                    })
                  }
                />
              ))}
            </ul>
          </SortableContext>
        ) : (
          <p className={`px-4 py-6 text-center text-sm ${isOver ? 'text-[var(--primary)]' : 'text-[var(--text3)]'}`}>
            {isOver ? 'Déposer le plat ici' : 'Aucun plat. Ajoutez-en un, ou glissez-en un ici.'}
          </p>
        )}
      </div>

      {/* Ajouter un plat / une formule / une sous-catégorie */}
      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border2)] p-3">
        <button
          onClick={() => setAddingItem(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90"
        >
          <Plus /> Ajouter un plat
        </button>
        <button
          onClick={() => setAddingFormula(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border2)] px-3 py-2 text-sm font-semibold text-[var(--text2)] transition-colors hover:border-[var(--primary)] hover:text-[var(--text)]"
        >
          <Plus /> Formule
        </button>
        {!isChild ? (
          <button
            onClick={() => setAddingSub(true)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-[var(--text2)] transition-colors hover:text-[var(--primary)]"
          >
            <Plus /> Sous-catégorie
          </button>
        ) : null}
      </div>

      {/* Sous-catégories (1 niveau) — réordonnables entre elles */}
      {!isChild && (section.children.length > 0 || addingSub) ? (
        <div className="space-y-3 border-t border-[var(--border2)] bg-[var(--bg)]/50 p-4 pl-5 sm:pl-6">
          <SortableContext items={childIds} strategy={verticalListSortingStrategy}>
            {section.children.map((child) => (
              <SectionBlock
                key={child.id}
                restaurantId={restaurantId}
                menuId={menuId}
                section={child}
                sources={sources}
                menuLanguages={menuLanguages}
                premium={premium}
                initialEditItemId={initialEditItemId}
                isChild
              />
            ))}
          </SortableContext>
          {addingSub ? (
            <AddSubSectionForm restaurantId={restaurantId} menuId={menuId} parentId={section.id} onDone={() => setAddingSub(false)} />
          ) : null}
        </div>
      ) : null}

      {err ? <p className="px-4 pb-3 text-[13px] font-medium text-red-500">{err}</p> : null}

      {/* ── Modales d'édition (centrées, sans décaler la liste) ─────────────── */}
      <Modal open={addingItem} onClose={() => setAddingItem(false)} title="Ajouter un plat" maxWidth="max-w-2xl">
        <ItemForm
          restaurantId={restaurantId}
          sectionId={section.id}
          onDone={() => setAddingItem(false)}
          menuLanguages={menuLanguages}
          premium={premium}
        />
      </Modal>
      <Modal open={!!editingItem} onClose={() => setEditItemId(null)} title="Modifier le plat" maxWidth="max-w-2xl">
        {editingItem ? (
          <ItemForm
            restaurantId={restaurantId}
            sectionId={section.id}
            item={editingItem}
            onDone={() => setEditItemId(null)}
            menuLanguages={menuLanguages}
            premium={premium}
          />
        ) : null}
      </Modal>

      <Modal open={addingFormula} onClose={() => setAddingFormula(false)} title="Ajouter une formule" maxWidth="max-w-2xl">
        <FormulaForm restaurantId={restaurantId} sectionId={section.id} sources={sources} onDone={() => setAddingFormula(false)} />
      </Modal>
      <Modal open={!!editingFormula} onClose={() => setEditFormulaId(null)} title="Modifier la formule" maxWidth="max-w-2xl">
        {editingFormula ? (
          <FormulaForm restaurantId={restaurantId} sectionId={section.id} item={editingFormula} sources={sources} onDone={() => setEditFormulaId(null)} />
        ) : null}
      </Modal>

      <Modal open={editingSection} onClose={() => setEditingSection(false)} title="Renommer la catégorie" maxWidth="max-w-md">
        <SectionForm
          restaurantId={restaurantId}
          section={section}
          menuLanguages={menuLanguages}
          premium={premium}
          onDone={() => setEditingSection(false)}
        />
      </Modal>

      <ConfirmDialog
        open={!!confirming}
        title={confirming?.title ?? ''}
        message={confirming?.message ?? ''}
        confirmLabel="Supprimer"
        onConfirm={() => confirming?.action()}
        onClose={() => setConfirming(null)}
      />
    </section>
  );
}

/** Une ligne de plat, déplaçable (poignée de glissement à gauche). */
function SortableItemRow({
  restaurantId,
  sectionId,
  item,
  pending,
  onEdit,
  onToggleAvailable,
  onDelete,
}: {
  restaurantId: string;
  sectionId: string;
  item: EditorItem;
  pending: boolean;
  onEdit: () => void;
  onToggleAvailable: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    data: { type: 'item', sectionId, label: item.name } satisfies DragData,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-start gap-2 p-4 ${isDragging ? 'rounded-xl bg-[var(--surface-var)] opacity-80' : 'transition-colors hover:bg-[var(--surface-var)]/30'}`}
    >
      <DragHandle attributes={attributes} listeners={listeners} label="Déplacer le plat" />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={`font-bold ${item.is_visible ? '' : 'text-[var(--text3)] line-through'}`}>{item.name}</span>
          {item.kind === 'formula' ? (
            <span className="rounded-full bg-[var(--primary-container)] px-2 py-0.5 text-[11px] font-bold text-[var(--primary)]">Formule</span>
          ) : null}
          {item.price != null ? <span className="tabular text-sm font-semibold text-[var(--text2)]">{formatPrice(item.price, item.currency)}</span> : null}
          {item.is_signature ? <span className="text-xs font-bold text-[var(--primary)]">⭐ Signature</span> : null}
          {!item.is_available ? <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-bold text-red-500">Épuisé</span> : null}
        </div>
        {item.description ? <p className="mt-0.5 text-sm text-[var(--text2)] line-clamp-2">{item.description}</p> : null}
        {item.allergens.length || item.diet_tags.length ? (
          <p className="mt-1 text-xs text-[var(--text3)]">
            {[...item.diet_tags.map((d) => DIET_LABEL[d] ?? d), ...item.allergens.map((a) => `⚠ ${ALLERGEN_LABEL[a] ?? a}`)].join(' · ')}
          </p>
        ) : null}
        {item.kind === 'item' ? (
          <div className="mt-2">
            <PhotoControl restaurantId={restaurantId} itemId={item.id} photoUrl={item.photo_url} />
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <div className="flex items-center gap-0.5">
          <IconBtn title={item.kind === 'formula' ? 'Modifier la formule' : 'Modifier le plat'} onClick={onEdit}>
            <Pencil />
          </IconBtn>
          <IconBtn title="Supprimer" danger disabled={pending} onClick={onDelete}>
            <Trash />
          </IconBtn>
        </div>
        <button
          onClick={onToggleAvailable}
          disabled={pending}
          className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-50 ${
            item.is_available
              ? 'border-[var(--border2)] text-[var(--text2)] hover:border-[var(--primary)] hover:text-[var(--text)]'
              : 'border-[var(--accent-success)]/40 bg-[var(--accent-success)]/10 text-[var(--accent-success)]'
          }`}
        >
          {item.is_available ? 'Marquer épuisé' : 'Remettre dispo'}
        </button>
      </div>
    </li>
  );
}

/** Poignée de glissement (bouton dédié → n'entre pas en conflit avec les clics). */
function DragHandle({
  attributes,
  listeners,
  label,
}: {
  attributes: ReturnType<typeof useSortable>['attributes'];
  listeners: ReturnType<typeof useSortable>['listeners'];
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...attributes}
      {...listeners}
      className="mt-0.5 flex h-7 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded text-[var(--text3)] transition-colors hover:bg-[var(--surface-var)] hover:text-[var(--text2)] active:cursor-grabbing"
    >
      <Grip />
    </button>
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

// Traduction manuelle par catégorie (onglets). fr = source (colonnes name/description).
const TRANSLATABLE = ['en', 'es', 'de', 'it'];
const LANG_LABEL: Record<string, string> = { en: 'Anglais', es: 'Espagnol', de: 'Allemand', it: 'Italien' };

/** Formulaire de renommage/description de catégorie (dans une modale). Onglets de
 *  langue (parité plat) : le français est la source ; chaque langue activée a son
 *  onglet pour éditer/corriger la traduction du nom et de la description de la
 *  sous-catégorie. Restreint à EN pour un resto gratuit (es/de/it premium). */
function SectionForm({
  restaurantId,
  section,
  menuLanguages,
  premium,
  onDone,
}: {
  restaurantId: string;
  section: EditorSection;
  menuLanguages: string[];
  premium: boolean;
  onDone: () => void;
}) {
  const [state, action] = useActionState<MenuActionState, FormData>(
    upsertSectionAction.bind(null, restaurantId),
    {}
  );
  const editable = (premium ? menuLanguages : menuLanguages.filter((l) => l === 'en')).filter((l) =>
    TRANSLATABLE.includes(l)
  );
  const [tab, setTab] = useState<string>('fr');
  const [i18n, setI18n] = useState<MenuItemI18n>(() => ({ ...(section.i18n ?? {}) }));
  // Édition manuelle d'une locale → on retire `_auto`/`_h` : l'entrée devient
  // « manuelle », l'auto-trad ne la réécrit plus jamais (contrat mig 085).
  const setLoc = (loc: string, field: 'name' | 'description', value: string) =>
    setI18n((prev) => {
      const cur = prev[loc] ?? {};
      return {
        ...prev,
        [loc]: {
          name: field === 'name' ? value : cur.name,
          description: field === 'description' ? value : cur.description,
        },
      };
    });
  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);
  const pill = (on: boolean) =>
    `rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
      on
        ? 'border-[var(--primary)] bg-[var(--primary-container)] text-[var(--primary)]'
        : 'border-[var(--border2)] text-[var(--text2)] hover:border-[var(--primary)]'
    }`;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={section.id} />

      {/* Onglets de langue — traduction manuelle de la catégorie (nom + description). */}
      {editable.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={() => setTab('fr')} className={pill(tab === 'fr')}>
            <FlagIcon code="fr" size={15} style={{ verticalAlign: '-2px', marginRight: 5 }} />
            Français <span className="font-normal opacity-60">· source</span>
          </button>
          {editable.map((l) => {
            const filled = !!i18n[l]?.name?.trim();
            return (
              <button key={l} type="button" onClick={() => setTab(l)} className={pill(tab === l)}>
                <FlagIcon code={l} size={15} style={{ verticalAlign: '-2px', marginRight: 5 }} />
                {LANG_LABEL[l]}{' '}
                {filled ? (
                  <span className="font-bold text-[var(--accent-success)]">✓</span>
                ) : (
                  <span className="font-normal opacity-60">· à traduire</span>
                )}
              </button>
            );
          })}
        </div>
      ) : null}

      <div>
        <label className={labelCls}>{tab === 'fr' ? 'Nom de la catégorie' : `Nom · ${LANG_LABEL[tab]}`}</label>
        {/* Source FR — toujours soumise (name="name") ; masquée hors onglet fr. Pas
            de `required` (un champ caché requis bloquerait le submit ; le serveur valide). */}
        <input
          name="name"
          type="text"
          maxLength={80}
          defaultValue={section.name}
          className={inputCls}
          autoFocus
          style={tab === 'fr' ? undefined : { display: 'none' }}
        />
        {tab !== 'fr' ? (
          <input
            key={tab}
            type="text"
            maxLength={200}
            value={i18n[tab]?.name ?? ''}
            onChange={(e) => setLoc(tab, 'name', e.target.value)}
            placeholder={section.name || 'Traduction du nom…'}
            className={inputCls}
          />
        ) : null}
      </div>
      <div>
        <label className={labelCls}>{tab === 'fr' ? 'Description (optionnel)' : `Description · ${LANG_LABEL[tab]}`}</label>
        <input
          name="description"
          type="text"
          maxLength={200}
          defaultValue={section.description ?? ''}
          placeholder="Ex. Faites maison, servies avec…"
          className={inputCls}
          style={tab === 'fr' ? undefined : { display: 'none' }}
        />
        {tab !== 'fr' ? (
          <input
            key={tab}
            type="text"
            maxLength={1000}
            value={i18n[tab]?.description ?? ''}
            onChange={(e) => setLoc(tab, 'description', e.target.value)}
            placeholder={section.description || 'Traduction de la description…'}
            className={inputCls}
          />
        ) : null}
      </div>

      <input type="hidden" name="i18n" value={JSON.stringify(i18n)} />

      <FormError error={state.error} />
      <div className="flex items-center gap-2">
        <button type="submit" className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-bold text-white hover:opacity-90">Enregistrer</button>
        <button type="button" onClick={onDone} className="rounded-lg px-3 py-2 text-sm font-semibold text-[var(--text2)] hover:text-[var(--text)]">Annuler</button>
      </div>
    </form>
  );
}

// ── Bouton-icône compact + jeu d'icônes (stroke, currentColor) ───────────────
function IconBtn({
  title,
  onClick,
  disabled,
  danger,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text2)] transition-colors disabled:opacity-30 ${
        danger ? 'hover:bg-red-500/10 hover:text-red-500' : 'hover:bg-[var(--surface-var)] hover:text-[var(--text)]'
      }`}
    >
      {children}
    </button>
  );
}

type P = { className?: string };
const svg = (children: React.ReactNode) => {
  const Icon = (p: P) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className} aria-hidden>
      {children}
    </svg>
  );
  return Icon;
};
const Pencil = svg(<><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>);
const Trash = svg(<><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" /></>);
const Eye = svg(<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>);
const EyeOff = svg(<><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20C5 20 1 12 1 12a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12A3 3 0 1 1 9.88 9.88" /><path d="M1 1l22 22" /></>);
const Plus = svg(<><path d="M12 5v14" /><path d="M5 12h14" /></>);
const Grip = svg(<><circle cx="9" cy="6" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="9" cy="18" r="1" /><circle cx="15" cy="6" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="18" r="1" /></>);
