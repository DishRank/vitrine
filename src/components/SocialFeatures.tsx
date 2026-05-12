/**
 * "Entre amis" — annonce les fonctionnalités sociales.
 *
 * Layout : carte vedette "barycentre" en tête (illustration SVG + storyboard
 * 4 étapes), puis grille de 3 cartes secondaires (Groupes / Sondages /
 * Listes), stackées sur mobile.
 *
 * i18n : tout le copy passe par `useTranslations('socialFeatures')`. Le
 * structurel (couleur, icône) reste local dans FEATURE_STYLES, les textes
 * (pill, titre, desc, bullets) viennent de `t.raw('items')`.
 */
import { useTranslations } from 'next-intl';
import Reveal from './Reveal';

type FeatureIconKind = 'groups' | 'poll' | 'list';

interface FeatureStyle {
  hue: number;
  color: string;
  icon: FeatureIconKind;
}

/** Style par feature (ordre = ordre dans messages.*.json socialFeatures.items) */
const FEATURE_STYLES: FeatureStyle[] = [
  { hue: 280, color: '#7c6cf7', icon: 'groups' },
  { hue: 30, color: '#ff7a3d', icon: 'poll' },
  { hue: 130, color: '#22C55E', icon: 'list' },
];

interface FeatureItem {
  pill: string;
  title: string;
  desc: string;
  bullets: string[];
}

interface BarycentreStep {
  num: string;
  title: string;
}

