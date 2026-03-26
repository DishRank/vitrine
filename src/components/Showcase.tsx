'use client';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useState, useEffect, useCallback, useRef } from 'react';

const IMAGES = [
  '/img/01_feed.jpg',
  '/img/02_dish_detail.jpg',
  '/img/03_categories.jpg',
  '/img/04_add_review.jpg',
  '/img/05_settings.jpg',
  '/img/06_map.jpg',
  '/img/07_restaurant.jpg',
  '/img/08_profile.jpg',
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

  useEffect(() => {
    const timer = setInterval(() => goTo(idx + 1), 5000);
    return () => clearInterval(timer);
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
                className={`h-2.5 rounded-full transition-all duration-300 ${i === idx ? 'w-7 bg-[var(--primary)]' : 'w-2.5 bg-[var(--border2)] hover:bg-[var(--text3)]'}`}
              />
            ))}
          </div>
          {/* Arrows */}
          <div className="flex gap-2 mt-1">
            <button onClick={() => goTo(idx - 1)} className="w-10 h-10 rounded-full border border-[var(--border2)] bg-[var(--surface)] text-[var(--text2)] flex items-center justify-center hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
            </button>
            <button onClick={() => goTo(idx + 1)} className="w-10 h-10 rounded-full border border-[var(--border2)] bg-[var(--surface)] text-[var(--text2)] flex items-center justify-center hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all">
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
            <div className="absolute -inset-4 rounded-[50px] opacity-15 blur-2xl bg-[var(--primary)]" style={{ transform: 'translateZ(-40px)' }} />

            {/* Phone frame */}
            <div className="relative w-[270px] rounded-[40px] p-[10px] bg-gradient-to-b from-[#2a2a2e] to-[#1a1a1e]"
              style={{
                boxShadow: [
                  'inset 0 1px 0 rgba(255,255,255,0.1)',
                  'inset 0 -1px 0 rgba(0,0,0,0.3)',
                  '0 0 0 1px rgba(255,255,255,0.08)',
                  '0 4px 8px rgba(0,0,0,0.3)',
                  '0 12px 24px rgba(0,0,0,0.3)',
                  '0 24px 48px rgba(0,0,0,0.25)',
                  '0 0 60px var(--primary-glow)',
                ].join(', '),
              }}
            >
              {/* Side button (power) */}
              <div className="absolute -right-[3px] top-24 w-[3px] h-10 rounded-r-sm bg-[#3a3a3e]" />
              {/* Side buttons (volume) */}
              <div className="absolute -left-[3px] top-20 w-[3px] h-6 rounded-l-sm bg-[#3a3a3e]" />
              <div className="absolute -left-[3px] top-28 w-[3px] h-6 rounded-l-sm bg-[#3a3a3e]" />

              {/* Dynamic Island */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-[100px] h-[28px] bg-black rounded-full z-20 flex items-center justify-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#1a1a2e] ring-1 ring-[#2a2a3e]" />
              </div>

              {/* Screen bezel */}
              <div className="rounded-[30px] overflow-hidden bg-black aspect-[250/540] relative">
                <Image
                  src={IMAGES[idx]}
                  alt={slides[idx].title}
                  fill
                  sizes="270px"
                  loading={idx === 0 ? 'eager' : 'lazy'}
                  priority={idx === 0}
                  className={`object-cover transition-all duration-300 ${animating ? 'opacity-0 -translate-x-5' : 'opacity-100 translate-x-0'}`}
                />
              </div>

              {/* Home indicator */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[100px] h-[4px] rounded-full bg-white/20 z-20" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
