'use client';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useCallback } from 'react';
import { openBetaModal } from './BetaModal';

export default function Footer() {
  const t = useTranslations('footer');
  const tl = useTranslations('legal');

  const openLegal = useCallback((e: React.MouseEvent<HTMLAnchorElement>, page: string) => {
    e.preventDefault();
    const params = new URLSearchParams(window.location.search);
    params.set('page', page);
    window.history.pushState(null, '', '?' + params.toString());
    window.dispatchEvent(new CustomEvent('open-legal', { detail: page }));
  }, []);

  return (
    <footer className="border-t border-[var(--border)] py-6">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <a href="/" className="flex items-center gap-2 font-bold">
          <Image src="/img/icon.png" alt="DishRank logo" width={24} height={24} className="rounded-md" />
          <span>DishRank</span>
        </a>
        <nav aria-label="Footer links" className="flex flex-wrap justify-center gap-4 sm:gap-5 text-xs text-[var(--text3)]">
          <a href="#" onClick={openBetaModal} className="hover:text-[var(--text)] transition-colors">Google Play</a>
          <a href="mailto:contact@dishrank.fr" className="hover:text-[var(--text)] transition-colors">{t('contact')}</a>
          <a href="/?page=privacy" onClick={(e) => openLegal(e, 'privacy')} className="hover:text-[var(--text)] transition-colors">{tl('privacy')}</a>
          <a href="/?page=terms" onClick={(e) => openLegal(e, 'terms')} className="hover:text-[var(--text)] transition-colors">{tl('terms')}</a>
        </nav>
      </div>
    </footer>
  );
}
