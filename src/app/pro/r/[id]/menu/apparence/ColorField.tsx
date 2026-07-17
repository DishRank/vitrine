'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Sélecteur de couleur d'accent — parité avec l'app mobile (components/ui/
 * ColorPicker + ColorPickerModal) : pastilles de presets + une pastille « perso »
 * qui déplie un carré saturation/luminosité (HSV) + un curseur de teinte + un
 * champ hex. 100 % CSS/pointer events, aucune dépendance externe → CSP-safe.
 *
 * Le modèle accepte déjà tout `#RRGGBB` (normalizeMenuTheme) ; seule l'UI web
 * restait bornée aux 8 presets — ce composant lève cette limite.
 */

// ── Conversions HSV ⇄ HEX (mêmes maths que l'app RN) ─────────────────────────
function hsvToRgb(h: number, s: number, v: number) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}
function hsvToHex(h: number, s: number, v: number): string {
  const { r, g, b } = hsvToRgb(h, s, v);
  const to = (n: number) => n.toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase();
}
function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const m = /^#?([0-9a-fA-F]{6})$/.exec((hex || '').trim());
  if (!m) return { h: 0, s: 0, v: 0 };
  const int = parseInt(m[1], 16);
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const isHex = (s: string) => /^#[0-9a-fA-F]{6}$/.test(s);
const FALLBACK = '#AE8324';

