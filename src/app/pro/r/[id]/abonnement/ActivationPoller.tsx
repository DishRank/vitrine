'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Le webhook Stripe est asynchrone : au retour de Checkout la ligne peut ne pas
 * encore être premium. On router.refresh() toutes les 2 s (~15 essais) → le RSC
 * relit la DB et remplace ce bloc par l'état « Premium actif » dès la bascule.
 * Jamais d'erreur rouge : le webhook fait autorité, le redirect ne l'accorde pas.
 */
export default function ActivationPoller() {
  const router = useRouter();
  const [tries, setTries] = useState(0);

  useEffect(() => {
    if (tries >= 15) return;
    const t = setTimeout(() => {
      router.refresh();
      setTries((n) => n + 1);
    }, 2000);
    return () => clearTimeout(t);
  }, [tries, router]);

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--primary)]/40 bg-[var(--primary-container)] p-4">
      <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
      <div>
        <p className="text-sm font-bold text-[var(--primary)]">Paiement confirmé — activation en cours…</p>
        {tries >= 15 ? (
          <p className="mt-0.5 text-xs text-[var(--text2)]">
            Rechargez la page dans un instant si le premium n&apos;apparaît pas.
          </p>
        ) : null}
      </div>
    </div>
  );
}
