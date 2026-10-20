'use client';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import type { DishRow } from '@/lib/supabase';

/**
 * Les 3 meilleurs plats du moment, en « tickets » photo empilés comme une
 * main de cartes. C'est la pièce maîtresse du haut de page : le produit
 * lui-même (un classement de plats), pas une illustration.
 *
 * Position de chaque ticket via variables CSS (--x, --y, --r) consommées par
 * `.ticket` dans globals.css, qui gère aussi la distribution au chargement.
 * Le n° 1 est devant et arrive en dernier.
 */
const LAYOUT = [
  // n° 1 — devant, légèrement penché
  { x: '0%', y: '0%', r: '-3deg', z: 3, d: 420, fromX: '0%' },
  // n° 2 — derrière à droite (écart réduit sur mobile via --spread)
  { x: 'calc(34% * var(--spread, 1))', y: '-7%', r: '7deg', z: 2, d: 260, fromX: '20%' },
  // n° 3 — derrière à gauche
  { x: 'calc(-34% * var(--spread, 1))', y: '6%', r: '-10deg', z: 1, d: 100, fromX: '-20%' },
];

function formatPrice(price: number | null, currency: string | null) {
  if (price == null) return null;
  const n = Number(price);
  if (!Number.isFinite(n) || n <= 0) return null;
  const s = Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ',');
  return currency && currency !== 'EUR' ? `${s} ${currency}` : `${s} €`;
}

export default function HeroTickets({ dishes }: { dishes: DishRow[] }) {
  const t = useTranslations('feed');
  const th = useTranslations('hero');
  const locale = useLocale();
  const top = dishes.slice(0, 3);
  if (top.length < 3) return null;

  const open = (d: DishRow) => window.dispatchEvent(new CustomEvent('open-dish', { detail: d }));

  return (
    <div className="relative mx-auto w-full max-w-[560px] h-[400px] sm:h-[500px] lg:h-[580px] [--spread:0.72] sm:[--spread:1]" role="group" aria-label={th('podium')}>
      {top.map((d, i) => {
        const l = LAYOUT[i];
        const price = formatPrice(d.latest_price, d.currency);
        const rating = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Number(d.avg_rating));
        return (
          <button
            key={`${d.restaurant_id}::${d.dish_name}`}
            type="button"
            onClick={() => open(d)}
            aria-label={`${i + 1}. ${d.dish_name} — ${d.restaurant_name} — ${d.avg_rating}/5`}
            className="ticket group absolute left-1/2 top-1/2 -ml-[29%] -mt-[45%] sm:-mt-[42%] w-[58%] text-left rounded-[22px] bg-[var(--surface)] border border-[var(--border2)] p-2.5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            style={{
              zIndex: l.z,
              ['--x' as string]: l.x,
              ['--y' as string]: l.y,
              ['--r' as string]: l.r,
              ['--d' as string]: `${l.d}ms`,
              ['--from-x' as string]: l.fromX,
              boxShadow: '0 22px 40px -28px rgba(35, 22, 15, 0.55)',
            }}
          >
            <div className="relative aspect-[4/5] overflow-hidden rounded-[16px] bg-[var(--surface-var)]">
              <Image
                src={d.cover_photo_url}
                alt={`${d.dish_name} chez ${d.restaurant_name}`}
                fill
                // Photo paysage recadrée dans un cadre portrait 4:5 : il faut
                // ~1,7× la largeur du cadre pour couvrir sa hauteur sans
                // agrandir l'image (sinon flou). Cadre ≈ 58vw mobile, ≤ 330px.
                sizes="(max-width: 640px) 100vw, 560px"
                quality={85}
                priority={i === 0}
                className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
              />
              <span className="display absolute top-2.5 right-2.5 flex items-center gap-1 rounded-full bg-[var(--surface)] px-2.5 py-1 text-[19px] sm:text-[22px] leading-none text-[var(--text)]">
                {rating}
                <span className="text-[var(--moutarde)] text-[0.75em]" aria-hidden="true">★</span>
              </span>
              {/* Rang en chiffre d'affiche, posé sur la photo */}
              <span
                className="display absolute left-3 bottom-1 text-white leading-none pointer-events-none"
                style={{ fontSize: 'clamp(4.5rem, 10vw, 7rem)', textShadow: '0 2px 10px rgba(0,0,0,0.45)' }}
                aria-hidden="true"
              >
                {i + 1}
              </span>
            </div>
            <div className="px-1.5 pt-3 pb-1">
              <p className="font-bold text-[15px] sm:text-[17px] leading-tight text-[var(--text)] truncate">{d.dish_name}</p>
              <p className="mt-0.5 text-[12.5px] sm:text-[13px] text-[var(--text2)] truncate">
                {d.restaurant_name}
                {d.restaurant_city ? ` · ${d.restaurant_city}` : ''}
              </p>
              <p className="mt-0.5 text-[12px] text-[var(--text3)] truncate">
                {price ? `${price} · ` : ''}
                {t('reviews', { count: d.review_count })}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
