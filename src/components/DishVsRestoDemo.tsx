import { useLocale, useTranslations } from 'next-intl';

/**
 * « Même resto, verdicts opposés » — bande moutarde pleine (carte du jour,
 * oct. 2026). À droite, une addition de restaurant : la note Google du resto
 * en tête, puis deux plats aux notes opposées en chiffres d'affiche. L'objet
 * réel (un ticket) plutôt qu'un schéma : on comprend en un regard que la
 * moyenne du resto cache l'essentiel.
 *
 * Affichée uniquement sur la home (pas les pages filtrées catégorie/ville
 * où le visiteur est déjà en shopping intent).
 */
export default function DishVsRestoDemo() {
  const t = useTranslations('dishVsResto');
  const locale = useLocale();
  const fmt = (n: number) => new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n);

  // Le titre « Même resto. <em>Verdicts opposés.</em> » passe sur deux lignes.
  const emLine = (chunks: React.ReactNode) => <span className="block">{chunks}</span>;
  const bold = (chunks: React.ReactNode) => <strong className="font-bold text-[var(--text)]">{chunks}</strong>;

  const rows = [
    { name: t('dish1Name'), reviews: t('dish1Reviews'), score: 4.8, color: 'var(--basilic)' },
    { name: t('dish2Name'), reviews: t('dish2Reviews'), score: 2.1, color: 'var(--paprika)' },
  ];

  return (
    <section className="band-moutarde">
      <div className="max-w-[1180px] mx-auto px-4 sm:px-8 lg:px-14 py-16 sm:py-24 grid grid-cols-1 lg:grid-cols-[1fr_0.85fr] items-center gap-12 lg:gap-16">
        <div>
          <h2 className="display text-[var(--text)]" style={{ fontSize: 'clamp(2.9rem, 7.4vw, 5.75rem)' }}>
            {t.rich('title', { em: emLine })}
          </h2>
          <p className="mt-6 max-w-[31rem] text-[17px] sm:text-lg leading-relaxed text-[var(--text2)]">
            {t.rich('body', { strong: bold })}
          </p>
          <p className="mt-4 text-sm font-semibold text-[var(--text)]">{t('footnote')}</p>
        </div>

        {/* L'addition */}
        <figure className="receipt mx-auto w-full max-w-[420px] rotate-[1.5deg] bg-[var(--surface)] px-6 sm:px-8 pt-7 pb-12 text-[var(--text)]">
          {/* Données fictives : on le dit. */}
          <p className="mb-2 text-[12px] font-semibold text-[var(--text3)]">{t('badge')}</p>
          <figcaption className="flex items-baseline justify-between gap-4 border-b border-dashed border-[var(--border2)] pb-4">
            <span className="display text-[26px] sm:text-[30px] leading-none">{t('restaurantName')}</span>
            <span className="shrink-0 text-[13px] text-[var(--text3)]">{t('restaurantMeta')}</span>
          </figcaption>
          <ul>
            {rows.map((r) => (
              <li key={r.name} className="flex items-center justify-between gap-4 border-b border-dashed border-[var(--border2)] py-5">
                <div className="min-w-0">
                  <p className="text-[17px] font-bold leading-tight">{r.name}</p>
                  <p className="mt-1 text-[13px] text-[var(--text3)]">{r.reviews}</p>
                </div>
                <p className="display shrink-0 leading-none" style={{ fontSize: 'clamp(3.5rem, 8vw, 4.75rem)', color: r.color }}>
                  {fmt(r.score)}
                </p>
              </li>
            ))}
          </ul>
        </figure>
      </div>
    </section>
  );
}
