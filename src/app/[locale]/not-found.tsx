import Link from 'next/link';
import { useTranslations } from 'next-intl';

export default function NotFound() {
  const t = useTranslations('notFound');

  return (
    <>
      <head>
        <title>{t('title')}</title>
        <meta name="robots" content="noindex, nofollow" />
      </head>
      <nav className="border-b border-[var(--border)] px-4 sm:px-8 flex items-center h-[72px]">
        <Link href="/" className="flex items-center gap-2.5 font-extrabold text-lg">
          <img src="/img/icon.png" alt="DishRank" className="w-8 h-8 rounded-[10px]" />
          <span>DishRank</span>
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
          <div className="flex gap-3.5 justify-center flex-wrap">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-7 py-3.5 bg-[var(--primary)] text-white font-semibold rounded-full hover:bg-[var(--primary-light)] hover:-translate-y-0.5 hover:shadow-[0_10px_30px_var(--primary-glow)] transition-all"
            >
              {t('backHome')}
            </Link>
            <a
              href="https://play.google.com/store/apps/details?id=com.dishrank.app"
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-2 px-7 py-3.5 border border-[var(--border)] text-[var(--text)] font-semibold rounded-full hover:border-[var(--primary)] hover:text-[var(--primary-light)] transition-all"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.807 1.626a1 1 0 0 1 0 1.732l-2.807 1.626L15.206 12l2.492-2.492zM5.864 2.658L16.8 8.99l-2.302 2.302-8.634-8.634z"/></svg>
              {t('downloadApp')}
            </a>
          </div>
        </div>
      </main>
    </>
  );
}
