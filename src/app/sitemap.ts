import { MetadataRoute } from 'next';
import { fetchRestaurantsWithDishes, fetchRestaurantsWithMenu } from '@/lib/supabase';
import { citySlug, restaurantSlug } from '@/lib/slug';
import { MIN_PLATS_CARTE, estVilleCarte } from '@/lib/menuOnly';
import {
  MIN_DISHES_FOR_INDEX,
  fetchCategoryIndex,
  indexableCategories,
  indexableCities,
} from '@/lib/indexable';

/**
 * Régénéré en arrière-plan toutes les heures (ISR) au lieu d'à chaque requête.
 * En `force-dynamic`, le sitemap mettait ~22 s à répondre (1,7 Mo, une vingtaine de
 * requêtes à la base à froid) : Search Console ne l'avait plus relu depuis le
 * 14/05/2026. Servi depuis le cache, il répond immédiatement. Une heure plutôt que
 * six : une fiche qui perd son dernier avis répond 404 tout de suite, le sitemap ne
 * doit pas l'annoncer une demi-journée de plus.
 */
export const revalidate = 3600;

/**
 * Au build, la génération ne doit pas approcher `staticPageGenerationTimeout` (60 s) :
 * au-delà de 40 s on publie l'accueil seul, régénéré une heure plus tard.
 */
const BUILD_TIMEOUT_MS = 40_000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`sitemap: plus de ${ms / 1000} s`)), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

const BASE = 'https://dishrank.fr';
const LOCALES = ['fr', 'en', 'es', 'de', 'it'];

/**
 * Langues dont les URLs sont LISTÉES. Les pages existent dans les 5 langues et
 * chaque entrée déclare les 5 alternates hreflang, mais Google n'indexe pas les
 * versions es/de/it d'un guide de plats lyonnais (308 URLs « explorées, non
 * indexées » au 25/10/2026, quasi toutes es/de/it) : les lister ne fait que
 * consommer le budget d'exploration. L'anglais reste : c'est lui qui reçoit des
 * impressions (« best burger in lyon », « clermont-ferrand restaurants »).
 */
const LOCALES_LISTEES = ['fr', 'en'];

/**
 * BCP-47 hreflang codes pour les alternates du sitemap.
 * DOIT matcher `HREFLANG_BY_LOCALE` dans `seoMetadata.ts` — sinon Google
 * voit des codes incohérents entre le sitemap (`fr`) et les balises HTML
 * (`fr-FR`), ce qui invalide les signaux hreflang.
 */
const HREFLANG_BY_LOCALE: Record<string, string> = {
  fr: 'fr-FR',
  en: 'en-US',
  es: 'es-ES',
  de: 'de-DE',
  it: 'it-IT',
};

function pathFor(locale: string, path: string) {
  const prefix = locale === 'fr' ? '' : `/${locale}`;
  return `${BASE}${prefix}${path}`;
}

/**
 * Une entrée par langue listée, chacune déclarant les 5 alternates hreflang : les
 * alternates doivent rester le jeu complet, identique aux balises HTML de la page,
 * sinon Google voit deux jeux hreflang contradictoires et les ignore.
 *
 * Pas de `lastModified` : une date « maintenant » à chaque génération est fausse
 * pour toutes les pages, et Google cesse de faire confiance aux lastmod d'un site
 * qui les invente.
 */
