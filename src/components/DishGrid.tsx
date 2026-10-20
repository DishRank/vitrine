'use client';
import { useTranslations } from 'next-intl';
import { useSearchParams, useParams } from 'next/navigation';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import type { DishRow } from '@/lib/supabase';
import type { DisplayMode } from '@/lib/ranking';
import { citySlug, restaurantSlug } from '@/lib/slug';
import DownloadButtons from './DownloadButtons';
import M3Spinner from './M3Spinner';
import LegalLink from './LegalLink';

export default function DishGrid({
  initialDishes,
  title,
  mode = 'ranking',
}: {
  initialDishes: DishRow[];
  /** Titre pre-calcule cote serveur (grammaire FR correcte + prefixe "plats" pour les nationalites). */
  title: string;
  /** `fresh` : pas assez d'avis pour classer → derniers plats notés, sans rang. */
  mode?: DisplayMode;
}) {
  const t = useTranslations('feed');
  const tw = useTranslations('why');
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
      <div className="pt-8 pb-6 sm:pb-9">
        <h2 className="display text-left" style={{ fontSize: 'clamp(2rem, 4.6vw, 3.4rem)' }}>
          {mode === 'fresh' ? t('freshTitle') : title}
        </h2>
        {mode === 'fresh' && (
          <p className="mt-3 max-w-[40rem] text-[15px] leading-relaxed text-[var(--text2)]">
            {t('freshNote')}{' '}
            <LegalLink page="reviews" className="font-semibold text-[var(--primary)] underline decoration-1 underline-offset-2 hover:opacity-80">
              {tw('reviewsLink')}
            </LegalLink>
          </p>
        )}
      </div>

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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-8 sm:gap-x-5">
          {dishes.map((d, i) => (
            <article
              key={`${d.restaurant_id}::${d.dish_name}`}
              role="button"
              tabIndex={0}
              aria-label={`${d.dish_name} — ${d.restaurant_name}${d.restaurant_city ? `, ${d.restaurant_city}` : ''} — ${d.avg_rating}/5`}
              className="dish-card group relative cursor-pointer rounded-[18px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--bg)]"
              onClick={() => window.dispatchEvent(new CustomEvent('open-dish', { detail: d }))}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); window.dispatchEvent(new CustomEvent('open-dish', { detail: d })); } }}
            >
              <div className="relative aspect-square overflow-hidden rounded-[18px] bg-[var(--surface-var)]">
                <Image
                  src={d.cover_photo_url}
                  alt={`${d.dish_name} chez ${d.restaurant_name}${d.restaurant_city ? ` à ${d.restaurant_city}` : ''}`}
                  fill
                  className="object-cover group-hover:scale-[1.04] transition-transform duration-500 ease-out"
                  // Cadre carré, photos paysage (~4:3) : ~1,35× la largeur du
                  // cadre pour couvrir sa hauteur sans agrandir l'image.
                  sizes="(max-width: 640px) 60vw, (max-width: 1024px) 42vw, (max-width: 1280px) 30vw, 300px"
                  quality={85}
                  priority={i === 0}
                  loading={i < 4 ? 'eager' : 'lazy'}
                  fetchPriority={i === 0 ? 'high' : undefined}
                />
                <div className="display absolute top-2.5 right-2.5 flex items-center gap-1 rounded-full bg-[var(--surface)] px-2.5 py-1 text-[17px] leading-none text-[var(--text)]">
                  {Number(d.avg_rating).toFixed(1).replace('.', locale === 'en' ? '.' : ',')}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--moutarde)" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                </div>
                {/* Rang #X en bas à gauche — ombre de texte courte, juste pour la lisibilité sur photo */}
                {mode === 'ranking' && (
                  <span
                    className="display absolute bottom-1 left-3 text-white leading-none pointer-events-none"
                    style={{ fontSize: 'clamp(3rem, 6vw, 4.25rem)', textShadow: '0 2px 8px rgba(0,0,0,0.45)' }}
                    aria-label={`Rang ${i + 1}`}
                  >
                    {i + 1}
                  </span>
                )}
              </div>
              <div className="px-0.5 pt-3">
                <h3 className="text-[15px] font-bold leading-snug truncate group-hover:text-[var(--primary)] transition-colors duration-200">{d.dish_name}</h3>
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
                <p className="mt-1 text-xs text-[var(--text3)]">
                  {t('reviews', { count: d.review_count })}
                  {d.latest_price ? ` · ${Number(d.latest_price).toFixed(2).replace('.', locale === 'en' ? '.' : ',')} ${d.currency === 'EUR' || !d.currency ? '€' : d.currency}` : ''}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
