/**
 * Layout racine des pages « autonomes » (/auth/confirm, /dish, /join/<code>,
 * /menu/<id>, /restaurant/<id>) : chacune rend son propre <html> et <body>,
 * avec ses métadonnées et sa CSP (voir proxy.ts). Il n'y a pas de layout
 * racine global ; depuis Next 16.4, chaque page doit en avoir un, d'où ce
 * layout qui ne fait que transmettre la page. Le groupe ne change pas les URL.
 */
export default function AutonomeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
