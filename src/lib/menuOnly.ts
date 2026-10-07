/**
 * Fiches « carte relevée » — un seul endroit pour décider qui est publié.
 *
 * Une fiche restaurant n'existait que si le restaurant avait des avis : 11 fiches
 * publiées, alors que la base compte ~1 250 restaurants dont la carte a été relevée sur
 * leur propre site. On ouvre ces fiches PRUDEMMENT, et les deux garde-fous vivent ici
 * pour que le sitemap et la page ne puissent pas diverger (sitemap qui annonce une
 * page que la route refuse de rendre, ou l'inverse) :
 *   • VILLES_CARTE  : les villes du pilote (Lyon d'abord) ;
 *   • MIN_PLATS     : sous ce seuil la page serait trop maigre → 404, comme avant.
 *
 * Élargir le pilote = modifier CE fichier, rien d'autre.
 */
import type { MenuTree } from './menu';

export const MIN_PLATS_CARTE = 10;

/** Villes où les fiches « carte relevée » sont publiées (comparaison insensible à la casse). */
export const VILLES_CARTE = ['Lyon'];

export function estVilleCarte(city: string | null | undefined): boolean {
  if (!city) return false;
  const v = city.trim().toLowerCase();
  return VILLES_CARTE.some((x) => x.toLowerCase() === v);
}

/**
 * Nombre de plats visibles de la carte, toutes sections (et sous-sections) confondues.
 *
 * Compte aussi les formules, là où le sitemap (`fetchRestaurantsWithMenu`) ne compte que
 * `kind='item'`. L'asymétrie va dans le bon sens : le sitemap est le plus strict, donc il
 * n'annonce jamais une URL que la route refuserait de rendre.
 */
export function compterPlats(menus: MenuTree[]): number {
  return menus.reduce(
    (n, m) =>
      n +
      [...m.sections, ...m.sections.flatMap((s) => s.children)].reduce((k, sec) => k + sec.items.length, 0),
    0
  );
}
