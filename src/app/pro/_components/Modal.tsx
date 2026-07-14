'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * Modale légère (portal sur <body>) pour ouvrir un éditeur SANS navigation :
 * l'ouverture est instantanée (contenu déjà côté client), pas de chargement de
 * page. Fermeture par ✕, clic sur le fond, ou Échap. Verrouille le scroll du
 * fond tant qu'elle est ouverte.
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
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Focus la modale pour l'accessibilité clavier.
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-6"
      style={{ animation: 'fadeUp 0.15s ease-out both' }}
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
        className={`my-4 w-full ${maxWidth} rounded-2xl border border-[var(--border2)] bg-[var(--surface)] shadow-2xl outline-none`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border2)] p-5 sm:p-6">
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
        <div className="p-5 sm:p-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
