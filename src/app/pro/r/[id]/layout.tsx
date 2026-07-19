import { requireOwnedRestaurant } from '@/lib/pro/data';

/**
 * Contexte d'UN établissement (segment [id], sous le shell dashboard /pro/r).
 * La navigation (sidebar) ET l'en-tête du resto actif (nom/adresse, statut de
 * sauvegarde, aperçu public, badge Premium) vivent désormais dans la TOPBAR du
 * shell (ProShell) — persistante sur toutes les pages, plus répétée ici. Ce
 * layout ne garde que la garde d'ownership serveur (redirect si pas propriétaire).
 */
export default async function RestaurantWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireOwnedRestaurant(id); // garde d'ownership (redirect sinon)
  return <>{children}</>;
}
