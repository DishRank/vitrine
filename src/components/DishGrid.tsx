'use client';
import { useTranslations } from 'next-intl';
import { useSearchParams, useParams } from 'next/navigation';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import type { DishRow } from '@/lib/supabase';
import { citySlug, restaurantSlug } from '@/lib/slug';
import DownloadButtons from './DownloadButtons';
import M3Spinner from './M3Spinner';

export default function DishGrid({
  initialDishes,
  title,
}: {
  initialDishes: DishRow[];
  /** Titre pre-calcule cote serveur (grammaire FR correcte + prefixe "plats" pour les nationalites). */
  title: string;
}) {
  const t = useTranslations('feed');
  const sp = useSearchParams();
  const routeParams = useParams<{ locale?: string }>();
  const locale = routeParams?.locale || 'fr';
  const localePrefix = locale === 'fr' ? '' : `/${locale}`;
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
  }, [initialDishes]);

  const dishes = useMemo(() => {
    let filtered = initialDishes;
    if (q.trim().length >= 2) {
      const lower = q.toLowerCase();
      filtered = filtered.filter(
        (d) => d.dish_name.toLowerCase().includes(lower) || d.restaurant_name.toLowerCase().includes(lower)
      );
    }
    // Limiter a 10 plats max pour respecter le "Top 10" du titre.
    return filtered.slice(0, 10);
  }, [initialDishes, q]);

  return (
    <div id="top10" className="max-w-[1200px] mx-auto px-5 sm:px-8 pb-8 min-h-[300px]">
      {/* Title H3 — match v3 sizing (~28px desktop) and align to the left like v3 Top10 */}
      <h2 className="text-xl sm:text-3xl font-bold tracking-tight pt-4 pb-5 sm:pb-7 text-center sm:text-left">{title}</h2>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <M3Spinner size={48} />
            <p className="text-sm text-[var(--text3)]">{t('loadingDishes')}</p>
          </div>
        </div>
      ) : dishes.length === 0 ? (
        <div className="text-center py-16">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 text-[var(--primary)]"
            style={{
              background: 'var(--primary-container)',
              border: '1px solid color-mix(in srgb, var(--primary) 25%, transparent)',
            }}
            aria-hidden="true"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <p className="text-lg font-bold mb-1">{t('noResults')}</p>
          <p className="text-[var(--text2)] text-sm mb-5">{t('beFirst')}</p>
          <DownloadButtons size="lg" />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {dishes.map((d, i) => (
            <article
              key={`${d.restaurant_id}::${d.dish_name}`}
              role="button"
              tabIndex={0}
              aria-label={`${d.dish_name} — ${d.restaurant_name}${d.restaurant_city ? `, ${d.restaurant_city}` : ''} — ${d.avg_rating}/5`}
              className="dish-card lift group relative bg-[var(--surface)] border border-[var(--border2)] rounded-2xl overflow-hidden cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2"
              onClick={() => window.dispatchEvent(new CustomEvent('open-dish', { detail: d }))}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); window.dispatchEvent(new CustomEvent('open-dish', { detail: d })); } }}
            >
              <div className="relative h-36 overflow-hidden">
                <Image
                  src={d.cover_photo_url}
                  alt={`${d.dish_name} chez ${d.restaurant_name}${d.restaurant_city ? ` à ${d.restaurant_city}` : ''}`}
                  fill
                  className="object-cover group-hover:scale-[1.04] transition-transform duration-500 ease-out"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                  priority={i === 0}
                  loading={i < 4 ? 'eager' : 'lazy'}
                  fetchPriority={i === 0 ? 'high' : undefined}
                />
                <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/70 rounded-lg px-2 py-1 text-xs font-bold text-white">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="#F9CA24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  {d.avg_rating}
                </div>
                <div className="absolute top-2 left-2 bg-black/70 rounded-lg px-2 py-1 text-xs font-semibold text-white inline-flex items-center gap-1">
                  <span>{d.review_count}</span>
                  <span>{t('reviewsLabel', { count: d.review_count })}</span>
                </div>
                {/* Rang #X en bas à gauche — ombre de texte courte, juste pour la lisibilité sur photo */}
                <div
                  className="absolute bottom-2 left-2.5 inline-flex items-baseline gap-0.5 text-white pointer-events-none"
                  style={{ textShadow: '0 1px 3px rgba(0,0,0,0.75)' }}
                  aria-label={`Rang ${i + 1}`}
                >
                  <span className="font-extrabold opacity-80" style={{ fontSize: 11 }}>#</span>
                  <span
                    className="font-extrabold leading-none"
                    style={{ fontSize: 30, letterSpacing: '-1.5px' }}
                  >
                    {i + 1}
                  </span>
                </div>
              </div>
              <div className="p-3">
                <h3 className="text-sm font-bold truncate group-hover:text-[var(--primary)] transition-colors duration-300">{d.dish_name}</h3>
                {/* Nom du resto cliquable → page resto. stopPropagation pour ne
                    pas déclencher l'ouverture du DishModal de la card parent.
                    Hyperlien `<a>` SSR-friendly pour que Google suive le
                    maillage interne (vs onClick router.push qui ne génère pas
                    d'href dans le HTML). */}
                {d.restaurant_city ? (
                  <a
                    href={`${localePrefix}/${citySlug(d.restaurant_city)}/r/${restaurantSlug(d.restaurant_name)}`}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    className="block text-xs text-[var(--text2)] truncate mt-0.5 hover:text-[var(--primary)] hover:underline transition-colors duration-300"
                    aria-label={`Voir tous les plats de ${d.restaurant_name}`}
                  >
                    {d.restaurant_name}
                  </a>
                ) : (
                  <p className="text-xs text-[var(--text2)] truncate mt-0.5 group-hover:text-[var(--text)] transition-colors duration-300">
                    {d.restaurant_name}
                  </p>
                )}
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
