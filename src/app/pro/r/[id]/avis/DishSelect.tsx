'use client';

import type { MenuItemRef } from './ReviewCard';

/**
 * <select> stylé pour rattacher un avis / un nom de plat orphelin à un plat du
 * menu (groupé par catégorie). `appearance-none` + chevron custom → rendu propre
 * et cohérent avec les inputs de l'espace pro (le natif était minuscule et brut).
 * Reste un vrai `<select name="menuItemId">` → soumission native dans le form.
 */
export default function DishSelect({
  groups,
  placeholder = 'Rattacher à un plat…',
}: {
  groups: [string, MenuItemRef[]][];
  placeholder?: string;
}) {
  return (
    <div className="relative w-[210px] max-w-full">
      <select
        name="menuItemId"
        required
        defaultValue=""
        className="w-full cursor-pointer appearance-none truncate rounded-lg border border-[var(--border2)] bg-[var(--surface)] py-2 pl-3 pr-8 text-sm font-medium text-[var(--text)] outline-none transition-colors hover:border-[var(--primary)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-glow)]"
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {groups.map(([section, items]) => (
          <optgroup key={section} label={section}>
            {items.map((it) => (
              <option key={it.id} value={it.id}>
                {it.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <svg
        aria-hidden
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text3)]"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}
