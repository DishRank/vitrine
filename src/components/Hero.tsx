import { useTranslations } from 'next-intl';

type Props = {
  /** Localized category label (e.g. "pizza", "pâtes") */
  category?: string;
  city?: string;
  /**
   * Pre-built "best {category}" fragment with correct grammar agreement
   * (e.g. "Le meilleur burger" / "La meilleure pizza" / "Les meilleures pâtes").
   * Built by HomePageContent via `buildBestCategoryFragment()` so we don't
   * have to re-compute it in a client component.
   */
  bestCategory?: string;
};

export default function Hero({ category, city, bestCategory }: Props) {
  const t = useTranslations('hero');

  // Pick the right keys based on filter
  const titleKey =
    category && city
      ? 'titleWithCityCategory'
      : category
      ? 'titleWithCategory'
      : city
      ? 'titleWithCity'
      : 'title';
  const subtitleKey =
    category && city
      ? 'subtitleWithCityCategory'
      : category
      ? 'subtitleWithCategory'
      : city
      ? 'subtitleWithCity'
      : 'subtitle';
  const introKey =
    category && city
      ? 'introWithCityCategory'
      : category
      ? 'introWithCategory'
      : city
      ? 'introWithCity'
      : 'intro';

  const args = {
    category: category || '',
    city: city || '',
    bestCategory: bestCategory || '',
  };
  const isFiltered = !!(category || city);

  return (
    <section className="relative pt-28 pb-10 text-center overflow-hidden" style={{ contain: 'layout paint' }}>
      {/* Radial glow: reduced from 900x900 to 600x600 and given paint containment
          to avoid triggering full-layer repaints on low-end mobile. Gain LCP. */}
      <div
        className="absolute top-[-25%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[radial-gradient(circle,var(--primary-glow)_0%,transparent_65%)] pointer-events-none"
        style={{ contain: 'paint' }}
        aria-hidden="true"
      />
      <div className="relative z-10 max-w-[1200px] mx-auto px-6 sm:px-8 flex flex-col items-center">
        <p className="text-xs font-semibold uppercase tracking-[2.5px] text-[var(--primary)] mb-5">
          {t('label')}
        </p>
        <h1
          className="font-black leading-[1.08] tracking-tight mb-4 text-center w-full"
          style={{ fontSize: 'clamp(1.75rem, 5.2vw, 3.5rem)' }}
        >
          {t.rich(titleKey, {
            em: (chunks) => <em className="not-italic text-[var(--primary)]">{chunks}</em>,
            ...args,
          })}
        </h1>
        <p className="text-base text-[var(--text2)] max-w-[600px] leading-relaxed mb-6 px-2">
          {t(subtitleKey, args)}
        </p>
        {/* SEO intro paragraph: provides unique long-form text per filtered page */}
        <p className={`text-sm text-[var(--text2)] max-w-[680px] leading-relaxed mb-8 px-2 ${isFiltered ? 'opacity-90' : 'opacity-70'}`}>
          {t(introKey, args)}
        </p>
        <div className="flex items-center gap-3 mb-6">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 text-green-400 text-xs font-semibold rounded-full border border-green-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            {t('betaOpen')}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs font-medium text-[var(--text3)]">
          <span>{t('categories')}</span>
          <span className="w-1 h-1 rounded-full bg-[var(--border2)]" />
          <span>{t('free')}</span>
          <span className="w-1 h-1 rounded-full bg-[var(--border2)]" />
          <span>{t('community')}</span>
        </div>
      </div>
    </section>
  );
}
