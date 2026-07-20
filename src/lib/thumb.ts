/**
 * Dérive l'URL du `_thumb` frère d'une image storage (créé à l'upload par
 * uploadMenuImage). Copie client-safe de getThumbnailUrl (lib/storage.ts app).
 * URL externe / sans extension → inchangée.
 *
 * Partagé /pro ET menu public (MenuBridge) depuis l'audit 2026-07-20 : les
 * vignettes du menu servaient le fichier 1280 px en 72 px d'affichage.
 */
const PUBLIC_OBJECT = '/storage/v1/object/public/';

export function getThumbnailUrl(photoUrl: string | null | undefined): string {
  if (!photoUrl) return '';
  if (!photoUrl.includes(PUBLIC_OBJECT)) return photoUrl;
  const [base, query] = photoUrl.split('?');
  const dot = base.lastIndexOf('.');
  if (dot < 0) return photoUrl;
  const thumb = base.slice(0, dot) + '_thumb' + base.slice(dot);
  return query ? `${thumb}?${query}` : thumb;
}
