'use client';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import type { DishRow } from '@/lib/supabase';
import { openBetaModal } from './BetaModal';
import M3Spinner from './M3Spinner';

export default function DishGrid({
  initialDishes,
  initialCategory,
  initialCity,
}: {
  initialDishes: DishRow[];
  initialCategory: string;
  initialCity: string;
}) {
  const t = useTranslations('feed');
  const sp = useSearchParams();
  const q = sp.get('q') || '';
  const [loading, setLoading] = useState(false);

  // Listen for navigation events from SearchSection
  useEffect(() => {
    const onLoading = () => setLoading(true);
    window.addEventListener('dish-loading', onLoading);
    return () => window.removeEventListener('dish-loading', onLoading);
  }, []);

  // Clear loading when server data arrives (props change)
  useEffect(() => {
    setLoading(false);
  }, [initialDishes, initialCategory, initialCity]);

  const dishes = useMemo(() => {
    let filtered = initialDishes;
    if (q.trim().length >= 2) {
      const lower = q.toLowerCase();
      filtered = filtered.filter(
        (d) => d.dish_name.toLowerCase().includes(lower) || d.restaurant_name.toLowerCase().includes(lower)
      );
    }
    return filtered;
  }, [initialDishes, q]);

  // Title
  let title = t('topRated');
  if (initialCategory && initialCity) title = t('topRatedCityCategory', { category: initialCategory, city: initialCity });
  else if (initialCategory) title = t('topRatedCategory', { category: initialCategory });
  else if (initialCity) title = t('topRatedCity', { city: initialCity });

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-8 pb-8 min-h-[300px]">
      <h2 className="text-lg font-bold py-3">{title}</h2>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <M3Spinner size={48} />
            <p className="text-sm text-[var(--text3)]">{t('topRated')}...</p>
          </div>
        </div>
      ) : dishes.length === 0 ? (
        <div className="text-center py-16">
          <span className="text-5xl block mb-3">&#128269;</span>
          <p className="text-lg font-bold mb-1">{t('noResults')}</p>
          <p className="text-[var(--text2)] text-sm mb-5">{t('beFirst')}</p>
          <a
            href="#"
            onClick={openBetaModal}
            className="inline-flex items-center gap-2 px-7 py-3 bg-[var(--primary)] text-white font-semibold rounded-full"
          >
            {t('download')}
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {dishes.map((d, i) => (
            <article
              key={`${d.restaurant_id}::${d.dish_name}`}
              role="button"
              tabIndex={0}
              aria-label={`${d.dish_name} — ${d.restaurant_name}${d.restaurant_city ? `, ${d.restaurant_city}` : ''} — ${d.avg_rating}/5`}
              className="group bg-[var(--surface)] rounded-2xl overflow-hidden cursor-pointer hover:-translate-y-1 hover:shadow-xl hover:shadow-[var(--card-shadow)] transition-all duration-300 animate-[fadeUp_0.4s_ease_both] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2"
              style={{ animationDelay: `${i * 40}ms` }}
              onClick={() => window.dispatchEvent(new CustomEvent('open-dish', { detail: d }))}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); window.dispatchEvent(new CustomEvent('open-dish', { detail: d })); } }}
            >
              <div className="relative h-36 overflow-hidden">
                <Image
                  src={d.cover_photo_url}
                  alt={`${d.dish_name} chez ${d.restaurant_name}${d.restaurant_city ? ` à ${d.restaurant_city}` : ''}`}
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                  priority={i === 0}
                  loading={i < 4 ? 'eager' : 'lazy'}
                  fetchPriority={i === 0 ? 'high' : undefined}
                />
                {/* Subtle dark overlay on hover for depth */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1 text-xs font-bold text-white group-hover:bg-black/80 group-hover:scale-105 transition-all duration-300">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="#F9CA24" className="group-hover:rotate-[20deg] transition-transform duration-300"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  {d.avg_rating}
                </div>
                <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1 text-xs font-semibold text-white group-hover:bg-black/80 transition-colors duration-300 inline-flex items-center gap-1">
                  <span>{d.review_count}</span>
                  <span>{t('reviewsLabel', { count: d.review_count })}</span>
                </div>
              </div>
              <div className="p-3">
                <h3 className="text-sm font-bold truncate group-hover:text-[var(--primary)] transition-colors duration-300">{d.dish_name}</h3>
                <p className="text-xs text-[var(--text2)] truncate mt-0.5 group-hover:text-[var(--text)] transition-colors duration-300">{d.restaurant_name}</p>
                {d.latest_price && (
                  <span className="inline-block mt-1 text-xs font-bold text-[var(--primary)] bg-[var(--primary-container)] px-2 py-0.5 rounded-md group-hover:bg-[var(--primary)] group-hover:text-white transition-colors duration-300">
                    {Number(d.latest_price).toFixed(2)} {d.currency || 'EUR'}
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
