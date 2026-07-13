'use client';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import AnimatedLogo from './AnimatedLogo';
import { usePlatform } from '@/lib/usePlatform';
import { APP_STORE_URL, PLAY_STORE_URL } from '@/lib/downloadLinks';
import { trackDownloadClick } from '@/lib/analytics';

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

  /** Smooth scroll custom — implémentation rAF qui IGNORE la préférence
   *  système `prefers-reduced-motion`. Justification : naviguer vers une
   *  section EST une intention explicite de l'utilisateur (il a cliqué
   *  un lien d'ancrage), pas de la déco passive. Sans le smooth, l'user
   *  est téléporté et perd la repère visuel "je viens de descendre".
   *  Le browser désactive `scrollIntoView({ behavior: smooth })` quand
   *  reduced-motion est actif → on contourne en pilotant le scroll
   *  frame-par-frame avec une easing inOutQuad (650ms par défaut). */
  const smoothScrollTo = useCallback((targetY: number, duration = 650) => {
    const startY = window.scrollY;
    const distance = targetY - startY;
    if (Math.abs(distance) < 1) return;
    let start: number | null = null;
    const easeInOutQuad = (t: number) =>
      t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const step = (ts: number) => {
      if (start === null) start = ts;
      const t = Math.min(1, (ts - start) / duration);
      window.scrollTo(0, startY + distance * easeInOutQuad(t));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, []);

  /** "Explorer" = retour en haut de page (cohérent avec la nav). */
  const scrollToTop = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    smoothScrollTo(0);
  }, [smoothScrollTo]);

  /** Anchor link → smooth scroll custom (cf. smoothScrollTo). Met à jour
   *  le hash de l'URL pour le partage. Le `scroll-margin-top: 80px` global
   *  est compensé en JS via -80 sur la position cible. */
  const scrollToAnchor = useCallback((e: React.MouseEvent<HTMLAnchorElement>, hash: string) => {
    e.preventDefault();
    const el = document.querySelector(hash) as HTMLElement | null;
    if (el) {
      // 80px = hauteur nav (h-16 = 64px) + 16px d'air, identique à la valeur
      // de `scroll-margin-top` posée sur `:where([id])` dans globals.css.
      const targetY = el.getBoundingClientRect().top + window.scrollY - 80;
      smoothScrollTo(Math.max(0, targetY));
      // Update URL hash sans push (replace) → pas de pollution de l'historique
      // navigateur sur les clics rapides successifs.
      window.history.replaceState(null, '', hash);
    }
  }, [smoothScrollTo]);

  /** "Cookies" → rouvre la modal de paramétrage cookies (CookieConsent
   *  écoute cet event et affiche directement le panneau "Personnaliser"
   *  pré-rempli avec le choix actuel). */
  const openCookieSettings = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    window.dispatchEvent(new CustomEvent('open-cookie-settings'));
  }, []);

  const showAppStore = !mounted || platform === 'desktop' || platform === 'ios';
  const showPlayStore = !mounted || platform === 'desktop' || platform === 'android';

  return (
    <footer className="border-t border-[var(--border)] bg-[var(--bg)] mt-12">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-12 sm:py-16">
        {/* 3 columns grid : Brand (2x wide) | Produit | Légal.
            La colonne "Communauté" (Instagram + contact) a été fusionnée
            sous le bloc Brand en row d'icônes sociales — réduit le "footer
            link farm" tout en gardant les 2 liens accessibles. */}
        <div className="grid grid-cols-2 md:grid-cols-[2fr_1fr_1fr] gap-8 md:gap-10">
          {/* Brand + tagline + store buttons + social icons */}
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
            <div className="flex flex-row flex-wrap items-start gap-2 sm:gap-3 mb-5">
              {showAppStore && (
                <a
                  href={APP_STORE_URL}
                  target="_blank"
                  rel="noopener"
                  onClick={() => trackDownloadClick('apple', 'footer')}
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
                  onClick={() => trackDownloadClick('play', 'footer')}
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
            {/* Icônes sociales — remplacent la colonne "Communauté" pour
                alléger le footer. Chaque icône a un aria-label explicite. */}
            <div className="flex items-center gap-2">
              <a
                href="https://www.instagram.com/dishrank.app"
                target="_blank"
                rel="noopener"
                className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-[var(--border2)] text-[var(--text2)] hover:text-[var(--accent-warm)] hover:border-[var(--accent-warm)] transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="2" y="2" width="20" height="20" rx="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
                {/* sr-only : texte d'ancrage lisible par les screen readers
                    ET crawlers, invisible visuellement. Remplace `aria-label`
                    qui n'est pas indexé aussi fiablement par tous les bots. */}
                <span className="sr-only">DishRank sur Instagram</span>
              </a>
              <a
                href="mailto:contact@dishrank.fr"
                className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-[var(--border2)] text-[var(--text2)] hover:text-[var(--primary)] hover:border-[var(--primary)] transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                <span className="sr-only">{t('contact')}</span>
              </a>
            </div>
          </div>

          {/* Produit */}
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-[1.6px] text-[var(--text3)] mb-4">
              {t('colProduit')}
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li><a href="/" onClick={scrollToTop} className="footer-link text-[var(--text2)] hover:text-[var(--text)]">{tn('explore')}</a></li>
              <li><a href="#top10" onClick={(e) => scrollToAnchor(e, '#top10')} className="footer-link text-[var(--text2)] hover:text-[var(--text)]">{tn('ranking')}</a></li>
              <li><a href="#app" onClick={(e) => scrollToAnchor(e, '#app')} className="footer-link text-[var(--text2)] hover:text-[var(--text)]">{tn('app')}</a></li>
              <li>
                <a href="#social" onClick={(e) => scrollToAnchor(e, '#social')} className="footer-link text-[var(--text2)] hover:text-[var(--text)]">
                  {tn('social')}
                  <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#ff7a3d]/15 text-[#ff7a3d] border border-[#ff7a3d]/30">
                    {tn('new')}
                  </span>
                </a>
              </li>
              <li><a href="#why" onClick={(e) => scrollToAnchor(e, '#why')} className="footer-link text-[var(--text2)] hover:text-[var(--text)]">{tn('why')}</a></li>
              <li><a href="/pro" className="footer-link font-semibold text-[var(--primary)] hover:opacity-80">Espace pro</a></li>
            </ul>
          </div>

          {/* Légal */}
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-[1.6px] text-[var(--text3)] mb-4">
              {t('colLegal')}
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li><a href="/?page=privacy" onClick={(e) => openLegal(e, 'privacy')} className="footer-link text-[var(--text2)] hover:text-[var(--text)]">{tl('privacy')}</a></li>
              <li><a href="/?page=terms" onClick={(e) => openLegal(e, 'terms')} className="footer-link text-[var(--text2)] hover:text-[var(--text)]">{tl('terms')}</a></li>
              <li><a href="/?page=delete" onClick={(e) => openLegal(e, 'delete')} className="footer-link text-[var(--text2)] hover:text-[var(--text)]">{tl('delete')}</a></li>
              <li><a href="#" onClick={openCookieSettings} className="footer-link text-[var(--text2)] hover:text-[var(--text)] cursor-pointer">{t('cookies')}</a></li>
            </ul>
          </div>
        </div>

        {/* Sub-footer : copyright + petite ligne "Made in France" + back-to-top.
            Sépare visuellement la zone légale / signature des link columns
            au-dessus. Border-top discret pour ancrer le bloc. */}
        <div className="mt-10 sm:mt-14 pt-6 border-t border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--text3)]">
          <p className="tabular">
            © {new Date().getFullYear()} DishRank ·{' '}
            <span className="inline-flex items-center gap-1">
              <span>Made in France</span>
              <span aria-hidden="true">🇫🇷</span>
            </span>
          </p>
          <button
            type="button"
            onClick={() => smoothScrollTo(0)}
            className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--border2)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
            aria-label="Retour en haut"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="18 15 12 9 6 15" />
            </svg>
            <span>{t('backToTop')}</span>
          </button>
        </div>
      </div>
    </footer>
  );
}
