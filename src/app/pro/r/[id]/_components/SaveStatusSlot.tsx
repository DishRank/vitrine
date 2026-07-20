'use client';

import { useSaveStatus } from '../../../_components/saveStatusStore';

/**
 * État d'auto-save du workspace. Rien quand idle → n'encombre pas les autres
 * onglets. Rendu en flottant sous la topbar (cf. ProShell) : il lui faut donc
 * un fond opaque, sinon le texte se superposerait au contenu qui défile.
 */
export default function SaveStatusSlot() {
  const status = useSaveStatus();
  if (status === 'idle') return null;

  const map = {
    pending: { text: 'Enregistrement…', cls: 'text-[var(--text3)]', dot: 'bg-[var(--primary)] animate-pulse' },
    saving: { text: 'Enregistrement…', cls: 'text-[var(--text3)]', dot: 'bg-[var(--primary)] animate-pulse' },
    saved: { text: 'Enregistré ✓', cls: 'text-[var(--accent-success)]', dot: 'bg-[var(--accent-success)]' },
    error: { text: 'Non enregistré', cls: 'text-red-500', dot: 'bg-red-500' },
  } as const;
  const s = map[status as keyof typeof map];
  if (!s) return null;

  return (
    <span
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border2)] bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold shadow-[0_4px_14px_var(--card-shadow)]"
    >
      <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${s.dot}`} />
      <span className={s.cls}>{s.text}</span>
    </span>
  );
}
