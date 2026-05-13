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

/** Durée du fade lors d'un changement d'onglet (doit matcher la transition
 *  CSS appliquée au body du sheet ci-dessous). */
const TAB_FADE_MS = 180;
/** Durée de la transition `height` du body quand on change d'onglet.
 *  Doit ≥ TAB_FADE_MS sinon le body est "vide" plus longtemps qu'il ne
 *  s'anime. 360ms iOS-like spring, cohérent avec sheetUp/sheetDown. */
const HEIGHT_ANIM_MS = 360;

export default function LegalSheet({ initialPage }: { initialPage: string }) {
  const t = useTranslations('legal');
  const isValidTab = (TABS as readonly string[]).includes(initialPage);
  const [open, setOpen] = useState(isValidTab);
  const [tab, setTab] = useState<Tab>(isValidTab ? (initialPage as Tab) : 'privacy');
  /** Onglet RÉELLEMENT affiché dans le body. Décalé d'un fade-out par rapport
   *  à `tab` (l'état "logique" qui suit le clic). On swap le contenu seulement
   *  pendant que le body est à opacity 0 → la transition de hauteur entre
   *  un onglet court (Suppression) et long (CGU) est cachée par le fade,
   *  plus de "téléportation" perçue. */
  const [displayedTab, setDisplayedTab] = useState<Tab>(isValidTab ? (initialPage as Tab) : 'privacy');
  const [contentVisible, setContentVisible] = useState(true);
  const [closing, setClosing] = useState(false);
  const [dragY, setDragY] = useState(0);
  const touchStartY = useRef<number | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const tabSwitchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heightReleaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Hauteur explicite de la SHEET (pas du body) — pilote la transition
   *  entre 2 onglets. `null` = auto (état au repos : la sheet sait s'auto-
   *  sizer via flex flex-col + max-h:85vh). Animer la sheet plutôt que
   *  le body évite de switcher le body entre `flex-1` et `flex: 0 0 auto`
   *  (source des petits "tp" visibles précédemment quand on relâchait
   *  vers auto). */
  const [sheetHeight, setSheetHeight] = useState<number | null>(null);

  /** Switch d'onglet animé : capture hauteur sheet → fade-out → swap →
   *  mesure nouvelle hauteur naturelle (en clearant temporairement le
   *  height inline) → transition CSS → release vers auto.
   *
   *  Skip animation si delta de hauteur < 2px (Privacy ↔ CGU : tous deux
   *  cappés à 85vh, sheet identique, transitionner ne ferait rien sauf
   *  jitter au release).
   *
   *  Le body reste TOUJOURS `flex-1` — son sizing suit naturellement la
   *  sheet, pas besoin de toucher au flex inline (source de bug avant). */
  const switchTab = useCallback((next: Tab) => {
    if (next === tab) return;

    const sheet = sheetRef.current;
    if (!sheet) {
      setTab(next);
      setDisplayedTab(next);
      return;
    }

    // 1) Capture la hauteur actuelle de la sheet (en px).
    const startH = sheet.offsetHeight;
    setSheetHeight(startH);
    setTab(next);
    setContentVisible(false);

    if (tabSwitchTimer.current) clearTimeout(tabSwitchTimer.current);
    if (heightReleaseTimer.current) clearTimeout(heightReleaseTimer.current);

    tabSwitchTimer.current = setTimeout(() => {
      setDisplayedTab(next);
      setContentVisible(true);

      // 2) Après commit + layout, on mesure la hauteur NATURELLE que la
      //    sheet aurait si on n'imposait pas startH. Pour ça on clear le
      //    height inline le temps d'un offsetHeight, puis on remet startH
      //    SYNCHRONEMENT avant la prochaine frame pour éviter un flash.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const node = sheetRef.current;
          if (!node) return;
          // Mesure synchrone : on désactive height inline, on lit, on
          // remet. Le browser ne paint pas entre les deux (même frame
          // de layout). Force reflow via lecture offsetHeight.
          node.style.height = '';
          const naturalH = node.offsetHeight;
          node.style.height = `${startH}px`;
          // Force reflow pour que le browser commit `startH` avant la
          // transition vers naturalH (sinon il pourrait skip directement).
          void node.offsetHeight;

          // 3) Skip si hauteur quasi-identique (Privacy ↔ CGU).
          if (Math.abs(naturalH - startH) < 2) {
            setSheetHeight(null);
            return;
          }

          // 4) Lance la transition CSS height vers naturalH.
          setSheetHeight(naturalH);

          // 5) Relâche après la fin de la transition. La sheet auto-size
          //    via flex naturel = naturalH (même valeur) → pas de jump.
          heightReleaseTimer.current = setTimeout(() => {
            setSheetHeight(null);
          }, HEIGHT_ANIM_MS);
        });
      });
    }, TAB_FADE_MS);
  }, [tab]);

  // Cleanup des timers si démontage en cours d'animation
  useEffect(() => {
    return () => {
      if (tabSwitchTimer.current) clearTimeout(tabSwitchTimer.current);
      if (heightReleaseTimer.current) clearTimeout(heightReleaseTimer.current);
    };
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const page = (e as CustomEvent).detail;
      if ((TABS as readonly string[]).includes(page)) {
        setTab(page as Tab);
        setDisplayedTab(page as Tab);
        setContentVisible(true);
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
  //
  // `releasing` distingue 2 états :
  //   • drag actif : transition coupée, suit le doigt (instantané)
  //   • release < seuil : spring-back vers 0 avec une transition unique
  //     posée pour cette frame uniquement. Sans ça, le sheet "claque"
  //     à sa position d'origine sans fluidité.
  const [releasing, setReleasing] = useState(false);
  const onHandleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    setReleasing(false);
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
      // Spring-back animé jusqu'à 0
      setReleasing(true);
      setDragY(0);
      // Repasse en mode "follow instant" après la fin du spring (pour le
      // prochain drag). 320ms = durée de la transition.
      setTimeout(() => setReleasing(false), 320);
    }
    touchStartY.current = null;
  };

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 z-[300] bg-black/50 backdrop-blur-sm flex items-end justify-center overscroll-contain ${closing ? 'backdrop-out' : 'backdrop-in'}`}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-title"
        className={`bg-[var(--surface)] rounded-t-3xl w-full max-w-[680px] max-h-[85vh] flex flex-col ${closing ? '' : 'sheet-up'}`}
        style={(() => {
          // Construit l'inline style en 1 passe pour éviter les overrides
          // accidentels de `transition` (TypeScript rejette les doublons).
          // Priorités :
          //   • closing → slide-out géré INLINE via transition CSS (pas la
          //     classe .sheet-down) pour démarrer depuis la position
          //     courante du sheet. Sans ça, drag-to-close faisait snap le
          //     sheet à translateY(0) avant de slider (keyframe sheetDown
          //     part de 0% donc visible jump-back du doigt vers le haut
          //     avant la descente).
          //   • dragY actif → transform inline + transition coupée (suivi
          //     instantané du doigt)
          //   • releasing (relâche post-drag) → transform 0 + spring back
          //     transform/height
          //   • Repos → height pinned si présente, transition height seule
          const base: React.CSSProperties = {};
          if (sheetHeight !== null) base.height = `${sheetHeight}px`;
          if (closing) {
            base.transform = 'translateY(100%)';
            base.opacity = 0.4;
            base.transition = 'transform 280ms cubic-bezier(0.4, 0, 0.7, 0.2), opacity 240ms cubic-bezier(0.4, 0, 0.7, 0.2)';
            // Will-change pour hint le compositor — slide-out fluide même
            // sur device modeste (la sheet a un backdrop-blur derrière).
            base.willChange = 'transform, opacity';
          } else if (dragY > 0) {
            base.transform = `translateY(${dragY}px)`;
            base.transition = 'none';
          } else if (releasing) {
            base.transform = 'translateY(0)';
            base.transition = `height ${HEIGHT_ANIM_MS}ms cubic-bezier(0.32, 0.72, 0, 1), transform 320ms cubic-bezier(0.32, 0.72, 0, 1)`;
          } else {
            base.transition = `height ${HEIGHT_ANIM_MS}ms cubic-bezier(0.32, 0.72, 0, 1)`;
          }
          return base;
        })()}
      >
        {/* Header — zone de swipe */}
        <div
          className="px-5 pt-3 shrink-0 relative touch-none select-none"
          onTouchStart={onHandleTouchStart}
          onTouchMove={onHandleTouchMove}
          onTouchEnd={onHandleTouchEnd}
        >
          <div className="w-9 h-1 bg-[var(--border2)] rounded-full mx-auto mb-3" />
          <button onClick={close} aria-label="Fermer" className="cursor-pointer absolute top-3 right-4 w-8 h-8 flex items-center justify-center bg-[var(--surface-var)] rounded-full text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--border2)] hover:scale-110 hover:rotate-90 transition-all duration-300">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
          <div className="flex gap-1 pb-3 border-b border-[var(--border)]">
            {TABS.map((tb) => (
              <button
                key={tb}
                onClick={() => switchTab(tb)}
                className={`cursor-pointer px-4 py-2 rounded-full text-sm font-medium transition-all ${tb === tab ? 'bg-[var(--primary-container)] text-[var(--primary)] font-semibold' : 'text-[var(--text3)] hover:text-[var(--text)]'}`}
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
            erreur lors d'une édition future des messages.

            Animation tab switch : c'est la SHEET parente dont la `height`
            est animée (cf. switchTab + sheetHeight). Le body reste flex-1
            standard — son `scroll-y` apparaît automatiquement quand le
            contenu dépasse la hauteur calculée par flex. */}
        <div
          key={displayedTab}
          className="legal-scroll flex-1 overflow-y-auto overscroll-contain px-6 py-5 text-sm [&_h3]:text-lg [&_h3]:font-extrabold [&_h3]:mb-1 [&_h4]:text-sm [&_h4]:font-bold [&_h4]:mt-5 [&_h4]:mb-1 [&_p]:text-[var(--text2)] [&_p]:leading-relaxed [&_p]:mb-2 [&_a]:text-[var(--primary)] [&_a]:underline [&_ul]:pl-4 [&_ul]:mb-2 [&_li]:text-[var(--text2)] [&_li]:leading-relaxed [&_li]:mb-1"
          style={{
            touchAction: 'pan-y',
            opacity: contentVisible ? 1 : 0,
            transform: contentVisible ? 'translateY(0)' : 'translateY(8px)',
            transition: `opacity ${TAB_FADE_MS}ms ease, transform ${TAB_FADE_MS}ms ease`,
          }}
          dangerouslySetInnerHTML={{ __html: sanitizeLegalHtml(t.raw(`${displayedTab}Content`) as string) }}
        />
      </div>
    </div>
  );
}
