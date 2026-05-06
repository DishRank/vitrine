import type { RecentReviewRow } from '@/lib/supabase';

/**
 * "En direct" — feed marquee défilant avec les avis récents de la communauté.
 * Reproduit le design v3 :
 *   • Pill orange "EN DIRECT" + dot pulsant
 *   • Titre H3 "Les avis qui tombent en ce moment"
 *   • Stats à droite (nombre d'avis + contributeurs uniques sur les rows fournies)
 *   • Chips marquee avec layout 2 lignes :
 *       - Ligne 1 : "{who} a noté {dish}" (nom bold, verbe muted, plat violet bold)
 *       - Ligne 2 : "{resto} · ★★★★★ · {ago}" — étoiles SVG dorées
 *
 * IMPORTANT : data dynamique (vient de Supabase via HomePageContent → props).
 * Si trop peu d'avis (< MIN_REVIEWS), le composant retourne `null` — le parent
 * n'affiche pas la section pour éviter un marquee à 1-2 chips qui boucle vite.
 */

const MIN_REVIEWS = 6;

/** Petite étoile SVG dorée. */
function Star({ size = 9 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#F9CA24" aria-hidden="true" className="shrink-0">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" />
    </svg>
  );
}

/** Nom affiché : display_name > "Anonyme".
 *  La colonne `username` a été retirée de `profiles` lors de la release sociale. */
function getWho(r: RecentReviewRow): string {
  return r.display_name || 'Anonyme';
}

/** Initiales 2 lettres pour l'avatar (premières lettres des mots du nom). */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Hue OKLCh stable par user_id (même user → même couleur).
 *  Utilise un hash simple, modulo 360 pour la teinte. */
function getHue(userId: string | null, fallbackIndex: number): number {
  if (!userId) return (fallbackIndex * 47) % 360;
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}

/** Convertit `created_at` en libellé "à l'instant" / "X min" / "X h" / "Xj". */
function getAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "à l'instant";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}j`;
  const weeks = Math.floor(days / 7);
  return `${weeks}sem`;
}

interface EventChipData {
  id: string;
  who: string;
  initials: string;
  hue: number;
  dish: string;
  resto: string;
  rating: number;
  ago: string;
}

function EventChip({ ev }: { ev: EventChipData }) {
  // Cap rating display at 5 stars max
  const stars = Math.max(1, Math.min(5, Math.round(ev.rating)));
  return (
    <div
      className="event-chip inline-flex items-center gap-3 px-[18px] py-3 rounded-2xl mr-3 shrink-0"
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-extrabold shrink-0"
        style={{ background: `oklch(0.7 0.14 ${ev.hue})` }}
        aria-hidden="true"
      >
        {ev.initials}
      </div>
      <div className="flex flex-col gap-0.5">
        <div className="text-[13px] text-[var(--text)]">
          <b className="font-bold">{ev.who}</b>
          <span className="text-[var(--text3)]"> a noté </span>
          <b className="font-bold text-[var(--primary)]">{ev.dish}</b>
        </div>
        <div className="text-[11px] text-[var(--text3)] flex items-center gap-2">
          <span>{ev.resto}</span>
          <span>·</span>
          <span className="inline-flex items-center gap-0.5">
            {Array.from({ length: stars }).map((_, j) => (
              <Star key={j} size={9} />
            ))}
          </span>
          <span>·</span>
          <span>{ev.ago}</span>
        </div>
      </div>
    </div>
  );
}

interface Props {
  /** Reviews récents fournis par le parent (server-side fetch). */
  reviews: RecentReviewRow[];
}

export default function SocialProof({ reviews }: Props) {
  // Ne rien afficher si on n'a pas assez de matière pour un marquee crédible
  if (!reviews || reviews.length < MIN_REVIEWS) {
    return null;
  }

  // Map raw rows → display events
  const events: EventChipData[] = reviews.map((r, i) => {
    const who = getWho(r);
    return {
      id: r.id,
      who,
      initials: getInitials(who),
      hue: getHue(r.user_id, i),
      dish: r.dish_name,
      resto: r.restaurant_name,
      rating: r.rating,
      ago: getAgo(r.created_at),
    };
  });

  // Stats : nombre total d'avis fournis + contributeurs uniques
  const totalReviews = events.length;
  const uniqueContributors = new Set(reviews.map((r) => r.user_id || 'anon')).size;

  // Duplicate the array for seamless infinite scroll
  const loop = [...events, ...events];

  return (
    <section className="py-12 sm:py-14 lg:py-16">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 lg:px-14 mb-6 sm:mb-9">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 sm:gap-4">
          <div>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#ff7a3d]/12 border border-[#ff7a3d]/35 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ff7a3d] pulse-dot" />
              <span className="text-[11px] font-bold uppercase tracking-[1.4px] text-[#ff7a3d]">
                En direct
              </span>
            </span>
            <h3
              className="font-bold tracking-tight text-[var(--text)]"
              style={{ fontSize: 'clamp(1.25rem, 3.2vw, 1.625rem)', lineHeight: 1.2 }}
            >
              Les avis qui tombent en ce moment
            </h3>
          </div>
          <div className="text-left sm:text-right text-[13px] text-[var(--text3)] leading-snug">
            <b className="text-[var(--text)] font-bold">{totalReviews} avis</b> récents
            <span className="sm:hidden"> · </span>
            <br className="hidden sm:block" />
            <b className="text-[var(--text)] font-bold">{uniqueContributors} contributeur{uniqueContributors > 1 ? 's' : ''}</b>
          </div>
        </div>
      </div>

      {/* Marquee */}
      <div className="mq-mask">
        <div className="mq-track flex">
          {loop.map((ev, i) => (
            <EventChip key={`${ev.id}-${i}`} ev={ev} />
          ))}
        </div>
      </div>
    </section>
  );
}
