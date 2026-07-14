'use client';

import { useSyncExternalStore } from 'react';
import type { SaveStatus } from './useAutoSave';

/**
 * Store client minimal pour partager l'état d'auto-save entre un formulaire
 * (ex. la fiche, dans le contenu) et l'en-tête du workspace (dans le layout,
 * un autre sous-arbre) → « Enregistré ✓ » s'affiche à côté du titre.
 */
let current: SaveStatus = 'idle';
const listeners = new Set<() => void>();

export function setSaveStatus(next: SaveStatus) {
  if (next === current) return;
  current = next;
  listeners.forEach((l) => l());
}

export function useSaveStatus(): SaveStatus {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => 'idle',
  );
}
