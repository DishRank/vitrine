import Link from 'next/link';
import AnimatedLogo from '@/components/AnimatedLogo';

/**
 * En-tête de la landing publique /pro — volontairement DISTINCT de la `Nav`
 * grand public (villes, catégories, téléchargement de l'appli), pour marquer
 * la séparation utilisateur / restaurateur. Barre sobre : wordmark « DishRank
 * Pro » + une action adaptée à la session.
 *
 * Server component : `authed` est calculé côté serveur dans la page. Les CTA
 * non connectés pointent vers /pro/claim — le middleware bounce vers
 * /pro/login?next=/pro/claim, aucun câblage spécial requis ici.
 */
export default function ProLandingHeader({ authed }: { authed: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border2)] bg-[var(--surface)]/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between gap-4 px-4 sm:px-8 lg:px-14">
        <Link href="/pro" className="flex items-center gap-2.5 text-[var(--text)]">
          <AnimatedLogo size={28} />
          <span className="text-lg font-extrabold tracking-tight">
            DishRank <span className="text-[var(--primary)]">Pro</span>
          </span>
        </Link>

        {authed ? (
          <Link
            href="/pro/espace"
            className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90"
          >
            Accéder à mon espace
          </Link>
        ) : (
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/pro/login"
              className="rounded-lg border border-[var(--border2)] px-3 py-1.5 text-sm font-semibold text-[var(--text2)] transition-colors hover:border-[var(--primary)] hover:text-[var(--text)]"
            >
              Se connecter
            </Link>
            <Link
              href="/pro/claim"
              className="hidden rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 sm:inline-block"
            >
              Revendiquer mon établissement
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
