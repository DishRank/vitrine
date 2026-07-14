import { requireOwnedRestaurant, isPremium, getPendingReviewCount } from '@/lib/pro/data';
import WorkspaceNav from './_components/WorkspaceNav';

/**
 * Contexte d'UN établissement (segment [id], sous le shell persistant /pro/r).
 * L'en-tête + le carrousel vivent dans le parent ; ici : nom/adresse du resto
 * actif, onglets, et la pastille « avis à répondre » (tâche récurrente n°1 de
 * l'owner). Garde d'ownership serveur (requireOwnedRestaurant → redirect).
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

  // Avis publiés sans réponse = ce que l'owner doit traiter (partagé avec le
  // cockpit via cache()).
  const pendingReviews = await getPendingReviewCount(id);

  return (
    <>
      <div className="mt-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold tracking-tight truncate sm:text-2xl">{resto.name}</h1>
          <p className="text-sm text-[var(--text2)] truncate">
            {[resto.address, resto.city].filter(Boolean).join(' · ') || '—'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href={`/menu/${id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden rounded-lg border border-[var(--border2)] px-3 py-1.5 text-xs font-semibold text-[var(--text2)] transition-colors hover:border-[var(--primary)] hover:text-[var(--text)] sm:inline-block"
          >
            Aperçu public ↗
          </a>
          {premium ? (
            <span className="rounded-full bg-[var(--primary-container)] px-3 py-1 text-xs font-bold text-[var(--primary)]">
              Premium
            </span>
          ) : null}
        </div>
      </div>

      <WorkspaceNav id={id} pendingReviews={pendingReviews} />

      <div className="mt-6">{children}</div>
    </>
  );
}
