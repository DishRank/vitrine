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

export default function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    if (open) {
      document.addEventListener('mousedown', handler);
      document.addEventListener('keydown', onEsc);
    }
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const switchTo = (code: LocaleCode) => {
    setOpen(false);
    if (code === locale) return;
    startTransition(() => {
      router.replace(pathname, { locale: code });
    });
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
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
          className="absolute right-0 top-full mt-2 z-[100] bg-[var(--surface)] border border-[var(--border2)] rounded-xl shadow-xl py-1 min-w-[170px] animate-[fadeUp_0.15s_ease]"
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