/** Icône SVG dédiée par feature, stroke 1.8, color via currentColor. */
function FeatureIcon({ kind, size = 36 }: { kind: FeatureIconKind; size?: number }) {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (kind) {
    case 'groups':
      // 3 silhouettes (groupe d'amis)
      return (
        <svg {...props}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case 'poll':
      // Bar chart vertical (sondage)
      return (
        <svg {...props}>
          <rect x="4" y="13" width="4" height="7" rx="0.6" />
          <rect x="10" y="9" width="4" height="11" rx="0.6" />
          <rect x="16" y="5" width="4" height="15" rx="0.6" />
          <path d="M3 21h18" />
        </svg>
      );
    case 'list':
      // Liste avec checkmark (liste partagée collaborative)
      return (
        <svg {...props}>
          <path d="M9 6h11" />
          <path d="M9 12h11" />
          <path d="M9 18h11" />
          <path d="M3 6l1.5 1.5L7 5" />
          <path d="M3 12l1.5 1.5L7 11" />
          <path d="M3 18l1.5 1.5L7 17" />
        </svg>
      );
  }
}

/** Mini-illustration vectorielle pour la carte barycentre. 3 avatars amis
 *  répartis sur la périphérie + pin central pulsant représentant le
 *  point milieu calculé par DishRank. Tout en SVG inline pour rester crisp
 *  à toutes les tailles, et hérite des couleurs theme via currentColor. */
function BarycentreIllustration({ ariaLabel }: { ariaLabel: string }) {
  return (
    <svg
      viewBox="0 0 320 240"
      className="w-full h-auto max-w-[360px] mx-auto"
      role="img"
      aria-label={ariaLabel}
    >
      {/* Cercles concentriques discrets — suggèrent la "zone" du barycentre */}
      <circle cx="160" cy="120" r="90" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 4" opacity="0.18" />
      <circle cx="160" cy="120" r="55" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 4" opacity="0.28" />

      {/* Lignes de connexion amis → centre */}
      <line x1="48" y1="60" x2="160" y2="120" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 3" opacity="0.4" />
      <line x1="280" y1="80" x2="160" y2="120" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 3" opacity="0.4" />
      <line x1="160" y1="210" x2="160" y2="120" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 3" opacity="0.4" />

      {/* Ami 1 — top-left */}
      <g>
        <circle cx="48" cy="60" r="20" fill="#7c6cf7" />
        <text x="48" y="68" textAnchor="middle" fontSize="22" fill="white">🧑</text>
      </g>
      {/* Ami 2 — top-right */}
      <g>
        <circle cx="280" cy="80" r="20" fill="#ff7a3d" />
        <text x="280" y="88" textAnchor="middle" fontSize="22" fill="white">👩</text>
      </g>
      {/* Ami 3 — bottom-center */}
      <g>
        <circle cx="160" cy="210" r="20" fill="#22C55E" />
        <text x="160" y="218" textAnchor="middle" fontSize="22" fill="white">🧔</text>
      </g>

      {/* Pin central (barycentre) — pulsant */}
      <g>
        <circle cx="160" cy="120" r="32" fill="currentColor" opacity="0.12">
          <animate attributeName="r" values="30;38;30" dur="2.4s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.18;0.05;0.18" dur="2.4s" repeatCount="indefinite" />
        </circle>
        <circle cx="160" cy="120" r="24" fill="currentColor" />
        <text x="160" y="128" textAnchor="middle" fontSize="22">🍽️</text>
      </g>
    </svg>
  );
}

export default function SocialFeatures() {
  const t = useTranslations('socialFeatures');
  const steps = t.raw('barycentre.steps') as BarycentreStep[];
  const items = t.raw('items') as FeatureItem[];

  // <em> dans les titres → portion en gradient violet (cohérent avec Hero).
  const emGradient = (chunks: React.ReactNode) => (
    <span className="hero-gradient-text not-italic">{chunks}</span>
  );

  return (
    <section
      id="social"
      className="relative max-w-[1280px] mx-auto px-4 sm:px-8 lg:px-14 py-14 sm:py-20 lg:py-24 overflow-hidden"
    >
      {/* Header */}
      <div className="text-center mb-12 sm:mb-16 px-2">
        <span className="inline-flex items-center gap-2 px-3 py-1.5 mb-5 rounded-full bg-[#ff7a3d]/12 border border-[#ff7a3d]/35 text-[#ff7a3d] text-[10px] sm:text-[11px] font-bold uppercase tracking-[1.5px] whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-[#ff7a3d] pulse-dot shrink-0" />
          {t('pill')}
        </span>
        <h2
          className="font-black tracking-[-0.02em] leading-[1.04] mb-4"
          style={{ fontSize: 'clamp(1.5rem, 5.5vw, 3.5rem)' }}
        >
          {t.rich('headline', { em: emGradient })}
        </h2>
        <p className="text-[var(--text2)] text-sm sm:text-base lg:text-lg max-w-2xl mx-auto leading-relaxed">
          {t('subtitle')}
        </p>
      </div>

      {/* Featured card "barycentre" — élément vedette de la section, placé en
          tête pour capter l'attention sur le killer feature avant le scroll
          plus bas. Layout 2 colonnes : illustration map à gauche, copy +
          storyboard à droite. Stack sur mobile (illustration au-dessus). */}
      <article
        className="relative rounded-2xl overflow-hidden mb-6 sm:mb-8 bg-[var(--surface)] border border-[var(--border2)]"
      >
        {/* Glow violet — discret, signale "feature premium" */}
        <div
          className="absolute -top-32 -right-32 w-[420px] h-[420px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(closest-side, color-mix(in srgb, var(--primary) 22%, transparent), transparent 70%)',
            filter: 'blur(50px)',
          }}
          aria-hidden="true"
        />

        <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 p-6 sm:p-8 lg:p-12">
          {/* Illustration */}
          <div className="flex items-center justify-center text-[var(--primary)]">
            <BarycentreIllustration ariaLabel={t('barycentre.illustrationAlt')} />
          </div>

          {/* Copy + storyboard — épuré : pill, titre, ligne types de lieux,
              puis 4 étapes title-only. On laisse le titre + la séquence des
              steps raconter l'histoire, pas de paragraphe redondant. */}
          <div>
            <span
              className="inline-flex items-center gap-2 px-2.5 py-1 mb-4 rounded-full text-[10px] font-bold uppercase tracking-[1.4px]"
              style={{
                background: 'var(--primary-container)',
                color: 'var(--primary)',
                border: '1px solid color-mix(in srgb, var(--primary) 25%, transparent)',
              }}
            >
              {t('barycentre.pill')}
            </span>
            <h3
              className="font-extrabold tracking-tight text-[var(--text)] mb-3 leading-[1.08]"
              style={{ fontSize: 'clamp(1.5rem, 3.4vw, 2.25rem)' }}
            >
              {t.rich('barycentre.title', { em: emGradient })}
            </h3>
            {/* Ligne types de lieux — donne le scope (resto / bar / café…)
                en 1 ligne, remplace le paragraphe explicatif. */}
            <p className="text-[var(--text3)] text-xs sm:text-sm font-semibold uppercase tracking-[1.8px] mb-7">
              {t('barycentre.venues')}
            </p>

            {/* Storyboard — 4 étapes, titre seul. La séquence 01→02→03→04
                raconte le workflow sans avoir besoin de descriptions. */}
            <ol className="space-y-2.5">
              {steps.map((step) => (
                <li key={step.num} className="flex gap-3 items-center">
                  <span
                    className="flex items-center justify-center w-8 h-8 rounded-lg text-[11px] font-bold shrink-0 tabular"
                    style={{
                      background: 'var(--primary-container)',
                      color: 'var(--primary)',
                      border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)',
                    }}
                  >
                    {step.num}
                  </span>
                  <span className="text-sm sm:text-base font-semibold text-[var(--text)] leading-tight">
                    {step.title}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </article>

      {/* Sous-titre transition vers les 3 features secondaires */}
      <p className="text-center text-xs sm:text-sm font-semibold uppercase tracking-[2px] text-[var(--text3)] mb-6 sm:mb-8">
        {t('andAlso')}
      </p>

      {/* 3 cards en grille — stack mobile, 3 cols à md+. Reveal stagger :
          chaque card animée au scroll-in avec un delay basé sur son index DOM. */}
      <Reveal stagger className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
        {items.map((item, i) => {
          const style = FEATURE_STYLES[i] || FEATURE_STYLES[0];
          return (
            <article
              key={i}
              data-reveal-child
              className="feature-card relative rounded-2xl p-6 sm:p-7 bg-[var(--surface)] border border-[var(--border2)] flex flex-col"
              style={{
                // CSS var consommée par `.feature-card:hover` dans globals.css.
                // Chaque card a sa signature couleur propre (groups=violet,
                // poll=orange, list=vert) au lieu d'un primary uniforme.
                ['--feat-color' as string]: style.color,
                ['--ri' as string]: i,
              }}
            >
              {/* Glow ambient teinté à la couleur de la feature */}
              <div
                className="absolute -top-12 -left-12 w-36 h-36 rounded-full pointer-events-none"
                style={{
                  background: `radial-gradient(closest-side, ${style.color}33, transparent 70%)`,
                  filter: 'blur(30px)',
                }}
                aria-hidden="true"
              />

              {/* Icon + pill row */}
              <div className="relative flex items-center justify-between mb-5">
                <div
                  className="flex items-center justify-center w-14 h-14 rounded-2xl"
                  style={{
                    background: `${style.color}1a`,
                    border: `1.5px solid ${style.color}40`,
                    color: style.color,
                  }}
                >
                  <FeatureIcon kind={style.icon} size={32} />
                </div>
                <span
                  className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[1.4px]"
                  style={{
                    background: `${style.color}1f`,
                    border: `1px solid ${style.color}55`,
                    color: style.color,
                  }}
                >
                  {item.pill}
                </span>
              </div>

              {/* Title + desc */}
              <h3 className="relative font-extrabold tracking-tight text-[var(--text)] text-xl sm:text-2xl mb-3 leading-tight">
                {item.title}
              </h3>
              <p className="relative text-[var(--text2)] text-sm sm:text-base leading-relaxed mb-5 flex-1">
                {item.desc}
              </p>

              {/* Bullets — skipped si vide (cas Sondages : pas de features
                  granulaires à lister, le desc suffit). */}
              {item.bullets.length > 0 && (
                <ul className="relative space-y-2.5">
                  {item.bullets.map((b, j) => (
                    <li
                      key={j}
                      className="flex items-start gap-2.5 text-sm text-[var(--text)]"
                    >
                      <span
                        className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: style.color }}
                        aria-hidden="true"
                      />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          );
        })}
      </Reveal>
    </section>
  );
}
