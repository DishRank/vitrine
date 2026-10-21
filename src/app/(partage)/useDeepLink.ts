'use client';
import { useSyncExternalStore } from 'react';

const noop = () => () => {};

/**
 * Lien d'ouverture de l'app pour un chemin (`s/<jeton>`, `g/<code>`).
 * `dishrank://…` par défaut (rendu serveur) ; sur Android, une URL `intent://`
 * avec repli sur la page courante, pour éviter l'erreur de Chrome quand l'app
 * n'est pas installée (même mécanique que /join).
 */
export function useDeepLink(path: string | undefined): string | null {
  return useSyncExternalStore(
    noop,
    () => {
      if (!path) return null;
      if (!/Android/i.test(navigator.userAgent || '')) return `dishrank://${path}`;
      return `intent://${path}#Intent;scheme=dishrank;S.browser_fallback_url=${encodeURIComponent(window.location.href)};end`;
    },
    () => (path ? `dishrank://${path}` : null)
  );
}

/** Vrai sur iPhone / iPad (faux au rendu serveur). */
export function useIsIOS(): boolean {
  return useSyncExternalStore(
    noop,
    () => /iPhone|iPad|iPod/i.test(navigator.userAgent || ''),
    () => false
  );
}

/* Horloge partagée, rafraîchie toutes les 30 s (null au rendu serveur). */
let clock = 0;
const subscribeClock = (cb: () => void) => {
  clock = Date.now();
  const id = window.setInterval(() => {
    clock = Date.now();
    cb();
  }, 30_000);
  return () => window.clearInterval(id);
};

export function useNow(): number | null {
  return useSyncExternalStore(
    subscribeClock,
    () => clock || (clock = Date.now()),
    () => null
  );
}
