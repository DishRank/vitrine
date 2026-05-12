import { useTranslations } from 'next-intl';

/**
 * Démo visuelle "même resto, plats opposés" — sert de preuve immédiate du
 * value prop "on note les plats, pas les restos".
 *
 * Affichée uniquement sur la home (pas les pages filtrées catégorie/ville
 * où le visiteur est déjà en shopping intent).
 *
 * Layout : card single, glow violet, illustration à gauche (carte restaurant
 * synthétique avec 2 plats aux notes opposées), copy à droite. Stack sur
 * mobile.
 */
export default function DishVsRestoDemo() {
  const t = useTranslations('dishVsResto');

  const emGradient = (chunks: React.ReactNode) => (
    <span className="not-italic hero-gradient-text">{chunks}</span>
  );

  const bold = (chunks: React.ReactNode) => (
    <strong className="text-[var(--text)] font-bold">{chunks}</strong>
  );

  return (
    <section className="relative max-w-[1100px] mx-auto px-4 sm:px-8 mt-2 sm:mt-4 mb-10 sm:mb-14">
      <div className="relative rounded-2xl border border-[var(--border2)] bg-[var(--surface)] p-6 sm:p-8 lg:p-10 overflow-hidden">
        {/* Glow violet en haut-droite — discret */}
        <div
          className="absolute -top-24 -right-24 w-72 h-72 rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(closest-side, var(--primary-glow), transparent 70%)',
            filter: 'blur(40px)',
          }}
          aria-hidden="true"
        />

        <div className="relative flex flex-col lg:flex-row items-center gap-7 lg:gap-12">
          {/* LEFT — Illustration */}
          <div className="w-full lg:flex-1 lg:max-w-[420px]">
            {/* Restaurant header */}
            <div
              className="flex items-center gap-3 mb-3 p-3 rounded-xl"
              style={{
                background: 'var(--surface-var)',
                border: '1px solid var(--border2)',
              }}
            >
              <div
                className="w-11 h-11 rounded-lg flex items-center justify-center text-xl shrink-0"
                style={{
                  background: 'linear-gradient(135deg, #ffb86b 0%, #ff7a3d 100%)',
                }}
                aria-hidden="true"
              >
                🍽️
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-[var(--text)] truncate">
                  {t('restaurantName')}
                </div>
                <div className="text-[11px] text-[var(--text3)] flex items-center gap-1.5">
                  <span>{t('restaurantMeta')}</span>
                </div>
              </div>
            </div>

            {/* Dish 1 — well-rated */}
            <div
              className="flex items-center justify-between gap-3 p-3 rounded-xl mb-2"
              style={{
                background: 'color-mix(in srgb, var(--accent-success) 8%, transparent)',
                border: '1px solid color-mix(in srgb, var(--accent-success) 40%, transparent)',
              }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-2xl shrink-0" aria-hidden="true">🍔</span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[var(--text)] truncate">
                    {t('dish1Name')}
                  </div>
                  <div className="text-[11px] text-[var(--text3)]">{t('dish1Reviews')}</div>
                </div>
              </div>
              <div
                className="text-base sm:text-lg font-bold tabular shrink-0 flex items-center gap-1"
                style={{ color: 'var(--accent-success)' }}
              >
                4.8
                <span style={{ color: 'var(--star)' }}>★</span>
              </div>
            </div>

            {/* Dish 2 — poorly-rated */}
            <div
              className="flex items-center justify-between gap-3 p-3 rounded-xl"
              style={{
                background: 'color-mix(in srgb, var(--accent-warm) 8%, transparent)',
                border: '1px solid color-mix(in srgb, var(--accent-warm) 40%, transparent)',
              }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-2xl shrink-0" aria-hidden="true">🥩</span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[var(--text)] truncate">
                    {t('dish2Name')}
                  </div>
                  <div className="text-[11px] text-[var(--text3)]">{t('dish2Reviews')}</div>
                </div>
              </div>
              <div
                className="text-base sm:text-lg font-bold tabular shrink-0 flex items-center gap-1"
                style={{ color: 'var(--accent-warm)' }}
              >
                2.1
                <span style={{ color: 'var(--star)' }}>★</span>
              </div>
            </div>
          </div>

          {/* RIGHT — Copy */}
          <div className="w-full lg:flex-1 text-center lg:text-left">
            <div
              className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full text-[10px] sm:text-[11px] font-bold uppercase whitespace-nowrap"
              style={{
                background: 'var(--primary-container)',
                color: 'var(--primary)',
                border: '1px solid color-mix(in srgb, var(--primary) 25%, transparent)',
                letterSpacing: '1.5px',
              }}
            >
              {t('badge')}
            </div>
            <h2
              className="font-extrabold tracking-tight text-[var(--text)] mb-4"
              style={{
                fontSize: 'clamp(1.5rem, 4vw, 2.25rem)',
                lineHeight: 1.08,
                letterSpacing: '-0.02em',
              }}
            >
              {t.rich('title', { em: emGradient })}
            </h2>
            <p
              className="text-[var(--text2)] mb-3"
              style={{
                fontSize: 'clamp(0.95rem, 1.6vw, 1.0625rem)',
                lineHeight: 1.55,
              }}
            >
              {t.rich('body', { strong: bold })}
            </p>
            <p className="text-[var(--text3)] text-xs sm:text-sm italic">
              {t('footnote')}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
