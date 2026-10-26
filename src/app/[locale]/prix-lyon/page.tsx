import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import DownloadButtons from '@/components/DownloadButtons';
import { jsonLdHtml } from '@/lib/jsonLd';
import etude from '@/data/etude-prix-lyon-2026.json';
import PriceRuler from './PriceRuler';
import ArrondissementChart from './ArrondissementChart';
import { dateFr, euros } from './format';

/**
 * Étude « Combien coûte un plat à Lyon ? » (octobre 2026). Chiffres FIGÉS dans
 * src/data/etude-prix-lyon-2026.json (ceux envoyés à la presse) : la page ne
 * relit pas la base, pour qu'un article et la page disent toujours la même chose.
 * Calcul : scripts hors dépôt, cf. claude/etude-prix-lyon-2026.md (projet).
 * Français uniquement.
 */

const SITE = 'https://dishrank.fr';
const PATH = '/prix-lyon';
const OG = '/img/etude-prix-lyon-og.png';
const CSV = '/etudes/prix-lyon-2026.csv';

type Props = { params: Promise<{ locale: string }> };

const { meta, dishes, repas, arrondissements } = etude;
const quenelle = dishes.find((d) => d.slug === 'quenelle')!;
const burger = dishes.find((d) => d.slug === 'burger')!;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (locale !== 'fr') return { robots: { index: false, follow: false } };
  const title = 'Combien coûte un plat à Lyon ? Les prix de 793 restaurants (2026)';
  const description = `Quenelle, andouillette, burger, tartare… Prix médians et fourchettes relevés sur les cartes de ${meta.restos_avec_prix} restaurants de Lyon et Villeurbanne. Une quenelle coûte ${euros(quenelle.median)} en médiane.`;
  return {
    title,
    description,
    alternates: { canonical: `${SITE}${PATH}` },
    openGraph: {
      title: 'Combien coûte un plat à Lyon ?',
      description,
      url: `${SITE}${PATH}`,
      type: 'article',
      locale: 'fr_FR',
      siteName: 'DishRank',
      images: [{ url: OG, width: 1200, height: 630, alt: 'Prix médians de onze plats à Lyon' }],
    },
    twitter: { card: 'summary_large_image', title: 'Combien coûte un plat à Lyon ?', description, images: [OG] },
  };
}

