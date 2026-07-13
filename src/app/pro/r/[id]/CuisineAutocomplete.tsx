'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CUISINE_BY_SLUG, searchCuisines } from '@/lib/pro/cuisines';

/**
 * Autocomplete « types de cuisine » — réutilise la taxonomie de l'app
 * (emoji + libellé). Multi-sélection (max), stockée dans un input caché
 * `name` (slugs joints par virgule) que le Server Action de la fiche relit.
 */
export default function CuisineAutocomplete({
  initial,
  name = 'cuisines',
  max = 8,
}: {
  initial: string[];
  name?: string;
  max?: number;
}) {
  // On ne garde que les slugs connus (un ancien texte libre est ignoré).
  const [selected, setSelected] = useState<string[]>(() =>
    initial.filter((s) => CUISINE_BY_SLUG.has(s))
  );
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const full = selected.length >= max;
  const excluded = useMemo(() => new Set(selected), [selected]);
  const results = useMemo(
    () => (full ? [] : searchCuisines(query, excluded).slice(0, 8)),
    [query, excluded, full]
  );

  // Fermer au clic extérieur.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (hi >= results.length) setHi(0);
  }, [results.length, hi]);

  function add(slug: string) {
    if (full || selected.includes(slug)) return;
    setSelected((s) => [...s, slug]);
    setQuery('');
    setHi(0);
    inputRef.current?.focus();
  }
  function remove(slug: string) {
    setSelected((s) => s.filter((x) => x !== slug));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHi((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHi((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (open && results[hi]) {
        e.preventDefault();
        add(results[hi].slug);
      }
    } else if (e.key === 'Backspace' && query === '' && selected.length) {
      remove(selected[selected.length - 1]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={boxRef} className="relative">
      {/* input caché relu par updateListingAction */}
      <input type="hidden" name={name} value={selected.join(',')} />

      <div
        onClick={() => {
          if (!full) {
            setOpen(true);
            inputRef.current?.focus();
          }
        }}
        className="flex min-h-[46px] w-full flex-wrap items-center gap-1.5 rounded-xl border border-[var(--border2)] bg-[var(--bg)] px-2.5 py-2 text-[15px] transition-colors focus-within:border-[var(--primary)] focus-within:ring-2 focus-within:ring-[var(--primary-glow)]"
      >
        {selected.map((slug) => {
          const c = CUISINE_BY_SLUG.get(slug);
          if (!c) return null;
          return (
            <span
              key={slug}
              className="inline-flex items-center gap-1 rounded-lg bg-[var(--primary-container)] py-1 pl-2 pr-1 text-[13px] font-semibold text-[var(--primary)]"
            >
              <span aria-hidden>{c.icon}</span>
              {c.name}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  remove(slug);
                }}
                aria-label={`Retirer ${c.name}`}
                className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[var(--primary)] hover:bg-[var(--primary)]/15"
              >
                ×
              </button>
            </span>
          );
        })}
        <input
          ref={inputRef}
          type="text"
          value={query}
          disabled={full}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={
            full
              ? `Maximum atteint (${max})`
              : selected.length
                ? 'Ajouter…'
                : 'Rechercher (italien, japonais, végé…)'
          }
          className="min-w-[120px] flex-1 bg-transparent px-1 py-1 text-[var(--text)] placeholder-[var(--text3)] outline-none disabled:cursor-not-allowed"
        />
      </div>

      <p className="mt-1 text-xs text-[var(--text3)]">
        {selected.length}/{max} — les mêmes types de cuisine que dans l&apos;app.
      </p>

      {open && results.length > 0 ? (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-[var(--border2)] bg-[var(--surface)] py-1 shadow-lg">
          {results.map((c, i) => (
            <li key={c.slug}>
              <button
                type="button"
                onMouseEnter={() => setHi(i)}
                onClick={() => add(c.slug)}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-[14px] ${
                  i === hi ? 'bg-[var(--primary-container)] text-[var(--primary)]' : 'text-[var(--text)]'
                }`}
              >
                <span className="w-6 text-center text-base" aria-hidden>
                  {c.icon}
                </span>
                <span className="font-medium">{c.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
