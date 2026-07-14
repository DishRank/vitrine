import type { EditorSection, EditorItem } from './menuData';

/** Ce qu'un draggable/droppable expose dans `data.current` (dnd-kit). */
export type DragData =
  | { type: 'section'; parentId: string | null; label: string }
  | { type: 'item'; sectionId: string; label: string }
  | { type: 'container'; sectionId: string };

/**
 * Transformations d'arbre PURES pour le glisser-déposer du menu (réordonner des
 * catégories, réordonner des plats, déplacer un plat d'une catégorie à l'autre).
 * Immuables (renvoient un nouvel arbre) et testables hors React — la couche UI
 * (MenuBoard) et les Server Actions (reorderAction/moveItemAction) consomment
 * leurs sorties. On borne la profondeur à 1 niveau, comme le reste de l'éditeur.
 */

/** Toutes les sections (racines + sous-catégories) à plat. */
export function flattenSections(roots: EditorSection[]): EditorSection[] {
  const out: EditorSection[] = [];
  for (const s of roots) {
    out.push(s);
    for (const c of s.children) out.push(c);
  }
  return out;
}

/** La section (racine ou sous-catégorie) portant cet id, ou null. */
export function findSection(roots: EditorSection[], id: string): EditorSection | null {
  return flattenSections(roots).find((s) => s.id === id) ?? null;
}

/** Les ids des catégories sœurs (même parent) de `sectionId`, dans l'ordre. */
export function siblingSectionIds(roots: EditorSection[], parentId: string | null): string[] {
  if (parentId === null) return roots.map((s) => s.id);
  return roots.find((r) => r.id === parentId)?.children.map((c) => c.id) ?? [];
}

/** La catégorie contenant ce plat + son index dedans, ou null. */
export function findItemLocation(
  roots: EditorSection[],
  itemId: string
): { sectionId: string; index: number } | null {
  for (const s of flattenSections(roots)) {
    const index = s.items.findIndex((it) => it.id === itemId);
    if (index >= 0) return { sectionId: s.id, index };
  }
  return null;
}

/** parent_section_id d'une catégorie (null = racine), ou undefined si absente. */
export function parentOf(roots: EditorSection[], sectionId: string): string | null | undefined {
  const s = flattenSections(roots).find((x) => x.id === sectionId);
  return s?.parent_section_id;
}

/** arrayMove immuable : déplace l'élément d'`from` vers `to`. */
export function arrayMove<T>(list: T[], from: number, to: number): T[] {
  const next = list.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** Réordonne un groupe de catégories sœurs (même parent) selon `orderedIds`. */
export function applySectionOrder(
  roots: EditorSection[],
  parentId: string | null,
  orderedIds: string[]
): EditorSection[] {
  if (parentId === null) return sortByIds(roots, orderedIds);
  return roots.map((r) =>
    r.id === parentId ? { ...r, children: sortByIds(r.children, orderedIds) } : r
  );
}

/** Réordonne les plats d'UNE catégorie selon `orderedItemIds`. */
export function applyItemOrder(
  roots: EditorSection[],
  sectionId: string,
  orderedItemIds: string[]
): EditorSection[] {
  return mapSections(roots, (s) =>
    s.id === sectionId ? { ...s, items: sortByIds(s.items, orderedItemIds) } : s
  );
}

/**
 * Déplace un plat vers `toSectionId` à l'index `toIndex`. Retire de sa catégorie
 * d'origine, met à jour son `section_id`, insère à la position voulue. No-op si
 * le plat est introuvable. `toIndex` est borné à la taille cible.
 */
export function applyItemMove(
  roots: EditorSection[],
  itemId: string,
  toSectionId: string,
  toIndex: number
): EditorSection[] {
  const loc = findItemLocation(roots, itemId);
  if (!loc) return roots;
  const moved = findSection(roots, loc.sectionId)?.items.find((it) => it.id === itemId);
  if (!moved) return roots;
  const item: EditorItem = { ...moved, section_id: toSectionId };
  // 1) retirer le plat de sa catégorie d'origine…
  const stripped = mapSections(roots, (s) =>
    s.items.some((it) => it.id === itemId) ? { ...s, items: s.items.filter((it) => it.id !== itemId) } : s
  );
  // 2) …puis l'insérer dans la catégorie cible à l'index voulu.
  return mapSections(stripped, (s) => {
    if (s.id !== toSectionId) return s;
    const clamped = Math.max(0, Math.min(toIndex, s.items.length));
    const items = s.items.slice();
    items.splice(clamped, 0, item);
    return { ...s, items };
  });
}

// ── internes ──────────────────────────────────────────────────────────────
/** Applique `fn` à chaque section (racines + enfants), immuable. */
function mapSections(
  roots: EditorSection[],
  fn: (s: EditorSection) => EditorSection
): EditorSection[] {
  return roots.map((r) => {
    const mappedChildren = r.children.map(fn);
    const childrenChanged = mappedChildren.some((c, i) => c !== r.children[i]);
    const base = childrenChanged ? { ...r, children: mappedChildren } : r;
    return fn(base);
  });
}

/** Retrie `list` selon l'ordre de `orderedIds` (les absents finissent à la queue). */
function sortByIds<T extends { id: string }>(list: T[], orderedIds: string[]): T[] {
  const pos = new Map(orderedIds.map((id, i) => [id, i]));
  return list
    .slice()
    .sort((a, b) => (pos.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (pos.get(b.id) ?? Number.MAX_SAFE_INTEGER));
}
