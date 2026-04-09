'use client';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useState, useEffect, useCallback, useRef } from 'react';

const IMAGES = [
  '/img/01_feed.webp',
  '/img/02_dish_detail.webp',
  '/img/03_categories.webp',
  '/img/04_add_review.webp',
  '/img/05_settings.webp',
  '/img/06_map.webp',
  '/img/07_restaurant.webp',
  '/img/08_profile.webp',
];

export default function Showcase() {
  const t = useTranslations('showcase');
  const slides = t.raw('slides') as { title: string; desc: string }[];
  const [idx, setIdx] = useState(0);
  const [animating, setAnimating] = useState(false);

  const goTo = useCallback((i: number) => {
    const next = ((i % slides.length) + slides.length) % slides.length;
    setAnimating(true);
    setTimeout(() => { setIdx(next); setAnimating(false); }, 300);
  }, [slides.length]);

  // Auto-rotate, pause when tab is hidden
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    const start = () => { timer = setInterval(() => goTo(idx + 1), 8000); };
    const stop = () => clearInterval(timer);
    const onVisibility = () => { document.hidden ? stop() : start(); };
    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility); };
  }, [idx, goTo]);

  // Touch swipe
  const touchStart = useRef(0);
  const onTouchStart = (e: React.TouchEvent) => { touchStart.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStart.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) goTo(diff > 0 ? idx + 1 : idx - 1);
  };

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
          {/* Arrows */}
          <div className="flex gap-2 mt-1">
            <button onClick={() => goTo(idx - 1)} aria-label="Previous slide" className="cursor-pointer w-10 h-10 rounded-full border border-[var(--border2)] bg-[var(--surface)] text-[var(--text2)] flex items-center justify-center hover:border-[var(--primary)] hover:text-[var(--primary)] hover:-translate-x-0.5 hover:scale-110 transition-all duration-200">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
            </button>
            <button onClick={() => goTo(idx + 1)} aria-label="Next slide" className="cursor-pointer w-10 h-10 rounded-full border border-[var(--border2)] bg-[var(--surface)] text-[var(--text2)] flex items-center justify-center hover:border-[var(--primary)] hover:text-[var(--primary)] hover:translate-x-0.5 hover:scale-110 transition-all duration-200">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
            </button>
          </div>
        </div>
        {/* Phone - hidden on mobile */}
        <div className="hidden md:flex justify-center" style={{ perspective: '1200px' }}>
          <div
            className="relative transition-transform duration-700 ease-out"
            style={{ transformStyle: 'preserve-3d', transform: 'rotateY(-6deg) rotateX(2deg)' }}
          >
            {/* Subtle glow behind phone */}
            <div className="absolute -inset-4 rounded-[40px] opacity-15 blur-2xl bg-[var(--primary)]" style={{ transform: 'translateZ(-40px)' }} />

            {/* Phone frame — minimal bezel */}
            <div className="relative w-[270px] rounded-[32px] p-[6px] bg-gradient-to-b from-[#2a2a2e] to-[#1a1a1e]"
              style={{
                boxShadow: [
                  'inset 0 1px 0 rgba(255,255,255,0.1)',
                  '0 0 0 1px rgba(255,255,255,0.08)',
                  '0 12px 40px rgba(0,0,0,0.4)',
                  '0 0 60px var(--primary-glow)',
                ].join(', '),
              }}
            >
              {/* Screen */}
              <div className="rounded-[26px] overflow-hidden bg-black aspect-[9/19.5] relative">
                <Image
                  src={IMAGES[idx]}
                  alt={slides[idx].title}
                  fill
                  sizes="270px"
                  loading={idx === 0 ? 'eager' : 'lazy'}
                  priority={idx === 0}
                  className={`object-cover object-top transition-all duration-300 ${animating ? 'opacity-0 -translate-x-5' : 'opacity-100 translate-x-0'}`}
                />
              </div>

              {/* Home indicator */}
              <div className="absolute bottom-[8px] left-1/2 -translate-x-1/2 w-[90px] h-[4px] rounded-full bg-white/20 z-20" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
