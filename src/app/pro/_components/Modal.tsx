'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * Modale légère (portal sur <body>) pour ouvrir un éditeur SANS navigation :
 * l'ouverture est instantanée (contenu déjà côté client), pas de chargement de
 * page. Fermeture par ✕, clic sur le fond, ou Échap. Centrée à l'écran et
 * scroll du fond bloqué tant qu'elle est ouverte.
 *
 * Blocage du scroll : dans le shell /pro le conteneur qui scrolle est <main>
 * (cadre d'app), pas <body>. On verrouille donc TOUT scroll container ancêtre
 * (overflow-y auto/scroll) via `overflow:hidden`, plus body en filet. Le
 * `overscroll-contain` sur le corps de la modale empêche en outre le
 * scroll-chaining de propager la molette au fond une fois arrivé en butée.
 */
export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'max-w-3xl',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);

    // Verrouille chaque conteneur scrollable de la page (le vrai scroll du
    // shell /pro vit dans <main>, pas dans <body>) + <body> en filet.
    const locked: { el: HTMLElement; prev: string }[] = [];
    const lock = (el: HTMLElement | null) => {
      if (!el) return;
      locked.push({ el, prev: el.style.overflow });
      el.style.overflow = 'hidden';
    };
    lock(document.body);
    document.querySelectorAll<HTMLElement>('main, [data-scroll-lock]').forEach((el) => {
      const oy = getComputedStyle(el).overflowY;
      if (oy === 'auto' || oy === 'scroll') lock(el);
    });

    // Focus la modale pour l'accessibilité clavier — SAUF si un champ interne a
    // déjà pris le focus (autoFocus d'un formulaire), qu'on ne veut pas voler.
    if (!panelRef.current?.contains(document.activeElement)) panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      locked.forEach(({ el, prev }) => {
        el.style.overflow = prev;
      });
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 sm:p-6"
      style={{ animation: 'fadeIn 0.15s ease-out both' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        // flex column + max-h : centrée, et si le contenu dépasse la hauteur
        // de l'écran c'est le CORPS qui scrolle (l'en-tête reste visible).
        className={`flex max-h-[calc(100dvh-2rem)] w-full ${maxWidth} flex-col rounded-2xl border border-[var(--border2)] bg-[var(--surface)] shadow-2xl outline-none`}
        style={{ animation: 'fadeUp 0.15s ease-out both' }}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--border2)] p-5 sm:p-6">
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold tracking-tight">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-sm text-[var(--text2)]">{subtitle}</p> : null}
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="shrink-0 rounded-lg p-2 text-[var(--text2)] transition-colors hover:bg-[var(--surface-var)] hover:text-[var(--text)]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain p-5 sm:p-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
