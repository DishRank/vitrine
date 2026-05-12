import { useTranslations } from 'next-intl';
import DownloadButtons from './DownloadButtons';
import CountUpStat from './CountUpStat';

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

/**
 * Hero v3 — fidèle au prototype `site-v3/landing.jsx`.
 *
 * Design key points:
 *   • Label "Note les plats · pas les restos" entouré de 2 traits horizontaux
 *     (24px × 1px, color #a99bff @ 40% opacity), uppercase tracked, tinted
 *     #a99bff (T.violetHi) — pas la couleur primary qui est plus foncée.
 *   • Titre H1 92px, blanc — gradient violet 3 stops (#a99bff → #7c6cf7 →
 *     #5b4fc2) UNIQUEMENT sur la portion <em> (gérée par le rich text i18n).
 *   • Subtitle 18px, ligne hauteur 1.55, max-width 560px, color textSoft
 *     (#bfb8e8).
 *   • Stats line : "200+" / "100%" en blanc bold, le reste en muted.
 *   • Sur les pages filtrées (city/category), le SEO `intro` paragraph est
 *     toujours rendu sous la subtitle pour garder le maillage sémantique
 *     long-tail. Sur la home, on garde le hero épuré façon v3.
 */
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

  /**
   * Split `bestCategory` sur le PREMIER MOT (article ou qualifier) :
   *   • FR : "Les meilleurs plats italiens" → prefix "Les ", label "meilleurs plats italiens"
   *   • FR : "Le meilleur burger"          → prefix "Le ",  label "meilleur burger"
   *   • FR : "La meilleure pizza"          → prefix "La ",  label "meilleure pizza"
   *   • EN : "Best italian dishes"         → prefix "Best ", label "italian dishes"
   *   • ES : "Mejor burger"                → prefix "Mejor ", label "burger"
   *
   * Le résultat : seul le premier mot (article FR / "Best" en EN) est en
   * plain text, tout le reste (qualifier + plats + label) passe en gradient
   * violet. Match le pattern du H1 home `Le <em>meilleur plat</em>...`.
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

  // V3 gradient applied ONLY on the <em> portion of the title (white default
  // for everything else). 3-stop gradient — saturation lowered (skill flags
  // 100% S as the "AI purple" tell). Same hue (~247°), saturations now
  // 70/60/51 instead of 100/89/51.
  const emGradient = (chunks: React.ReactNode) => (
    <span
      className="not-italic"
      style={{
        background: 'linear-gradient(120deg, #aba0e8 0%, #7669d0 50%, #5b4fc2 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        color: 'transparent',
      }}
    >
      {chunks}
    </span>
  );

  // Bold-number wrapper for the stats line (200+, 100%, Sans pub).
  // `<CountUpStat>` auto-détecte si chunks contient un nombre :
  //   • "200+"     → count-up de 0 → 200 + suffixe "+"
  //   • "100%"     → count-up de 0 → 100 + suffixe "%"
  //   • "Sans pub" → texte rendu tel quel (pas de chiffre, pas d'animation)
  // Déclenché par IntersectionObserver à la première intersection avec le
  // viewport, donc l'utilisateur voit toujours l'animation au premier scroll.
  const statBold = (chunks: React.ReactNode) => (
    <CountUpStat className="text-[var(--text)] font-bold">{chunks}</CountUpStat>
  );

  return (
    <section className="relative pt-24 pb-10 sm:pb-12 text-center overflow-hidden" style={{ contain: 'layout paint' }}>
      {/* Radial glow principal — derive lentement (mesh-blob), width clamps
          so it never overflows on mobile. */}
      <div
        className="mesh-blob absolute -top-[80px] sm:-top-[120px] left-1/2 rounded-full pointer-events-none"
        style={{
          width: 'min(1000px, 100vw)',
          height: 'min(540px, 60vw)',
          background: 'radial-gradient(closest-side, rgba(124,108,247,0.28), transparent 70%)',
          filter: 'blur(40px)',
          contain: 'paint',
        }}
        aria-hidden="true"
      />
      {/* Mesh blob secondaire — accent orange chaud en off-center pour
          casser le mono-violet. Très transparent, dérive en phase inverse
          → impression de "lumière qui vit" dans le fond. */}
      <div
        className="mesh-blob-2 absolute top-[40px] right-[-100px] sm:right-[-60px] rounded-full pointer-events-none hidden sm:block"
        style={{
          width: 'min(420px, 50vw)',
          height: 'min(420px, 50vw)',
          background: 'radial-gradient(closest-side, color-mix(in srgb, var(--accent-warm) 18%, transparent), transparent 70%)',
          filter: 'blur(50px)',
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 max-w-[1280px] mx-auto px-4 sm:px-8 lg:px-14 flex flex-col items-center">
        {/* Label avec lignes horizontales sur les côtés.
            tracking se réduit sur mobile pour éviter de devoir wrap le texte. */}
        <div
          className="inline-flex items-center gap-2 sm:gap-3 mb-6 sm:mb-7 text-[10px] sm:text-[11px] font-bold uppercase whitespace-nowrap text-[var(--primary)]"
          style={{ letterSpacing: '1.8px' }}
        >
          <span
            className="inline-block h-px bg-[var(--primary)]"
            style={{ width: 'clamp(16px, 4vw, 24px)', opacity: 0.4 }}
          />
          <span>{t('label')}</span>
          <span
            className="inline-block h-px bg-[var(--primary)]"
            style={{ width: 'clamp(16px, 4vw, 24px)', opacity: 0.4 }}
          />
        </div>

        {/* Title — white default, gradient ONLY on <em> portions */}
        <h1
          className="font-bold text-[var(--text)] text-center max-w-5xl mb-4 sm:mb-5"
          style={{
            fontSize: 'clamp(2.25rem, 8vw, 5.75rem)',
            lineHeight: 0.98,
            letterSpacing: '-0.025em',
          }}
        >
          {t.rich(titleKey, { em: emGradient, ...args })}
        </h1>

        {/* Tagline émotionnelle — uniquement sur la home (pas filtré).
            Évite de diluer le focus SEO des pages catégorie/ville où le
            visiteur est arrivé via une intention précise ("burger Lyon"). */}
        {!isFiltered && (
          <p
            className="text-center text-[var(--text)] font-semibold mb-5 sm:mb-6 px-2"
            style={{
              fontSize: 'clamp(1.1rem, 2.4vw, 1.5rem)',
              lineHeight: 1.35,
              letterSpacing: '-0.01em',
              maxWidth: 640,
            }}
          >
            {t.rich('tagline', { em: emGradient })}
          </p>
        )}

        {/* Subtitle */}
        <p
          className="text-center mb-8 px-2 text-[var(--text2)]"
          style={{
            fontSize: 'clamp(0.95rem, 1.6vw, 1.125rem)',
            lineHeight: 1.55,
            maxWidth: 560,
          }}
        >
          {t(subtitleKey, args)}
        </p>

        {/* SEO intro paragraph: only on filtered pages (kept for long-tail SEO) */}
        {isFiltered && (
          <p className="text-sm text-[var(--text2)] max-w-[680px] leading-relaxed mb-8 px-2 opacity-80">
            {t(introKey, args)}
          </p>
        )}

        {/* Download CTA — home only. Placé avant la beta pill / stats pour
            capturer l'intention dès le viewport initial. Sur les pages
            filtrées, le visiteur arrive via une intention SEO précise
            ("burger Lyon") : on le laisse scroller vers les plats avant de
            pousser le CTA (qui revient plus bas via <CtaBanner />). */}
        {!isFiltered && (
          <DownloadButtons size="lg" className="mb-7 sm:mb-8" />
        )}

        {/* Beta pill + stats stacked */}
        <div className="inline-flex flex-col items-center gap-4">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold"
            style={{
              background: 'color-mix(in srgb, var(--accent-success) 12%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent-success) 32%, transparent)',
              color: 'var(--accent-success)',
            }}
          >
            <span
              className="pulse-dot inline-block rounded-full"
              style={{ width: 7, height: 7, background: 'var(--accent-success)' }}
            />
            {t('betaOpen')}
          </div>

          <div className="tabular flex flex-wrap items-center justify-center gap-x-5 sm:gap-x-7 gap-y-2 text-xs font-medium text-[var(--text3)]">
            <span>{t.rich('categories', { b: statBold })}</span>
            <span style={{ opacity: 0.3 }} className="hidden sm:inline">·</span>
            <span>{t.rich('free', { b: statBold })}</span>
            <span style={{ opacity: 0.3 }} className="hidden sm:inline">·</span>
            <span>{t.rich('noAds', { b: statBold })}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
