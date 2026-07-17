'use client';

import { useEffect, useState } from 'react';
import { useAutoSave } from '../../../_components/useAutoSave';
import { setSaveStatus } from '../../../_components/saveStatusStore';
import { DEFAULT_THANK } from '@/lib/pro/thanks';

/**
 * Réglages « remerciements automatiques » en haut de l'onglet Avis. Message par
 * défaut modifiable + interrupteur d'envoi auto (avis positifs uniquement).
 * Auto-sauvegardé en arrière-plan (même hook que la fiche).
 */
export default function ThankSettings({
  id,
  initialEnabled,
  initialTemplate,
}: {
  id: string;
  initialEnabled: boolean;
  initialTemplate: string | null;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [template, setTemplate] = useState(initialTemplate ?? '');

  // Closure fraîche à chaque rendu (le hook la garde en ref) → lit toujours le
  // state courant.
  const save = async () => {
    const res = await fetch('/api/pro/thanks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, auto_thank_enabled: enabled, thank_template: template.trim() }),
    });
    const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    return { ok: res.ok && !!j.ok, error: j.error };
  };
  const { status, schedule, flush } = useAutoSave(save);
  // Pousse le statut dans le store partagé → il s'affiche dans l'en-tête de
  // page (SaveStatusSlot), comme la fiche et le menu — « Enregistré ✓ » en haut,
  // uniforme sur toutes les pages.
  useEffect(() => {
    setSaveStatus(status);
  }, [status]);
  useEffect(() => () => setSaveStatus('idle'), []);

  return (
    <section className="mb-4 rounded-2xl border border-[var(--border2)] bg-[var(--surface)] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-extrabold">Remerciements automatiques</h2>
          <p className="mt-0.5 text-sm text-[var(--text2)]">
            Répondez « merci » tout seul aux avis positifs (4★ et +). Vérifié chaque heure.
          </p>
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2">
          <span className="text-sm font-semibold text-[var(--text2)]">{enabled ? 'Activé' : 'Désactivé'}</span>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => {
              setEnabled(e.target.checked);
              schedule();
            }}
            className="h-5 w-5 accent-[var(--primary)]"
          />
        </label>
      </div>

      <div className="mt-3">
        <label className="mb-1.5 block text-[13px] font-semibold text-[var(--text2)]">Message par défaut</label>
        <textarea
          rows={2}
          maxLength={1000}
          value={template}
          onChange={(e) => {
            setTemplate(e.target.value);
            schedule();
          }}
          onBlur={flush}
          placeholder={DEFAULT_THANK}
          className="w-full rounded-xl border border-[var(--border2)] bg-[var(--bg)] px-3.5 py-2.5 text-sm text-[var(--text)] placeholder-[var(--text3)] outline-none focus:border-[var(--primary)]"
        />
        <p className="mt-1 text-xs text-[var(--text3)]">
          Vide = « {DEFAULT_THANK} »
        </p>
      </div>
    </section>
  );
}
