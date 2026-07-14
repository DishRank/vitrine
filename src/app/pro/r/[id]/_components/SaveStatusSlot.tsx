'use client';

import { useSaveStatus } from '../../../_components/saveStatusStore';

/**
 * Affiche l'état d'auto-save dans l'en-tête du workspace (à côté de « Aperçu
 * public »). Rien quand idle → n'encombre pas les autres onglets.
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
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
      <span className={`inline-block h-2 w-2 rounded-full ${s.dot}`} />
      <span className={s.cls}>{s.text}</span>
    </span>
  );
}
