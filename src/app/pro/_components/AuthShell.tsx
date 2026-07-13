import Link from 'next/link';
import AnimatedLogo from '@/components/AnimatedLogo';

/**
 * Coquille des écrans auth /pro : carte centrée, logo, titre. Server-safe
 * (aucun hook) — les formulaires clients sont passés en children.
 */
export default function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-10">
      <Link
        href="/"
        className="flex items-center gap-2.5 mb-8 text-[var(--text)] hover:opacity-80 transition-opacity"
      >
        <AnimatedLogo size={34} />
        <span className="text-xl font-extrabold tracking-tight">
          DishRank <span className="text-[var(--primary)]">Pro</span>
        </span>
      </Link>

      <div className="w-full max-w-[420px] rounded-2xl border border-[var(--border2)] bg-[var(--surface)] p-6 sm:p-8 shadow-[0_10px_40px_var(--card-shadow)]">
        <h1 className="text-2xl font-extrabold tracking-tight mb-1">{title}</h1>
        {subtitle ? <p className="text-sm text-[var(--text2)] mb-6">{subtitle}</p> : <div className="mb-6" />}
        {children}
      </div>

      <p className="mt-6 text-xs text-[var(--text3)] max-w-[420px] text-center">
        Espace réservé aux restaurateurs. Vous cherchez l&apos;appli pour noter des plats ?{' '}
        <Link href="/" className="underline hover:text-[var(--text2)]">C&apos;est par ici</Link>.
      </p>
    </main>
  );
}
