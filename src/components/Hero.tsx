import { useTranslations } from 'next-intl';
import DownloadButtons from './DownloadButtons';
import HeroTickets from './HeroTickets';
import type { DishRow } from '@/lib/supabase';

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
  /** Plats classés (avec photo) — les 3 premiers deviennent les tickets du héros. */
  dishes?: DishRow[];
};

/**
 * Héros « carte du jour » (oct. 2026).
 *
 *   • Texte aligné à gauche, titre en typo d'affiche condensée (`.display`).
 *   • À droite, les 3 meilleurs plats réels en tickets photo (<HeroTickets />).
 *     Sans au moins 3 plats avec photo, le héros reste en une colonne.
 *   • Plus d'accent coloré sur un mot du titre : la taille et la typo portent
 *     le titre. Sur les pages filtrées (ville/catégorie), le paragraphe SEO
 *     `intro` reste rendu sous le sous-titre.
 */
export default function Hero({ category, city, bestCategory, dishes = [] }: Props) {
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

  /**
   * Split `bestCategory` sur le PREMIER MOT (article ou qualifier) :
   *   • FR : "Les meilleurs plats italiens" → prefix "Les ", label "meilleurs plats italiens"
   *   • FR : "Le meilleur burger"          → prefix "Le ",  label "meilleur burger"
   *   • FR : "La meilleure pizza"          → prefix "La ",  label "meilleure pizza"
   *   • EN : "Best italian dishes"         → prefix "Best ", label "italian dishes"
   *   • ES : "Mejor burger"                → prefix "Mejor ", label "burger"
   *
   * Le résultat : seul le premier mot (article FR / "Best" en EN) est en
   * plain text, tout le reste (qualifier + plats + label) passe en
   * couleur d'accent. Match le pattern du H1 home `Le <em>meilleur plat</em>...`.
   */
  const splitParts = (() => {
    if (!bestCategory) {
      return { prefix: '', label: '', suffix: '' };
    }
    const firstSpaceIdx = bestCategory.indexOf(' ');
    if (firstSpaceIdx === -1) {
      // Pas d'espace (cas pathologique) → tout en violet, pas de prefix
      return { prefix: '', label: bestCategory, suffix: '' };
    }
    return {
      prefix: bestCategory.slice(0, firstSpaceIdx + 1), // "Les " (avec espace)
      label: bestCategory.slice(firstSpaceIdx + 1),     // "meilleurs plats italiens"
      suffix: '',
    };
  })();

  const args = {
    category: category || '',
    city: city || '',
    bestCategory: bestCategory || '',
    bestPrefix: splitParts.prefix,
    bestLabel: splitParts.label,
    bestSuffix: splitParts.suffix,
  };
  const isFiltered = !!(category || city);

  // Portion <em> des messages : rendue sans accent (le titre tient par sa typo).
  const emPlain = (chunks: React.ReactNode) => <span className="not-italic">{chunks}</span>;

  // Bold-number wrapper for the stats line (200+, 100%, Sans pub).
  // `<CountUpStat>` auto-détecte si chunks contient un nombre :
  //   • "200+"     → count-up de 0 → 200 + suffixe "+"
  //   • "100%"     → count-up de 0 → 100 + suffixe "%"
  //   • "Sans pub" → texte rendu tel quel (pas de chiffre, pas d'animation)
  // Déclenché par IntersectionObserver à la première intersection avec le
  // viewport, donc l'utilisateur voit toujours l'animation au premier scroll.
  const statBold = (chunks: React.ReactNode) => <b className="text-[var(--text)] font-bold">{chunks}</b>;

  const withTickets = dishes.filter((d) => d.cover_photo_url).length >= 3;

  return (
    <section className="relative pt-24 sm:pt-28 pb-12 sm:pb-20">
      <div
        className={`max-w-[1280px] mx-auto px-4 sm:px-8 lg:px-14 grid grid-cols-1 items-center gap-10 ${
          withTickets ? 'lg:grid-cols-[1.1fr_1fr] lg:gap-8' : ''
        }`}
      >
        <div className="min-w-0">
          <p className="mb-4 sm:mb-5 text-[15px] sm:text-base font-semibold text-[var(--primary)]">{t('label')}</p>

          <h1 className="display text-[var(--text)]" style={{ fontSize: 'clamp(3.4rem, 10vw, 7.75rem)' }}>
            {t.rich(titleKey, { em: emPlain, ...args })}
          </h1>

          {!isFiltered && (
            <p className="mt-6 sm:mt-7 max-w-[34rem] text-lg sm:text-xl font-semibold leading-snug text-[var(--text)]">
              {t.rich('tagline', { em: emPlain })}
            </p>
          )}

          <p className="mt-3 max-w-[34rem] text-[15px] sm:text-base leading-relaxed text-[var(--text2)]">
            {t(subtitleKey, args)}
          </p>

          {/* Paragraphe SEO : pages filtrées uniquement (maillage longue traîne) */}
          {isFiltered && (
            <p className="mt-4 max-w-[38rem] text-sm leading-relaxed text-[var(--text2)] opacity-80">{t(introKey, args)}</p>
          )}

          {!isFiltered && <DownloadButtons size="lg" align="start" className="mt-8" />}

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[var(--text2)]">
            <span className="inline-flex items-center gap-2 font-semibold text-[var(--basilic)] dark:text-[var(--accent-success)]">
              <span className="inline-block h-[7px] w-[7px] rounded-full bg-current" aria-hidden="true" />
              {t('betaOpen')}
            </span>
            <span>{t.rich('categories', { b: statBold })}</span>
            <span>{t.rich('free', { b: statBold })}</span>
            <span>{t.rich('noAds', { b: statBold })}</span>
          </div>
        </div>

        {withTickets && <HeroTickets dishes={dishes.filter((d) => d.cover_photo_url)} />}
      </div>
    </section>
  );
}
