'use client';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useState, useEffect, useCallback, useRef } from 'react';

// Chaque slide a une variante dark et une variante light. Lorsque l'utilisateur
// a un thème clair actif (système ou classe `.light`/.dark sur <html>), on
// bascule sur la variante light.
const IMAGES: { dark: string; light: string }[] = [
  { dark: '/img/01_feed-v2.webp',        light: '/img/01_feed_light-v2.webp' },
  { dark: '/img/02_dish_detail-v2.webp', light: '/img/02_dish_detail_light-v2.webp' },
  { dark: '/img/03_categories-v2.webp',  light: '/img/03_categories_light-v2.webp' },
  { dark: '/img/04_add_review-v2.webp',  light: '/img/04_add_review_light-v2.webp' },
  { dark: '/img/06_map-v2.webp',         light: '/img/06_map_light-v2.webp' },
  { dark: '/img/08_profile-v2.webp',     light: '/img/08_profile_light-v2.webp' },
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

  return (
    <section className="py-12 sm:py-20 overflow-hidden" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        {/* Info */}
        <div className="flex flex-col gap-3 items-center text-center md:items-end md:text-right">
          <p className="text-[15px] font-semibold text-[var(--primary)]">{t('label')}</p>
          <h2
            className={`display transition-all duration-300 ${animating ? 'opacity-0 translate-x-8' : 'opacity-100 translate-x-0'}`}
            style={{ fontSize: 'clamp(2.25rem, 4.6vw, 3.6rem)' }}
          >
            {slides[idx].title}
          </h2>
          <p
            className={`text-base text-[var(--text2)] leading-relaxed max-w-[400px] transition-all duration-300 delay-[40ms] ${animating ? 'opacity-0 translate-x-8' : 'opacity-100 translate-x-0'}`}
          >
            {slides[idx].desc}
          </p>
          {/* Dots — active state plus large (w-7) + hover patterns alignés
              avec le langage du site (translate subtil, pas scale 1.25). */}
          <div className="flex gap-2 mt-2">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                aria-label={`Slide ${i + 1}`}
                className={`cursor-pointer h-2.5 rounded-full transition-all duration-300 ${i === idx ? 'w-7 bg-[var(--primary)]' : 'w-2.5 bg-[var(--border2)] hover:bg-[var(--primary)]/60'}`}
              />
            ))}
          </div>
          {/* Arrows — translate-only on hover (skill: stable hover states,
              avoid scale that shifts layout). */}
          <div className="hidden md:flex gap-2 mt-1">
            <button onClick={goPrev} aria-label="Previous slide" className="cursor-pointer w-10 h-10 rounded-full border border-[var(--border2)] bg-[var(--surface)] text-[var(--text2)] flex items-center justify-center hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors duration-200">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
            </button>
            <button onClick={goNextManual} aria-label="Next slide" className="cursor-pointer w-10 h-10 rounded-full border border-[var(--border2)] bg-[var(--surface)] text-[var(--text2)] flex items-center justify-center hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors duration-200">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
            </button>
          </div>
        </div>
        {/* Téléphone (masqué sur mobile) — à plat : pas d'inclinaison 3D, de
            halo, d'ombre portée ni de reflet (oct. 2026). Un cadre sombre uni
            suffit à dire « capture d'app ». */}
        <div className="hidden md:flex justify-center">
          <div className="w-[270px] rounded-[32px] p-[6px] bg-[#1C1917] border border-[var(--border2)]">
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
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
