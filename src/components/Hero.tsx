import { useTranslations } from 'next-intl';

type Props = {
  category?: string;
  city?: string;
};

export default function Hero({ category, city }: Props) {
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

  const args = { category: category || '', city: city || '' };
  const isFiltered = !!(category || city);

  return (
    <section className="relative pt-28 pb-10 text-center overflow-hidden">
      <div className="absolute top-[-30%] left-1/2 -translate-x-1/2 w-[900px] h-[900px] bg-[radial-gradient(circle,var(--primary-glow)_0%,transparent_65%)] pointer-events-none" />
      <div className="relative z-10 max-w-[1200px] mx-auto px-4 flex flex-col items-center">
        <p className="text-xs font-semibold uppercase tracking-[2.5px] text-[var(--primary)] mb-5">
          {t('label')}
        </p>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.08] tracking-tight mb-4">
          {t.rich(titleKey, {
            em: (chunks) => <em className="not-italic text-[var(--primary)]">{chunks}</em>,
            ...args,
          })}
        </h1>
        <p className="text-base text-[var(--text2)] max-w-[600px] leading-relaxed mb-6">
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
