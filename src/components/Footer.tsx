'use client';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import AnimatedLogo from './AnimatedLogo';
import { usePlatform } from '@/lib/usePlatform';
import { APP_STORE_URL, PLAY_STORE_URL } from '@/lib/downloadLinks';

export default function Footer() {
  const t = useTranslations('footer');
  const tl = useTranslations('legal');
  const tn = useTranslations('nav');
  const { platform, mounted } = usePlatform();

  const openLegal = useCallback((e: React.MouseEvent<HTMLAnchorElement>, page: string) => {
    e.preventDefault();
    const params = new URLSearchParams(window.location.search);
    params.set('page', page);
    window.history.pushState(null, '', '?' + params.toString());
    window.dispatchEvent(new CustomEvent('open-legal', { detail: page }));
  }, []);

  /** "Explorer" = retour en haut de page (cohérent avec la nav). */
  const scrollToTop = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const showAppStore = !mounted || platform === 'desktop' || platform === 'ios';
  const showPlayStore = !mounted || platform === 'desktop' || platform === 'android';

  return (
    <footer className="border-t border-[var(--border)] bg-[var(--bg)] mt-12">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-12 sm:py-16">
        {/* 4 columns grid : Brand (2x wide) | Produit | Communauté | Légal.
            Switches to the proper 4-col layout dès md (768px) au lieu de lg —
            il y a largement la place dès cette largeur, pas besoin d'attendre
            1024px pour passer en mode "ligne unique". */}
        <div className="grid grid-cols-2 md:grid-cols-[2fr_1fr_1fr_1fr] gap-8 md:gap-10">
          {/* Brand + tagline + store buttons */}
          <div className="col-span-2 md:col-span-1">
            <a
              href="/"
              aria-label="DishRank — accueil"
              className="inline-flex items-center gap-2.5 font-extrabold text-lg mb-4 text-[var(--primary)] dark:text-white"
            >
              <AnimatedLogo size={28} />
              <span className="text-[var(--text)]">DishRank</span>
            </a>
            <p className="text-sm text-[var(--text3)] leading-relaxed mb-5 max-w-sm">
              Note les plats, pas les restos. Trouve la meilleure adresse près de chez toi grâce à la communauté.
            </p>
            <div className="flex flex-row flex-wrap items-start gap-2 sm:gap-3">
              {showAppStore && (
                <a
                  href={APP_STORE_URL}
                  target="_blank"
                  rel="noopener"
                  className="store-btn inline-flex items-center gap-2 px-3 py-2 text-white rounded-lg transition-colors border"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                  <div className="text-left leading-none">
                    <div className="text-[7px] uppercase tracking-wider opacity-70">Télécharger sur</div>
                    <div className="text-[11px] font-bold mt-0.5">App Store</div>
                  </div>
                </a>
              )}
              {showPlayStore && (
                <a
                  href={PLAY_STORE_URL}
                  target="_blank"
                  rel="noopener"
                  className="store-btn inline-flex items-center gap-2 px-3 py-2 text-white rounded-lg transition-colors border"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.807 1.626a1 1 0 0 1 0 1.732l-2.807 1.626L15.206 12l2.492-2.492zM5.864 2.658L16.8 8.99l-2.302 2.302-8.634-8.634z"/></svg>
                  <div className="text-left leading-none">
                    <div className="text-[7px] uppercase tracking-wider opacity-70">Disponible sur</div>
                    <div className="text-[11px] font-bold mt-0.5">Google Play</div>
                  </div>
                </a>
              )}
            </div>
          </div>

          {/* Produit */}
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-[1.6px] text-[var(--text3)] mb-4">
              {t('colProduit')}
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li><a href="/" onClick={scrollToTop} className="text-[var(--text2)] hover:text-[var(--text)] transition-colors">{tn('explore')}</a></li>
              <li><a href="#top10" className="text-[var(--text2)] hover:text-[var(--text)] transition-colors">{tn('ranking')}</a></li>
              <li><a href="#app" className="text-[var(--text2)] hover:text-[var(--text)] transition-colors">{tn('app')}</a></li>
              <li>
                <a href="#social" className="text-[var(--text2)] hover:text-[var(--text)] transition-colors inline-flex items-center gap-1.5">
                  {tn('social')}
                  <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#ff7a3d]/15 text-[#ff7a3d] border border-[#ff7a3d]/30">
                    {tn('new')}
                  </span>
                </a>
              </li>
              <li><a href="#why" className="text-[var(--text2)] hover:text-[var(--text)] transition-colors">{tn('why')}</a></li>
            </ul>
          </div>

          {/* Communauté */}
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-[1.6px] text-[var(--text3)] mb-4">
              {t('colCommunaute')}
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li><a href="https://www.instagram.com/dishrank.app" target="_blank" rel="noopener" className="text-[var(--text2)] hover:text-[var(--text)] transition-colors">Instagram</a></li>
              <li><a href="mailto:contact@dishrank.fr" className="text-[var(--text2)] hover:text-[var(--text)] transition-colors">{t('contact')}</a></li>
              <li><a href="mailto:contact@dishrank.fr?subject=Presse" className="text-[var(--text2)] hover:text-[var(--text)] transition-colors">{t('press')}</a></li>
            </ul>
          </div>

          {/* Légal */}
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-[1.6px] text-[var(--text3)] mb-4">
              {t('colLegal')}
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li><a href="/?page=privacy" onClick={(e) => openLegal(e, 'privacy')} className="text-[var(--text2)] hover:text-[var(--text)] transition-colors">{tl('privacy')}</a></li>
              <li><a href="/?page=terms" onClick={(e) => openLegal(e, 'terms')} className="text-[var(--text2)] hover:text-[var(--text)] transition-colors">{tl('terms')}</a></li>
              <li><a href="/?page=delete" onClick={(e) => openLegal(e, 'delete')} className="text-[var(--text2)] hover:text-[var(--text)] transition-colors">{tl('delete')}</a></li>
              <li><a href="mailto:contact@dishrank.fr" className="text-[var(--text2)] hover:text-[var(--text)] transition-colors">{t('cookies')}</a></li>
            </ul>
          </div>
        </div>

      </div>
    </footer>
  );
}
