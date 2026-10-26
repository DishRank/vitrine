import { euros, pos } from './format';

export type DishStat = {
  slug: string;
  label: string;
  lyonnais: boolean;
  n: number;
  median: number;
  p10: number;
  p25: number;
  p75: number;
  p90: number;
};

const MIN = 0;
const MAX = 25;
const TICKS = [0, 5, 10, 15, 20, 25];

/**
 * Règle des prix : une ligne par plat sur un même axe en euros. La bande couvre
 * 9 restaurants sur 10 (10e → 90e centile), la partie foncée la moitié centrale,
 * le point le prix médian. Rendu serveur, sans JS : le détail s'affiche au survol
 * ou au focus clavier, et toutes les valeurs sont aussi dans le tableau de la méthode.
 */
export default function PriceRuler({ dishes }: { dishes: DishStat[] }) {
  return (
    <figure className="m-0">
      <figcaption className="sr-only">
        Prix médian et fourchette de prix de {dishes.length} plats dans les restaurants de Lyon et Villeurbanne.
      </figcaption>

      {/* Axe partagé, aligné sur la colonne des règles */}
      <div className="hidden sm:grid grid-cols-[11rem_1fr_5.5rem] gap-x-4 mb-1" aria-hidden="true">
        <span />
        <div className="relative h-5 text-xs text-[var(--text3)] tabular-nums">
          {TICKS.map((t) => (
            <span key={t} className="absolute -translate-x-1/2" style={{ left: pos(t, MIN, MAX) }}>
              {t}&nbsp;€
            </span>
          ))}
        </div>
        <span />
      </div>

      <ul className="list-none m-0 p-0 border-t border-[var(--border2)]">
        {dishes.map((d) => (
          <li
            key={d.slug}
            tabIndex={0}
            aria-label={`${d.label} : ${euros(d.median)} en prix médian, 9 restaurants sur 10 entre ${euros(d.p10)} et ${euros(d.p90)}, ${d.n} restaurants.`}
            className="group relative grid grid-cols-[1fr_auto] sm:grid-cols-[11rem_1fr_5.5rem] items-center gap-x-4 gap-y-2 py-3 border-b border-[var(--border2)] outline-none focus-visible:bg-[var(--surface-var)]"
          >
            <div className="min-w-0">
              <p className="m-0 font-semibold text-[var(--text)] leading-tight">{d.label}</p>
              {d.lyonnais && <p className="m-0 text-xs text-[var(--text2)]">Spécialité lyonnaise</p>}
            </div>

            {/* Règle */}
            <div className="relative h-6 col-span-2 sm:col-span-1 order-3 sm:order-none" aria-hidden="true">
              {TICKS.map((t) => (
                <span
                  key={t}
                  className="absolute top-0 bottom-0 w-px bg-[var(--border2)]"
                  style={{ left: pos(t, MIN, MAX) }}
                />
              ))}
              <span
                className="absolute top-1/2 -translate-y-1/2 h-2.5 rounded-[4px]"
                style={{
                  left: pos(d.p10, MIN, MAX),
                  width: `calc(${pos(d.p90, MIN, MAX)} - ${pos(d.p10, MIN, MAX)})`,
                  background: 'color-mix(in srgb, var(--primary) 26%, transparent)',
                }}
              />
              <span
                className="absolute top-1/2 -translate-y-1/2 h-2.5 rounded-[4px]"
                style={{
                  left: pos(d.p25, MIN, MAX),
                  width: `calc(${pos(d.p75, MIN, MAX)} - ${pos(d.p25, MIN, MAX)})`,
                  background: 'color-mix(in srgb, var(--primary) 55%, transparent)',
                }}
              />
              <span
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-[var(--primary)]"
                style={{ left: pos(d.median, MIN, MAX), boxShadow: '0 0 0 2px var(--bg)' }}
              />
            </div>

            <p className="m-0 text-right display text-2xl sm:text-[1.75rem] text-[var(--text)] whitespace-nowrap">
              {euros(d.median)}
            </p>

            <p className="m-0 col-span-2 sm:col-start-2 sm:col-span-2 order-4 text-xs text-[var(--text2)] tabular-nums">
              {d.n} restaurants. 9 sur 10 entre {euros(d.p10)} et {euros(d.p90)}.
            </p>

            {/* Détail au survol / focus (enrichit, ne remplace pas le tableau) */}
            <div
              role="presentation"
              className="pointer-events-none absolute right-0 sm:right-[5.5rem] -top-2 -translate-y-full z-10 hidden group-hover:block group-focus-visible:block rounded-lg border border-[var(--border2)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text2)] shadow-[0_8px_24px_var(--card-shadow)] whitespace-nowrap tabular-nums"
            >
              <p className="m-0 font-semibold text-[var(--text)]">{d.label}</p>
              <p className="m-0">Prix médian : {euros(d.median)}</p>
              <p className="m-0">
                Moitié des restaurants : {euros(d.p25)} à {euros(d.p75)}
              </p>
              <p className="m-0">
                9 sur 10 : {euros(d.p10)} à {euros(d.p90)}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[var(--text2)]">
        <span className="inline-flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-[var(--primary)]" aria-hidden="true" />
          Prix médian
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            className="inline-block w-6 h-2.5 rounded-[4px]"
            style={{ background: 'color-mix(in srgb, var(--primary) 55%, transparent)' }}
            aria-hidden="true"
          />
          La moitié des restaurants
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            className="inline-block w-6 h-2.5 rounded-[4px]"
            style={{ background: 'color-mix(in srgb, var(--primary) 26%, transparent)' }}
            aria-hidden="true"
          />
          9 restaurants sur 10
        </span>
      </div>
    </figure>
  );
}
