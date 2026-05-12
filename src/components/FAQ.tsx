'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

/**
 * FAQ accordéon — questions localisées via `useTranslations('faq')`.
 * Le `+` pivote en `×` quand l'item est ouvert (classe `faq-open` qui pilote
 * la transform via globals.css).
 *
 * Le FAQPage JSON-LD est émis ici (et uniquement ici) pour matcher la langue
 * du contenu visible. Émis sur la home uniquement (cf. HomePageContent
 * `{isHome && <FAQ />}`) pour éviter le "duplicate FAQPage" en Search Console.
 */
type FaqItem = { q: string; a: string };

export default function FAQ({ nonce }: { nonce?: string }) {
  const t = useTranslations('faq');
  const items = t.raw('items') as FaqItem[];
  const [open, setOpen] = useState<number | null>(0);

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };

  return (
    <section id="faq" className="max-w-[800px] mx-auto px-4 sm:px-8 py-16 sm:py-20">
      <script type="application/ld+json" nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <h2
        className="font-black tracking-tight text-center mb-3"
        style={{ fontSize: 'clamp(1.75rem, 4.5vw, 2.75rem)' }}
      >
        {t('title')}
      </h2>
      <p className="text-center text-[var(--text2)] mb-10 sm:mb-12 text-sm sm:text-base">
        {t('subtitle')}
      </p>
      <div className="space-y-3">
        {items.map((item, i) => {
          const isOpen = open === i;
          return (
            <div
              key={i}
              className={`rounded-2xl bg-[var(--surface)] border overflow-hidden transition-all duration-300 ${
                isOpen
                  ? 'border-[var(--primary)]/40 faq-open shadow-lg shadow-[var(--card-shadow)]'
                  : 'border-[var(--border2)] hover:border-[var(--primary)]/30 hover:-translate-y-0.5 hover:shadow-md hover:shadow-[var(--card-shadow)]'
              }`}
            >
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="w-full flex items-center justify-between gap-4 px-5 sm:px-6 py-5 text-left cursor-pointer"
              >
                <span className="font-semibold text-[var(--text)] text-base sm:text-lg pr-2">
                  {item.q}
                </span>
                {/* Chevron SVG plutôt qu'un `+` glyph : taille stable cross-browser
                    (le caractère + a un line-height inégal en fonction de la
                    police système), rotation propre, et matche le langage
                    iconographique du reste du site (Heroicons-style 1.8 stroke). */}
                <span
                  className="faq-icon flex items-center justify-center w-9 h-9 rounded-full text-[var(--primary)] shrink-0"
                  style={{
                    background: isOpen ? 'var(--primary-container)' : 'transparent',
                    border: '1px solid color-mix(in srgb, var(--primary) 22%, transparent)',
                  }}
                  aria-hidden="true"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </span>
              </button>
              {/* Animated collapse using grid-rows 0fr→1fr transition (CSS) */}
              <div className={`faq-collapse ${isOpen ? 'is-open' : ''}`}>
                <div className="faq-collapse-inner">
                  <div className="px-5 sm:px-6 pb-5 -mt-1 text-[var(--text2)] text-sm sm:text-base leading-relaxed">
                    {item.a}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
