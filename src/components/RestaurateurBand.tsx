import Link from 'next/link';

/**
 * Encart restaurateurs (home, FR) — oct. 2026.
 *
 * Un restaurateur qui reçoit le mail « votre tableau des allergènes est prêt »
 * tape « DishRank » dans Google avant de cliquer. Cette page doit lui répondre
 * en trois lignes : d'où vient sa carte, ce qu'on lui offre, comment l'enlever.
 * La pièce maîtresse est un extrait de tableau des allergènes — l'objet réel,
 * pas une promesse.
 */

const EXTRAIT: { plat: string; allergenes: string[] }[] = [
  { plat: 'Quenelle de brochet, sauce Nantua', allergenes: ['Gluten', 'Œufs', 'Lait', 'Poisson', 'Crustacés'] },
  { plat: 'Salade lyonnaise', allergenes: ['Œufs', 'Gluten', 'Moutarde'] },
  { plat: 'Tarte aux pralines', allergenes: ['Gluten', 'Lait', 'Œufs', 'Fruits à coque'] },
];

export default function RestaurateurBand() {
  return (
    <section aria-labelledby="restaurateurs-titre" className="py-12 sm:py-16">
      <div className="mx-auto grid max-w-[1180px] grid-cols-1 items-center gap-8 px-4 sm:px-8 lg:grid-cols-[1fr_1.05fr] lg:gap-14 lg:px-14">
        <div>
          <h2
            id="restaurateurs-titre"
            className="display text-[var(--text)]"
            style={{ fontSize: 'clamp(2.4rem, 5.2vw, 3.75rem)' }}
          >
            Vous tenez un restaurant ?
          </h2>
          <p className="mt-4 max-w-[34rem] text-[16px] leading-relaxed text-[var(--text2)]">
            Votre carte est peut-être déjà sur DishRank : nous relevons les cartes publiées sur les sites des
            restaurants lyonnais pour que chaque plat puisse être noté. À partir de vos plats, nous préparons
            aussi votre <strong className="text-[var(--text)]">tableau des 14 allergènes</strong>, à vérifier et à
            imprimer. C&apos;est gratuit.
          </p>
          <p className="mt-3 max-w-[34rem] text-[15px] leading-relaxed text-[var(--text2)]">
            Revendiquez votre fiche pour corriger la carte, publier vos allergènes et répondre aux avis. Vous
            préférez qu&apos;elle n&apos;y soit pas ?{' '}
            <a
              href="mailto:contact@dishrank.fr?subject=Retirer%20ma%20carte%20de%20DishRank"
              className="font-semibold text-[var(--primary)] underline decoration-1 underline-offset-2 hover:opacity-80"
            >
              Écrivez-nous
            </a>
            , nous la retirons.
          </p>
          <Link
            href="/pro"
            className="mt-6 inline-flex items-center rounded-full bg-[var(--primary)] px-6 py-3 text-[15px] font-bold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Espace restaurateur
          </Link>
        </div>

        {/* Extrait du tableau tel que le restaurateur l'imprime. */}
        <figure className="rounded-2xl border border-[var(--border2)] bg-[var(--surface)] p-5 sm:p-6">
          <figcaption className="mb-4 flex items-baseline justify-between gap-3">
            <span className="font-bold text-[var(--text)]">Tableau des allergènes</span>
            <span className="text-[13px] text-[var(--text3)]">extrait, prêt à imprimer</span>
          </figcaption>
          <ul className="divide-y divide-[var(--border2)]">
            {EXTRAIT.map((l) => (
              <li key={l.plat} className="py-3 first:pt-0 last:pb-0">
                <p className="text-[15px] font-semibold text-[var(--text)]">{l.plat}</p>
                <p className="mt-1.5 flex flex-wrap gap-1.5">
                  {l.allergenes.map((a) => (
                    <span
                      key={a}
                      className="rounded-md bg-[var(--primary-container)] px-2 py-0.5 text-[12.5px] font-semibold text-[var(--primary)]"
                    >
                      {a}
                    </span>
                  ))}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[12.5px] leading-snug text-[var(--text3)]">
            Information obligatoire, par écrit, sans que le client ait à la demander (décret n° 2015-447).
          </p>
        </figure>
      </div>
    </section>
  );
}
