/**
 * Vérifie qu'un résultat Google Places désigne bien NOTRE établissement avant
 * d'en afficher la note.
 *
 * Find Place (recherche texte) renvoie toujours un « meilleur » candidat, même
 * quand l'établissement n'existe pas chez Google : sur la base DEV, « Resto
 * Maestro E2E, 1 rue du Test, Lyon » (adresse fictive) recevait ainsi la note
 * d'un autre lieu (4,1 / 195 avis). Prendre le premier candidat sans contrôle
 * peut donc coller la note d'un voisin sur une vraie fiche.
 *
 * Règle : le nom doit se ressembler ET le lieu être proche quand on connaît
 * les deux positions. Le nom et la position d'un lieu sont des champs « Basic »
 * de Places (non facturés en plus de la requête).
 */

export type PlaceRef = {
  name: string | null | undefined;
  latitude?: number | null;
  longitude?: number | null;
};

/** Mots qui disent le type de lieu, pas son identité. */
const GENERIC = new Set([
  'le', 'la', 'les', 'l', 'de', 'du', 'des', 'd', 'et', 'a', 'au', 'aux', 'en', 'chez', 'the', 'and', 'of',
  'restaurant', 'restaurants', 'resto', 'brasserie', 'bistrot', 'bistro', 'cafe', 'bar', 'pizzeria',
  'traiteur', 'cantine', 'snack', 'lyon', 'paris',
]);

/** Minuscules, sans accents ni ponctuation, découpé en mots. */
function words(name: string): string[] {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' et ')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * Ressemblance de deux noms entre 0 et 1 (coefficient de Dice sur les mots
 * distinctifs) : « Daniel & Denise Saint-Jean » / « Daniel et Denise Saint
 * Jean - Bouchon Lyonnais » = 0,8 ; « Paul » / « Paul Bocuse » = 0,67 (un seul
 * mot commun ne suffit pas à loin).
 */
export function nameSimilarity(a: string, b: string): number {
  const all = (s: string) => words(s);
  const distinct = (s: string) => {
    const w = all(s).filter((x) => !GENERIC.has(x));
    return w.length ? w : all(s);
  };
  const wa = new Set(distinct(a));
  const wb = new Set(distinct(b));
  if (!wa.size || !wb.size) return 0;
  const [small, big] = wa.size <= wb.size ? [wa, wb] : [wb, wa];
  let shared = 0;
  for (const w of small) {
    // Un mot proche compte aussi (pluriel, faute de frappe d'une lettre).
    if (big.has(w) || [...big].some((x) => x.length > 3 && w.length > 3 && (x.startsWith(w) || w.startsWith(x)))) {
      shared += 1;
    }
  }
  return (2 * shared) / (wa.size + wb.size);
}

/** Distance en mètres (haversine). */
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const hasPos = (p: PlaceRef) =>
  typeof p.latitude === 'number' && typeof p.longitude === 'number' && !(p.latitude === 0 && p.longitude === 0);

/**
 * Le candidat Google est-il notre établissement ?
 * - positions connues : à plus de 500 m, jamais ; jusqu'à 150 m, un nom qui
 *   partage la moitié de ses mots suffit ; au-delà, il faut un nom presque
 *   identique ;
 * - position inconnue d'un côté : nom presque identique exigé.
 */
export function isSamePlace(ours: PlaceRef, candidate: PlaceRef): boolean {
  if (!ours.name || !candidate.name) return false;
  const sim = nameSimilarity(ours.name, candidate.name);
  if (hasPos(ours) && hasPos(candidate)) {
    const d = distanceMeters(ours.latitude!, ours.longitude!, candidate.latitude!, candidate.longitude!);
    if (d > 500) return false;
    if (d <= 150) return sim >= 0.5;
    return sim >= 0.8;
  }
  return sim >= 0.8;
}