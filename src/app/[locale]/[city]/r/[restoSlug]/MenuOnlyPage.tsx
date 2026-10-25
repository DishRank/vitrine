/**
 * Page restaurant « carte relevée, pas encore d'avis » (19/09).
 *
 * POURQUOI. Jusqu'ici une fiche n'existait QUE si le restaurant avait des avis : 11
 * restaurants publiés, alors que la base en compte 1 253 avec une carte complète
 * relevée sur leur site. Tout ce travail restait invisible pour les moteurs et pour
 * les assistants IA, qui ne peuvent citer que ce qu'ils peuvent lire.
 *
 * CE QUI EST DIT ICI, ET CE QUI NE L'EST PAS
 *   • la carte (sections, plats, prix) telle qu'elle a été relevée sur le site du
 *     restaurant, avec la même mention que la page menu : partielle, non fournie par
 *     l'établissement, datée ;
 *   • AUCUNE note, AUCUN avis, et donc aucun `aggregateRating` dans le JSON-LD —
 *     déclarer une note inexistante est une fraude aux données structurées, et la
 *     page serait démentie par ce que le visiteur voit.
 * Même page pour tout le monde, robots compris : pas de contenu dédié aux crawlers.
 */
import { Suspense } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { headers } from 'next/headers';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import CtaBanner from '@/components/CtaBanner';
import RelatedFilters from '@/components/RelatedFilters';
import LegalSheet from '@/components/LegalSheet';
import CookieConsent from '@/components/CookieConsent';
import BetaModal from '@/components/BetaModal';
import { citySlug, restaurantSlug } from '@/lib/slug';
import type { MenuTree } from '@/lib/menu';
import { compterPlats } from '@/lib/menuOnly';
import { jsonLdHtml } from '@/lib/jsonLd';

const SITE = 'https://dishrank.fr';

export interface MenuOnlyRestaurant {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  cuisines?: string[] | null;
}

const localePrefix = (locale: string) => (locale === 'fr' ? '' : `/${locale}`);

const BCP47: Record<string, string> = { fr: 'fr-FR', en: 'en-GB', es: 'es-ES', de: 'de-DE', it: 'it-IT' };

/** Prix avec le séparateur décimal de la langue (12,50 € en fr, 12.50 € en en). */
const prix = (p: number | string, locale: string) =>
  Number(p).toFixed(2).replace('.', locale === 'en' ? '.' : ',');

interface Libelles {
  menu: (n: string) => string;
  collected: string;
  noRating: string;
  about: (n: string) => string;
  dishes: (n: number) => string;
  body: (n: string, c: string, k: number) => string;
  free: string;
}

