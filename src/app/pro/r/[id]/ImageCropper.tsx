'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { uploadWebpBlobs } from './menu/imageUpload';

/**
 * Recadreur d'image (couverture 16:9 / logo 1:1) — glisser pour cadrer, molette
 * ou curseur pour zoomer. On stocke EXACTEMENT la zone visible (webp, résolution
 * bornée) → images uniformes, poids minimal, l'utilisateur centre lui-même.
 *
 * L'image source est chargée en **data: URI** (jamais blob:) : la CSP de /pro
 * bloque blob: pour les images, et un canvas ne rasterise une source que si elle
 * n'a pas « tainté » le contexte (même piège que l'export du logo QR).
 */

const THUMB_WIDTH = 320;

export default function ImageCropper({
  file,
  aspect,
  outputWidth,
  title,
  quality = 0.82,
  fit = 'cover',
  onDone,
  onCancel,
}: {
  file: File;
  /** largeur/hauteur du cadre (16/9 pour la couverture, 1 pour le logo). */
  aspect: number;
  /** largeur du webp exporté (hauteur = outputWidth / aspect). */
  outputWidth: number;
  title: string;
  quality?: number;
  /**
   * `cover` (défaut, couverture) : l'image remplit toujours le cadre — les
   * débords sont rognés. `contain` (logo) : l'image ENTIÈRE tient dans le cadre
   * (un logo « bandeau » n'est pas coupé) ; les marges deviennent transparentes
   * dans le webp. Dans les deux cas l'utilisateur peut zoomer pour recadrer.
   */
  fit?: 'cover' | 'contain';
  onDone: (url: string) => void;
  onCancel: () => void;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1); // multiplicateur au-dessus du « cover »
  const [offset, setOffset] = useState({ x: 0, y: 0 }); // coin haut-gauche image / cadre
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const frameRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  // Charge le fichier en data: URI (pas blob: — CSP).
  useEffect(() => {
    const reader = new FileReader();
    reader.onload = () => setDataUrl(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => setErr("Impossible de lire l'image.");
    reader.readAsDataURL(file);
  }, [file]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onCancel]);

  const frame = () => {
    const el = frameRef.current;
    return el ? { w: el.clientWidth, h: el.clientHeight } : { w: 0, h: 0 };
  };

  // Échelle de base (zoom = 1) : couvrir (cover) ou contenir (contain) le cadre.
  const baseScale = useCallback(() => {
    if (!nat) return 1;
    const f = frame();
    if (!f.w) return 1;
    return fit === 'contain' ? Math.min(f.w / nat.w, f.h / nat.h) : Math.max(f.w / nat.w, f.h / nat.h);
  }, [nat, fit]);

  const clamp = useCallback(
    (o: { x: number; y: number }, scale: number) => {
      if (!nat) return o;
      const f = frame();
      const dispW = nat.w * scale;
      const dispH = nat.h * scale;
      // Si l'image couvre l'axe → on la borne au cadre ; sinon (contain) → on
      // la centre (marge transparente à l'export).
      return {
        x: dispW >= f.w ? Math.min(0, Math.max(f.w - dispW, o.x)) : (f.w - dispW) / 2,
        y: dispH >= f.h ? Math.min(0, Math.max(f.h - dispH, o.y)) : (f.h - dispH) / 2,
      };
    },
    [nat]
  );

  // Centre l'image quand elle est prête.
  const onImgLoad = () => {
    const img = imgRef.current;
    if (!img) return;
    const n = { w: img.naturalWidth, h: img.naturalHeight };
    setNat(n);
    const f = frame();
    const s = fit === 'contain' ? Math.min(f.w / n.w, f.h / n.h) : Math.max(f.w / n.w, f.h / n.h);
    setZoom(1);
    setOffset({ x: (f.w - n.w * s) / 2, y: (f.h - n.h * s) / 2 });
  };

  const recenter = () => {
    if (!nat) return;
    const f = frame();
    const s = baseScale();
    setZoom(1);
    setOffset({ x: (f.w - nat.w * s) / 2, y: (f.h - nat.h * s) / 2 });
  };

  const applyZoom = (nextZoom: number, anchor?: { x: number; y: number }) => {
    if (!nat) return;
    const z = Math.min(4, Math.max(1, nextZoom));
    const f = frame();
    const a = anchor ?? { x: f.w / 2, y: f.h / 2 };
    const oldScale = baseScale() * zoom;
    const newScale = baseScale() * z;
    // Zoom ancré sous le curseur / centre.
    const nx = a.x - ((a.x - offset.x) * newScale) / oldScale;
    const ny = a.y - ((a.y - offset.y) * newScale) / oldScale;
    setZoom(z);
    setOffset(clamp({ x: nx, y: ny }, newScale));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const scale = baseScale() * zoom;
    setOffset(clamp({ x: drag.current.ox + (e.clientX - drag.current.x), y: drag.current.oy + (e.clientY - drag.current.y) }, scale));
  };
  const onPointerUp = () => {
    drag.current = null;
  };
  const onWheel = (e: React.WheelEvent) => {
    const rect = frameRef.current?.getBoundingClientRect();
    const anchor = rect ? { x: e.clientX - rect.left, y: e.clientY - rect.top } : undefined;
    applyZoom(zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12), anchor);
  };

  const confirm = async () => {
    if (!nat || !imgRef.current) return;
    setBusy(true);
    setErr('');
    try {
      const f = frame();
      const scale = baseScale() * zoom;
      // Rectangle source (px image) correspondant au cadre. En mode `contain`
      // il peut DÉBORDER l'image (marges) → on le clippe à l'image et on reporte
      // le décalage sur la destination ; le reste du canvas reste transparent.
      // (En `cover` le rectangle est toujours dans l'image → clip = no-op.)
      const sxRaw = -offset.x / scale;
      const syRaw = -offset.y / scale;
      const swRaw = f.w / scale;
      const shRaw = f.h / scale;
      const csx = Math.max(0, sxRaw);
      const csy = Math.max(0, syRaw);
      const csw = Math.min(nat.w, sxRaw + swRaw) - csx;
      const csh = Math.min(nat.h, syRaw + shRaw) - csy;
      const outW = outputWidth;
      const outH = Math.round(outputWidth / aspect);

      const draw = (w: number, h: number, q: number): Promise<Blob> => {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('canvas');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        // Pas de fillRect → l'alpha d'un logo transparent (et les marges du mode
        // contain) restent transparents.
        if (csw > 0 && csh > 0) {
          const kx = w / swRaw;
          const ky = h / shRaw;
          ctx.drawImage(imgRef.current!, csx, csy, csw, csh, (csx - sxRaw) * kx, (csy - syRaw) * ky, csw * kx, csh * ky);
        }
        return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('webp'))), 'image/webp', q));
      };

      const [full, thumb] = await Promise.all([
        draw(outW, outH, quality),
        draw(THUMB_WIDTH, Math.round(THUMB_WIDTH / aspect), 0.7),
      ]);

      const up = await uploadWebpBlobs(full, thumb);
      if (!up.ok || !up.url) {
        setErr(up.error || "Échec de l'envoi.");
        setBusy(false);
        return;
      }
      onDone(up.url);
    } catch {
      setErr("Impossible de traiter l'image.");
      setBusy(false);
    }
  };

  if (typeof document === 'undefined') return null;
  const scale = baseScale() * zoom;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 sm:p-6"
      style={{ animation: 'fadeIn 0.15s ease-out both' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col rounded-2xl border border-[var(--border2)] bg-[var(--surface)] shadow-2xl"
        style={{ animation: 'fadeUp 0.15s ease-out both' }}
      >
        <div className="flex items-center justify-between gap-4 border-b border-[var(--border2)] p-5 sm:p-6">
          <h2 className="text-lg font-extrabold tracking-tight">{title}</h2>
          <button onClick={onCancel} aria-label="Fermer" className="shrink-0 rounded-lg p-2 text-[var(--text2)] hover:bg-[var(--surface-var)] hover:text-[var(--text)]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <div className="overflow-y-auto p-5 sm:p-6">
          {/* Cadre de recadrage */}
          <div
            ref={frameRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={onWheel}
            className="relative mx-auto w-full max-w-[420px] cursor-grab touch-none select-none overflow-hidden rounded-xl bg-[var(--surface-var)] active:cursor-grabbing"
            style={{ aspectRatio: String(aspect) }}
          >
            {dataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                ref={imgRef}
                src={dataUrl}
                alt=""
                onLoad={onImgLoad}
                draggable={false}
                className="pointer-events-none absolute left-0 top-0 max-w-none origin-top-left"
                style={{ width: nat ? nat.w * scale : 'auto', height: nat ? nat.h * scale : 'auto', transform: `translate(${offset.x}px, ${offset.y}px)` }}
              />
            ) : null}
            {/* Grille tiers pour aider au centrage (une fois l'image chargée) */}
            {nat ? (
              <div className="pointer-events-none absolute inset-0 opacity-40">
                <div className="absolute inset-y-0 left-1/3 w-px bg-white/60" />
                <div className="absolute inset-y-0 left-2/3 w-px bg-white/60" />
                <div className="absolute inset-x-0 top-1/3 h-px bg-white/60" />
                <div className="absolute inset-x-0 top-2/3 h-px bg-white/60" />
              </div>
            ) : null}
            {/* Chargement de l'image */}
            {!nat ? (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
              </span>
            ) : null}
          </div>

          {/* Zoom + recentrer */}
          <div className="mt-4 flex items-center gap-2">
            <button type="button" onClick={() => applyZoom(zoom / 1.2)} aria-label="Dézoomer" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border2)] text-[var(--text2)] transition-colors hover:border-[var(--primary)] hover:text-[var(--text)]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14" /></svg>
            </button>
            <input
              type="range"
              min={1}
              max={4}
              step={0.01}
              value={zoom}
              onChange={(e) => applyZoom(Number(e.target.value))}
              className="h-1.5 flex-1 cursor-pointer accent-[var(--primary)]"
              aria-label="Zoom"
            />
            <button type="button" onClick={() => applyZoom(zoom * 1.2)} aria-label="Zoomer" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border2)] text-[var(--text2)] transition-colors hover:border-[var(--primary)] hover:text-[var(--text)]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            </button>
            <button type="button" onClick={recenter} className="ml-1 shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[var(--text2)] transition-colors hover:text-[var(--primary)]">
              Recentrer
            </button>
          </div>
          <p className="mt-2 text-xs text-[var(--text3)]">Glissez l’image pour la cadrer, zoomez pour ajuster.</p>
          {err ? <p className="mt-2 text-[13px] font-medium text-red-500">{err}</p> : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--border2)] p-4 sm:px-6">
          <button onClick={onCancel} disabled={busy} className="rounded-lg border border-[var(--border2)] px-4 py-2 text-sm font-semibold text-[var(--text2)] transition-colors hover:border-[var(--primary)] hover:text-[var(--text)] disabled:opacity-50">
            Annuler
          </button>
          <button onClick={confirm} disabled={busy || !nat} className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50">
            {busy ? 'Envoi…' : 'Valider'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
