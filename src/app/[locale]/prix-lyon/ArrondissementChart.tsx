import { ecart, pos } from './format';

export type ArrStat = { label: string; index: number; lo: number; hi: number; restos: number; small: boolean };

const MIN = 50;
const MAX = 130;
const TICKS = [60, 80, 100, 120];

/**
 * Indice de prix par arrondissement (100 = prix médian lyonnais pour les mêmes
 * plats). Le point est l'indice, le trait sa marge d'incertitude à 90 %
 * (rééchantillonnage par restaurant). Les arrondissements avec moins de
 * 15 établissements sont signalés en texte, pas seulement par la couleur.
 */
export default function ArrondissementChart({ rows }: { rows: ArrStat[] }) {
  return (
    <figure className="m-0">
      <figcaption className="sr-only">
        Indice de prix des mêmes plats par arrondissement, base 100 pour Lyon, avec marge d&apos;incertitude.
      </figcaption>

      <div className="hidden sm:grid grid-cols-[9rem_1fr_7.5rem] gap-x-4 mb-1" aria-hidden="true">
        <span />
        <div className="relative h-5 text-xs text-[var(--text3)] tabular-nums">
          {TICKS.map((t) => (
            <span key={t} className="absolute -translate-x-1/2" style={{ left: pos(t, MIN, MAX) }}>
              {t}
            </span>
          ))}
        </div>
        <span />
      </div>

      <ul className="list-none m-0 p-0 border-t border-[var(--border2)]">
        {rows.map((r) => (
          <li
            key={r.label}
            tabIndex={0}
            aria-label={`${r.label} : indice ${r.index}, ${ecart(r.index)}, marge de ${r.lo} à ${r.hi}, ${r.restos} établissements${r.small ? ', peu de données' : ''}.`}
            className="group relative grid grid-cols-[1fr_auto] sm:grid-cols-[9rem_1fr_7.5rem] items-center gap-x-4 gap-y-1 py-2.5 border-b border-[var(--border2)] outline-none focus-visible:bg-[var(--surface-var)]"
          >
            <div className="min-w-0">
              <p className="m-0 font-semibold text-[var(--text)] leading-tight">{r.label}</p>
              <p className="m-0 text-xs text-[var(--text2)]">
                {r.restos} établissements{r.small ? ', peu de données' : ''}
              </p>
            </div>

            <div className="relative h-6 col-span-2 sm:col-span-1 order-3 sm:order-none" aria-hidden="true">
              {TICKS.map((t) => (
                <span
                  key={t}
                  className={`absolute top-0 bottom-0 w-px ${t === 100 ? 'bg-[var(--text3)]' : 'bg-[var(--border2)]'}`}
                  style={{ left: pos(t, MIN, MAX) }}
                />
              ))}
              <span
                className="absolute top-1/2 -translate-y-1/2 h-0.5 rounded-full"
                style={{
                  left: pos(r.lo, MIN, MAX),
                  width: `calc(${pos(r.hi, MIN, MAX)} - ${pos(r.lo, MIN, MAX)})`,
                  background: r.small ? 'var(--text3)' : 'var(--primary)',
                }}
              />
              <span
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full"
                style={{
                  left: pos(r.index, MIN, MAX),
                  background: r.small ? 'var(--text3)' : 'var(--primary)',
                  boxShadow: '0 0 0 2px var(--bg)',
                }}
              />
            </div>

            <p className="m-0 text-right text-sm font-semibold text-[var(--text)] whitespace-nowrap tabular-nums">
              {ecart(r.index)}
            </p>

            <div
              role="presentation"
              className="pointer-events-none absolute right-0 -top-2 -translate-y-full z-10 hidden group-hover:block group-focus-visible:block rounded-lg border border-[var(--border2)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text2)] shadow-[0_8px_24px_var(--card-shadow)] whitespace-nowrap tabular-nums"
            >
              <p className="m-0 font-semibold text-[var(--text)]">{r.label}</p>
              <p className="m-0">Indice {r.index} (Lyon = 100)</p>
              <p className="m-0">
                Marge d&apos;incertitude : {r.lo} à {r.hi}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[var(--text2)]">
        <span className="inline-flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-[var(--primary)]" aria-hidden="true" />
          Indice (100 = Lyon)
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block w-6 h-0.5 bg-[var(--primary)]" aria-hidden="true" />
          Marge d&apos;incertitude à 90&nbsp;%
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-[var(--text3)]" aria-hidden="true" />
          Moins de 15 établissements
        </span>
      </div>
    </figure>
  );
}