const T: Record<string, Libelles> = {
  fr: {
    menu: (n: string) => `La carte de ${n}`,
    collected: 'Carte relevée sur le site du restaurant. Elle est partielle et n’a pas été fournie par l’établissement.',
    noRating: 'Aucun plat n’a encore été noté ici. Les notes viennent des membres DishRank, plat par plat.',
    about: (n: string) => `À propos de ${n}`,
    dishes: (n: number) => `${n} plat${n > 1 ? 's' : ''} relevé${n > 1 ? 's' : ''}`,
    body: (n: string, c: string, k: number) =>
      `${n} est répertorié sur DishRank à ${c} avec ${k} plat${k > 1 ? 's' : ''} relevé${k > 1 ? 's' : ''} sur le site du restaurant. ` +
      `Aucun plat n’a encore été noté : sur DishRank, chaque plat est noté individuellement par la communauté, ` +
      `pas le restaurant dans son ensemble. Vous y êtes allé ? Notez ce que vous avez mangé depuis l’application.`,
    free: 'Prix indicatifs, relevés à la date ci-dessus.',
  },
  en: {
    menu: (n: string) => `${n}'s menu`,
    collected: 'Menu collected from the restaurant’s website. It is partial and was not provided by the venue.',
    noRating: 'No dish has been rated here yet. Ratings come from DishRank members, dish by dish.',
    about: (n: string) => `About ${n}`,
    dishes: (n: number) => `${n} dish${n > 1 ? 'es' : ''} collected`,
    body: (n: string, c: string, k: number) =>
      `${n} is listed on DishRank in ${c} with ${k} dish${k > 1 ? 'es' : ''} collected from the restaurant’s own website. ` +
      `No dish has been rated yet: on DishRank every dish is rated individually by the community, not the venue as a whole. ` +
      `Been there? Rate what you ate from the app.`,
    free: 'Indicative prices, as collected on the date above.',
  },
  es: {
    menu: (n: string) => `La carta de ${n}`,
    collected: 'Carta recogida en el sitio web del restaurante. Es parcial y no la ha facilitado el establecimiento.',
    noRating: 'Aquí todavía no se ha valorado ningún plato. Las valoraciones vienen de los miembros de DishRank, plato a plato.',
    about: (n: string) => `Sobre ${n}`,
    dishes: (n: number) => `${n} plato${n > 1 ? 's' : ''} recogido${n > 1 ? 's' : ''}`,
    body: (n: string, c: string, k: number) =>
      `${n} está listado en DishRank en ${c} con ${k} plato${k > 1 ? 's' : ''} recogido${k > 1 ? 's' : ''} en el sitio web del restaurante. ` +
      `Todavía no se ha valorado ningún plato: en DishRank cada plato se valora individualmente, no el restaurante en su conjunto. ` +
      `¿Has estado allí? Valora lo que comiste desde la aplicación.`,
    free: 'Precios indicativos, recogidos en la fecha indicada arriba.',
  },
  de: {
    menu: (n: string) => `Die Speisekarte von ${n}`,
    collected: 'Speisekarte von der Website des Restaurants erfasst. Sie ist unvollständig und wurde nicht vom Betrieb bereitgestellt.',
    noRating: 'Hier wurde noch kein Gericht bewertet. Bewertungen kommen von DishRank-Mitgliedern, Gericht für Gericht.',
    about: (n: string) => `Über ${n}`,
    dishes: (n: number) => `${n} Gericht${n > 1 ? 'e' : ''} erfasst`,
    body: (n: string, c: string, k: number) =>
      `${n} ist auf DishRank in ${c} mit ${k} Gericht${k > 1 ? 'en' : ''} gelistet, erfasst auf der Website des Restaurants. ` +
      `Noch kein Gericht ist bewertet: Auf DishRank wird jedes Gericht einzeln bewertet, nicht das Restaurant als Ganzes. ` +
      `Schon dort gewesen? Bewerte in der App, was du gegessen hast.`,
    free: 'Richtpreise, erfasst am oben genannten Datum.',
  },
  it: {
    menu: (n: string) => `Il menù di ${n}`,
    collected: 'Menù raccolto dal sito del ristorante. È parziale e non è stato fornito dal locale.',
    noRating: 'Qui nessun piatto è ancora stato valutato. Le valutazioni arrivano dai membri DishRank, piatto per piatto.',
    about: (n: string) => `Informazioni su ${n}`,
    dishes: (n: number) => `${n} piatt${n > 1 ? 'i' : 'o'} raccolt${n > 1 ? 'i' : 'o'}`,
    body: (n: string, c: string, k: number) =>
      `${n} è presente su DishRank a ${c} con ${k} piatt${k > 1 ? 'i' : 'o'} raccolt${k > 1 ? 'i' : 'o'} dal sito del ristorante. ` +
      `Nessun piatto è ancora stato valutato: su DishRank ogni piatto è valutato singolarmente, non il locale nel suo insieme. ` +
      `Ci sei stato? Valuta ciò che hai mangiato dall'app.`,
    free: 'Prezzi indicativi, raccolti alla data indicata sopra.',
  },
};

