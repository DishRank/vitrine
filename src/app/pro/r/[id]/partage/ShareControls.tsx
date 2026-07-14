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

/** Charge une image (data: URI) en promesse. */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Convertit le SVG (rendu serveur) en PNG 512px téléchargeable, côté client.
 *
 * IMPORTANT : le SVG est chargé via un data: URI, PAS un blob: URL — la CSP
 * (`img-src 'self' https: data:`, sans `blob:`) bloque les blob URLs, ce qui
 * cassait silencieusement le téléchargement.
 *
 * Si `logo` (data: URI) est fourni, on le redessine SÉPARÉMENT sur le canvas
 * (pastille blanche arrondie + logo « contain »), car une <image> imbriquée dans
 * le SVG ne se rasterise pas en mode image. Géométrie alignée sur l'overlay de
 * QrKit : pastille = 28% du côté, padding = 12% de la pastille.
 */
export function DownloadPngButton({
  svg,
  filename,
  logo,
}: {
  svg: string;
  filename: string;
  logo?: string | null;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const size = 512;
        try {
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            setBusy(false);
            return;
          }
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, size, size);

          const qrImg = await loadImage(
            'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg),
          );
          ctx.drawImage(qrImg, 0, 0, size, size);

          if (logo) {
            const box = size * 0.28;
            const bx = (size - box) / 2;
            const rx = box * 0.16;
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            if (typeof ctx.roundRect === 'function') ctx.roundRect(bx, bx, box, box, rx);
            else ctx.rect(bx, bx, box, box);
            ctx.fill();
            try {
              const logoImg = await loadImage(logo);
              const avail = box * 0.76; // 12% de padding de chaque côté
              const scale = Math.min(avail / logoImg.width, avail / logoImg.height);
              const w = logoImg.width * scale;
              const h = logoImg.height * scale;
              ctx.drawImage(logoImg, (size - w) / 2, (size - h) / 2, w, h);
            } catch {
              /* logo indisponible → on garde le QR + pastille blanche */
            }
          }

          canvas.toBlob((png) => {
            if (png) {
              const a = document.createElement('a');
              a.href = URL.createObjectURL(png);
              a.download = filename;
              a.click();
              URL.revokeObjectURL(a.href);
            }
            setBusy(false);
          }, 'image/png');
        } catch {
          setBusy(false);
        }
      }}
      className="rounded-lg border border-[var(--border2)] px-4 py-2 text-sm font-semibold text-[var(--text2)] transition-colors hover:border-[var(--primary)] hover:text-[var(--text)] disabled:opacity-50"
    >
      {busy ? 'Génération…' : 'Télécharger le QR (PNG)'}
    </button>
  );
}
