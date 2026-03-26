'use client';
import { useState, useEffect } from 'react';

export default function BetaModal() {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('open-beta', handler);
    return () => window.removeEventListener('open-beta', handler);
  }, []);

  const close = () => {
    setClosing(true);
    setTimeout(() => { setOpen(false); setClosing(false); }, 250);
  };

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 z-[300] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 ${closing ? 'animate-[fadeOut_0.25s_ease_forwards]' : 'animate-[fadeIn_0.2s_ease]'}`}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-[420px] p-6 sm:p-8 text-center ${closing ? 'animate-[sheetDown_0.25s_ease_forwards]' : 'animate-[slideUp_0.3s_ease]'}`}
      >
        {/* Badge beta */}
        <span className="inline-block px-3 py-1 text-xs font-bold bg-[var(--primary-container)] text-[var(--primary)] rounded-full mb-4">
          Version beta
        </span>

        <h2 className="text-xl font-extrabold mb-2">
          DishRank est en test
        </h2>

        <p className="text-sm text-[var(--text2)] mb-6 leading-relaxed">
          L&apos;app est actuellement en version de test sur le Play Store.
          Rejoins les premiers testeurs et aide-nous a construire le classement
          des meilleurs plats de Lyon !
        </p>

        {/* Bouton Play Store test */}
        <a
          href="https://play.google.com/apps/testing/com.dishrank.app"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--primary)] text-white font-semibold rounded-full hover:bg-[var(--primary-light)] hover:text-[var(--bg)] transition-all text-sm w-full justify-center"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.807 1.626a1 1 0 0 1 0 1.732l-2.807 1.626L15.206 12l2.492-2.492zM5.864 2.658L16.8 8.99l-2.302 2.302-8.634-8.634z"/>
          </svg>
          Rejoindre le test sur Google Play
        </a>

        {/* Fermer */}
        <button
          onClick={close}
          className="mt-4 text-xs text-[var(--text3)] hover:text-[var(--text)] transition-colors"
        >
          Fermer
        </button>
      </div>
    </div>
  );
}

/** Helper : ouvre la modal beta depuis n'importe quel composant */
export function openBetaModal(e: React.MouseEvent) {
  e.preventDefault();
  window.dispatchEvent(new Event('open-beta'));
}
