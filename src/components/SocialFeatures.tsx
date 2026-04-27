/**
 * "Entre amis" — annonce les fonctionnalités sociales (Phase 1 du plan
 * `vivid-wishing-lark.md`).
 *
 * Refonte sans phone-mocks (les mocks rendaient le layout illisible en
 * mobile/tablette et dupliquaient l'UI plus fidèlement montrée en stories
 * Insta). Ici on va à l'essentiel : 3 cards alignées en row sur desktop,
 * stackées sur mobile, chacune avec un gros icône SVG coloré, titre, desc,
 * et 3 bullets concrets.
 *
 * Volontairement HARDCODÉ EN FRANÇAIS — la fonctionnalité cible Lyon /
 * la France au lancement.
 */

interface FeatureSpec {
  pill: string;
  hue: number;
  color: string;
  icon: 'groups' | 'poll' | 'list';
  title: string;
  desc: string;
  bullets: string[];
}

const FEATURES: FeatureSpec[] = [
  {
    pill: 'Groupes',
    hue: 280,
    color: '#7c6cf7',
    icon: 'groups',
    title: 'Groupes avec tes potes',
    desc: 'Tes amis partagent leurs avis, tu vois leur activité, et plus jamais "on va où ?" sans réponse.',
    bullets: ['Codes d\'invitation et liens partagés', 'Activité du groupe centralisée', 'Notifications par groupe'],
  },
  {
    pill: 'Sondages',
    hue: 30,
    color: '#ff7a3d',
    icon: 'poll',
    title: 'Décidez en 30 secondes',
    desc: 'Plus de débats interminables sur WhatsApp. Lance un sondage, swipe pour voter, le verdict tombe.',
    bullets: ['Vote oui / peut-être / non', 'Mode swipe pour les indécis', 'Top du groupe sauvegardé'],
  },
  {
    pill: 'Listes partagées',
    hue: 130,
    color: '#22C55E',
    icon: 'list',
    title: 'Vos pépites en collab',
    desc: 'Une seule liste vivante avec les meilleures adresses du groupe — ajoutée par chacun, partageable par lien.',
    bullets: ['Multi-collaborateurs en temps réel', 'Listes auto par catégorie', 'Partage par lien public ou privé'],
  },
];

/** Icône SVG dédiée par feature, stroke 1.8, color via currentColor. */
function FeatureIcon({ kind, size = 36 }: { kind: FeatureSpec['icon']; size?: number }) {
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

export default function SocialFeatures() {
  return (
    <section
      id="social"
      className="relative max-w-[1280px] mx-auto px-4 sm:px-8 lg:px-14 py-14 sm:py-20 lg:py-24 overflow-hidden"
    >
      {/* Header */}
      <div className="text-center mb-12 sm:mb-16 px-2">
        <span className="inline-flex items-center gap-2 px-3 py-1.5 mb-5 rounded-full bg-[#ff7a3d]/12 border border-[#ff7a3d]/35 text-[#ff7a3d] text-[10px] sm:text-[11px] font-bold uppercase tracking-[1.5px] whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-[#ff7a3d] pulse-dot shrink-0" />
          Nouveau · Entre amis
        </span>
        <h2
          className="font-black tracking-[-0.02em] leading-[1.04] mb-4"
          style={{ fontSize: 'clamp(1.5rem, 5.5vw, 3.5rem)' }}
        >
          DishRank, c&apos;est mieux{' '}
          <span className="hero-gradient-text">à plusieurs.</span>
        </h2>
        <p className="text-[var(--text2)] text-sm sm:text-base lg:text-lg max-w-2xl mx-auto leading-relaxed">
          Trois nouveautés pour transformer la sortie resto en vraie partie de plaisir : groupes, sondages et listes collaboratives.
        </p>
      </div>

      {/* 3 cards en grille — stack mobile, 3 cols à md+ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
        {FEATURES.map((f, i) => (
          <article
            key={i}
            className="relative rounded-2xl p-6 sm:p-7 bg-[var(--surface)] border border-[var(--border2)] flex flex-col transition-all hover:-translate-y-1 hover:border-[var(--primary)]/30"
          >
            {/* Glow ambient teinté à la couleur de la feature */}
            <div
              className="absolute -top-12 -left-12 w-36 h-36 rounded-full pointer-events-none"
              style={{
                background: `radial-gradient(closest-side, ${f.color}33, transparent 70%)`,
                filter: 'blur(30px)',
              }}
              aria-hidden="true"
            />

            {/* Icon + pill row */}
            <div className="relative flex items-center justify-between mb-5">
              <div
                className="flex items-center justify-center w-14 h-14 rounded-2xl"
                style={{
                  background: `${f.color}1a`,
                  border: `1.5px solid ${f.color}40`,
                  color: f.color,
                }}
              >
                <FeatureIcon kind={f.icon} size={32} />
              </div>
              <span
                className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[1.4px]"
                style={{
                  background: `${f.color}1f`,
                  border: `1px solid ${f.color}55`,
                  color: f.color,
                }}
              >
                {f.pill}
              </span>
            </div>

            {/* Title + desc */}
            <h3 className="relative font-extrabold tracking-tight text-[var(--text)] text-xl sm:text-2xl mb-3 leading-tight">
              {f.title}
            </h3>
            <p className="relative text-[var(--text2)] text-sm sm:text-base leading-relaxed mb-5 flex-1">
              {f.desc}
            </p>

            {/* Bullets */}
            <ul className="relative space-y-2.5">
              {f.bullets.map((b, j) => (
                <li
                  key={j}
                  className="flex items-start gap-2.5 text-sm text-[var(--text)]"
                >
                  <span
                    className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: f.color }}
                    aria-hidden="true"
                  />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