export default function ColorField({
  value,
  onChange,
  presets,
}: {
  value: string;
  onChange: (hex: string) => void;
  presets: string[];
}) {
  const [open, setOpen] = useState(false);
  const isCustom = !presets.some((p) => p.toLowerCase() === value.toLowerCase());

  // HSV interne = source de vérité pendant le drag (aller dans un coin ne perd
  // pas la teinte). Re-synchro seulement sur changement externe (preset/hex).
  const [hsv, setHsv] = useState(() => hexToHsv(isHex(value) ? value : FALLBACK));
  const hsvRef = useRef(hsv);
  hsvRef.current = hsv;
  const lastEmitted = useRef(value.toUpperCase());
  useEffect(() => {
    if (value.toUpperCase() !== lastEmitted.current) {
      setHsv(hexToHsv(isHex(value) ? value : FALLBACK));
      lastEmitted.current = value.toUpperCase();
    }
  }, [value]);

  const commit = useCallback(
    (next: { h: number; s: number; v: number }) => {
      hsvRef.current = next;
      setHsv(next);
      const hex = hsvToHex(next.h, next.s, next.v);
      lastEmitted.current = hex;
      onChange(hex);
    },
    [onChange]
  );

  // ── Drag carré S/V ──────────────────────────────────────────────────────────
  const svRef = useRef<HTMLDivElement>(null);
  const applySv = useCallback(
    (clientX: number, clientY: number) => {
      const el = svRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      commit({
        h: hsvRef.current.h,
        s: clamp((clientX - r.left) / r.width, 0, 1),
        v: 1 - clamp((clientY - r.top) / r.height, 0, 1),
      });
    },
    [commit]
  );
  // ── Drag curseur de teinte ─────────────────────────────────────────────────
  const hueRef = useRef<HTMLDivElement>(null);
  const applyHue = useCallback(
    (clientX: number) => {
      const el = hueRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      commit({ h: clamp((clientX - r.left) / r.width, 0, 1) * 360, s: hsvRef.current.s, v: hsvRef.current.v });
    },
    [commit]
  );

  // Handler générique : applique au pointerdown puis suit le pointeur (window)
  // jusqu'au relâchement — robuste hors des bords de l'élément.
  const startDrag = useCallback(
    (apply: (x: number, y: number) => void) => (e: React.PointerEvent) => {
      e.preventDefault();
      apply(e.clientX, e.clientY);
      const move = (ev: PointerEvent) => apply(ev.clientX, ev.clientY);
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    []
  );

  const [hexDraft, setHexDraft] = useState(value);
  useEffect(() => setHexDraft(value), [value]);
  const onHex = (txt: string) => {
    const v = '#' + txt.replace(/#/g, '').replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
    setHexDraft(v);
    if (isHex(v)) onChange(v);
  };

  const pureHue = hsvToHex(hsv.h, 1, 1);
  const swatch = isHex(value) ? value : FALLBACK;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {presets.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-label={c}
            className={`h-9 w-9 rounded-full border-2 ${value.toLowerCase() === c.toLowerCase() ? 'border-[var(--text)]' : 'border-transparent'}`}
            style={{ background: c }}
          />
        ))}
        {/* Pastille « perso » — déplie le carré HSV + teinte + hex. */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label="Couleur personnalisée"
          title="Couleur personnalisée"
          className={`flex h-9 w-9 items-center justify-center rounded-full border-2 ${isCustom || open ? 'border-[var(--text)]' : 'border-[var(--border2)]'}`}
          style={{ background: isCustom ? swatch : 'var(--surface-var)' }}
        >
          {isCustom ? (
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M20 6L9 17l-5-5" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="13.5" cy="6.5" r="1.5" /><circle cx="17.5" cy="10.5" r="1.5" /><circle cx="8.5" cy="7.5" r="1.5" /><circle cx="6.5" cy="12.5" r="1.5" />
              <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.5-.6 1.5-1.5 0-.4-.2-.8-.5-1.1-.3-.3-.5-.7-.5-1.1 0-.9.6-1.5 1.5-1.5H16c3.3 0 6-2.7 6-6 0-4.9-4.5-8.3-10-8.3z" />
            </svg>
          )}
        </button>
      </div>

      {open ? (
        <div className="mt-3 w-full max-w-[300px] rounded-xl border border-[var(--border2)] bg-[var(--surface)] p-3">
          {/* Carré saturation (X) × luminosité (Y) */}
          <div
            ref={svRef}
            onPointerDown={startDrag((x, y) => applySv(x, y))}
            className="relative h-40 w-full rounded-lg"
            style={{
              cursor: 'crosshair',
              touchAction: 'none',
              background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent), ${pureHue}`,
            }}
          >
            <span
              className="pointer-events-none absolute h-[18px] w-[18px] rounded-full border-[3px] border-white"
              style={{
                left: `${hsv.s * 100}%`,
                top: `${(1 - hsv.v) * 100}%`,
                transform: 'translate(-50%, -50%)',
                background: swatch,
                boxShadow: '0 0 0 1px rgba(0,0,0,0.35)',
              }}
            />
          </div>
          {/* Curseur de teinte */}
          <div
            ref={hueRef}
            onPointerDown={startDrag((x) => applyHue(x))}
            className="relative mt-3 h-4 w-full rounded-full"
            style={{
              cursor: 'pointer',
              touchAction: 'none',
              background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
            }}
          >
            <span
              className="pointer-events-none absolute h-[22px] w-4 rounded-lg border-[3px] border-white"
              style={{
                left: `${(hsv.h / 360) * 100}%`,
                top: '50%',
                transform: 'translate(-50%, -50%)',
                background: pureHue,
                boxShadow: '0 0 0 1px rgba(0,0,0,0.3)',
              }}
            />
          </div>
          {/* Champ hex */}
          <div className="mt-3 flex items-center gap-2">
            <span className="h-8 w-8 shrink-0 rounded-lg border border-[var(--border2)]" style={{ background: swatch }} />
            <input
              value={hexDraft}
              onChange={(e) => onHex(e.target.value)}
              onBlur={() => { if (!isHex(hexDraft)) setHexDraft(value); }}
              spellCheck={false}
              maxLength={7}
              placeholder="#RRGGBB"
              className="w-full rounded-lg border border-[var(--border2)] bg-[var(--bg)] px-3 py-1.5 text-sm font-semibold uppercase tracking-wide text-[var(--text)] outline-none focus:border-[var(--primary)]"
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="shrink-0 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-sm font-bold text-white hover:opacity-90"
            >
              Terminé
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
