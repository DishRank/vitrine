'use client';
import { useTranslations } from 'next-intl';
import { useState, useEffect, useRef, useCallback } from 'react';

const TABS = ['privacy', 'terms', 'delete'] as const;
type Tab = (typeof TABS)[number];

/**
 * Defense-in-depth pour le contenu légal injecté via dangerouslySetInnerHTML.
 * Le contenu vient de fichiers i18n JSON versionnés (donc safe par design),
 * mais on strip quand même tout `<script>` ou attribut `on*=...` au cas où
 * quelqu'un éditerait les messages par erreur ou copy-paste un blob HTML
 * suspect. Léger (regex simples), pas une lib comme DOMPurify.
 */
function sanitizeLegalHtml(html: string): string {
  return html
    // Strip <script>...</script> + variantes
    .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
    // Strip <iframe>, <object>, <embed>
    .replace(/<\s*(iframe|object|embed)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    // Strip on* event handlers (onClick, onLoad, onError, etc.)
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    // Strip javascript: URLs
    .replace(/(href|src)\s*=\s*("\s*javascript:[^"]*"|'\s*javascript:[^']*')/gi, '$1="#"');
}

export default function LegalSheet({ initialPage }: { initialPage: string }) {
  const t = useTranslations('legal');
  const isValidTab = (TABS as readonly string[]).includes(initialPage);
  const [open, setOpen] = useState(isValidTab);
  const [tab, setTab] = useState<Tab>(isValidTab ? (initialPage as Tab) : 'privacy');
  const [closing, setClosing] = useState(false);
  const [dragY, setDragY] = useState(0);
  const touchStartY = useRef<number | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

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

  // Empeche le scroll du body quand le sheet est ouvert (mobile notamment)
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    const prevTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = prevTouchAction;
    };
  }, [open]);

  const close = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setOpen(false);
      setClosing(false);
      setDragY(0);
      const params = new URLSearchParams(window.location.search);
      params.delete('page');
      const qs = params.toString();
      window.history.replaceState(null, '', qs ? '?' + qs : window.location.pathname);
    }, 300);
  }, []);

  // Swipe-down to close : gestionnaire touch sur la zone du header (handle + tabs)
  // Pas sur le corps pour ne pas interferer avec le scroll du contenu.
  const onHandleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };
  const onHandleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (dy > 0) setDragY(dy);
  };
  const onHandleTouchEnd = () => {
    if (dragY > 100) {
      close();
    } else {
      setDragY(0);
    }
    touchStartY.current = null;
  };

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 z-[300] bg-black/50 backdrop-blur-sm flex items-end justify-center overscroll-contain ${closing ? 'animate-[fadeOut_0.3s_ease_forwards]' : 'animate-[fadeIn_0.2s_ease]'}`}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-title"
        className={`bg-[var(--surface)] rounded-t-3xl w-full max-w-[680px] max-h-[85vh] flex flex-col ${closing ? 'animate-[sheetDown_0.3s_ease_forwards]' : 'animate-[sheetUp_0.35s_ease]'}`}
        style={dragY > 0 ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
      >
        {/* Header — zone de swipe */}
        <div
          className="px-5 pt-3 shrink-0 relative touch-none select-none"
          onTouchStart={onHandleTouchStart}
          onTouchMove={onHandleTouchMove}
          onTouchEnd={onHandleTouchEnd}
        >
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
        {/* Body — contenu légal injecté via dangerouslySetInnerHTML.
            Source : i18n JSON statique (versionné dans le repo, pas user-input)
            → safe en l'état. Mais pour défense en profondeur on strip toute
            balise <script> ou attribut on* qui aurait pu être glissé par
            erreur lors d'une édition future des messages. */}
        <div
          className="legal-scroll flex-1 overflow-y-auto overscroll-contain px-6 py-5 text-sm [&_h3]:text-lg [&_h3]:font-extrabold [&_h3]:mb-1 [&_h4]:text-sm [&_h4]:font-bold [&_h4]:mt-5 [&_h4]:mb-1 [&_p]:text-[var(--text2)] [&_p]:leading-relaxed [&_p]:mb-2 [&_a]:text-[var(--primary)] [&_a]:underline [&_ul]:pl-4 [&_ul]:mb-2 [&_li]:text-[var(--text2)] [&_li]:leading-relaxed [&_li]:mb-1"
          style={{ touchAction: 'pan-y' }}
          dangerouslySetInnerHTML={{ __html: sanitizeLegalHtml(t.raw(`${tab}Content`) as string) }}
        />
      </div>
    </div>
  );
}
