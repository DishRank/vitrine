import { requireOwnedRestaurant, isPremium } from '@/lib/pro/data';
import WorkspaceNav from './_components/WorkspaceNav';

/**
 * Contexte d'UN établissement (segment [id], sous le shell persistant /pro/r).
 * L'en-tête + le carrousel vivent dans le parent ; ici on n'affiche que le
 * nom/adresse du resto actif + les onglets. La garde d'ownership serveur reste
 * (requireOwnedRestaurant redirige vers /pro si le resto n'est pas au user).
 */
export default async function RestaurantWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const resto = await requireOwnedRestaurant(id);
  const premium = isPremium(resto);

  return (
    <>
      <div className="mt-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold tracking-tight truncate sm:text-2xl">{resto.name}</h1>
          <p className="text-sm text-[var(--text2)] truncate">
            {[resto.address, resto.city].filter(Boolean).join(' · ') || '—'}
          </p>
        </div>
        {premium ? (
          <span className="shrink-0 rounded-full bg-[var(--primary-container)] px-3 py-1 text-xs font-bold text-[var(--primary)]">
            Premium
          </span>
        ) : null}
      </div>

      <WorkspaceNav id={id} />

      <div className="mt-6">{children}</div>
    </>
  );
}
