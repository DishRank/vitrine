import type { EditorSection } from './menuData';

/**
 * Sources sélectionnables pour les crans d'une formule (sections + plats).
 *
 * ⚠️ Ce module est importé par des composants CLIENT (MenuEditor). Il ne doit
 * donc RIEN importer de serveur — d'où le `import type` de EditorSection
 * (effacé à la compilation), au lieu d'importer depuis menuData.ts qui, lui,
 * dépend de next/headers via supabaseServer.
 */
export interface FormulaSources {
  sections: { id: string; name: string }[];
  items: { id: string; name: string; sectionName: string }[];
}

/** Aplati l'arbre (sections + sous-sections) en sources : toutes les sections,
 *  et tous les PLATS (kind='item', jamais les formules elles-mêmes). */
export function collectFormulaSources(sections: EditorSection[]): FormulaSources {
  const out: FormulaSources = { sections: [], items: [] };
  const walk = (list: EditorSection[]) => {
    for (const s of list) {
      out.sections.push({ id: s.id, name: s.name });
      for (const it of s.items) {
        if (it.kind === 'item') out.items.push({ id: it.id, name: it.name, sectionName: s.name });
      }
      if (s.children.length) walk(s.children);
    }
  };
  walk(sections);
  return out;
}
