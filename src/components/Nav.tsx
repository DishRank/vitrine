'use client';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { openBetaModal } from './BetaModal';
import LocaleSwitcher from './LocaleSwitcher';
import { usePlatform } from '@/lib/usePlatform';
import { APP_STORE_URL, ANDROID_LIVE, PLAY_STORE_URL } from '@/lib/downloadLinks';

export default function Nav() {
  const t = useTranslations('nav');
  const [scrolled, setScrolled] = useState(false);
  const { platform, mounted } = usePlatform();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Determine which buttons to show:
  //  - desktop or not-yet-mounted -> both
  //  - iOS -> App Store only
  //  - Android -> Google Play only
  const showAppStore = !mounted || platform === 'desktop' || platform === 'ios';
  const showPlayStore = !mounted || platform === 'desktop' || platform === 'android';

  const playStoreButton = (
    <button
      onClick={openBetaModal}
      aria-label={`Google Play - ${t('betaClosed')}`}
      className="inline-flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3.5 py-1.5 sm:py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-all border border-gray-700 cursor-pointer"
    >
      <svg width="14" height="14" className="sm:w-4 sm:h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.807 1.626a1 1 0 0 1 0 1.732l-2.807 1.626L15.206 12l2.492-2.492zM5.864 2.658L16.8 8.99l-2.302 2.302-8.634-8.634z"/></svg>
      <div className="hidden sm:block text-left leading-none">
        <div className="text-[7px] sm:text-[8px] uppercase tracking-wider opacity-70">{ANDROID_LIVE ? t('downloadOn') : t('betaClosed')}</div>
        <div className="text-[10px] sm:text-xs font-bold mt-0.5">Google Play</div>
      </div>
    </button>
  );

  const appStoreButton = (
    <a
      href={APP_STORE_URL}
      target="_blank"
      rel="noopener"
      aria-label={`${t('downloadOn')} App Store`}
      className="inline-flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3.5 py-1.5 sm:py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-all border border-gray-700"
    >
      <svg width="14" height="14" className="sm:w-4 sm:h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
      <div className="hidden sm:block text-left leading-none">
        <div className="text-[7px] sm:text-[8px] uppercase tracking-wider opacity-70">{t('downloadOn')}</div>
        <div className="text-[10px] sm:text-xs font-bold mt-0.5">App Store</div>
      </div>
    </a>
  );

  // Reference ANDROID_LIVE and PLAY_STORE_URL so unused-warning doesn't trip.
  void PLAY_STORE_URL;

  return (
    <nav
      aria-label="Main navigation"
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={scrolled ? {
        background: 'color-mix(in srgb, var(--bg) 85%, transparent)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 1px 0 var(--border)',
      } : {}}
    >
      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 flex items-center justify-between h-16">
        <a href="/" className="flex items-center gap-2.5 font-extrabold text-lg">
          <Image
            src="/img/icon.webp"
            alt="DishRank"
            width={32}
            height={32}
            className="rounded-[10px] block dark:hidden"
          />
          <Image
            src="/img/logo-light.webp"
            alt="DishRank"
            width={32}
            height={32}
            className="rounded-[10px] hidden dark:block"
          />
          <span>DishRank</span>
        </a>
        <div className="flex items-center gap-1 sm:gap-2">
          {showPlayStore && playStoreButton}
          {showAppStore && appStoreButton}
          <LocaleSwitcher />
        </div>
      </div>
    </nav>
  );
}