export default async function PrixLyonPage({ params }: Props) {
  const { locale } = await params;
  if (locale !== 'fr') notFound();
  setRequestLocale(locale);
  const nonce = (await headers()).get('x-nonce') || undefined;

  const dataset = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'Prix des plats dans les restaurants de Lyon et Villeurbanne (septembre 2026)',
    description: `Prix relevés sur les cartes publiées par ${meta.restos_avec_prix} restaurants de Lyon et Villeurbanne ; ${dishes.length} plats comparés dans ${meta.restos_etude} restaurants.`,
    url: `${SITE}${PATH}`,
    creator: { '@type': 'Organization', name: 'DishRank', url: SITE },
    temporalCoverage: `${meta.releve_du}/${meta.releve_au}`,
    spatialCoverage: { '@type': 'Place', name: 'Lyon et Villeurbanne, France' },
    datePublished: meta.publie_le,
    inLanguage: 'fr',
    distribution: [{ '@type': 'DataDownload', encodingFormat: 'text/csv', contentUrl: `${SITE}${CSV}` }],
  };

  const lyonnais = dishes.filter((d) => d.lyonnais);

  return (
    <>
      <script
        type="application/ld+json"
        nonce={nonce}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(dataset) }}
      />
      <Nav />
      <main id="main-content">
        {/* Ouverture : la question, puis le chiffre qui y répond */}
        <section className="pt-28 sm:pt-32 pb-12 sm:pb-16">
          <div className="max-w-[1040px] mx-auto px-4 sm:px-8 grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-end">
            <div>
              <h1 className="display text-[var(--text)] m-0" style={{ fontSize: 'clamp(2.75rem, 8vw, 5.5rem)' }}>
                Combien coûte un plat à&nbsp;Lyon&nbsp;?
              </h1>
              <p className="mt-6 mb-0 text-lg text-[var(--text2)] max-w-[34rem]">
                Nous avons relevé les prix sur les cartes de {meta.restos_avec_prix} restaurants de Lyon et
                Villeurbanne, puis comparé {dishes.length} plats dans les {meta.restos_etude} qui les servent.
              </p>
              <p className="mt-3 mb-0 text-sm text-[var(--text3)]">
                Prix relevés du {dateFr(meta.releve_du).replace(' 2026', '')} au {dateFr(meta.releve_au)}. Étude publiée
                le {dateFr(meta.publie_le)}.
              </p>
            </div>
            <div className="border-t-2 border-[var(--text)] pt-4">
              <p className="display m-0 text-[var(--primary)]" style={{ fontSize: 'clamp(4.5rem, 14vw, 8rem)' }}>
                {euros(quenelle.median)}
              </p>
              <p className="mt-2 mb-0 text-base text-[var(--text)] max-w-[22rem]">
                Le prix médian d&apos;une quenelle à Lyon. C&apos;est plus qu&apos;un burger ({euros(burger.median)}).
              </p>
            </div>
          </div>
        </section>

        {/* La règle des prix */}
        <section className="pb-16 sm:pb-20" aria-labelledby="regle">
          <div className="max-w-[1040px] mx-auto px-4 sm:px-8">
            <h2 id="regle" className="display text-[var(--text)] m-0 mb-2" style={{ fontSize: 'clamp(1.9rem, 4.5vw, 2.75rem)' }}>
              {dishes.length} plats, du plus cher au moins cher
            </h2>
            <p className="m-0 mb-8 text-[var(--text2)] max-w-[40rem]">
              Les spécialités lyonnaises ne sont pas les plats les moins chers de la ville : la quenelle et
              l&apos;andouillette dépassent le tartare de bœuf et le burger.
            </p>
            <PriceRuler dishes={dishes} />
          </div>
        </section>

        {/* Le repas lyonnais complet, présenté comme une addition */}
        <section className="band-moutarde py-16 sm:py-20" aria-labelledby="repas">
          <div className="max-w-[1040px] mx-auto px-4 sm:px-8 grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-start">
            <div>
              <h2 id="repas" className="display text-[var(--text)] m-0" style={{ fontSize: 'clamp(1.9rem, 4.5vw, 2.75rem)' }}>
                Le repas lyonnais complet
              </h2>
              <p className="mt-4 mb-0 text-[var(--text2)] max-w-[30rem]">
                Cervelle de canut, quenelle et tarte aux pralines : {euros(repas.sum_medians)} en additionnant les prix
                médians, et {euros(repas.sum_avec_salade)} avec une salade lyonnaise en entrée.
              </p>
              <p className="mt-3 mb-0 text-[var(--text2)] max-w-[30rem]">
                Six bouchons servent un repas lyonnais complet à la carte, de {euros(repas.restos[0].total)} à{' '}
                {euros(repas.restos[repas.restos.length - 1].total)} :
              </p>
              <ul className="list-none m-0 mt-4 p-0">
                {repas.restos.map((r) => (
                  <li key={r.href} className="py-1.5">
                    <p className="m-0 flex items-baseline gap-2">
                      <a href={r.href} className="font-semibold text-[var(--text)] underline-offset-4 hover:underline">
                        {r.resto}
                      </a>
                      <span className="text-sm text-[var(--text2)] whitespace-nowrap">{r.arr}</span>
                      <span className="flex-1 border-b border-dotted border-[var(--text3)] translate-y-[-4px] min-w-4" aria-hidden="true" />
                      <span className="tabular-nums font-semibold text-[var(--text)] whitespace-nowrap">{euros(r.total)}</span>
                    </p>
                    <p className="m-0 text-xs text-[var(--text2)]">
                      {r.lines.map(([label]) => String(label).toLowerCase()).join(', ').replace(/^./, (c) => c.toUpperCase())}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-[var(--surface)] text-[var(--text)] px-6 py-7 sm:px-8 font-mono text-[0.95rem] rotate-[-0.6deg]" aria-label="Addition type">
              <p className="m-0 text-center font-bold">L&apos;addition</p>
              <p className="m-0 mb-5 text-center text-xs text-[var(--text2)]">Prix médians, Lyon, septembre 2026</p>
              {repas.lines.map(([label, price]) => (
                <p key={label as string} className="m-0 flex gap-2 py-1">
                  <span>{label}</span>
                  <span className="flex-1 border-b border-dotted border-[var(--text3)] translate-y-[-5px]" aria-hidden="true" />
                  <span className="tabular-nums">{euros(price as number)}</span>
                </p>
              ))}
              <p className="m-0 mt-4 pt-3 border-t-2 border-dashed border-[var(--text3)] flex gap-2 text-lg font-bold">
                <span>Total</span>
                <span className="flex-1" />
                <span className="tabular-nums">{euros(repas.sum_medians)}</span>
              </p>
            </div>
          </div>
        </section>

        {/* Arrondissements */}
        <section className="py-16 sm:py-20" aria-labelledby="quartiers">
          <div className="max-w-[1040px] mx-auto px-4 sm:px-8">
            <h2 id="quartiers" className="display text-[var(--text)] m-0 mb-2" style={{ fontSize: 'clamp(1.9rem, 4.5vw, 2.75rem)' }}>
              Au centre, les prix se valent
            </h2>
            <p className="m-0 mb-8 text-[var(--text2)] max-w-[44rem]">
              Les quartiers ne servent pas les mêmes plats : chaque prix est donc comparé au prix médian lyonnais du
              même plat. Du 1er au 7e, les écarts restent dans la marge d&apos;incertitude. Le 8e ressort nettement
              moins cher, mais sur 12 restaurants seulement ; le 9e et Villeurbanne semblent un peu moins chers, de
              justesse.
            </p>
            <ArrondissementChart rows={arrondissements} />
          </div>
        </section>

        {/* Les moins chers, par plat */}
        <section className="pb-16 sm:pb-20" aria-labelledby="bons-plans">
          <div className="max-w-[1040px] mx-auto px-4 sm:px-8">
            <h2 id="bons-plans" className="display text-[var(--text)] m-0 mb-2" style={{ fontSize: 'clamp(1.9rem, 4.5vw, 2.75rem)' }}>
              Où les trouver moins cher
            </h2>
            <p className="m-0 mb-8 text-[var(--text2)] max-w-[40rem]">
              Les trois prix les plus bas relevés pour chaque plat. Les cartes changent : vérifiez sur place avant
              d&apos;y aller.
            </p>
            <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {[...lyonnais, ...dishes.filter((d) => !d.lyonnais)].map((d) => (
                <div key={d.slug} className="min-w-0">
                  <h3 className="m-0 mb-2 text-base font-bold text-[var(--text)] border-b-2 border-[var(--text)] pb-1">
                    {d.label}
                  </h3>
                  <ul className="list-none m-0 p-0">
                    {d.cheapest.map((c) => (
                      <li key={c.href} className="flex items-baseline gap-2 py-1 text-sm">
                        <a href={c.href} className="min-w-0 text-[var(--text)] underline-offset-4 hover:underline truncate">
                          {c.resto}
                        </a>
                        <span className="text-[var(--text3)] whitespace-nowrap">{c.arr.replace('Lyon ', '')}</span>
                        <span className="flex-1 border-b border-dotted border-[var(--text3)] translate-y-[-4px] min-w-4" aria-hidden="true" />
                        <span className="tabular-nums font-semibold text-[var(--text)] whitespace-nowrap">{euros(c.price)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Vers l'appli */}
        <section className="band-espresso py-16 sm:py-20" aria-labelledby="appli">
          <div className="max-w-[1040px] mx-auto px-4 sm:px-8 grid gap-8 lg:grid-cols-[1.3fr_1fr] lg:items-center">
            <div>
              <h2 id="appli" className="display text-[var(--text)] m-0" style={{ fontSize: 'clamp(1.9rem, 4.5vw, 2.75rem)' }}>
                Toutes ces cartes sont dans DishRank
              </h2>
              <p className="mt-4 mb-0 text-[var(--text2)] max-w-[34rem]">
                Compare les prix avant d&apos;y aller. Pour un repas à plusieurs, propose deux ou trois adresses : chacun
                vote depuis un lien, sans installer l&apos;appli.
              </p>
              <p className="mt-4 mb-0">
                <Link href="/lyon" className="font-semibold text-[var(--text)] underline underline-offset-4">
                  Voir les restaurants de Lyon
                </Link>
              </p>
            </div>
            <DownloadButtons size="lg" align="start" />
          </div>
        </section>

        {/* Méthode + tableau (équivalent texte des graphiques) */}
        <section className="py-16 sm:py-20" aria-labelledby="methode">
          <div className="max-w-[820px] mx-auto px-4 sm:px-8">
            <h2 id="methode" className="display text-[var(--text)] m-0 mb-6" style={{ fontSize: 'clamp(1.9rem, 4.5vw, 2.75rem)' }}>
              Comment on a calculé
            </h2>
            <div className="flex flex-col gap-4 text-[var(--text2)] leading-relaxed">
              <p className="m-0">
                <strong className="text-[var(--text)]">Source.</strong> Les cartes que les restaurants publient sur leur
                propre site, relevées automatiquement du {dateFr(meta.releve_du).replace(' 2026', '')} au{' '}
                {dateFr(meta.releve_au)}, puis classées plat par plat.
              </p>
              <p className="m-0">
                <strong className="text-[var(--text)]">Périmètre.</strong> Lyon (9 arrondissements) et Villeurbanne.{' '}
                {meta.restos_avec_prix} restaurants ont une carte avec prix dans nos données, soit environ un sur quatre ;{' '}
                {meta.restos_etude} servent au moins un des {dishes.length} plats étudiés ({meta.prix_etude} prix).
              </p>
              <p className="m-0">
                <strong className="text-[var(--text)]">Un prix par restaurant.</strong> Quand un restaurant propose
                plusieurs versions d&apos;un plat, nous retenons leur prix médian.
              </p>
              <p className="m-0">
                <strong className="text-[var(--text)]">Exclusions.</strong> Menus et formules, portions enfant ou à
                partager, suppléments, commerces (charcuteries, traiteurs, pâtissiers) et les prix incompatibles avec une
                portion servie à table, comme une tarte entière.
              </p>
              <p className="m-0">
                <strong className="text-[var(--text)]">Fourchettes.</strong> Nous donnons le prix médian et l&apos;écart
                dans lequel se situent 9 restaurants sur 10 (arrondi à 10 centimes), plutôt que les extrêmes : ils
                tiennent plus souvent à une erreur de carte ou à une recette à part, comme un tartare aux truffes.
              </p>
              <p className="m-0">
                <strong className="text-[var(--text)]">Arrondissements.</strong> Chaque prix est divisé par le prix
                médian lyonnais du même plat ; on fait la moyenne par restaurant, puis la médiane par arrondissement. La
                marge d&apos;incertitude à 90&nbsp;% vient d&apos;un rééchantillonnage des restaurants (bootstrap).
              </p>
              <p className="m-0">
                <strong className="text-[var(--text)]">Limites.</strong> Une carte en ligne peut différer des prix sur
                place, et les restaurants sans site n&apos;y figurent pas. La tarte aux pralines repose sur 13
                restaurants seulement.
              </p>
            </div>

            <div className="mt-10 overflow-x-auto">
              <table className="w-full text-sm border-collapse tabular-nums">
                <caption className="text-left text-[var(--text2)] pb-3">Tous les chiffres de l&apos;étude</caption>
                <thead>
                  <tr className="text-left text-[var(--text2)] border-b-2 border-[var(--text)]">
                    <th scope="col" className="py-2 pr-3 font-semibold">Plat</th>
                    <th scope="col" className="py-2 px-3 font-semibold text-right">Restaurants</th>
                    <th scope="col" className="py-2 px-3 font-semibold text-right">Prix médian</th>
                    <th scope="col" className="py-2 px-3 font-semibold text-right">La moitié entre</th>
                    <th scope="col" className="py-2 pl-3 font-semibold text-right">9 sur 10 entre</th>
                  </tr>
                </thead>
                <tbody>
                  {dishes.map((d) => (
                    <tr key={d.slug} className="border-b border-[var(--border2)] text-[var(--text)]">
                      <th scope="row" className="py-2 pr-3 text-left font-semibold">{d.label}</th>
                      <td className="py-2 px-3 text-right">{d.n}</td>
                      <td className="py-2 px-3 text-right">{euros(d.median)}</td>
                      <td className="py-2 px-3 text-right whitespace-nowrap">{euros(d.p25)} – {euros(d.p75)}</td>
                      <td className="py-2 pl-3 text-right whitespace-nowrap">{euros(d.p10)} – {euros(d.p90)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-10 flex flex-col gap-3 text-[var(--text2)]">
              <p className="m-0">
                <a href={CSV} download className="font-semibold text-[var(--primary)] underline underline-offset-4">
                  Télécharger les données (CSV)
                </a>{' '}
                : un prix par restaurant et par plat, avec le libellé de la carte.
              </p>
              <p className="m-0">
                Reprise libre avec la mention « Source : DishRank, cartes relevées en septembre 2026 ».
              </p>
              <p className="m-0">
                Un prix a changé, ou vous tenez l&apos;un de ces restaurants ? Écrivez à{' '}
                <a href="mailto:contact@dishrank.fr" className="text-[var(--text)] underline underline-offset-4">
                  contact@dishrank.fr
                </a>
                , nous corrigeons rapidement.
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
