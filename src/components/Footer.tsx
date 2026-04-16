'use client';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import AnimatedLogo from './AnimatedLogo';
import { openBetaModal } from './BetaModal';
import { usePlatform } from '@/lib/usePlatform';
import { APP_STORE_URL } from '@/lib/downloadLinks';

export default function Footer() {
  const t = useTranslations('footer');
  const tl = useTranslations('legal');
  const { platform, mounted } = usePlatform();

  const openLegal = useCallback((e: React.MouseEvent<HTMLAnchorElement>, page: string) => {
    e.preventDefault();
    const params = new URLSearchParams(window.location.search);
    params.set('page', page);
    window.history.pushState(null, '', '?' + params.toString());
    window.dispatchEvent(new CustomEvent('open-legal', { detail: page }));
  }, []);

  const showAppStore = !mounted || platform === 'desktop' || platform === 'ios';
  const showPlayStore = !mounted || platform === 'desktop' || platform === 'android';

  return (
    <footer className="border-t border-[var(--border)] py-6">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <a
          href="/"
          aria-label="DishRank — accueil"
          className="flex items-center gap-2 font-bold text-[#6C5CE7] dark:text-white"
        >
          <AnimatedLogo size={24} />
          <span className="text-[var(--text)]">DishRank</span>
        </a>
        <nav aria-label="Footer links" className="flex flex-wrap justify-center gap-4 sm:gap-5 text-xs text-[var(--text3)]">
          {showPlayStore && (
            <a href="#" onClick={openBetaModal} className="inline-flex items-center gap-1.5 hover:text-[var(--text)] transition-colors">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.807 1.626a1 1 0 0 1 0 1.732l-2.807 1.626L15.206 12l2.492-2.492zM5.864 2.658L16.8 8.99l-2.302 2.302-8.634-8.634z"/></svg>
              Google Play
            </a>
          )}
          {showAppStore && (
            <a href={APP_STORE_URL} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 hover:text-[var(--text)] transition-colors">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
              App Store
            </a>
          )}
          <a href="https://www.instagram.com/dishrank.app" target="_blank" rel="noopener" className="hover:text-[var(--text)] transition-colors">Instagram</a>
          <a href="mailto:contact@dishrank.fr" className="hover:text-[var(--text)] transition-colors">{t('contact')}</a>
          <a href="/?page=privacy" onClick={(e) => openLegal(e, 'privacy')} className="hover:text-[var(--text)] transition-colors">{tl('privacy')}</a>
          <a href="/?page=terms" onClick={(e) => openLegal(e, 'terms')} className="hover:text-[var(--text)] transition-colors">{tl('terms')}</a>
        </nav>
      </div>
    </footer>
  );
}
