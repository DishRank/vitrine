import Link from 'next/link';
import { requireOwnedRestaurant, isPremium } from '@/lib/pro/data';
import ProHeader from '../../_components/ProHeader';
import WorkspaceNav from './_components/WorkspaceNav';

/**
 * Shell d'un établissement possédé. Garde d'ownership serveur (requireOwnedRestaurant
 * redirige vers /pro si le resto n'est pas au user), en-tête, sélecteur d'onglets.
 * Les enfants (fiche, avis, …) refont chacun leur propre chargement RLS.
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
    <div className="mx-auto max-w-4xl px-4 py-6">
      <ProHeader />

      <div className="mt-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/pro" className="text-xs font-semibold text-[var(--text3)] hover:text-[var(--text2)]">
            ← Mes établissements
          </Link>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight truncate">{resto.name}</h1>
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
    </div>
  );
}
