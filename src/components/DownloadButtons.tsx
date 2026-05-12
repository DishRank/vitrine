'use client';

import { useEffect, useRef, useState } from 'react';
import { openBetaModal } from './BetaModal';
import { APP_STORE_URL, PLAY_STORE_URL, ANDROID_LIVE, detectPlatform, type Platform } from '@/lib/downloadLinks';

type Size = 'sm' | 'md' | 'lg';

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'px-4 py-2 text-xs',
  md: 'px-5 py-3 text-sm',
  lg: 'px-7 py-3 text-base',
};

const BASE_CLASSES =
  'cta-shadow magnetic cursor-pointer inline-flex items-center gap-2 bg-[var(--primary)] text-white font-semibold rounded-full hover:bg-[var(--primary-light)]';

/**
 * Hook "magnetic" — la souris attire légèrement l'élément vers son centre.
 * Effet subtil (±6px max) qui donne un ressenti premium / haptic-like.
 * Coût : 2 listeners par bouton + une CSS transform. Désactivé sur touch
 * (les listeners pointermove n'existent pas vraiment, et le hover state
 * ne s'applique pas — la transform reste à 0).
 */
function useMagnetic(strength = 0.35, max = 6) {
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Pas d'effet magnétique pour les users qui préfèrent reduced motion.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let raf: number | null = null;
    let tx = 0, ty = 0;
    const apply = () => {
      el.style.transform = `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px)`;
      raf = null;
    };
    const onMove = (e: PointerEvent) => {
      // Track instantané pendant le follow : on coupe la transition CSS
      // pour éviter le lag (sinon chaque pointermove déclenche un nouveau
      // tween 60fps → effet "ballast"). Le repli (onLeave) la remet.
      el.style.transition = 'none';
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) * strength;
      const dy = (e.clientY - cy) * strength;
      tx = Math.max(-max, Math.min(max, dx));
      ty = Math.max(-max, Math.min(max, dy));
      if (raf === null) raf = requestAnimationFrame(apply);
    };
    const onLeave = () => {
      // Spring de retour : on pose une transition unique pour cette
      // animation, puis l'effet "rubber band" ramène à 0,0.
      el.style.transition = 'transform 0.4s cubic-bezier(0.18, 0.9, 0.3, 1.2)';
      tx = 0; ty = 0;
      if (raf === null) raf = requestAnimationFrame(apply);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, [strength, max]);

  return ref;
}

function AppleIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.38-1.09-.5-2.09-.55-3.24 0-1.44.72-2.2.48-3.08-.38C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.78 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.1zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

function PlayIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3 20.5V3.5c0-.59.34-1.11.84-1.35L13.69 12l-9.85 9.85c-.5-.25-.84-.76-.84-1.35zM16.81 15.12L6.05 21.34l8.49-8.49 2.27 2.27zM20.16 10.81c.35.27.58.72.58 1.19 0 .47-.23.91-.57 1.18l-2.29 1.32-2.5-2.5 2.5-2.5 2.28 1.31zM6.05 2.66l10.76 6.22-2.27 2.27L6.05 2.66z" />
    </svg>
  );
}

export default function DownloadButtons({
  size = 'md',
  className = '',
}: {
  size?: Size;
  className?: string;
}) {
  const [platform, setPlatform] = useState<Platform>('desktop');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
    setMounted(true);
  }, []);

  const sizeClass = SIZE_CLASSES[size];
  const iconSize = size === 'sm' ? 12 : size === 'lg' ? 16 : 14;

  // Refs magnetic — un par bouton. Les 2 hooks sont toujours appelés (ordre
  // stable côté React) même si un seul bouton est rendu pour la plateforme
  // courante.
  const appleRef = useMagnetic();
  const playRef = useMagnetic();

  const appStoreBtn = (
    <a
      ref={appleRef}
      href={APP_STORE_URL}
      target="_blank"
      rel="noopener"
      aria-label="Telecharger sur l'App Store"
      className={`${BASE_CLASSES} ${sizeClass}`}
    >
      <AppleIcon size={iconSize} />
      App Store
    </a>
  );

  const playStoreBtn = ANDROID_LIVE ? (
    <a
      ref={playRef}
      href={PLAY_STORE_URL}
      target="_blank"
      rel="noopener"
      aria-label="Telecharger sur Google Play"
      className={`${BASE_CLASSES} ${sizeClass}`}
    >
      <PlayIcon size={iconSize} />
      Google Play
    </a>
  ) : (
    <a
      ref={playRef}
      href="#"
      onClick={openBetaModal}
      aria-label="Telecharger sur Google Play (beta)"
      className={`${BASE_CLASSES} ${sizeClass}`}
    >
      <PlayIcon size={iconSize} />
      Google Play
    </a>
  );

  // Avant l'hydratation cote client, afficher les deux (fallback neutre).
  // Apres detection, afficher en fonction de la plateforme.
  let buttons;
  if (!mounted || platform === 'desktop') {
    buttons = (
      <>
        {appStoreBtn}
        {playStoreBtn}
      </>
    );
  } else if (platform === 'ios') {
    buttons = appStoreBtn;
  } else {
    buttons = playStoreBtn;
  }

  return <div className={`flex flex-wrap items-center justify-center gap-3 ${className}`}>{buttons}</div>;
}
