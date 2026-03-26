import { useTranslations } from 'next-intl';
import Image from 'next/image';

export default function CtaBanner() {
  const t = useTranslations('cta');
  return (
    <section className="max-w-[1200px] mx-auto px-4 sm:px-8 my-6 sm:my-8">
      <div className="relative bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 sm:p-10 overflow-hidden">
        <div className="absolute top-[-50%] left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-[radial-gradient(circle,var(--primary-glow)_0%,transparent_70%)] pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row items-center gap-4 sm:gap-6 text-center sm:text-left">
          <Image src="/img/icon.png" alt="DishRank" width={48} height={48} className="rounded-2xl shrink-0" />
          <div className="flex-1 min-w-0">
            <h2 className="text-lg sm:text-xl font-bold mb-1">{t('title')}</h2>
            <p className="text-xs sm:text-sm text-[var(--text2)]">{t('subtitle')}</p>
          </div>
          <a
            href="https://play.google.com/store/apps/details?id=com.dishrank.app"
            className="inline-flex items-center gap-2 px-6 py-3 sm:px-8 sm:py-4 bg-[var(--primary)] text-white font-semibold rounded-full hover:bg-[var(--primary-light)] hover:text-[var(--bg)] transition-all text-sm sm:text-base shrink-0"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.807 1.626a1 1 0 0 1 0 1.732l-2.807 1.626L15.206 12l2.492-2.492zM5.864 2.658L16.8 8.99l-2.302 2.302-8.634-8.634z"/></svg>
            {t('button')}
          </a>
        </div>
      </div>
    </section>
  );
}
