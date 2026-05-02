'use client';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useState, useEffect, useCallback, useRef } from 'react';

// Chaque slide a une variante dark et une variante light. Lorsque l'utilisateur
// a un thème clair actif (système ou classe `.light`/.dark sur <html>), on
// bascule sur la variante light.
const IMAGES: { dark: string; light: string }[] = [
  { dark: '/img/01_feed.webp',        light: '/img/01_feed_light.webp' },
  { dark: '/img/02_dish_detail.webp', light: '/img/02_dish_detail_light.webp' },
  { dark: '/img/03_categories.webp',  light: '/img/03_categories_light.webp' },
  { dark: '/img/04_add_review.webp',  light: '/img/04_add_review_light.webp' },
  { dark: '/img/05_settings.webp',    light: '/img/05_settings_light.webp' },
  { dark: '/img/06_map.webp',         light: '/img/06_map_light.webp' },
  { dark: '/img/07_restaurant.webp',  light: '/img/07_restaurant_light.webp' },
  { dark: '/img/08_profile.webp',     light: '/img/08_profile_light.webp' },
];

export default function Showcase() {
  const t = useTranslations('showcase');
  const slides = t.raw('slides') as { title: string; desc: string }[];
  const [idx, setIdx] = useState(0);
  const [animating, setAnimating] = useState(false);
  // SSR : on rend toujours la version dark (pas d'accès au prefers-color-scheme
  // côté serveur). Au mount client, on bascule sur light si applicable.
  // Pas de mismatch d'hydratation : le serveur et le 1er render client
  // utilisent la même valeur (`false`) avant l'effet.
  const [isLightTheme, setIsLightTheme] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Détection du thème : miroir de la logique de `init.js` + globals.css.
  //   - classe `.dark` sur <html> → forcé dark
  //   - classe `.light` sur <html> → forcé light
  //   - sinon : on suit `prefers-color-scheme`
  // On observe aussi les changements de classe sur <html> au cas où un toggle
  // manuel serait ajouté plus tard, et le `change` de la media query pour
  // les utilisateurs qui changent leur préférence système en cours de visite.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const compute = () => {
      const cl = document.documentElement.classList;
      if (cl.contains('dark')) return false;
      if (cl.contains('light')) return true;
      return mq.matches;
    };
    setIsLightTheme(compute());
    const onChange = () => setIsLightTheme(compute());
    mq.addEventListener('change', onChange);
    const observer = new MutationObserver(onChange);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => {
      mq.removeEventListener('change', onChange);
      observer.disconnect();
    };
  }, []);

  const currentSrc = isLightTheme ? IMAGES[idx].light : IMAGES[idx].dark;

  const goNext = useCallback(() => {
    setAnimating(true);
    setTimeout(() => {
      setIdx((prev) => (prev + 1) % slides.length);
      setAnimating(false);
    }, 300);
  }, [slides.length]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!document.hidden) timerRef.current = setInterval(goNext, 8000);
  }, [goNext]);

  const goTo = useCallback((i: number) => {
    setAnimating(true);
    setTimeout(() => {
      setIdx(((i % slides.length) + slides.length) % slides.length);
      setAnimating(false);
    }, 300);
    resetTimer();
  }, [slides.length, resetTimer]);

  const goPrev = useCallback(() => {
    setAnimating(true);
    setTimeout(() => {
      setIdx((prev) => (prev - 1 + slides.length) % slides.length);
      setAnimating(false);
    }, 300);
    resetTimer();
  }, [slides.length, resetTimer]);

  const goNextManual = useCallback(() => {
    goNext();
    resetTimer();
  }, [goNext, resetTimer]);

  // Auto-rotate, pause when tab is hidden
  useEffect(() => {
    timerRef.current = setInterval(goNext, 8000);
    const onVisibility = () => {
      if (document.hidden) {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      } else if (!timerRef.current) {
        timerRef.current = setInterval(goNext, 8000);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [goNext]);

  // Touch swipe
  const touchStart = useRef(0);
  const onTouchStart = (e: React.TouchEvent) => { touchStart.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStart.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) (diff > 0 ? goNextManual : goPrev)();
  };

  // ─── Mouse-driven 3D tilt sur le mock ──────────────────────────────────
  // Implémentation : lerp + requestAnimationFrame.
  //
  // Naïf (CSS transition relancée à chaque mousemove) = janky : à 60+ fps,
  // chaque mousemove interrompt la transition précédente avant qu'elle
  // n'ait fini d'interpoler → résultat saccadé. Au lieu, on stocke la
  // ROTATION CIBLE en ref et une rAF loop interpole la rotation COURANTE
  // vers la cible avec un facteur d'amortissement (lerp). Le DOM est
  // muté une fois par frame uniquement (60fps cap), avec une inertie
  // naturelle "spring" — fluide, peu coûteux, pas de transition CSS.
  //
  // Mappage : position souris (-1..+1 relatif au centre du mock) →
  // rotateY (±16°, horizontal) et rotateX (±10°, vertical inversé).
  const mockRef = useRef<HTMLDivElement>(null);
  const DEFAULT_X = 2;   // rotateX au repos (deg)
  const DEFAULT_Y = -6;  // rotateY au repos (deg)
  /** Rotation que l'on souhaite atteindre (mise à jour à chaque mousemove). */
  const targetTilt = useRef({ x: DEFAULT_X, y: DEFAULT_Y });
  /** Rotation effectivement appliquée au DOM. Lerpée vers la cible. */
  const currentTilt = useRef({ x: DEFAULT_X, y: DEFAULT_Y });
  const rafId = useRef<number | null>(null);
  const isHovering = useRef(false);

  /** Boucle d'animation : lerp current → target, mute le DOM, planifie la
   *  frame suivante tant qu'on n'a pas convergé (ou tant que la souris est
   *  encore sur le mock). */
  const animate = useCallback(() => {
    // Facteur d'amortissement : 0.18 réactif au tracking, 0.10 plus mou
    // au retour pour un effet "spring" plus visible quand la souris quitte.
    const ease = isHovering.current ? 0.18 : 0.10;
    currentTilt.current.x += (targetTilt.current.x - currentTilt.current.x) * ease;
    currentTilt.current.y += (targetTilt.current.y - currentTilt.current.y) * ease;

    const el = mockRef.current;
    if (el) {
      el.style.transform = `rotateY(${currentTilt.current.y.toFixed(2)}deg) rotateX(${currentTilt.current.x.toFixed(2)}deg)`;
    }

    const dx = Math.abs(targetTilt.current.x - currentTilt.current.x);
    const dy = Math.abs(targetTilt.current.y - currentTilt.current.y);
    // Continue tant qu'on tracke OU qu'on n'est pas encore à 0.05° de la
    // cible. En dessous, on stoppe pour économiser les frames.
    if (isHovering.current || dx > 0.05 || dy > 0.05) {
      rafId.current = requestAnimationFrame(animate);
    } else {
      // Snap final pour éviter les arrondis flottants résiduels
      currentTilt.current.x = targetTilt.current.x;
      currentTilt.current.y = targetTilt.current.y;
      if (el) {
        el.style.transform = `rotateY(${currentTilt.current.y}deg) rotateX(${currentTilt.current.x}deg)`;
      }
      rafId.current = null;
    }
  }, []);

  const onMockMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = mockRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    const cy = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
    const dx = Math.max(-1, Math.min(1, cx));
    const dy = Math.max(-1, Math.min(1, cy));
    targetTilt.current.y = dx * 16;   // rotateY (horizontal)
    targetTilt.current.x = -dy * 10;  // rotateX (vertical inversé)
    isHovering.current = true;
    if (rafId.current === null) rafId.current = requestAnimationFrame(animate);
  };

  const onMockMouseLeave = () => {
    isHovering.current = false;
    targetTilt.current.x = DEFAULT_X;
    targetTilt.current.y = DEFAULT_Y;
    if (rafId.current === null) rafId.current = requestAnimationFrame(animate);
  };

  // Cleanup : annule la frame en cours au démontage
  useEffect(() => {
    return () => {
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    };
  }, []);

  return (
    <section className="py-12 sm:py-20 overflow-hidden" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        {/* Info */}
        <div className="flex flex-col gap-3 items-center text-center md:items-end md:text-right">
          <p className="text-xs font-semibold uppercase tracking-[2px] text-[var(--primary)]">{t('label')}</p>
          <h2
            className={`text-2xl sm:text-3xl lg:text-4xl font-extrabold leading-tight transition-all duration-300 ${animating ? 'opacity-0 translate-x-8' : 'opacity-100 translate-x-0'}`}
          >
            {slides[idx].title}
          </h2>
          <p
            className={`text-base text-[var(--text2)] leading-relaxed max-w-[400px] transition-all duration-300 delay-[40ms] ${animating ? 'opacity-0 translate-x-8' : 'opacity-100 translate-x-0'}`}
          >
            {slides[idx].desc}
          </p>
          {/* Dots */}
          <div className="flex gap-2 mt-2">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                aria-label={`Slide ${i + 1}`}
                className={`cursor-pointer h-2.5 rounded-full transition-all duration-300 ${i === idx ? 'w-7 bg-[var(--primary)]' : 'w-2.5 bg-[var(--border2)] hover:bg-[var(--text3)] hover:scale-125'}`}
              />
            ))}
          </div>
          {/* Arrows — hidden on mobile (dots are enough for touch) */}
          <div className="hidden md:flex gap-2 mt-1">
            <button onClick={goPrev} aria-label="Previous slide" className="cursor-pointer w-10 h-10 rounded-full border border-[var(--border2)] bg-[var(--surface)] text-[var(--text2)] flex items-center justify-center hover:border-[var(--primary)] hover:text-[var(--primary)] hover:-translate-x-0.5 hover:scale-110 transition-all duration-200">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
            </button>
            <button onClick={goNextManual} aria-label="Next slide" className="cursor-pointer w-10 h-10 rounded-full border border-[var(--border2)] bg-[var(--surface)] text-[var(--text2)] flex items-center justify-center hover:border-[var(--primary)] hover:text-[var(--primary)] hover:translate-x-0.5 hover:scale-110 transition-all duration-200">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
            </button>
          </div>
        </div>
        {/* Phone - hidden on mobile.
            Mouse-driven 3D tilt : on attache les listeners au container avec
            perspective pour que le tracking suive la souris partout autour
            du mock (même quand elle survole la zone autour, pas seulement le
            phone). Tilt par défaut (rotateY -6°, rotateX 2°) restauré en
            spring au mouseleave. */}
        {/* Perspective réduite (900 au lieu de 1200) → caméra plus proche
            → effet 3D plus prononcé quand on tilt. */}
        <div
          className="hidden md:flex justify-center"
          style={{ perspective: '900px' }}
          onMouseMove={onMockMouseMove}
          onMouseLeave={onMockMouseLeave}
        >
          <div
            ref={mockRef}
            className="relative"
            style={{
              transformStyle: 'preserve-3d',
              transform: 'rotateY(-6deg) rotateX(2deg)',
              // Pas de `transition` ici : la rAF loop ci-dessus gère
              // l'interpolation manuellement (lerp). Une transition CSS
              // entrerait en conflit avec les mutations frame-par-frame.
              willChange: 'transform',
            }}
          >
            {/* ─── PROFONDEUR : empilement Z multi-niveaux ───
                Au lieu d'avoir tous les éléments à Z=0 (effet feuille de
                papier), on les stack à différentes profondeurs pour que la
                rotation crée une vraie parallaxe :
                  • Glow violet diffus           : Z = -80 px (loin derrière)
                  • Drop-shadow plate            : Z = -50 px (plan flou)
                  • Dos du téléphone (épaisseur) : Z = -16 px (corps)
                  • Cadre / bezel                : Z =   0 px (face avant)
                  • Écran (légèrement enfoncé)   : Z =  -4 px (recessed)
                  • Image (le contenu)           : Z =  +2 px (à fleur de bezel)
                  • Home indicator               : Z =  +6 px (touche relief)
                  • Reflet spéculaire haut       : Z =  +8 px (highlight glass)
                Tous les containers intermédiaires ont
                `transform-style: preserve-3d` pour que les translateZ
                s'additionnent dans la même scène 3D. */}

            {/* Glow violet — très loin derrière */}
            <div
              className="absolute -inset-6 rounded-[44px] opacity-25 blur-3xl bg-[var(--primary)] pointer-events-none"
              style={{ transform: 'translateZ(-80px)' }}
              aria-hidden="true"
            />

            {/* Ombre portée (élément flou foncé) — plan intermédiaire */}
            <div
              className="absolute inset-0 rounded-[36px] bg-black/55 blur-2xl pointer-events-none"
              style={{ transform: 'translateZ(-50px) translateY(20px) scale(0.98)' }}
              aria-hidden="true"
            />

            {/* Dos du téléphone — donne l'illusion d'épaisseur (~16px) */}
            <div
              className="absolute inset-0 rounded-[34px] pointer-events-none"
              style={{
                transform: 'translateZ(-16px)',
                background: 'linear-gradient(135deg, #1a1a1e 0%, #0a0a0e 100%)',
                boxShadow: '0 0 0 1px rgba(0,0,0,0.6)',
              }}
              aria-hidden="true"
            />

            {/* Phone frame — face avant (Z=0). preserve-3d pour propager
                les translateZ aux enfants (écran, indicator, reflet). */}
            <div
              className="relative w-[270px] rounded-[32px] p-[6px] bg-gradient-to-b from-[#2a2a2e] to-[#15151a]"
              style={{
                transformStyle: 'preserve-3d',
                boxShadow: [
                  'inset 0 1px 0 rgba(255,255,255,0.12)',
                  'inset 0 -1px 0 rgba(0,0,0,0.5)',
                  '0 0 0 1px rgba(255,255,255,0.08)',
                  '0 18px 45px rgba(0,0,0,0.45)',
                  '0 0 60px var(--primary-glow)',
                ].join(', '),
              }}
            >
              {/* Screen — l'image reste enfant direct (préservation du
                  comportement Next/Image `fill`). On NE met PAS preserve-3d
                  ici car overflow:hidden flatten le contexte 3D et casse le
                  rendu — la profondeur est portée par les couches Z du
                  frame parent (dos -16, bezel 0, glow -80, etc), pas par
                  l'intérieur de l'écran. */}
              <div className="rounded-[26px] overflow-hidden bg-black aspect-[9/19.5] relative">
                <Image
                  src={currentSrc}
                  alt={slides[idx].title}
                  fill
                  sizes="270px"
                  loading={idx === 0 ? 'eager' : 'lazy'}
                  priority={idx === 0}
                  className={`object-cover object-top transition-all duration-300 ${animating ? 'opacity-0 -translate-x-5' : 'opacity-100 translate-x-0'}`}
                />

                {/* Reflet spéculaire haut — overlay 2D simple (pas de
                    translateZ) qui simule le verre brillant en haut de
                    l'écran. mixBlendMode screen → blanchit légèrement
                    sans cacher l'image. */}
                <div
                  className="absolute inset-x-0 top-0 h-1/3 pointer-events-none z-10"
                  style={{
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 100%)',
                    mixBlendMode: 'screen',
                  }}
                  aria-hidden="true"
                />
              </div>

              {/* Home indicator — touche de relief +6px (sur la couche 3D du frame) */}
              <div
                className="absolute bottom-[8px] left-1/2 w-[90px] h-[4px] rounded-full bg-white/25 z-20"
                style={{ transform: 'translateX(-50%) translateZ(6px)' }}
                aria-hidden="true"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
