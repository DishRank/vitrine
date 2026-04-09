'use client';
import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';

const TABS = ['privacy', 'terms', 'delete'] as const;
type Tab = (typeof TABS)[number];

export default function LegalSheet({ initialPage }: { initialPage: string }) {
  const t = useTranslations('legal');
  const isValidTab = (TABS as readonly string[]).includes(initialPage);
  const [open, setOpen] = useState(isValidTab);
  const [tab, setTab] = useState<Tab>(isValidTab ? (initialPage as Tab) : 'privacy');
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const page = (e as CustomEvent).detail;
      if ((TABS as readonly string[]).includes(page)) {
        setTab(page as Tab);
        setOpen(true);
      }
    };
    window.addEventListener('open-legal', handler);
    return () => window.removeEventListener('open-legal', handler);
  }, []);

  const close = () => {
    setClosing(true);
    setTimeout(() => {
      setOpen(false);
      setClosing(false);
      const params = new URLSearchParams(window.location.search);
      params.delete('page');
      const qs = params.toString();
      window.history.replaceState(null, '', qs ? '?' + qs : window.location.pathname);
    }, 300);
  };

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 z-[300] bg-black/50 backdrop-blur-sm flex items-end justify-center ${closing ? 'animate-[fadeOut_0.3s_ease_forwards]' : 'animate-[fadeIn_0.2s_ease]'}`}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="legal-title" className={`bg-[var(--surface)] rounded-t-3xl w-full max-w-[680px] max-h-[85vh] flex flex-col ${closing ? 'animate-[sheetDown_0.3s_ease_forwards]' : 'animate-[sheetUp_0.35s_ease]'}`}>
        {/* Header */}
        <div className="px-5 pt-3 shrink-0 relative">
          <div className="w-9 h-1 bg-[var(--border2)] rounded-full mx-auto mb-3" />
          <button onClick={close} className="absolute top-3 right-4 w-8 h-8 flex items-center justify-center bg-[var(--surface-var)] rounded-full text-[var(--text2)] hover:text-[var(--text)]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
          <div className="flex gap-1 pb-3 border-b border-[var(--border)]">
            {TABS.map((tb) => (
              <button
                key={tb}
                onClick={() => setTab(tb)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${tb === tab ? 'bg-[var(--primary-container)] text-[var(--primary)] font-semibold' : 'text-[var(--text3)] hover:text-[var(--text)]'}`}
              >
                {t(tb)}
              </button>
            ))}
          </div>
        </div>
        {/* Body */}
        <div
          className="legal-scroll flex-1 overflow-y-auto px-6 py-5 text-sm [&_h3]:text-lg [&_h3]:font-extrabold [&_h3]:mb-1 [&_h4]:text-sm [&_h4]:font-bold [&_h4]:mt-5 [&_h4]:mb-1 [&_p]:text-[var(--text2)] [&_p]:leading-relaxed [&_p]:mb-2 [&_a]:text-[var(--primary)] [&_a]:underline [&_ul]:pl-4 [&_ul]:mb-2 [&_li]:text-[var(--text2)] [&_li]:leading-relaxed [&_li]:mb-1"
          dangerouslySetInnerHTML={{ __html: t.raw(`${tab}Content`) as string }}
        />
      </div>
    </div>
  );
}
