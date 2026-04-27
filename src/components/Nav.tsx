'use client';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import AnimatedLogo from './AnimatedLogo';
import LocaleSwitcher from './LocaleSwitcher';
import { usePlatform } from '@/lib/usePlatform';
import { APP_STORE_URL, PLAY_STORE_URL } from '@/lib/downloadLinks';

/**
 * Nav v3 — fully responsive.
 * Desktop (≥ md / 768px) : logo + horizontal links + store buttons + locale.
 * Mobile (< md)          : logo + burger button → full-screen drawer with
 *                          links, store buttons, and locale.
 *
 * The drawer locks body scroll, animates in via translateX, and closes on
 * link tap, ESC press, backdrop click, or "×" button.
 */
export default function Nav() {
  const t = useTranslations('nav');
  const [scrolled, setScrolled] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { platform, mounted } = usePlatform();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Body scroll lock + ESC to close drawer.
  //
  // On utilise la technique `position: fixed` (au lieu de juste
  // `overflow: hidden`) car Safari iOS ignore `overflow: hidden` sur le
  // body quand un autre élément (le drawer) a une transform/scroll. La
  // méthode fiable :
  //   1) Mémoriser la position scroll actuelle
  //   2) Mettre body en `position: fixed; top: -<scrollY>px; width: 100%`
  //   3) Au close, restaurer le scroll exactement où on était
  useEffect(() => {
    if (!drawerOpen) return;

    const scrollY = window.scrollY;
    const body = document.body;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
    body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);

    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;
      body.style.overflow = prev.overflow;
      // Restore the scroll position exactly where we were before locking
      window.scrollTo(0, scrollY);
      window.removeEventListener('keydown', onKey);
    };
  }, [drawerOpen]);

  // Determine which buttons to show based on user platform
  const showAppStore = !mounted || platform === 'desktop' || platform === 'ios';
  const showPlayStore = !mounted || platform === 'desktop' || platform === 'android';

  /** Reusable Play Store button (used in desktop nav and mobile drawer). */
  const playStoreButton = (variant: 'desktop' | 'drawer') => (
    <a
      href={PLAY_STORE_URL}
      target="_blank"
      rel="noopener"
      aria-label={`${t('downloadOn')} Google Play`}
      onClick={() => setDrawerOpen(false)}
      className={
        variant === 'desktop'
          ? 'store-btn inline-flex items-center gap-2 px-3.5 py-2 text-white rounded-lg transition-colors border'
          : 'store-btn flex-1 min-w-0 inline-flex items-center justify-center gap-2 px-2.5 py-2 text-white rounded-lg border transition-colors'
      }
    >
      <svg width={variant === 'drawer' ? 16 : 16} height={variant === 'drawer' ? 16 : 16} viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
        <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.807 1.626a1 1 0 0 1 0 1.732l-2.807 1.626L15.206 12l2.492-2.492zM5.864 2.658L16.8 8.99l-2.302 2.302-8.634-8.634z" />
      </svg>
      <div className="text-left leading-none">
        <div className="text-[8px] uppercase tracking-wider opacity-70">
          {t('downloadOn')}
        </div>
        <div className="text-xs font-bold mt-0.5">
          Google Play
        </div>
      </div>
    </a>
  );

  /** Reusable App Store button. */
  const appStoreButton = (variant: 'desktop' | 'drawer') => (
    <a
      href={APP_STORE_URL}
      target="_blank"
      rel="noopener"
      aria-label={`${t('downloadOn')} App Store`}
      onClick={() => setDrawerOpen(false)}
      className={
        variant === 'desktop'
          ? 'store-btn inline-flex items-center gap-2 px-3.5 py-2 text-white rounded-lg transition-colors border'
          : 'store-btn flex-1 min-w-0 inline-flex items-center justify-center gap-2 px-2.5 py-2 text-white rounded-lg border transition-colors'
      }
    >
      <svg width={variant === 'drawer' ? 16 : 16} height={variant === 'drawer' ? 16 : 16} viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
      </svg>
      <div className="text-left leading-none">
        <div className="text-[8px] uppercase tracking-wider opacity-70">
          {t('downloadOn')}
        </div>
        <div className="text-xs font-bold mt-0.5">
          App Store
        </div>
      </div>
    </a>
  );

  /** Nav anchor links — same set used in desktop bar and mobile drawer.
   *  `top: true` → click handler scrolle à 0 (au lieu de chercher une ancre).
   *  L'href reste `/` pour la sémantique + fallback no-JS (la page recharge
   *  au top), mais le handler `preventDefault` + `scrollTo({ top: 0 })`
   *  garde l'utilisateur sur la même page sans recharge. */
  const navLinks: Array<{ href: string; label: string; badge?: string; top?: boolean }> = [
    { href: '/', label: t('explore'), top: true },
    { href: '#top10', label: t('ranking') },
    { href: '#social', label: t('social'), badge: t('new') },
    { href: '#why', label: t('why') },
  ];

  /** Handler partagé desktop + drawer pour les liens "scroll to top". */
  const onNavLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, link: typeof navLinks[number]) => {
    if (link.top) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setDrawerOpen(false);
  };

  return (
    <>
      <nav
        aria-label="Main navigation"
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={scrolled ? {
          background: 'color-mix(in srgb, var(--bg) 78%, transparent)',
          backdropFilter: 'saturate(160%) blur(14px)',
          WebkitBackdropFilter: 'saturate(160%) blur(14px)',
          boxShadow: '0 1px 0 var(--border)',
        } : {
          background: 'color-mix(in srgb, var(--bg) 60%, transparent)',
          backdropFilter: 'saturate(160%) blur(10px)',
          WebkitBackdropFilter: 'saturate(160%) blur(10px)',
        }}
      >
        <div className="max-w-[1280px] mx-auto px-4 sm:px-8 flex items-center justify-between h-16">
          {/* Logo + brand. AnimatedLogo herite la couleur du parent via
              currentColor → violet en light mode, blanc en dark mode. */}
          <a
            href="/"
            aria-label="DishRank — accueil"
            className="flex items-center gap-2.5 font-extrabold text-lg shrink-0 text-[var(--primary)] dark:text-white"
          >
            <AnimatedLogo size={28} />
            <span className="text-[var(--text)]">DishRank</span>
          </a>

          {/* Desktop : horizontal nav links (lg+ only — pushed back to lg
              because at md sizes the bar gets crowded with stores+locale). */}
          <div className="hidden lg:flex items-center gap-7 text-sm font-medium text-[var(--text2)]">
            {navLinks.map((l) => (
              <a
                key={l.label}
                href={l.href}
                onClick={(e) => onNavLinkClick(e, l)}
                className="hover:text-[var(--text)] transition-colors inline-flex items-center gap-1.5"
              >
                {l.label}
                {l.badge && (
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#ff7a3d]/15 text-[#ff7a3d] border border-[#ff7a3d]/30">
                    {l.badge}
                  </span>
                )}
              </a>
            ))}
          </div>

          {/* Right side :
              • Stores visible dès sm+ (les CTA download sont notre priorité,
                on les garde tant qu'ils passent dans la barre)
              • Locale visible dès sm+
              • Nav links visibles à lg+ uniquement (drawer en dessous)
              • Burger visible à < lg */}
          <div className="flex items-center gap-2">
            {/* Stores + Locale visibles dès sm (640px) */}
            <div className="hidden sm:flex items-center gap-2">
              {showPlayStore && playStoreButton('desktop')}
              {showAppStore && appStoreButton('desktop')}
              <LocaleSwitcher />
            </div>

            {/* < lg : burger button */}
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Ouvrir le menu"
              aria-expanded={drawerOpen}
              aria-controls="mobile-drawer"
              className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg cursor-pointer hover:bg-[var(--surface)] transition-colors"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* ─────────── DRAWER (< lg) ─────────── */}
      {/* Backdrop — fade-in court (200ms). */}
      <div
        onClick={() => setDrawerOpen(false)}
        className={`lg:hidden fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${
          drawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
      />

      {/* Drawer panel — slides in from the right.
          IMPORTANT : on utilise un `style` inline pour le transform au lieu
          des classes Tailwind `translate-x-*`. En Tailwind v4, ces classes
          compilent vers la propriété CSS `translate` (pas `transform`),
          donc `transition-transform` ne déclenche AUCUNE animation et le
          drawer apparaît d'un coup. Inline `transform` + `transition` =
          slide visible et fluide.

          280ms + cubic-bezier(0.32, 0.72, 0, 1) → courbe "iOS sheet",
          rapide mais clairement perçue comme animée. */}
      <aside
        id="mobile-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Menu de navigation"
        style={{
          transform: drawerOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 280ms cubic-bezier(0.32, 0.72, 0, 1)',
          willChange: 'transform',
        }}
        className="lg:hidden fixed top-0 right-0 bottom-0 z-[61] w-[88%] max-w-[360px] bg-[var(--bg)] border-l border-[var(--border2)] shadow-2xl flex flex-col"
      >
        {/* Drawer header : logo + close */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-[var(--border)]">
          <a
            href="/"
            onClick={() => setDrawerOpen(false)}
            className="flex items-center gap-2.5 font-extrabold text-lg text-[var(--primary)] dark:text-white"
          >
            <AnimatedLogo size={26} />
            <span className="text-[var(--text)]">DishRank</span>
          </a>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="Fermer le menu"
            className="inline-flex items-center justify-center w-10 h-10 rounded-lg cursor-pointer hover:bg-[var(--surface)] transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="6" y1="18" x2="18" y2="6" />
            </svg>
          </button>
        </div>

        {/* Drawer body : nav links */}
        <nav className="flex-1 overflow-y-auto px-2 py-4">
          <ul className="flex flex-col gap-1">
            {navLinks.map((l) => (
              <li key={l.label}>
                <a
                  href={l.href}
                  onClick={(e) => onNavLinkClick(e, l)}
                  className="flex items-center justify-between px-4 py-4 rounded-xl text-base font-semibold text-[var(--text)] hover:bg-[var(--surface)] active:bg-[var(--surface-var)] transition-colors"
                >
                  <span>{l.label}</span>
                  {l.badge ? (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#ff7a3d]/15 text-[#ff7a3d] border border-[#ff7a3d]/30">
                      {l.badge}
                    </span>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--text3)]" aria-hidden="true">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  )}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Drawer footer : store buttons (côte à côte, compacts) + locale */}
        <div className="px-4 py-5 border-t border-[var(--border)] flex flex-col gap-4">
          <div className="flex flex-row gap-2">
            {showPlayStore && playStoreButton('drawer')}
            {showAppStore && appStoreButton('drawer')}
          </div>
          <LocaleSwitcher variant="drawer" />
        </div>
      </aside>
    </>
  );
}
