import Link from 'next/link';
import AnimatedLogo from '@/components/AnimatedLogo';
import { signOutAction } from '../actions';

/** En-tête commun à toutes les pages authentifiées de l'espace pro. */
export default function ProHeader({ email }: { email?: string | null }) {
  return (
    <header className="flex items-center justify-between gap-4 pb-5 border-b border-[var(--border2)]">
      <Link href="/pro" className="flex items-center gap-2.5 text-[var(--text)]">
        <AnimatedLogo size={28} />
        <span className="text-lg font-extrabold tracking-tight">
          DishRank <span className="text-[var(--primary)]">Pro</span>
        </span>
      </Link>
      <div className="flex items-center gap-3">
        <Link href="/pro/compte" className="hidden sm:block text-sm font-semibold text-[var(--text2)] hover:text-[var(--text)]">
          {email ?? 'Mon compte'}
        </Link>
        <form action={signOutAction}>
          <button
            type="submit"
            className="rounded-lg border border-[var(--border2)] px-3 py-1.5 text-sm font-semibold text-[var(--text2)] hover:border-[var(--primary)] hover:text-[var(--text)] transition-colors"
          >
            Se déconnecter
          </button>
        </form>
      </div>
    </header>
  );
}
