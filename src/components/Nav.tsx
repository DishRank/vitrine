'use client';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { openBetaModal } from './BetaModal';

export default function Nav() {
  const t = useTranslations('footer');
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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
          <Image src="/img/icon.png" alt="DishRank" width={32} height={32} className="rounded-[10px]" />
          <span>DishRank</span>
        </a>
        <button
          onClick={openBetaModal}
          className="inline-flex items-center gap-2 px-5 py-2 bg-[var(--primary)] text-white text-sm font-semibold rounded-full hover:bg-[var(--primary-light)] hover:text-[var(--bg)] transition-all border-none cursor-pointer"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.807 1.626a1 1 0 0 1 0 1.732l-2.807 1.626L15.206 12l2.492-2.492zM5.864 2.658L16.8 8.99l-2.302 2.302-8.634-8.634z"/></svg>
          {t('download')}
        </button>
      </div>
    </nav>
  );
}
