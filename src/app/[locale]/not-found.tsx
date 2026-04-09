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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/icon.webp" alt="DishRank" className="w-8 h-8 rounded-[10px] block dark:hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/logo-light.webp" alt="DishRank" className="w-8 h-8 rounded-[10px] hidden dark:block" />
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
              aria-label="Google Play"
              className="inline-flex items-center gap-2 px-7 py-3.5 border border-[var(--border)] text-[var(--text)] font-semibold rounded-full hover:border-[var(--primary)] hover:text-[var(--primary-light)] transition-all"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.807 1.626a1 1 0 0 1 0 1.732l-2.807 1.626L15.206 12l2.492-2.492zM5.864 2.658L16.8 8.99l-2.302 2.302-8.634-8.634z"/></svg>
              Google Play
            </a>
            <a
              href="https://apps.apple.com/fr/app/dishrank/id6761752556"
              target="_blank"
              rel="noopener"
              aria-label="App Store"
              className="inline-flex items-center gap-2 px-7 py-3.5 border border-[var(--border)] text-[var(--text)] font-semibold rounded-full hover:border-[var(--primary)] hover:text-[var(--primary-light)] transition-all"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
              App Store
            </a>
          </div>
        </div>
      </main>
    </>
  );
}
