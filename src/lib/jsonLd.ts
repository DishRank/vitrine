/**
 * Sérialise un objet JSON-LD pour injection dans `<script type="application/ld+json">`.
 *
 * `JSON.stringify` n'échappe PAS `<` : une donnée contenant `</script>` — nom de
 * restaurant issu de l'ingestion OSM, libellé de ville… — sort du contexte du
 * script et permet l'injection de markup dans une page publique indexée.
 * L'échappement `<` est transparent pour les parseurs JSON : Google lit le
 * balisage à l'identique.
 *
 * À utiliser pour TOUS les blocs, y compris ceux qui n'interpolent aujourd'hui
 * que des constantes. C'est l'échappement appliqué bloc par bloc qui avait créé
 * le trou (breadcrumbs oublié entre deux voisins échappés, audit 2026-07-20) :
 * un helper unique supprime la classe de bug, pas juste l'instance.
 */
export function jsonLdHtml(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
