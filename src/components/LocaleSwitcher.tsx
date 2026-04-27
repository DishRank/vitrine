'use client';
import { useState, useRef, useEffect, useTransition } from 'react';
import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';

const LOCALES = [
  { code: 'fr', flag: '🇫🇷', label: 'Français' },
  { code: 'en', flag: '🇬🇧', label: 'English' },
  { code: 'es', flag: '🇪🇸', label: 'Español' },
  { code: 'de', flag: '🇩🇪', label: 'Deutsch' },
  { code: 'it', flag: '🇮🇹', label: 'Italiano' },
] as const;

type LocaleCode = (typeof LOCALES)[number]['code'];

interface Props {
  /**
   * `nav` (default) : compact icon + dropdown — used in the desktop navbar.
   * `drawer` : 5 large flag pills laid out as a grid — used in the mobile
   *            burger drawer where space is plentiful.
   */
  variant?: 'nav' | 'drawer';
}

/** Durée des animations open/close du dropdown (doit matcher dropDownIn /
 *  dropDownOut dans globals.css). */
const DROPDOWN_ANIM_MS = 180;

export default function LocaleSwitcher({ variant = 'nav' }: Props) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  /** True pendant l'animation de fermeture. Le dropdown reste mounted le
   *  temps que l'animation `dropDownOut` se joue (sinon on aurait juste
   *  un unmount instantané sans transition). */
  const [closing, setClosing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  /** Ferme le dropdown avec animation de sortie. Pendant DROPDOWN_ANIM_MS
   *  on garde `open=true` + `closing=true` pour laisser jouer dropDownOut. */
  const closeDropdown = () => {
    if (!open || closing) return;
    setClosing(true);
    window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, DROPDOWN_ANIM_MS);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) closeDropdown();
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDropdown();
    };
    if (open && !closing) {
      document.addEventListener('mousedown', handler);
      document.addEventListener('keydown', onEsc);
    }
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', onEsc);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, closing]);

  const switchTo = (code: LocaleCode) => {
    closeDropdown();
    if (code === locale) return;
    startTransition(() => {
      router.replace(pathname, { locale: code });
    });
  };

  // ─── DRAWER VARIANT — 5 flag pills, all visible at once ────────────────
  if (variant === 'drawer') {
    return (
      <div className="w-full">
        <div
          className="text-[11px] font-bold uppercase tracking-[1.4px] text-[var(--text3)] mb-2 px-1"
          aria-hidden="true"
        >
          Langue
        </div>
        <div role="radiogroup" aria-label="Choisir la langue" className="grid grid-cols-5 gap-2">
          {LOCALES.map((l) => {
            const isActive = l.code === locale;
            return (
              <button
                key={l.code}
                role="radio"
                aria-checked={isActive}
                aria-label={l.label}
                onClick={() => switchTo(l.code)}
                disabled={isPending}
                className={`
                  flex flex-col items-center justify-center gap-1 py-3 rounded-xl
                  transition-all duration-200
                  ${isActive
                    ? 'bg-[var(--primary-container)] border-2 border-[var(--primary)] scale-[1.04]'
                    : 'bg-[var(--surface)] border-2 border-transparent hover:border-[var(--primary)]/30 active:scale-95'
                  }
                  disabled:opacity-50 disabled:cursor-wait
                `}
              >
                <span className="text-2xl leading-none" aria-hidden="true">
                  {l.flag}
                </span>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider ${
                    isActive ? 'text-[var(--primary)]' : 'text-[var(--text2)]'
                  }`}
                >
                  {l.code}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── NAV VARIANT (default) — compact icon trigger + dropdown ───────────
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => (open ? closeDropdown() : setOpen(true))}
        aria-label={`${current.label} — change language`}
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={isPending}
        className="cursor-pointer w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-xl rounded-lg hover:bg-[var(--surface-var)] hover:scale-110 transition-all duration-200 disabled:opacity-50 disabled:cursor-wait"
      >
        <span aria-hidden="true">{current.flag}</span>
      </button>
      {open && (
        <div
          role="listbox"
          aria-label="Languages"
          // Animation asymétrique : entre par le haut (dropDownIn) et sort
          // par le bas (dropDownOut) → ressenti "goutte" cohérent.
          // `forwards` sur la sortie pour que l'état final (opacity 0,
          // translateY 10px) reste pendant le timeout avant l'unmount.
          className={`absolute right-0 top-full mt-2 z-[100] bg-[var(--surface)] border border-[var(--border2)] rounded-xl shadow-xl py-1 min-w-[170px] ${
            closing
              ? 'animate-[dropDownOut_0.18s_ease_forwards] pointer-events-none'
              : 'animate-[dropDownIn_0.18s_ease]'
          }`}
        >
          {LOCALES.map((l) => {
            const isActive = l.code === locale;
            return (
              <button
                key={l.code}
                role="option"
                aria-selected={isActive}
                onClick={() => switchTo(l.code)}
                className={`cursor-pointer w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 transition-colors ${
                  isActive
                    ? 'bg-[var(--primary-container)] text-[var(--primary)] font-bold'
                    : 'text-[var(--text)] hover:bg-[var(--surface-var)]'
                }`}
              >
                <span className="text-lg" aria-hidden="true">
                  {l.flag}
                </span>
                {l.label}
                {isActive && (
                  <svg
                    className="ml-auto"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
