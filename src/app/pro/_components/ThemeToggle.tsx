'use client';

import { useEffect, useState } from 'react';

type Mode = 'light' | 'dark';

/**
 * Bascule clair/sombre pour l'espace pro. Le thème est piloté par une classe
 * `.dark` / `.light` sur <html> (cf. globals.css) et persisté dans localStorage
 * ('dr-pro-theme'). Le script d'init du layout applique la préférence AVANT le
 * paint (pas de flash) ; ce bouton ne fait que la lire et la changer.
 */
export default function ThemeToggle() {
  const [mode, setMode] = useState<Mode | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const current: Mode = root.classList.contains('dark')
      ? 'dark'
      : root.classList.contains('light')
        ? 'light'
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
    setMode(current);
  }, []);

  const apply = (m: Mode) => {
    const root = document.documentElement;
    root.classList.remove('dark', 'light');
    root.classList.add(m);
    try {
      localStorage.setItem('dr-pro-theme', m);
    } catch {
      /* stockage indispo — no-op */
    }
    setMode(m);
  };

  // Avant hydratation on réserve la place (évite un saut de layout + le flash
  // d'une icône qui ne correspondrait pas au thème réellement appliqué).
  if (mode === null) return <span className="h-9 w-9" aria-hidden />;

  const next: Mode = mode === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      onClick={() => apply(next)}
      aria-label={`Passer en thème ${next === 'dark' ? 'sombre' : 'clair'}`}
      title={`Thème ${next === 'dark' ? 'sombre' : 'clair'}`}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border2)] text-base text-[var(--text2)] transition-colors hover:border-[var(--primary)] hover:text-[var(--text)]"
    >
      {mode === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}
