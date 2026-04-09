'use client';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, useCallback, useEffect } from 'react';
import type { CategoryRow } from '@/lib/supabase';
import { citySlug } from '@/lib/slug';
import { localizedCategory } from '@/lib/categoryLabels';

const CHIP_STEPS = [10, 30, 60, 100];

export default function SearchSection({
  categories,
  initialCategory,
  initialCity,
  initialQuery,
  cities,
}: {
  categories: CategoryRow[];
  initialCategory: string;
  initialCity: string;
  initialQuery: string;
  cities: string[];
}) {
  const t = useTranslations('search');
  const locale = useLocale();
  const router = useRouter();
  const [category, setCategory] = useState(initialCategory);
  const [city, setCity] = useState(initialCity || (cities.length === 1 ? cities[0] : ''));
  const [query, setQuery] = useState(initialQuery);
  const [chipLevel, setChipLevel] = useState(0);
  const [prevLimit, setPrevLimit] = useState(CHIP_STEPS[0]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  /**
   * Navigate to the path-based URL matching the current filter combo.
   * - city + category : /[locale]/[city-slug]/[category]
   * - city alone      : /[locale]/[city-slug]
   * - category alone  : /[locale]/c/[category]
   * - none            : /[locale]
   * The optional ?q= text search is preserved as a query string.
   */
  const navigate = useCallback(
    (cat: string, c: string, q: string, isFilter = false) => {
      const localePrefix = locale === 'fr' ? '' : `/${locale}`;
      let path = localePrefix || '/';
      if (c && cat) path = `${localePrefix}/${citySlug(c)}/${cat}`;
      else if (c) path = `${localePrefix}/${citySlug(c)}`;
      else if (cat) path = `${localePrefix}/c/${cat}`;
      const qs = q ? `?q=${encodeURIComponent(q)}` : '';
      if (isFilter) window.dispatchEvent(new CustomEvent('dish-loading'));
      router.push(`${path}${qs}`, { scroll: false });
    },
    [router, locale]
  );

  const allChips = [
    { slug: '', icon: '', label: t('all') },
    ...categories.map((c) => {
      const localized = localizedCategory(c.slug, locale);
      // Capitalize first letter for display
      const displayLabel = localized.charAt(0).toUpperCase() + localized.slice(1);
      return {
        slug: c.slug,
        icon: c.icon,
        label: `${c.icon} ${displayLabel}`,
      };
    }),
  ];

  const limit = CHIP_STEPS[chipLevel] ?? allChips.length;
  const visibleChips = allChips.slice(0, limit);
  const hasMore = limit < allChips.length;

  const selectCategory = (slug: string) => {
    setCategory(slug);
    navigate(slug, city, query, true);
    setSheetOpen(false);
  };

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-8 pb-4">
      <p className="text-lg sm:text-2xl font-extrabold text-center text-[var(--text)] mt-4 sm:mt-6 mb-3 sm:mb-4">
        {t('label')}
      </p>

      {/* Search bar */}
      <div className="relative">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center bg-[var(--surface)] border border-[var(--border2)] rounded-2xl sm:rounded-full px-3 py-2 sm:px-2 sm:py-1.5 gap-2 sm:gap-0 focus-within:border-[var(--primary)] focus-within:ring-2 focus-within:ring-[var(--primary-container)] transition-all">
          {/* City */}
          <div className="flex items-center gap-1.5 sm:pl-3 sm:pr-3 shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--primary)" aria-hidden="true"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
            <button
              type="button"
              aria-label={t('allCities')}
              onClick={() => setCityDropdownOpen(!cityDropdownOpen)}
              className="bg-transparent border-none outline-none text-sm font-semibold cursor-pointer flex items-center gap-1 min-w-0 sm:w-28"
              style={{ color: city ? 'var(--text)' : 'var(--text3)' }}
            >
              <span className="truncate">{city || t('allCities')}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="shrink-0 opacity-50"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>
            </button>
          </div>
        <div className="hidden sm:block w-px h-6 bg-[var(--border2)] shrink-0" />
        <div className="block sm:hidden h-px w-full bg-[var(--border2)]" />
        {/* Query */}
        <div className="flex items-center gap-2 flex-1 sm:px-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            type="text"
            aria-label={t('placeholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') navigate(category, city, query); }}
            placeholder={t('placeholder')}
            className="bg-transparent border-none outline-none text-[var(--text)] text-sm flex-1 min-w-0 py-1 placeholder:text-[var(--text3)]"
          />
          {query && (
            <button onClick={() => { setQuery(''); navigate(category, city, ''); }} className="text-[var(--text3)] hover:text-[var(--text)]" aria-label="Clear search">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/></svg>
            </button>
          )}
        </div>
        </div>
        {/* City dropdown — outside search bar to avoid clipping */}
        {cityDropdownOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setCityDropdownOpen(false)} />
            <div className="absolute left-3 sm:left-4 top-full mt-1 z-50 bg-[var(--surface)] border border-[var(--border2)] rounded-xl shadow-xl max-h-60 overflow-y-auto min-w-[200px] py-1 animate-[fadeUp_0.15s_ease]">
              <button
                type="button"
                onClick={() => { setCity(''); setCityDropdownOpen(false); navigate(category, '', query, true); }}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-[var(--primary-container)] rounded-lg mx-0 ${!city ? 'text-[var(--primary)] font-bold' : 'text-[var(--text)]'}`}
              >
                {t('allCities')}
              </button>
              {cities.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => { setCity(c); setCityDropdownOpen(false); navigate(category, c, query, true); }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-[var(--primary-container)] ${city === c ? 'text-[var(--primary)] font-bold' : 'text-[var(--text)]'}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Category chips - desktop: inline with animation, mobile: limited + bottom sheet */}
      <div className="flex flex-wrap gap-1.5 sm:gap-2 pt-3">
        {(isMobile ? allChips.slice(0, 8) : visibleChips).map((c, i) => {
          const isNew = !isMobile && i >= prevLimit;
          return (
            <button
              key={c.slug}
              onClick={() => selectCategory(c.slug)}
              className={`cursor-pointer px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium border transition-all duration-200 shrink-0 hover:-translate-y-0.5 hover:scale-[1.03] ${
                c.slug === category
                  ? 'bg-[var(--primary)] border-[var(--primary)] text-white font-semibold'
                  : 'bg-[var(--surface)] border-[var(--border2)] text-[var(--text2)] hover:border-[var(--primary)] hover:text-[var(--text)]'
              }`}
              style={isNew ? { animation: `chipPop 0.25s ease ${(i - prevLimit) * 8}ms both` } : undefined}
              aria-label={`Filter: ${c.label}`}
            >
              {c.label}
            </button>
          );
        })}
        {/* Mobile: open bottom sheet */}
        {isMobile && (
          <button
            onClick={() => setSheetOpen(true)}
            className="cursor-pointer px-3 py-1 rounded-full text-xs font-medium border border-[var(--primary)] text-[var(--primary)] inline-flex items-center gap-1 hover:bg-[var(--primary-container)] hover:-translate-y-0.5 transition-all duration-200"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>
            {t('more')}
          </button>
        )}
        {/* Desktop: inline more/less */}
        {!isMobile && chipLevel > 0 && (
          <button
            onClick={() => { setPrevLimit(0); setChipLevel(0); }}
            className="cursor-pointer px-4 py-1.5 rounded-full text-sm font-medium border border-[var(--primary)] text-[var(--primary)] inline-flex items-center gap-1 hover:bg-[var(--primary-container)] hover:-translate-y-0.5 transition-all duration-200"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>
            {t('less')}
          </button>
        )}
        {!isMobile && hasMore && (
          <button
            onClick={() => { setPrevLimit(limit); setChipLevel((l) => Math.min(l + 1, CHIP_STEPS.length)); }}
            className="cursor-pointer px-4 py-1.5 rounded-full text-sm font-medium border border-[var(--primary)] text-[var(--primary)] inline-flex items-center gap-1 hover:bg-[var(--primary-container)] hover:-translate-y-0.5 transition-all duration-200"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>
            {t('more')}
          </button>
        )}
      </div>

      {/* Mobile bottom sheet for categories */}
      {sheetOpen && (
        <div
          className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-end justify-center animate-[fadeIn_0.2s_ease]"
          onClick={(e) => { if (e.target === e.currentTarget) setSheetOpen(false); }}
        >
          <div role="dialog" aria-modal="true" className="bg-[var(--surface)] rounded-t-3xl w-full max-h-[70vh] flex flex-col animate-[sheetUp_0.3s_ease]">
            <div className="px-5 pt-3 pb-2 shrink-0 flex items-center justify-between border-b border-[var(--border)]">
              <div className="w-9 h-1 bg-[var(--border2)] rounded-full mx-auto absolute left-1/2 -translate-x-1/2 top-3" />
              <p className="font-bold text-sm mt-2">{t('label')}</p>
              <button onClick={() => setSheetOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--surface-var)] text-[var(--text2)]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-wrap gap-2 content-start">
              {allChips.map((c) => (
                <button
                  key={c.slug}
                  onClick={() => selectCategory(c.slug)}
                  className={`cursor-pointer px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    c.slug === category
                      ? 'bg-[var(--primary)] border-[var(--primary)] text-white font-semibold'
                      : 'bg-[var(--surface)] border-[var(--border2)] text-[var(--text2)]'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
