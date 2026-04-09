'use client';
import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import type { DishRow } from '@/lib/supabase';
import { openBetaModal } from './BetaModal';

export default function DishModal() {
  const t = useTranslations('modal');
  const tf = useTranslations('feed');
  const [dish, setDish] = useState<DishRow | null>(null);
  const [closing, setClosing] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      setImgLoaded(false);
      setDish((e as CustomEvent).detail);
    };
    window.addEventListener('open-dish', handler);
    return () => window.removeEventListener('open-dish', handler);
  }, []);

  const close = () => {
    setClosing(true);
    setTimeout(() => { setDish(null); setClosing(false); }, 250);
  };

  if (!dish) return null;

  const stars = Array.from({ length: 5 }, (_, i) => i < Math.round(dish.avg_rating));

  return (
    <div
      className={`fixed inset-0 z-[250] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 ${closing ? 'animate-[fadeOut_0.25s_ease_forwards]' : 'animate-[fadeIn_0.2s_ease]'}`}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`bg-[var(--surface)] rounded-2xl w-full max-w-[480px] max-h-[80vh] flex flex-col overflow-hidden ${closing ? 'animate-[sheetDown_0.25s_ease_forwards]' : 'animate-[slideUp_0.3s_ease]'}`}
      >
        {/* Hero image */}
        <div className="group/hero relative h-44 sm:h-52 shrink-0 bg-[var(--surface-var)] flex items-center justify-center overflow-hidden">
          <button onClick={close} aria-label="Close" className="cursor-pointer absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center bg-black/50 rounded-full text-white hover:bg-black/80 hover:scale-110 hover:rotate-90 transition-all duration-300">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={dish.cover_photo_url}
            alt={`${dish.dish_name} chez ${dish.restaurant_name}`}
            onLoad={() => setImgLoaded(true)}
            className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ease-out group-hover/hero:scale-105 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
          />
          {/* Gradient overlay for depth */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
        </div>

        {/* Body */}
        <div className="legal-scroll flex-1 overflow-y-auto p-5">
          <h2 className="text-xl font-extrabold mb-2">{dish.dish_name}</h2>

          {/* Rating */}
          <div className="flex items-center gap-1.5 mb-3 flex-wrap">
            <div className="group/stars flex gap-0.5">
              {stars.map((filled, i) => (
                <svg
                  key={i}
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill={filled ? '#F9CA24' : 'var(--border2)'}
                  className="transition-transform duration-300 group-hover/stars:scale-110"
                  style={{ transitionDelay: `${i * 40}ms` }}
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              ))}
            </div>
            <span className="text-sm font-bold">{dish.avg_rating}/5</span>
            <span className="text-xs text-[var(--text3)] bg-[var(--surface-var)] px-2 py-0.5 rounded-md hover:bg-[var(--primary-container)] hover:text-[var(--primary)] transition-colors duration-200">
              {tf('reviews', { count: dish.review_count })}
            </span>
          </div>

          {/* Restaurant */}
          <div className="group/resto flex items-center gap-1.5 text-sm text-[var(--text2)] mb-2 hover:text-[var(--text)] transition-colors duration-200">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--primary)" aria-hidden="true" className="shrink-0 group-hover/resto:scale-125 transition-transform duration-200"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg>
            {dish.restaurant_name}
            {dish.restaurant_address && ` — ${dish.restaurant_address}`}
          </div>

          {/* Price */}
          {dish.latest_price && (
            <span className="inline-block text-sm font-bold text-[var(--primary)] bg-[var(--primary-container)] px-3 py-1 rounded-lg mb-4 hover:bg-[var(--primary)] hover:text-white hover:scale-105 transition-all duration-300 cursor-default">
              {Number(dish.latest_price).toFixed(2)} {dish.currency || 'EUR'}
            </span>
          )}

          {/* CTA */}
          <div className="border-t border-[var(--border)] pt-4 mt-2 text-center">
            <p className="text-sm text-[var(--text2)] mb-3">{t('downloadCta')}</p>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <a
                href="#"
                onClick={openBetaModal}
                aria-label="Google Play"
                className="cursor-pointer inline-flex items-center gap-2 px-5 py-3 bg-[var(--primary)] text-white font-semibold rounded-full hover:bg-[var(--primary-light)] hover:text-[var(--bg)] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[var(--primary-glow)] transition-all duration-200 text-sm"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.807 1.626a1 1 0 0 1 0 1.732l-2.807 1.626L15.206 12l2.492-2.492zM5.864 2.658L16.8 8.99l-2.302 2.302-8.634-8.634z"/></svg>
                Google Play
              </a>
              <a
                href="https://apps.apple.com/fr/app/dishrank/id6761752556"
                target="_blank"
                rel="noopener"
                aria-label="App Store"
                className="cursor-pointer inline-flex items-center gap-2 px-5 py-3 bg-[var(--primary)] text-white font-semibold rounded-full hover:bg-[var(--primary-light)] hover:text-[var(--bg)] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[var(--primary-glow)] transition-all duration-200 text-sm"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                App Store
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
