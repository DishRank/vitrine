'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

interface Props {
  /** Si true, applique `.reveal-stagger` au lieu de `.reveal` — chaque enfant
   *  marqué `data-reveal-child` reçoit un delay basé sur son index DOM. */
  stagger?: boolean;
  /** Seuil de visibilité (0..1) qui déclenche le reveal. Défaut 0.15. */
  threshold?: number;
  /** Marge supplémentaire autour du viewport. */
  rootMargin?: string;
  className?: string;
  style?: React.CSSProperties;
  as?: 'div' | 'section' | 'article' | 'ul';
  children: React.ReactNode;
}

/**
 * Wrapper scroll-reveal — pose `.in` quand l'élément entre dans le viewport.
 *
 * SEO-safe :
 *   • SSR rend SANS classe `.reveal` → contenu visible dans l'HTML
 *     (opacity 1, transform: none par défaut). Crawlers indexent le
 *     contenu normalement.
 *   • Client useLayoutEffect (avant 1er paint) : si l'élément est
 *     below-fold ET que IntersectionObserver est dispo, on applique
 *     `.reveal` (opacity 0). L'user au-dessus du fold ne voit jamais
 *     ce changement → pas de flicker.
 *   • Above-fold : on applique direct `.reveal.in` → contenu visible
 *     instantanément sans animation cachée (pas besoin d'animer ce
 *     que l'user voit déjà).
 *   • Observer : quand l'élément entre dans le viewport, ajoute `.in`
 *     → transition opacity/transform.
 *
 * Si JS est désactivé ou échoue : aucune classe n'est appliquée, contenu
 * reste visible (style par défaut). Aucune dégradation SEO.
 */
export default function Reveal({
  stagger = false,
  threshold = 0.15,
  rootMargin = '0px 0px -40px 0px',
  className = '',
  style,
  as = 'div',
  children,
}: Props) {
  const ref = useRef<HTMLElement>(null);
  /** 3 états :
   *   • 'none' : SSR + pré-mount → aucune classe, contenu visible
   *   • 'pending' : .reveal posée (opacity 0), en attente d'intersect
   *   • 'in' : .reveal.in posée → animation joue
   */
  const [state, setState] = useState<'none' | 'pending' | 'in'>('none');

  // useLayoutEffect runs avant le 1er paint client → on peut poser
  // `.reveal` sans que l'user voie le contenu "flasher" visible puis
  // invisible. SSR : noop, donc l'HTML reste sans classe.
  useLayoutEffect(() => {
    if (typeof window === 'undefined' || !ref.current) return;
    if (typeof IntersectionObserver === 'undefined') {
      setState('in'); // fallback : pas d'observer, on montre tout
      return;
    }
    const rect = ref.current.getBoundingClientRect();
    const inView = rect.top < window.innerHeight && rect.bottom > 0;
    if (inView) {
      // Above fold → skip l'animation, contenu reste visible (state 'in'
      // ajoute la classe `.in` mais sans transition perceptible vu qu'on
      // n'est jamais passé par opacity 0).
      setState('in');
    } else {
      // Below fold → on cache pour préparer l'animation. L'user ne voit
      // pas ce moment car c'est below-fold.
      setState('pending');
    }
  }, []);

  useEffect(() => {
    if (state !== 'pending' || !ref.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setState('in');
            observer.disconnect();
            break;
          }
        }
      },
      { threshold, rootMargin },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [state, threshold, rootMargin]);

  const base = stagger ? 'reveal-stagger' : 'reveal';
  // SSR + initial : aucune classe `.reveal*` → contenu visible
  // Client below-fold pre-observer : `.reveal*` → opacity 0
  // Client in-view ou post-observer : `.reveal* in` → opacity 1 (animé)
  const stateClass =
    state === 'none' ? '' :
    state === 'in' ? `${base} in` :
    base;
  const Tag = as as keyof React.JSX.IntrinsicElements;

  return (
    // @ts-expect-error — JSX intrinsic ref typing for dynamic tag
    <Tag ref={ref} style={style} className={`${stateClass} ${className}`.trim()}>
      {children}
    </Tag>
  );
}
