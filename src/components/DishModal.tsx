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
        <div className="relative h-44 sm:h-52 shrink-0 bg-[var(--surface-var)] flex items-center justify-center">
          <button onClick={close} className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={dish.cover_photo_url}
            alt={`${dish.dish_name} chez ${dish.restaurant_name}`}
            onLoad={() => setImgLoaded(true)}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
          />
        </div>

        {/* Body */}
        <div className="legal-scroll flex-1 overflow-y-auto p-5">
          <h2 className="text-xl font-extrabold mb-2">{dish.dish_name}</h2>

          {/* Rating */}
          <div className="flex items-center gap-1.5 mb-3 flex-wrap">
            <div className="flex gap-0.5">
              {stars.map((filled, i) => (
                <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill={filled ? '#F9CA24' : 'var(--border2)'}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              ))}
            </div>
            <span className="text-sm font-bold">{dish.avg_rating}/5</span>
            <span className="text-xs text-[var(--text3)] bg-[var(--surface-var)] px-2 py-0.5 rounded-md">
              {tf('reviews', { count: dish.review_count })}
            </span>
          </div>

          {/* Restaurant */}
          <div className="flex items-center gap-1.5 text-sm text-[var(--text2)] mb-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--primary)" aria-hidden="true"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg>
            {dish.restaurant_name}
            {dish.restaurant_address && ` — ${dish.restaurant_address}`}
          </div>

          {/* Price */}
          {dish.latest_price && (
            <span className="inline-block text-sm font-bold text-[var(--primary)] bg-[var(--primary-container)] px-3 py-1 rounded-lg mb-4">
              {Number(dish.latest_price).toFixed(2)} {dish.currency || 'EUR'}
            </span>
          )}

          {/* CTA */}
          <div className="border-t border-[var(--border)] pt-4 mt-2 text-center">
            <p className="text-sm text-[var(--text2)] mb-3">{t('downloadCta')}</p>
            <a
              href="#"
              onClick={openBetaModal}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--primary)] text-white font-semibold rounded-full hover:bg-[var(--primary-light)] hover:text-[var(--bg)] transition-all text-sm"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.807 1.626a1 1 0 0 1 0 1.732l-2.807 1.626L15.206 12l2.492-2.492zM5.864 2.658L16.8 8.99l-2.302 2.302-8.634-8.634z"/></svg>
              Google Play
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
