import { useTranslations } from 'next-intl';
import Reveal from './Reveal';

/**
 * Why DishRank — fidèle au v3 :
 *   • Title H2 44px centré, mb 56px
 *   • UN SEUL gros container : `bgElev`, border 1px, radius 18, overflow hidden
 *   • Grid 3 colonnes × 2 rangées, séparateurs internes uniquement (border-right
 *     entre colonnes, border-bottom entre la rangée du haut et celle du bas)
 *   • Chaque cellule :
 *       - icon container 44×44 (rgba violet + border `lineHi`, radius 12)
 *       - numéro mono `01..06` violetHi opacity 0.7 sur la droite
 *       - titre 18px bold blanc, letter-spacing -0.4
 *       - desc 14px textSoft, lh 1.55
 *
 * Mapping des 6 icônes (ordre = ordre des items dans messages.fr.json) :
 *   0 plate · 1 rank · 2 grid · 3 free · 4 people · 5 map
 */
function WhyIcon({ kind }: { kind: 'plate' | 'rank' | 'grid' | 'free' | 'people' | 'map' }) {
  // stroke=currentColor → couleur héritée du parent (var(--primary)) → adapte
  // automatiquement entre light et dark theme.
  const props = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (kind) {
    case 'plate':
      return (<svg {...props}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /></svg>);
    case 'rank':
      return (<svg {...props}><path d="M3 21h18" /><rect x="6" y="13" width="4" height="8" /><rect x="10" y="9" width="4" height="12" /><rect x="14" y="5" width="4" height="16" /></svg>);
    case 'grid':
      return (<svg {...props}><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>);
    case 'free':
      return (<svg {...props}><path d="M12 2v20M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6" /></svg>);
    case 'people':
      return (<svg {...props}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></svg>);
    case 'map':
      return (<svg {...props}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>);
  }
}

const ICONS: Array<'plate' | 'rank' | 'grid' | 'free' | 'people' | 'map'> = [
  'plate', 'rank', 'grid', 'free', 'people', 'map',
];

export default function WhySection() {
  const t = useTranslations('why');
  const items = t.raw('items') as { title: string; desc: string }[];

  // Note : on n'émet PAS de FAQPage JSON-LD ici. Les items sont des "raisons /
  // features" plutôt que des Q&A — les marquer comme FAQPage serait
  // sémantiquement incorrect et créerait surtout un DUPLICATE avec le
  // FAQPage déjà émis par <FAQ /> sur la home (Search Console penalize les
  // duplicate FAQPage). Le "vrai" FAQ JSON-LD est uniquement dans FAQ.tsx.

  return (
    <section id="why" className="max-w-[1280px] mx-auto px-4 sm:px-14 py-16 sm:py-24">
      {/* Eyebrow label — visual rhythm with Hero / SocialFeatures sections.
          Wrapped in a flex so the lines/label stay perfectly centered. */}
      <div
        className="inline-flex items-center gap-3 mb-5 text-[10px] sm:text-[11px] font-bold uppercase text-[var(--primary)] w-full justify-center"
        style={{ letterSpacing: '1.8px' }}
      >
        <span className="inline-block h-px bg-[var(--primary)] opacity-40" style={{ width: 'clamp(16px, 4vw, 24px)' }} />
        <span>{t('eyebrow')}</span>
        <span className="inline-block h-px bg-[var(--primary)] opacity-40" style={{ width: 'clamp(16px, 4vw, 24px)' }} />
      </div>
      <h2
        className="font-bold text-[var(--text)] text-center mb-10 sm:mb-14 tracking-tight"
        style={{ fontSize: 'clamp(2rem, 5vw, 2.75rem)', lineHeight: 1.04, letterSpacing: '-1.5px' }}
      >
        {t('title')}
      </h2>

      {/* Single big container with internal-only borders.
          Border logic is in globals.css `.why-cell` rules so it stays clean
          at every breakpoint (mobile = 1 col, tablet = 2 cols, lg = 3 cols).
          Stagger reveal : chaque cellule animée au scroll-in via Reveal. */}
      <Reveal
        stagger
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 overflow-hidden bg-[var(--surface)]"
        style={{ border: '1px solid var(--border2)', borderRadius: 18 }}
      >
        {items.map((item, i) => {
          // Première cellule mise en valeur — gradient violet très léger en
          // diagonale, taille d'icône bumpée, numéro plus contrasté. Casse la
          // grille 3×2 égale (pattern AI flag par le skill) sans toucher la
          // structure des borders internes.
          const featured = i === 0;
          return (
            <div
              key={i}
              data-reveal-child
              className="why-cell relative px-6 sm:px-7 lg:px-[30px] pt-7 pb-8 sm:pt-8 sm:pb-9"
              style={{
                ['--ri' as string]: i,
                ...(featured ? {
                  background: 'linear-gradient(135deg, color-mix(in srgb, var(--primary) 12%, transparent) 0%, color-mix(in srgb, var(--primary) 3%, transparent) 55%, transparent 100%)',
                } : {}),
              }}
            >
              {/* Featured "Top" ribbon — tiny pill upper-right, only sur la
                  première cell. `.shimmer` ajoute un sweep diagonal périodique
                  toutes les ~3s pour attirer subtilement l'œil. */}
              {featured && (
                <span
                  className="shimmer absolute top-3 right-3 sm:top-4 sm:right-4 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tabular pointer-events-none"
                  style={{
                    letterSpacing: '1.2px',
                    background: 'color-mix(in srgb, var(--primary) 14%, transparent)',
                    color: 'var(--primary)',
                    border: '1px solid color-mix(in srgb, var(--primary) 28%, transparent)',
                  }}
                  aria-hidden="true"
                >
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" className="relative z-[1]"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/></svg>
                  <span className="relative z-[1]">Top</span>
                </span>
              )}
              {/* Icon + number row */}
              <div className="flex items-center justify-between mb-5">
                <div
                  className="flex items-center justify-center text-[var(--primary)] bg-[var(--primary-container)]"
                  style={{
                    width: featured ? 52 : 44,
                    height: featured ? 52 : 44,
                    borderRadius: featured ? 14 : 12,
                    border: featured
                      ? '1px solid color-mix(in srgb, var(--primary) 38%, transparent)'
                      : '1px solid color-mix(in srgb, var(--primary) 25%, transparent)',
                    boxShadow: featured
                      ? '0 8px 20px -10px color-mix(in srgb, var(--primary) 60%, transparent)'
                      : undefined,
                  }}
                >
                  <WhyIcon kind={ICONS[i] || 'plate'} />
                </div>
                <span
                  className="font-bold text-[var(--primary)] tabular"
                  style={{
                    fontFamily: 'ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, monospace',
                    fontSize: 12,
                    letterSpacing: 1,
                    opacity: featured ? 1 : 0.7,
                  }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
              </div>

              <h3
                className="font-bold text-[var(--text)] mb-2"
                style={{
                  fontSize: featured ? 19 : 18,
                  letterSpacing: '-0.4px',
                }}
              >
                {item.title}
              </h3>
              <p
                className="text-[var(--text2)]"
                style={{
                  fontSize: 14,
                  lineHeight: 1.55,
                }}
              >
                {item.desc}
              </p>
            </div>
          );
        })}
      </Reveal>
    </section>
  );
}
