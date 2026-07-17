'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORY_BY_SLUG, GROUP_LABELS, searchCategories } from '@/lib/pro/categories';

/** Lot du scroll infini : nombre de catégories affichées d'emblée, puis chargées
 *  par paquets en scrollant (les 290 catégories ne rentrent pas d'un coup). */
const PAGE_SIZE = 24;

/**
 * Picker « Catégories » d'un plat (menu_items.category_slugs, max 3) — sur les
 * 260 catégories de l'app (tous groupes). Relie le plat aux notes de la
 * communauté DishRank. Multi-sélection à puces, stockée dans un input caché
 * `name` (slugs joints par virgule) relu par le Server Action.
 */
export default function DishCategoryPicker({
  initial,
  name = 'category_slugs',
  max = 3,
}: {
  initial: string[];
  name?: string;
  max?: number;
}) {
  const [selected, setSelected] = useState<string[]>(() => initial.filter((s) => CATEGORY_BY_SLUG.has(s)));
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const full = selected.length >= max;
  const excluded = useMemo(() => new Set(selected), [selected]);
  const filtered = useMemo(
    () => (full ? [] : searchCategories(query, excluded)),
    [full, query, excluded]
  );
  // Scroll infini fenêtré : on affiche un lot, la suite se charge en scrollant.
  // (Sans ça, l'ancien cap à 10 donnait « on dirait qu'il n'y a pas beaucoup de
  // catégories » alors qu'il y en a ~290.)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const results = full ? [] : filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;
  // Repartir du 1er lot à chaque nouvelle recherche ou (ré)ouverture.
  useEffect(() => setVisibleCount(PAGE_SIZE), [query, open]);

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

  const add = (slug: string) => {
    if (full || selected.includes(slug)) return;
    setSelected((s) => [...s, slug]);
    setQuery('');
    setHi(0);
    inputRef.current?.focus();
  };
  const remove = (slug: string) => setSelected((s) => s.filter((x) => x !== slug));

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      if (hasMore && hi >= results.length - 3) {
        setVisibleCount((v) => Math.min(v + PAGE_SIZE, filtered.length));
      }
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
  };

  return (
    <div ref={boxRef} className="relative">
      <input type="hidden" name={name} value={selected.join(',')} />
      <div
        onClick={() => {
          if (!full) {
            setOpen(true);
            inputRef.current?.focus();
          }
        }}
        className="flex min-h-[42px] w-full flex-wrap items-center gap-1.5 rounded-xl border border-[var(--border2)] bg-[var(--bg)] px-2.5 py-1.5 text-sm transition-colors focus-within:border-[var(--primary)]"
      >
        {selected.map((slug) => {
          const c = CATEGORY_BY_SLUG.get(slug);
          if (!c) return null;
          return (
            <span
              key={slug}
              className="inline-flex items-center gap-1 rounded-lg bg-[var(--primary-container)] py-0.5 pl-2 pr-1 text-xs font-semibold text-[var(--primary)]"
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
                className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full hover:bg-[var(--primary)]/15"
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
          placeholder={full ? `Max ${max}` : selected.length ? 'Ajouter…' : 'Burger, pizza, ramen…'}
          className="min-w-[100px] flex-1 bg-transparent px-1 py-0.5 text-[var(--text)] placeholder-[var(--text3)] outline-none disabled:cursor-not-allowed"
        />
      </div>

      {open && results.length > 0 ? (
        <ul
          onScroll={(e) => {
            const el = e.currentTarget;
            if (hasMore && el.scrollTop + el.clientHeight >= el.scrollHeight - 32) {
              setVisibleCount((v) => Math.min(v + PAGE_SIZE, filtered.length));
            }
          }}
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-[var(--border2)] bg-[var(--surface)] py-1 shadow-lg"
        >
          {results.map((c, i) => (
            <li key={c.slug}>
              <button
                type="button"
                onMouseEnter={() => setHi(i)}
                onClick={() => add(c.slug)}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm ${
                  i === hi ? 'bg-[var(--primary-container)] text-[var(--primary)]' : 'text-[var(--text)]'
                }`}
              >
                <span className="w-6 text-center text-base" aria-hidden>
                  {c.icon}
                </span>
                <span className="font-medium">{c.name}</span>
                <span className="ml-auto text-[11px] text-[var(--text3)]">{GROUP_LABELS[c.group]}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
