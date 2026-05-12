'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';

interface Props {
  /** Texte original (ex: "200+", "100%", "Sans pub"). Si pas de chiffre
   *  détecté, on retourne tel quel — utile pour `<b>Sans pub</b>`. */
  children: React.ReactNode;
  /** Durée du count-up en ms. */
  duration?: number;
  className?: string;
}

/**
 * Wrap un nombre dans une animation count-up déclenchée au scroll-in.
 *
 * SEO-safe : le SSR rend `children` tel quel ("200+", "100%"). L'animation
 * mutate `textContent` via ref UNIQUEMENT côté client, après mount. Le
 * crawler lit donc la vraie valeur dans l'HTML, pas un "0" misleading.
 *
 * Flow :
 *   • SSR + hydration : <span>200+</span> (texte visible, indexable)
 *   • useLayoutEffect (avant 1er paint) : si en view, écrase textContent
 *     à "0" pour préparer l'animation sans flicker
 *   • useEffect : attache IntersectionObserver, lance la rAF loop qui
 *     mutate textContent frame-par-frame jusqu'à la cible
 *   • Pour les users below-fold : le SSR reste affiché jusqu'au scroll
 *     (pas d'animation s'ils ne descendent pas, mais texte correct).
 *
 * Respecte `prefers-reduced-motion` (durée raccourcie à 280ms).
 */
export default function CountUpStat({ children, duration = 1400, className }: Props) {
  const ref = useRef<HTMLSpanElement>(null);

  // Extraction robuste du texte depuis children.
  const text = extractText(children);
  const match = text.match(/^([^\d-]*)(-?\d+(?:[.,]\d+)?)(.*)$/);
  const isNumeric = !!match;
  const targetNum = isNumeric ? parseFloat(match![2].replace(',', '.')) : 0;
  const prefix = isNumeric ? match![1] : '';
  const suffix = isNumeric ? match![3] : '';
  const isInt = isNumeric ? Number.isInteger(targetNum) : true;

  // useLayoutEffect : runs APRÈS le DOM commit mais AVANT que le browser
  // ne paint pour l'utilisateur. Pour les éléments above-fold (Hero), on
  // y reset textContent à 0 → l'user voit directement "0" puis count-up,
  // sans flicker "200 → 0 → count-up".
  // SSR : useLayoutEffect est noop (pas de DOM côté serveur) → l'HTML
  // contient bien "200+" pour les crawlers.
  useLayoutEffect(() => {
    if (!isNumeric || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const inView = rect.top < window.innerHeight && rect.bottom > 0;
    if (inView) {
      ref.current.textContent = `${prefix}0${suffix}`;
    }
  }, [isNumeric, prefix, suffix]);

  useEffect(() => {
    if (!isNumeric) return;
    const el = ref.current;
    if (!el) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const effectiveDuration = reduced ? 280 : duration;

    let rafId: number | null = null;
    let start: number | null = null;
    const animate = (ts: number) => {
      if (start === null) start = ts;
      const t = Math.min(1, (ts - start) / effectiveDuration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = targetNum * eased;
      const display = isInt ? Math.round(current).toString() : current.toFixed(1);
      if (ref.current) {
        ref.current.textContent = `${prefix}${display}${suffix}`;
      }
      if (t < 1) rafId = requestAnimationFrame(animate);
    };

    const rect = el.getBoundingClientRect();
    const inView = rect.top < window.innerHeight && rect.bottom > 0;

    if (inView || typeof IntersectionObserver === 'undefined') {
      rafId = requestAnimationFrame(animate);
      return () => { if (rafId !== null) cancelAnimationFrame(rafId); };
    }

    // Below-fold : on attend l'intersect. Avant le déclenchement, le
    // textContent reste tel que rendu par React (= la cible "200+"),
    // donc l'user qui ne scroll pas voit toujours la bonne valeur. Au
    // scroll, on écrase à "0" PUIS on lance rAF (single tick, pas de
    // flicker car la mutation `textContent = "0"` et le 1er rAF se font
    // dans la même frame de layout).
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (ref.current) ref.current.textContent = `${prefix}0${suffix}`;
            rafId = requestAnimationFrame(animate);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [isNumeric, targetNum, duration, prefix, suffix, isInt]);

  // SSR + initial render : passthrough des children. Pour un nombre
  // ("200+"), le texte rendu est exactement le contenu source → crawlers
  // lisent la bonne valeur. Pour un non-nombre ("Sans pub"), idem.
  return (
    <span ref={ref} className={isNumeric ? `tabular ${className ?? ''}`.trim() : className}>
      {children}
    </span>
  );
}

/** Walk un React.ReactNode et concatène toutes les portions string/number
 *  qu'il contient. Gère : string, number, array, React element (children
 *  via props.children), fragment. Évite le piège `String([object Object])`. */
function extractText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (typeof node === 'object' && 'props' in node) {
    const props = (node as { props?: { children?: React.ReactNode } }).props;
    return extractText(props?.children);
  }
  return '';
}
