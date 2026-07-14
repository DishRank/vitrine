import { requireOwnedRestaurant, isPremium } from '@/lib/pro/data';
import SaveStatusSlot from './_components/SaveStatusSlot';

/**
 * Contexte d'UN établissement (segment [id], sous le shell dashboard /pro/r).
 * La navigation (sidebar) et le sélecteur d'établissement vivent dans le
 * parent ; ici : l'en-tête de page (nom/adresse du resto actif, statut de
 * sauvegarde, aperçu public, badge Premium). Garde d'ownership serveur
 * (requireOwnedRestaurant → redirect).
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold tracking-tight truncate sm:text-2xl">{resto.name}</h1>
          <p className="text-sm text-[var(--text2)] truncate">
            {[resto.address, resto.city].filter(Boolean).join(' · ') || '—'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <SaveStatusSlot />
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

      <div className="mt-6">{children}</div>
    </>
  );
}
