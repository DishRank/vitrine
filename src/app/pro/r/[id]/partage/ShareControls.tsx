'use client';

import { useState } from 'react';

/** Copie une valeur dans le presse-papier avec retour visuel. */
export function CopyButton({ value, label = 'Copier' }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {
          /* clipboard indispo (http, permissions) — no-op */
        }
      }}
      className="shrink-0 rounded-lg border border-[var(--border2)] px-3 py-2 text-sm font-semibold text-[var(--text2)] transition-colors hover:border-[var(--primary)] hover:text-[var(--text)]"
    >
      {done ? 'Copié ✓' : label}
    </button>
  );
}

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-bold text-white hover:opacity-90"
    >
      Imprimer le chevalet
    </button>
  );
}

/** Convertit le SVG (rendu serveur) en PNG 512px téléchargeable, côté client. */
export function DownloadPngButton({ svg, filename }: { svg: string; filename: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          const size = 512;
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, size, size);
            ctx.drawImage(img, 0, 0, size, size);
          }
          URL.revokeObjectURL(url);
          canvas.toBlob((png) => {
            if (!png) {
              setBusy(false);
              return;
            }
            const a = document.createElement('a');
            a.href = URL.createObjectURL(png);
            a.download = filename;
            a.click();
            URL.revokeObjectURL(a.href);
            setBusy(false);
          }, 'image/png');
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          setBusy(false);
        };
        img.src = url;
      }}
      className="rounded-lg border border-[var(--border2)] px-4 py-2 text-sm font-semibold text-[var(--text2)] transition-colors hover:border-[var(--primary)] hover:text-[var(--text)] disabled:opacity-50"
    >
      {busy ? 'Génération…' : 'Télécharger le QR (PNG)'}
    </button>
  );
}
