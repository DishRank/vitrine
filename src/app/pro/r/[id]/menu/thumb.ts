/**
 * Dérive l'URL du `_thumb` frère d'une image storage (créé à l'upload par
 * uploadMenuImage). Copie client-safe de getThumbnailUrl (lib/storage.ts app).
 * URL externe / sans extension → inchangée.
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
