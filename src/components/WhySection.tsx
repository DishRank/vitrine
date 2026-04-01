import { useTranslations } from 'next-intl';

export default function WhySection() {
  const t = useTranslations('why');
  const items = t.raw('items') as { title: string; desc: string }[];

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.title,
      acceptedAnswer: { '@type': 'Answer', text: item.desc },
    })),
  };

  return (
    <section className="max-w-[1200px] mx-auto px-4 sm:px-8 py-10 sm:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <h2 className="text-xl sm:text-3xl font-extrabold text-center mb-6 sm:mb-10">{t('title')}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-[var(--border)] border border-[var(--border)] rounded-xl sm:rounded-2xl overflow-hidden">
        {items.map((item, i) => (
          <div key={i} className="bg-[var(--bg)] p-4 sm:p-8 hover:bg-[var(--surface)] transition-colors relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--primary-glow)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10">
              <span className="text-[10px] sm:text-xs font-bold text-[var(--primary)] tracking-wider mb-2 sm:mb-4 block">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="text-sm sm:text-base font-bold mb-1 sm:mb-2">{item.title}</h3>
              <p className="text-xs sm:text-sm text-[var(--text2)] leading-relaxed">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
