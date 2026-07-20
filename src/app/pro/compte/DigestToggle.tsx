'use client';

import { useState, useTransition } from 'react';
import { setDigestOptOutAction } from './prefActions';

export default function DigestToggle({ initialOptOut }: { initialOptOut: boolean }) {
  const [optOut, setOptOut] = useState(initialOptOut);
  const [pending, start] = useTransition();
  const [err, setErr] = useState('');

  // Bascule OPTIMISTE : l'interrupteur suit le doigt tout de suite, et ne
  // revient en arrière que si le serveur refuse. Attendre l'aller-retour avant
  // de bouger donnait un bouton qui paraissait mort pendant ~300 ms.
  const toggle = () => {
    const next = !optOut;
    setErr('');
    setOptOut(next);
    start(async () => {
      const r = await setDigestOptOutAction(next);
      if (!r.ok) {
        setOptOut(!next);
        setErr(r.error || 'Erreur.');
      }
    });
  };

  return (
    <div>
      <label className="flex items-center justify-between gap-4 cursor-pointer">
        <span className="text-sm">
          <span className="font-semibold block">Rappels « avis à répondre »</span>
          <span className="text-[var(--text2)]">Un email quand de nouveaux avis attendent votre réponse.</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={!optOut}
          onClick={toggle}
          disabled={pending}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${!optOut ? 'bg-[var(--primary)]' : 'bg-[var(--border2)]'}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${!optOut ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
        </button>
      </label>
      {err ? <p className="mt-2 text-[13px] text-red-500">{err}</p> : null}
    </div>
  );
}