export default async function MenuOnlyPage({
  locale,
  cityName,
  restaurant,
  menus,
  allCities,
  searchPage,
}: {
  locale: string;
  cityName: string;
  restaurant: MenuOnlyRestaurant;
  menus: MenuTree[];
  allCities: string[];
  searchPage: string;
}) {
  setRequestLocale(locale);
  const t = T[locale] ?? T.en;
  const tMeta = await getTranslations({ locale, namespace: 'meta' });
  const nonce = (await headers()).get('x-nonce') || undefined;

  const nbPlats = compterPlats(menus);
  const releve = menus[0]?.captured_at ?? null;
  const canonical = `${SITE}${localePrefix(locale)}/${citySlug(cityName)}/r/${restaurantSlug(restaurant.name)}`;
  const dateReleve = releve
    ? new Date(releve).toLocaleDateString(BCP47[locale] ?? 'en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  // JSON-LD : un Restaurant AVEC sa carte, SANS note ni avis (il n'y en a pas).
  const restaurantJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    '@id': `${canonical}#restaurant`,
    name: restaurant.name,
    url: canonical,
    address: {
      '@type': 'PostalAddress',
      streetAddress: restaurant.address || undefined,
      addressLocality: cityName,
      addressCountry: 'FR',
    },
    geo:
      restaurant.latitude && restaurant.longitude
        ? { '@type': 'GeoCoordinates', latitude: restaurant.latitude, longitude: restaurant.longitude }
        : undefined,
    telephone: restaurant.phone || undefined,
    servesCuisine: restaurant.cuisines?.length ? restaurant.cuisines : undefined,
    menu: canonical,
    hasMenu: {
      '@type': 'Menu',
      name: t.menu(restaurant.name),
      dateModified: releve || undefined,
      hasMenuSection: menus.flatMap((m) =>
        [...m.sections, ...m.sections.flatMap((s) => s.children)]
          .filter((s) => s.items.length > 0)
          .map((s) => ({
            '@type': 'MenuSection',
            name: s.name,
            hasMenuItem: s.items.map((i) => ({
              '@type': 'MenuItem',
              name: i.name,
              description: i.description || undefined,
              offers: i.price
                ? { '@type': 'Offer', price: Number(i.price).toFixed(2), priceCurrency: i.currency || 'EUR' }
                : undefined,
            })),
          }))
      ),
    },
  };

  const breadcrumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'DishRank', item: `${SITE}${localePrefix(locale)}` },
      { '@type': 'ListItem', position: 2, name: cityName, item: `${SITE}${localePrefix(locale)}/${citySlug(cityName)}` },
      { '@type': 'ListItem', position: 3, name: restaurant.name, item: canonical },
    ],
  };

  return (
    <>
      <script type="application/ld+json" nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: jsonLdHtml(breadcrumbs) }} />
      <script type="application/ld+json" nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: jsonLdHtml(restaurantJsonLd) }} />

      <Nav />
      <main id="main-content">
        <section className="relative pt-24 pb-6 text-center">
          <div className="relative z-10 max-w-[1100px] mx-auto px-4 sm:px-8">
            <nav aria-label="Breadcrumb" className="mb-5 text-xs sm:text-sm text-[var(--text3)]">
              <a href={`${localePrefix(locale) || '/'}`} className="hover:text-[var(--primary)] transition-colors">
                DishRank
              </a>
              <span className="mx-2 opacity-50">›</span>
              <a href={`${localePrefix(locale)}/${citySlug(cityName)}`} className="hover:text-[var(--primary)] transition-colors">
                {cityName}
              </a>
              <span className="mx-2 opacity-50">›</span>
              <span className="text-[var(--text2)]">{restaurant.name}</span>
            </nav>

            <h1
              className="font-bold text-[var(--text)] mb-3"
              style={{ fontSize: 'clamp(2rem, 6vw, 4rem)', lineHeight: 1.04, letterSpacing: '-0.02em' }}
            >
              {restaurant.name}
            </h1>
            <p className="text-sm sm:text-base text-[var(--text2)] mb-2">
              {restaurant.address ? `${restaurant.address} · ` : ''}
              {cityName}
            </p>
            <p className="text-sm text-[var(--text2)]">{t.dishes(nbPlats)}</p>
          </div>
        </section>

        <section className="max-w-[820px] mx-auto px-4 sm:px-8">
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text2)]">
            <p>
              {t.collected}
              {dateReleve ? ` (${dateReleve})` : ''}
            </p>
            <p className="mt-1 opacity-80">{t.noRating}</p>
          </div>

          <h2
            className="font-extrabold text-[var(--text)] mt-10 mb-4 tracking-tight"
            style={{ fontSize: 'clamp(1.25rem, 3vw, 1.75rem)' }}
          >
            {t.menu(restaurant.name)}
          </h2>

          {menus.map((m) =>
            [...m.sections, ...m.sections.flatMap((s) => s.children)]
              .filter((s) => s.items.length > 0)
              .map((s) => (
                <section key={s.id} className="mb-8">
                  <h3 className="font-bold text-[var(--text)] mb-3 text-base sm:text-lg">{s.name}</h3>
                  <ul className="divide-y divide-[var(--line)]">
                    {s.items.map((i) => (
                      <li key={i.id} className="flex items-baseline justify-between gap-4 py-2">
                        <span className="text-sm sm:text-base text-[var(--text)]">
                          {i.name}
                          {i.description ? (
                            <span className="block text-xs sm:text-sm text-[var(--text3)]">{i.description}</span>
                          ) : null}
                        </span>
                        {i.price != null ? (
                          <span className="shrink-0 text-sm sm:text-base font-semibold text-[var(--text2)] tabular-nums">
                            {prix(i.price, locale)} {i.currency === 'EUR' || !i.currency ? '€' : i.currency}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </section>
              ))
          )}
          <p className="text-xs text-[var(--text3)] mb-10">{t.free}</p>
        </section>

        <CtaBanner />

        <section className="max-w-[820px] mx-auto px-4 sm:px-8 py-10 sm:py-14">
          <h2
            className="font-extrabold text-[var(--text)] mb-4 tracking-tight"
            style={{ fontSize: 'clamp(1.25rem, 3vw, 1.75rem)' }}
          >
            {t.about(restaurant.name)}
          </h2>
          <p className="text-sm sm:text-base text-[var(--text2)] leading-relaxed">
            {t.body(restaurant.name, cityName, nbPlats)}
          </p>
          <p className="sr-only">{tMeta('siteTagline')}</p>
        </section>

        <Suspense fallback={null}>
          <RelatedFilters locale={locale} city={cityName} allCities={allCities} />
        </Suspense>
      </main>

      <Footer />
      <LegalSheet initialPage={searchPage} />
      <CookieConsent />
      <BetaModal />
    </>
  );
}