function withAlternates(
  path: string,
  extra: Omit<MetadataRoute.Sitemap[number], 'url' | 'alternates'>,
  emises: string[] = LOCALES_LISTEES
): MetadataRoute.Sitemap {
  return emises.map((locale) => ({
    url: pathFor(locale, path),
    alternates: {
      languages: Object.fromEntries(LOCALES.map((l) => [HREFLANG_BY_LOCALE[l], pathFor(l, path)])),
    },
    ...extra,
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const urls: MetadataRoute.Sitemap = [
    ...withAlternates('', { changeFrequency: 'daily', priority: 1 }),
    // Landing restaurateur — seule page indexable de la zone /pro (le reste est
    // noindex). Hors [locale] (FR only) → entrée simple, sans hreflang.
    { url: `${BASE}/pro`, changeFrequency: 'monthly', priority: 0.6 },
    // Étude de prix (FR uniquement, chiffres figés) — cf. src/app/[locale]/prix-lyon.
    { url: `${BASE}/prix-lyon`, changeFrequency: 'monthly', priority: 0.7 },
  ];

  const isBuild = process.env.NEXT_PHASE === 'phase-production-build';
  try {
    urls.push(...(await (isBuild ? withTimeout(contentUrls(), BUILD_TIMEOUT_MS) : contentUrls())));
  } catch (e) {
    // Au build, on publie au moins l'accueil (un build ne doit pas casser parce que la
    // base a hoqueté) ; il sera régénéré à la prochaine échéance. En production, on
    // relance l'erreur : l'ISR continue de servir le sitemap précédent, complet, au
    // lieu de le remplacer une heure durant par une version amputée.
    if (!isBuild) throw e;
    console.error('sitemap: données indisponibles au build', e);
  }
  return urls;
}

/**
 * Toutes les pages de contenu indexables. Une URL n'est listée que si la route la
 * rend ET l'indexe (lib/indexable) : avant, 555 URLs listées ou liées répondaient
 * « noindex », et les villes venaient d'une liste figée croisée avec une liste de
 * villes tronquée à 1 000 restaurants.
 */
async function contentUrls(): Promise<MetadataRoute.Sitemap> {
  const urls: MetadataRoute.Sitemap = [];
  const [index, restos, restosCarte] = await Promise.all([
    fetchCategoryIndex(),
    fetchRestaurantsWithDishes(),
    fetchRestaurantsWithMenu(MIN_PLATS_CARTE),
  ]);

  // 1. Villes : assez de plats notés, ou villes du pilote « cartes relevées » (leur
  //    page liste les fiches restaurant).
  for (const { slug, n } of indexableCities(index)) {
    urls.push(
      ...withAlternates(`/${slug}`, {
        changeFrequency: 'daily',
        priority: Math.min(0.9, 0.6 + Math.min(n, 30) * 0.01),
      })
    );
  }

  // 2. Catégories (/c/<cat>) et paires ville × catégorie (/<ville>/<cat>), mêmes
  //    seuils que les pages. Les parents de hiérarchie (asian, drinks…) agrègent
  //    leurs descendants : comptés comme la page les affiche.
  for (const { slug, n: total } of indexableCategories(index)) {
    urls.push(
      ...withAlternates(`/c/${slug}`, {
        changeFrequency: 'weekly',
        priority: Math.min(0.8, 0.5 + Math.min(total, 30) * 0.01),
      })
    );
    for (const [villeSlug, { n }] of index.categories.get(slug)?.byCity ?? []) {
      if (n < MIN_DISHES_FOR_INDEX) continue;
      urls.push(
        ...withAlternates(`/${villeSlug}/${slug}`, {
          changeFrequency: 'weekly',
          priority: Math.min(0.8, 0.5 + Math.min(n, 20) * 0.015),
        })
      );
    }
  }

  // 3. Fiches restaurant : /<ville>/r/<restaurant>
  // Tout restaurant qui a au moins 1 plat noté (avis modéré). Capture les recherches
  // brandées « {nom} {ville} avis » — les seules requêtes, avec la marque, qui
  // apportent déjà des clics. Doublon de slug dans une ville : on garde celui qui a
  // le plus de plats notés (l'autre reste joignable, mais pas annoncé).
  const restaurantPathByCity = new Map<string, Map<string, { slug: string; dishCount: number }>>();
  for (const r of restos) {
    const cSlug = citySlug(r.city);
    const rSlug = restaurantSlug(r.name);
    if (!cSlug || !rSlug) continue;
    const cityMap = restaurantPathByCity.get(cSlug) || new Map();
    const existing = cityMap.get(rSlug);
    if (!existing || r.dish_count > existing.dishCount) {
      cityMap.set(rSlug, { slug: rSlug, dishCount: r.dish_count });
    }
    restaurantPathByCity.set(cSlug, cityMap);
  }
  for (const [cSlug, cityMap] of restaurantPathByCity) {
    for (const { slug: rSlug, dishCount } of cityMap.values()) {
      urls.push(
        ...withAlternates(`/${cSlug}/r/${rSlug}`, {
          changeFrequency: 'weekly',
          priority: Math.min(0.7, 0.4 + Math.min(dishCount, 6) * 0.05),
        })
      );
    }
  }

  // 3bis. Fiches « carte relevée » : restaurants SANS avis dont la carte a été relevée
  // sur leur propre site. Même périmètre que la route (`lib/menuOnly`) — un sitemap
  // qui annoncerait une page que la route refuse de rendre fabriquerait des 404.
  const dejaListe = new Set<string>();
  for (const [cSlug, cityMap] of restaurantPathByCity) {
    for (const { slug } of cityMap.values()) dejaListe.add(`${cSlug}/${slug}`);
  }
  for (const r of restosCarte) {
    if (!estVilleCarte(r.city)) continue;
    const cSlug = citySlug(r.city);
    const rSlug = restaurantSlug(r.name);
    if (!cSlug || !rSlug || dejaListe.has(`${cSlug}/${rSlug}`)) continue;
    dejaListe.add(`${cSlug}/${rSlug}`);
    urls.push(...withAlternates(`/${cSlug}/r/${rSlug}`, { changeFrequency: 'monthly', priority: 0.3 }));
  }

  return urls;
}
