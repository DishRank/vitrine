'use client';
import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';

/**
 * CookieConsent — banner CNIL-compliant.
 *
 * Conformité explicite avec les directives CNIL 2024-2025 :
 *   • "Accepter tout", "Refuser tout" et "Personnaliser" ont strictement
 *     la MÊME hiérarchie visuelle (même taille, même couleur de fond,
 *     même bordure, même police). Aucun bouton n'est mis en avant.
 *   • Aucune case pré-cochée — analytics_storage = denied tant que l'user
 *     n'a pas explicitement accepté.
 *   • Aucun "cookie wall" — l'user peut continuer à naviguer sans choisir
 *     (le banner reste affiché en attente du choix).
 *   • Le bouton de fermeture "X" sans choix est volontairement absent
 *     (sinon il serait considéré comme un consentement implicite).
 *
 * UX :
 *   • Banner large en bas de page (max 720px), centré, ombre prononcée,
 *     visible immédiatement (pas un petit popup discret en coin).
 *   • Apparaît avec 800ms de délai après le mount → l'user a le temps
 *     de voir le site avant la décision (meilleur taux d'engagement).
 *   • Wording humain qui mentionne le contexte indé du projet plutôt que
 *     du jargon corporate. Augmente naturellement le taux d'acceptation
 *     sans manipuler.
 *   • Bouton "Personnaliser" ouvre un modal dédié avec les détails de
 *     chaque catégorie de cookie + un toggle pour les analytics.
 */

const CONSENT_KEY = 'dishrank_cookie_consent';
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

type Consent = 'granted' | 'denied' | null;

function getStoredConsent(): Consent {
  if (typeof window === 'undefined') return null;
  const v = localStorage.getItem(CONSENT_KEY);
  if (v === 'granted' || v === 'denied') return v;
  return null;
}

function loadGA() {
  if (!GA_ID || document.getElementById('ga-script')) return;
  const s = document.createElement('script');
  s.id = 'ga-script';
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);
  s.onload = () => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    (window as any).gtag('consent', 'update', { analytics_storage: 'granted' });
    (window as any).gtag('config', GA_ID);
    /* eslint-enable @typescript-eslint/no-explicit-any */
  };
}

