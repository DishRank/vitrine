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
 * Calcul : analyse3.py hors dépôt (projet claude/etude-prix-lyon-2026.md).
 * Aucun établissement n'est nommé avec un prix : les prix relevés n'ont pas été
 * vérifiés un par un. Français uniquement.
 */

const SITE = 'https://dishrank.fr';
const PATH = '/prix-lyon';
const OG = '/img/etude-prix-lyon-og.png';
const CSV = '/etudes/prix-lyon-2026.csv';

type Props = { params: Promise<{ locale: string }> };

const { meta, dishes, repas, arrondissements } = etude;
const quenelle = dishes.find((d) => d.slug === 'quenelle')!;
const burger = dishes.find((d) => d.slug === 'burger')!;
const tarte = dishes.find((d) => d.slug === 'tarte-aux-pralines')!;
const arr = (label: string) => arrondissements.find((a) => a.label === label)!;
const sixieme = arr('Lyon 6e');
const huitieme = arr('Lyon 8e');
const snacks8e = Math.round(huitieme.snack_share * huitieme.restos);

const BORNES = [
  ['quenelle', '9 à 40 €'],
  ['andouillette', '10 à 40 €'],
  ['salade lyonnaise', '6 à 26 €'],
  ['cervelle de canut', '3 à 16 €'],
  ['tarte aux pralines', '4 à 14 €'],
  ['burger', '7 à 36 €'],
  ['tartare de bœuf', '11 à 40 €'],
  ['pizza margherita', '6 à 20 €'],
  ['tiramisu', '3 à 15 €'],
  ['café gourmand', '4 à 16 €'],
  ['crème brûlée', '4 à 14 €'],
];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (locale !== 'fr') return { robots: { index: false, follow: false } };
  const title = `Combien coûte un plat à Lyon ? ${dishes.length} plats comparés dans ${meta.restos_etude} restaurants (2026)`;
  const description = `Quenelle, andouillette, burger, tartare… Prix médians et fourchettes relevés sur les cartes en ligne des restaurants de Lyon et Villeurbanne. Une quenelle coûte ${euros(quenelle.median)} en prix médian.`;
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
      images: [{ url: OG, width: 1200, height: 630, alt: 'Prix médians de plats à Lyon' }],
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
    description: `${dishes.length} plats comparés dans ${meta.restos_etude} établissements de Lyon et Villeurbanne, à partir de leurs cartes publiées en ligne.`,
    url: `${SITE}${PATH}`,
    creator: { '@type': 'Organization', name: 'DishRank', url: SITE },
    temporalCoverage: `${meta.releve_du}/${meta.releve_au}`,
    spatialCoverage: { '@type': 'Place', name: 'Lyon et Villeurbanne, France' },
    datePublished: meta.publie_le,
    inLanguage: 'fr',
    distribution: [{ '@type': 'DataDownload', encodingFormat: 'text/csv', contentUrl: `${SITE}${CSV}` }],
  };

  const h2 = { fontSize: 'clamp(1.9rem, 4.5vw, 2.75rem)' };
  const ecart6 = sixieme.index - 100;

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
                Nous avons relevé les prix sur les cartes en ligne de {meta.etablissements_avec_prix} restaurants, cafés et
                bars de Lyon et Villeurbanne, puis comparé {dishes.length} plats dans les {meta.restos_etude} qui les
                servent.
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
            <h2 id="regle" className="display text-[var(--text)] m-0 mb-2" style={h2}>
              {dishes.length} plats, du plus cher au moins cher
            </h2>
            <p className="m-0 mb-8 text-[var(--text2)] max-w-[40rem]">
              Les spécialités lyonnaises ne sont pas les plats les moins chers de la ville : la quenelle et
              l&apos;andouillette coûtent autant qu&apos;un tartare de bœuf, et plus qu&apos;un burger.
            </p>
            <PriceRuler dishes={dishes} />
          </div>
        </section>

        {/* Le repas lyonnais complet, présenté comme une addition */}
        <section className="band-moutarde py-16 sm:py-20" aria-labelledby="repas">
          <div className="max-w-[1040px] mx-auto px-4 sm:px-8 grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
            <div>
              <h2 id="repas" className="display text-[var(--text)] m-0" style={h2}>
                Le repas lyonnais complet
              </h2>
              <p className="mt-4 mb-0 text-[var(--text2)] max-w-[30rem]">
                Cervelle de canut, quenelle et tarte aux pralines : {euros(repas.sum_medians)} en additionnant les prix
                médians, et {euros(repas.sum_avec_salade)} avec une salade lyonnaise en entrée.
              </p>
              <p className="mt-3 mb-0 text-[var(--text2)] max-w-[30rem]">
                C&apos;est un ordre de grandeur, pas l&apos;addition d&apos;un bouchon précis : elle varie d&apos;une adresse à
                l&apos;autre, boissons non comprises. La tarte aux pralines repose sur {tarte.n} établissements seulement.
              </p>
            </div>

            <div className="bg-[var(--surface)] text-[var(--text)] px-6 py-7 sm:px-8 font-mono text-[0.95rem] rotate-[-0.6deg]">
              <p className="m-0 text-center font-bold">L&apos;addition</p>
              <p className="m-0 mb-5 text-center text-xs text-[var(--text2)]">Prix médians, Lyon, septembre 2026</p>
              {repas.lines.map(([label, price]) => (
                <p key={String(label)} className="m-0 flex gap-2 py-1">
                  <span>{label}</span>
                  <span className="flex-1 border-b border-dotted border-[var(--text3)] translate-y-[-5px]" aria-hidden="true" />
                  <span className="tabular-nums">{euros(Number(price))}</span>
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
            <h2 id="quartiers" className="display text-[var(--text)] m-0 mb-2" style={h2}>
              Peu d&apos;écart entre les quartiers
            </h2>
            <p className="m-0 mb-8 text-[var(--text2)] max-w-[44rem]">
              Chaque prix est comparé au prix médian lyonnais du même plat. Seul le 6e ressort un peu plus cher que
              l&apos;ensemble de Lyon ({ecart6 > 0 ? '+' : '−'}
              {Math.abs(ecart6)}&nbsp;%). Le 8e et le 9e ressortent moins chers, surtout parce que les établissements de
              l&apos;étude y sont plus souvent des snacks : dans le 8e, {snacks8e} sur {huitieme.restos} n&apos;y
              figurent que pour un tiramisu, une pizza ou un burger.
            </p>
            <ArrondissementChart rows={arrondissements} />
          </div>
        </section>

        {/* Vers l'appli */}
        <section className="band-espresso py-16 sm:py-20" aria-labelledby="appli">
          <div className="max-w-[1040px] mx-auto px-4 sm:px-8 grid gap-8 lg:grid-cols-[1.3fr_1fr] lg:items-center">
            <div>
              <h2 id="appli" className="display text-[var(--text)] m-0" style={h2}>
                Les cartes et les prix sont dans DishRank
              </h2>
              <p className="mt-4 mb-0 text-[var(--text2)] max-w-[34rem]">
                Regarde la carte et les prix d&apos;un restaurant avant d&apos;y aller. Pour un repas à plusieurs, propose deux
                ou trois adresses : chacun vote depuis un lien, sans installer l&apos;appli.
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
            <h2 id="methode" className="display text-[var(--text)] m-0 mb-6" style={h2}>
              Comment on a calculé
            </h2>
            <div className="flex flex-col gap-4 text-[var(--text2)] leading-relaxed">
              <p className="m-0">
                <strong className="text-[var(--text)]">Source.</strong> Les cartes que les établissements publient en
                ligne (leur site ou leur page de commande), relevées automatiquement du{' '}
                {dateFr(meta.releve_du).replace(' 2026', '')} au {dateFr(meta.releve_au)}, puis classées plat par plat.
              </p>
              <p className="m-0">
                <strong className="text-[var(--text)]">Périmètre.</strong> Lyon (69001 à 69009) et Villeurbanne (69100).{' '}
                {meta.etablissements_avec_prix} établissements ont une carte avec prix dans nos données, dont{' '}
                {meta.restaurants_avec_prix} restaurants sur {meta.restaurants_ouverts.toLocaleString('fr-FR')}, soit
                environ un sur quatre. {meta.restos_etude} servent au moins un des {dishes.length} plats étudiés, ce qui
                donne {meta.prix_etude} prix.
              </p>
              <p className="m-0">
                <strong className="text-[var(--text)]">Un prix par établissement.</strong> Quand un établissement propose
                plusieurs versions d&apos;un plat, nous retenons leur prix médian. Les fiches en double (même nom, ou même
                carte sur plusieurs adresses) ne comptent qu&apos;une fois.
              </p>
              <p className="m-0">
                <strong className="text-[var(--text)]">Exclusions.</strong> Menus et formules, petites portions, portions
                enfant ou à partager, suppléments et commerces (charcuteries, traiteurs, pâtissiers). Nous écartons aussi
                les prix incompatibles avec une portion servie à table : {BORNES.map(([p, b]) => `${p} ${b}`).join(', ')}.
              </p>
              <p className="m-0">
                <strong className="text-[var(--text)]">Fourchettes.</strong> Le prix médian, puis l&apos;écart dans lequel
                se situe la moitié des établissements (25e à 75e centile) et celui où s&apos;en trouvent 8 sur 10 (10e à 90e
                centile), arrondis à 10 centimes. Les extrêmes tiennent trop souvent à une erreur de carte ou à une
                recette à part, comme un tartare aux truffes.
              </p>
              <p className="m-0">
                <strong className="text-[var(--text)]">Arrondissements.</strong> Chaque prix est divisé par le prix
                médian lyonnais du même plat ; on fait la moyenne par établissement, puis la médiane par arrondissement.
                La marge d&apos;incertitude à 90&nbsp;% vient d&apos;un rééchantillonnage des établissements (bootstrap). Un
                arrondissement n&apos;est dit plus ou moins cher que si toute sa marge est au-dessus ou au-dessous de 100.
              </p>
              <p className="m-0">
                <strong className="text-[var(--text)]">Limites.</strong> Une carte en ligne peut différer des prix en
                salle, et les établissements sans carte en ligne n&apos;y figurent pas. Les prix n&apos;ont pas été vérifiés
                un par un : c&apos;est pourquoi cette étude ne nomme aucun établissement.
              </p>
            </div>

            <div className="mt-10 overflow-x-auto">
              <table className="w-full text-sm border-collapse tabular-nums">
                <caption className="text-left text-[var(--text2)] pb-3">Tous les chiffres de l&apos;étude</caption>
                <thead>
                  <tr className="text-left text-[var(--text2)] border-b-2 border-[var(--text)]">
                    <th scope="col" className="py-2 pr-3 font-semibold">Plat</th>
                    <th scope="col" className="py-2 px-3 font-semibold text-right">Établissements</th>
                    <th scope="col" className="py-2 px-3 font-semibold text-right">Prix médian</th>
                    <th scope="col" className="py-2 px-3 font-semibold text-right">La moitié entre</th>
                    <th scope="col" className="py-2 pl-3 font-semibold text-right">8 sur 10 entre</th>
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
                : un prix par établissement et par plat, avec l&apos;arrondissement et le libellé de la carte.
              </p>
              <p className="m-0">
                Reprise libre avec la mention « Source : DishRank, cartes relevées en septembre 2026 ».
              </p>
              <p className="m-0">
                Une question sur la méthode, ou vous tenez un restaurant ? Écrivez à{' '}
                <a href="mailto:contact@dishrank.fr" className="text-[var(--text)] underline underline-offset-4">
                  contact@dishrank.fr
                </a>
                .
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
