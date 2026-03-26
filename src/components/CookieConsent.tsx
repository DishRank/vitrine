'use client';
import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';

const CONSENT_KEY = 'dishrank_cookie_consent';

type Consent = 'granted' | 'denied' | null;

function getStoredConsent(): Consent {
  if (typeof window === 'undefined') return null;
  const v = localStorage.getItem(CONSENT_KEY);
  if (v === 'granted' || v === 'denied') return v;
  return null;
}

function updateGtagConsent(consent: 'granted' | 'denied') {
  if (typeof window !== 'undefined' && typeof (window as any).gtag === 'function') {
    (window as any).gtag('consent', 'update', {
      analytics_storage: consent,
    });
  }
}

export default function CookieConsent() {
  const t = useTranslations('cookies');
  const [consent, setConsent] = useState<Consent>('granted'); // SSR default: hidden
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    setConsent(getStoredConsent());
  }, []);

  const accept = () => {
    setClosing(true);
    setTimeout(() => {
      localStorage.setItem(CONSENT_KEY, 'granted');
      setConsent('granted');
      updateGtagConsent('granted');
      // Load GA script dynamically
      loadGA();
    }, 300);
  };

  const deny = () => {
    setClosing(true);
    setTimeout(() => {
      localStorage.setItem(CONSENT_KEY, 'denied');
      setConsent('denied');
      updateGtagConsent('denied');
    }, 300);
  };

  // Don't show if already answered
  if (consent !== null) return null;

  return (
    <div className={`fixed bottom-4 right-4 z-[400] transition-all duration-300 ${closing ? 'opacity-0 translate-y-2 scale-95' : 'opacity-100 translate-y-0 scale-100 animate-[fadeUp_0.3s_ease]'}`}>
      <div className="w-[280px] bg-[var(--surface)] border border-[var(--border2)] rounded-xl p-4 shadow-[0_4px_20px_rgba(0,0,0,0.15)]">
        <p className="text-xs font-bold mb-1">{t('title')}</p>
        <p className="text-[11px] text-[var(--text2)] leading-relaxed mb-3">{t('description')}</p>
        <div className="flex gap-2">
          <button
            onClick={deny}
            className="flex-1 px-3 py-1.5 rounded-full text-[11px] font-medium border border-[var(--border2)] text-[var(--text2)] hover:text-[var(--text)] hover:border-[var(--text3)] transition-all"
          >
            {t('deny')}
          </button>
          <button
            onClick={accept}
            className="flex-1 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-[var(--primary)] text-white hover:bg-[var(--primary-light)] hover:text-[var(--bg)] transition-all"
          >
            {t('accept')}
          </button>
        </div>
      </div>
    </div>
  );
}

// Load GA4 script only after consent
function loadGA() {
  const id = process.env.NEXT_PUBLIC_GA_ID;
  if (!id || document.getElementById('ga-script')) return;
  const s = document.createElement('script');
  s.id = 'ga-script';
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(s);
  s.onload = () => {
    (window as any).dataLayer = (window as any).dataLayer || [];
    function gtag(...args: any[]) { (window as any).dataLayer.push(args); }
    (window as any).gtag = gtag;
    gtag('js', new Date());
    gtag('consent', 'update', { analytics_storage: 'granted' });
    gtag('config', id);
  };
}
