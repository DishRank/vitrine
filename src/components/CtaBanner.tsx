'use client';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { openBetaModal } from './BetaModal';
import { usePlatform } from '@/lib/usePlatform';
import { APP_STORE_URL } from '@/lib/downloadLinks';

export default function CtaBanner() {
  const t = useTranslations('cta');
  const { platform, mounted } = usePlatform();

  const showAppStore = !mounted || platform === 'desktop' || platform === 'ios';
  const showPlayStore = !mounted || platform === 'desktop' || platform === 'android';

  return (
    <section className="max-w-[1200px] mx-auto px-4 sm:px-8 my-6 sm:my-8">
      <div className="relative bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 sm:p-10 overflow-hidden">
        <div className="absolute top-[-50%] left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-[radial-gradient(circle,var(--primary-glow)_0%,transparent_70%)] pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row items-center gap-4 sm:gap-6 text-center sm:text-left">
          <Image
            src="/img/icon.webp"
            alt="DishRank"
            width={48}
            height={48}
            className="rounded-2xl shrink-0 block dark:hidden"
          />
          <Image
            src="/img/logo-light.webp"
            alt="DishRank"
            width={48}
            height={48}
            className="rounded-2xl shrink-0 hidden dark:block"
          />
          <div className="flex-1 min-w-0">
            <h2 className="text-lg sm:text-xl font-bold mb-1">{t('title')}</h2>
            <p className="text-xs sm:text-sm text-[var(--text2)]">{t('subtitle')}</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
            {showPlayStore && (
              <a
                href="#"
                onClick={openBetaModal}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 transition-all text-sm shrink-0 border border-gray-600"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.807 1.626a1 1 0 0 1 0 1.732l-2.807 1.626L15.206 12l2.492-2.492zM5.864 2.658L16.8 8.99l-2.302 2.302-8.634-8.634z"/></svg>
                <div className="text-left">
                  <div className="text-[9px] uppercase tracking-wider opacity-80">Disponible sur</div>
                  <div className="text-sm font-bold -mt-0.5">Google Play</div>
                </div>
              </a>
            )}
            {showAppStore && (
              <a
                href={APP_STORE_URL}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 transition-all text-sm shrink-0 border border-gray-600"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                <div className="text-left">
                  <div className="text-[9px] uppercase tracking-wider opacity-80">Disponible sur</div>
                  <div className="text-sm font-bold -mt-0.5">App Store</div>
                </div>
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