export default function CookieConsent() {
  const t = useTranslations('cookies');
  const [consent, setConsent] = useState<Consent>('granted'); // SSR default: hidden
  const [showCustomize, setShowCustomize] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false); // case décochée par défaut
  const [visible, setVisible] = useState(false);

  // Lecture du choix stocké au mount
  useEffect(() => {
    const stored = getStoredConsent();
    setConsent(stored);
    if (stored === 'granted') {
      loadGA();
    }
  }, []);

  // Permet de rouvrir le banner cookies depuis l'extérieur (lien "Cookies"
  // dans le Footer). On reset `consent` à null pour que le banner principal
  // re-s'affiche (les 3 boutons), pas la modal Personnaliser. Si l'user
  // veut ré-affiner, il cliquera "Personnaliser" depuis le banner. Le toggle
  // est pré-rempli avec le choix actuel pour cohérence.
  //
  // IMPORTANT — animation au reopen : on met `visible=false` D'ABORD pour
  // que le banner monte à sa position cachée (translateY 4, opacity 0),
  // puis on bascule à `visible=true` au tick d'animation suivant (double
  // rAF) pour que la CSS transition `transition-all duration-300` ait une
  // vraie frame "from" à animer. Sans ça, React batch les deux setStates
  // dans le même render → le banner apparaît instantanément à sa position
  // finale, pas d'animation perçue.
  useEffect(() => {
    const reopen = () => {
      const stored = getStoredConsent();
      setAnalyticsEnabled(stored === 'granted');
      setShowCustomize(false);
      setVisible(false);
      setConsent(null);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
    };
    window.addEventListener('open-cookie-settings', reopen);
    return () => window.removeEventListener('open-cookie-settings', reopen);
  }, []);

  // Délai avant affichage : laisse l'user voir le site d'abord (meilleur engagement)
  useEffect(() => {
    if (consent !== null) return;
    const timer = window.setTimeout(() => setVisible(true), 800);
    return () => window.clearTimeout(timer);
  }, [consent]);

  const acceptAll = useCallback(() => {
    setVisible(false);
    window.setTimeout(() => {
      localStorage.setItem(CONSENT_KEY, 'granted');
      setConsent('granted');
      loadGA();
    }, 300);
  }, []);

  const denyAll = useCallback(() => {
    setVisible(false);
    window.setTimeout(() => {
      localStorage.setItem(CONSENT_KEY, 'denied');
      setConsent('denied');
      /* eslint-disable @typescript-eslint/no-explicit-any */
      (window as any).gtag?.('consent', 'update', { analytics_storage: 'denied' });
      /* eslint-enable @typescript-eslint/no-explicit-any */
    }, 300);
  }, []);

  // "Personnaliser" → user décide explicitement, on enregistre selon les toggles
  const saveCustom = useCallback(() => {
    setVisible(false);
    window.setTimeout(() => {
      const choice: Consent = analyticsEnabled ? 'granted' : 'denied';
      localStorage.setItem(CONSENT_KEY, choice);
      setConsent(choice);
      if (choice === 'granted') loadGA();
      setShowCustomize(false);
    }, 300);
  }, [analyticsEnabled]);

  // Si déjà répondu, on n'affiche rien
  if (consent !== null) return null;

  // ─── MODAL "Personnaliser" ──────────────────────────────────────────────
  if (showCustomize) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookie-customize-title"
        className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease]"
      >
        <div className="relative w-full max-w-[560px] bg-[var(--surface)] border border-[var(--border2)] rounded-2xl shadow-2xl animate-[slideUp_0.3s_ease]">
          {/* Header */}
          <div className="px-6 sm:px-8 pt-6 pb-4 border-b border-[var(--border)]">
            <h2 id="cookie-customize-title" className="font-bold text-xl text-[var(--text)]">
              {t('title')}
            </h2>
          </div>

          {/* Body : 2 catégories */}
          <div className="px-6 sm:px-8 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Cookies essentiels — toujours actifs */}
            <div className="rounded-xl border border-[var(--border2)] p-4 bg-[var(--surface-var)]">
              <div className="flex items-center justify-between gap-4 mb-2">
                <h3 className="font-bold text-sm text-[var(--text)]">{t('necessaryLabel')}</h3>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text3)] shrink-0">
                  {t('alwaysOn')}
                </span>
              </div>
              <p className="text-xs text-[var(--text2)] leading-relaxed">{t('necessaryDesc')}</p>
            </div>

            {/* Statistiques anonymes — toggle */}
            <div className="rounded-xl border border-[var(--border2)] p-4">
              <div className="flex items-center justify-between gap-4 mb-2">
                <h3 className="font-bold text-sm text-[var(--text)]">{t('analyticsLabel')}</h3>
                {/* Toggle switch — track 44×24px, thumb 20×20px.
                    Inline style on transform/left guarantees correct positioning
                    regardless of Tailwind config quirks. Thumb sits at left:2px
                    when off, slides 20px to the right when on (final left:22px),
                    leaving a 2px right padding inside the 44px track. */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={analyticsEnabled}
                  onClick={() => setAnalyticsEnabled((v) => !v)}
                  className={`relative shrink-0 rounded-full transition-colors cursor-pointer ${
                    analyticsEnabled ? 'bg-[var(--primary)]' : 'bg-[var(--border2)]'
                  }`}
                  style={{ width: 44, height: 24 }}
                >
                  <span
                    aria-hidden="true"
                    className="absolute rounded-full bg-white shadow transition-transform"
                    style={{
                      width: 20,
                      height: 20,
                      top: 2,
                      left: 2,
                      transform: analyticsEnabled ? 'translateX(20px)' : 'translateX(0)',
                    }}
                  />
                </button>
              </div>
              <p className="text-xs text-[var(--text2)] leading-relaxed">{t('analyticsDesc')}</p>
            </div>
          </div>

          {/* Footer : Retour + Enregistrer (équivalents en hiérarchie) */}
          <div className="px-6 sm:px-8 py-4 border-t border-[var(--border)] flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 sm:justify-end">
            <button
              type="button"
              onClick={() => setShowCustomize(false)}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold text-[var(--text)] bg-transparent border border-[var(--border2)] hover:bg-[var(--surface-var)] transition-colors cursor-pointer"
            >
              {t('back')}
            </button>
            <button
              type="button"
              onClick={saveCustom}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-[var(--primary)] hover:opacity-90 transition-opacity cursor-pointer"
            >
              {t('save')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── BANNER PRINCIPAL ───────────────────────────────────────────────────
  // IMPORTANT — pourquoi inline `style` au lieu de classes Tailwind pour le
  // transform : en Tailwind v4, `-translate-x-1/2` et `translate-y-4`
  // compilent vers la MÊME propriété CSS shorthand `translate` (et non plus
  // `transform` avec variables comme en v3). Résultat : la dernière classe
  // écrase la précédente — le centrage X se perd dans l'état caché et
  // l'animation devient incohérente. On centralise donc le translate dans
  // un inline style unique. Animation : slide-in horizontal depuis la
  // gauche (off-screen → centré) + fade.
  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-banner-title"
      aria-describedby="cookie-banner-desc"
      className="fixed bottom-4 sm:bottom-6 z-[400] w-[calc(100%-2rem)] max-w-[720px]"
      style={{
        left: '50%',
        transform: visible
          ? 'translate(-50%, 0)'
          : 'translate(-200%, 0)',
        opacity: visible ? 1 : 0,
        transition: 'transform 500ms cubic-bezier(0.32, 0.72, 0, 1), opacity 300ms ease-out',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <div
        className="relative bg-[var(--surface)] border-2 border-[var(--primary)]/30 rounded-2xl px-5 sm:px-7 py-5 sm:py-6 shadow-2xl"
        style={{ boxShadow: '0 20px 60px -15px rgba(108, 92, 231, 0.4), 0 8px 25px -8px rgba(0, 0, 0, 0.25)' }}
      >
        {/* Glow décoratif violet en arrière-plan */}
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none -z-10"
          aria-hidden="true"
          style={{
            background: 'radial-gradient(circle at 0% 0%, rgba(108, 92, 231, 0.12), transparent 50%)',
          }}
        />

        {/* Title + description */}
        <h2 id="cookie-banner-title" className="font-bold text-base sm:text-lg text-[var(--text)] mb-2">
          {t('title')}
        </h2>
        <p
          id="cookie-banner-desc"
          className="text-sm text-[var(--text2)] leading-relaxed mb-5"
        >
          {t('description')}
        </p>

        {/* 3 boutons à HIERARCHIE STRICTEMENT ÉGALE — exigence CNIL 2024.
            Même couleur de fond, même bordure, même taille, même police.
            Aucun n'est "mis en avant" visuellement. */}
        <div
          role="group"
          aria-label="Vos choix"
          className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3"
        >
          <button
            type="button"
            onClick={denyAll}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold text-[var(--text)] bg-[var(--surface-var)] border border-[var(--border2)] hover:bg-[var(--border2)] transition-colors cursor-pointer"
          >
            {t('deny')}
          </button>
          <button
            type="button"
            onClick={() => setShowCustomize(true)}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold text-[var(--text)] bg-[var(--surface-var)] border border-[var(--border2)] hover:bg-[var(--border2)] transition-colors cursor-pointer"
          >
            {t('customize')}
          </button>
          <button
            type="button"
            onClick={acceptAll}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold text-[var(--text)] bg-[var(--surface-var)] border border-[var(--border2)] hover:bg-[var(--border2)] transition-colors cursor-pointer"
          >
            {t('accept')}
          </button>
        </div>
      </div>
    </div>
  );
}
