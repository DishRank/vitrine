'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { reorderAction, moveItemAction } from './menuActions';
import type { EditorMenu, EditorSection } from './menuData';
import type { FormulaSources } from './menuSources';
import {
  applyItemMove,
  applyItemOrder,
  applySectionOrder,
  arrayMove,
  findSection,
  parentOf,
  siblingSectionIds,
  type DragData,
} from './menuDnd';
import SectionBlock from './SectionBlock';

/**
 * Instantané COMPLET de l'arbre serveur : ordre ET tout champ rendu (visibilité,
 * nom, prix, dispo, signature, updated_at…). Indispensable — sinon une mutation
 * qui ne change pas l'ordre (bouton œil, renommer, épuisé, édition d'un plat) ne
 * re-synchronise pas l'état local optimiste et « ne fait rien » à l'écran. Pendant
 * la fenêtre optimiste d'un drag, les props ne sont pas encore revalidées → la
 * signature reste identique → l'ordre optimiste n'est pas écrasé prématurément.
 */
function signature(sections: EditorSection[]): string {
  return JSON.stringify(sections);
}

/**
 * Orchestrateur glisser-déposer du menu. Détient l'état local optimiste de
 * l'arbre (réordonnancement instantané à l'écran) puis persiste via les Server
 * Actions. Un seul DndContext englobe TOUTES les catégories → un plat peut être
 * traîné d'une catégorie vers une autre. Les catégories se réordonnent entre
 * sœurs (racines entre elles, sous-catégories dans leur parent).
 *
 * Le tri par boutons ↑/↓ est remplacé par des poignées de glissement ; l'accès
 * clavier est assuré par le KeyboardSensor de dnd-kit (Espace pour saisir,
 * flèches pour déplacer, Espace pour déposer).
 */
export default function MenuBoard({
  restaurantId,
  menu,
  sources,
}: {
  restaurantId: string;
  menu: EditorMenu;
  sources: FormulaSources;
}) {
  const [sections, setSections] = useState<EditorSection[]>(menu.sections);
  const [active, setActive] = useState<DragData | null>(null);
  const [, startTransition] = useTransition();
  const [err, setErr] = useState('');

  // Re-synchronise sur les données serveur quand elles changent réellement
  // (ajout/suppression de plat, édition ailleurs) — mais pas après nos propres
  // commits (l'optimiste matche déjà, donc la signature est identique).
  const serverSig = signature(menu.sections);
  const lastSig = useRef(serverSig);
  useEffect(() => {
    if (serverSig !== lastSig.current) {
      lastSig.current = serverSig;
      setSections(menu.sections);
    }
  }, [serverSig, menu.sections]);

  const sensors = useSensors(
    // distance 6px : un clic sur un bouton/poignée n'enclenche pas un drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // appui long 200ms sur mobile → le scroll de la page reste possible.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Un drag de catégorie ne cible que des catégories ; un drag de plat ne cible
  // que des plats + conteneurs de catégorie → aucune interférence croisée. On
  // privilégie `pointerWithin` (position réelle du curseur → précis même avec
  // de grandes catégories imbriquées) et on retombe sur `closestCorners` quand
  // le curseur n'est au-dessus d'aucune cible (bords, clavier).
  const collision: CollisionDetection = (args) => {
    const t = (args.active.data.current as DragData | undefined)?.type;
    const droppableContainers = args.droppableContainers.filter((c) => {
      const ct = (c.data.current as DragData | undefined)?.type;
      return t === 'section' ? ct === 'section' : ct === 'item' || ct === 'container';
    });
    const scoped = { ...args, droppableContainers };
    const hits = pointerWithin(scoped);
    return hits.length > 0 ? hits : closestCorners(scoped);
  };

  const commit = (p: Promise<{ error?: string }>) =>
    startTransition(async () => {
      const r = await p;
      if (r?.error) setErr(r.error);
    });

  const onDragStart = (e: DragStartEvent) => {
    setErr('');
    setActive((e.active.data.current as DragData | undefined) ?? null);
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActive(null);
    const { active: a, over } = e;
    if (!over) return;
    const aData = a.data.current as DragData | undefined;
    const oData = over.data.current as DragData | undefined;
    if (!aData || !oData) return;

    if (aData.type === 'section') {
      const overSectionId = oData.type === 'section' ? String(over.id) : oData.type === 'container' ? oData.sectionId : null;
      if (!overSectionId || overSectionId === String(a.id)) return;
      const parentId = aData.parentId;
      // On ne déplace qu'entre sœurs de même parent (pas d'imbrication par drag).
      if (parentOf(sections, overSectionId) !== parentId) return;
      const ids = siblingSectionIds(sections, parentId);
      const from = ids.indexOf(String(a.id));
      const to = ids.indexOf(overSectionId);
      if (from < 0 || to < 0) return;
      const next = arrayMove(ids, from, to);
      setSections((s) => applySectionOrder(s, parentId, next));
      commit(reorderAction(restaurantId, 'menu_sections', next));
      return;
    }

    // aData.type === 'item'
    const fromSection = aData.sectionId;
    const toSection = oData.type === 'item' ? oData.sectionId : oData.type === 'container' ? oData.sectionId : null;
    if (!toSection) return;

    if (fromSection === toSection) {
      const ids = findSection(sections, fromSection)?.items.map((i) => i.id) ?? [];
      const from = ids.indexOf(String(a.id));
      let to = oData.type === 'item' ? ids.indexOf(String(over.id)) : ids.length - 1;
      if (from < 0) return;
      if (to < 0) to = ids.length - 1;
      if (from === to) return;
      const next = arrayMove(ids, from, to);
      setSections((s) => applyItemOrder(s, fromSection, next));
      commit(reorderAction(restaurantId, 'menu_items', next));
    } else {
      const targetIds = findSection(sections, toSection)?.items.map((i) => i.id) ?? [];
      let insertIndex = oData.type === 'item' ? targetIds.indexOf(String(over.id)) : targetIds.length;
      if (insertIndex < 0) insertIndex = targetIds.length;
      const nextTree = applyItemMove(sections, String(a.id), toSection, insertIndex);
      setSections(nextTree);
      const newOrder = findSection(nextTree, toSection)?.items.map((i) => i.id) ?? [];
      commit(moveItemAction(restaurantId, String(a.id), toSection, newOrder));
    }
  };

  const rootIds = useMemo(() => sections.map((s) => s.id), [sections]);

  return (
    <DndContext
      // id stable : sinon dnd-kit génère des `aria-describedby` (DndDescribedBy-N)
      // au compteur, différents entre SSR et client → mismatch d'hydratation.
      id="menu-board"
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActive(null)}
    >
      <SortableContext items={rootIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {sections.map((s) => (
            <SectionBlock key={s.id} restaurantId={restaurantId} menuId={menu.id} section={s} sources={sources} />
          ))}
        </div>
      </SortableContext>

      {/* Aperçu qui suit le curseur pendant le glissement. */}
      <DragOverlay dropAnimation={null}>
        {active ? (
          <div className="pointer-events-none rounded-xl border border-[var(--primary)] bg-[var(--surface)] px-3 py-2 text-sm font-bold shadow-[0_12px_32px_var(--card-shadow)]">
            {active.type === 'container' ? '' : active.label}
          </div>
        ) : null}
      </DragOverlay>

      {err ? <p className="mt-2 text-[13px] font-medium text-red-500">{err}</p> : null}
    </DndContext>
  );
}
