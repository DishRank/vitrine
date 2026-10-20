import { useTranslations } from 'next-intl';
import LegalLink from './LegalLink';

/**
 * Nos règles — mise en page éditoriale (carte du jour, oct. 2026).
 * Remplace l'ancien « Pourquoi DishRank ? », qui répétait le reste de la page :
 * on y affiche les engagements vérifiables (pas de place achetée, avis non
 * supprimables par le resto, note par plat, gratuit pour les gourmands) et un
 * lien vers « Comment fonctionnent les avis » (obligation d'information,
 * art. L111-7-2 et D111-17 du Code de la consommation).
 *
 *   • Titre d'affiche à gauche, qui reste visible pendant la lecture (sticky
 *     sur grand écran).
 *   • À droite, les règles en liste à deux colonnes, séparées par des
 *     filets : titre court en typo d'affiche, phrase d'explication dessous.
 *     Pas de cartes, pas d'icônes décoratives, pas de numéros (ce n'est pas
 *     une séquence).
 *
 * Note : on n'émet PAS de FAQPage JSON-LD ici. Les items sont des raisons,
 * pas des Q&A, et un FAQPage en double avec celui de <FAQ /> serait signalé
 * par Search Console. Le seul FAQ JSON-LD est dans FAQ.tsx.
 */
export default function WhySection() {
  const t = useTranslations('why');
  const items = t.raw('items') as { title: string; desc: string }[];

  return (
    <section
      id="why"
      className="max-w-[1280px] mx-auto px-4 sm:px-8 lg:px-14 py-16 sm:py-24 grid grid-cols-1 lg:grid-cols-[0.8fr_1.5fr] gap-10 lg:gap-16"
    >
      <h2 className="display text-[var(--text)] lg:sticky lg:top-28 self-start" style={{ fontSize: 'clamp(2.6rem, 6.5vw, 5rem)' }}>
        {t('title')}
      </h2>

      <div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-10">
          {items.map((item) => (
            <div key={item.title} className="border-t border-[var(--border2)] pt-5 pb-8">
              <dt className="display text-[var(--text)] text-[28px] sm:text-[32px]">{item.title}</dt>
              <dd className="mt-2.5 text-[15px] leading-relaxed text-[var(--text2)]">{item.desc}</dd>
            </div>
          ))}
        </dl>
        <LegalLink
          page="reviews"
          className="inline-block text-[15px] font-semibold text-[var(--primary)] underline decoration-1 underline-offset-4 hover:opacity-80"
        >
          {t('reviewsLink')}
        </LegalLink>
      </div>
    </section>
  );
}
