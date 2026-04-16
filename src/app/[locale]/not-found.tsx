import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { useTranslations } from 'next-intl';
import AnimatedLogo from '@/components/AnimatedLogo';
import DownloadButtons from '@/components/DownloadButtons';

// Metadata for the 404 page (uses the App Router metadata API instead of
// mounting a <head> inside the body, which caused hydration errors).
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('notFound');
  return {
    title: t('title'),
    robots: { index: false, follow: false },
  };
}

export default function NotFound() {
  const t = useTranslations('notFound');

  return (
    <>
      <nav className="border-b border-[var(--border)] px-4 sm:px-8 flex items-center h-[72px]">
        <Link
          href="/"
          aria-label="DishRank — accueil"
          className="flex items-center gap-2.5 font-extrabold text-lg text-[#6C5CE7] dark:text-white"
        >
          <AnimatedLogo size={32} />
          <span className="text-[var(--text)]">DishRank</span>
        </Link>
      </nav>
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-10 relative overflow-hidden min-h-[70vh]">
        <div className="absolute top-[-30%] left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-[radial-gradient(circle,var(--primary-glow)_0%,transparent_70%)] pointer-events-none" />
        <div className="relative z-10">
          <p className="text-[clamp(5rem,14vw,9rem)] font-black leading-none tracking-tighter text-[var(--primary)] opacity-25 -mb-4">
            404
          </p>
          <h1 className="text-[clamp(1.6rem,3.5vw,2.4rem)] font-extrabold leading-tight mb-3">
            {t.rich('heading', { em: (chunks) => <em className="not-italic text-[var(--primary-light)]">{chunks}</em> })}
          </h1>
          <p className="text-[var(--text2)] text-[clamp(0.95rem,1.2vw,1.1rem)] max-w-[420px] mx-auto mb-8 leading-relaxed">
            {t('description')}
          </p>
          <div className="flex flex-col items-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-7 py-3.5 bg-[var(--primary)] text-white font-semibold rounded-full hover:bg-[var(--primary-light)] hover:-translate-y-0.5 hover:shadow-[0_10px_30px_var(--primary-glow)] transition-all"
            >
              {t('backHome')}
            </Link>
            <DownloadButtons size="md" />
          </div>
        </div>
      </main>
    </>
  );
}
