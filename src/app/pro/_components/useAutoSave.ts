'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

/**
 * Auto-save débounced + en arrière-plan avec plusieurs tentatives.
 *
 * - `schedule()` : à appeler à chaque changement → planifie une sauvegarde
 *   `delay` ms plus tard (fusionne les frappes successives).
 * - `flush()` : sauvegarde tout de suite (ex. au blur / avant de quitter).
 * - retries : jusqu'à 3 essais avec backoff avant de passer en `error`.
 * - si le contenu change PENDANT une sauvegarde, une nouvelle est relancée
 *   ensuite (pas de perte).
 *
 * `save` peut changer à chaque rendu (closure sur le state) : on le garde dans
 * une ref pour que `schedule`/`flush` restent stables.
 */
export function useAutoSave(
  save: () => Promise<{ ok?: boolean; error?: string }>,
  delay = 900
) {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | undefined>();
  const saveRef = useRef(save);
  saveRef.current = save;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const running = useRef(false);
  const dirtyDuringRun = useRef(false);

  const run = useCallback(async () => {
    if (running.current) {
      // Une sauvegarde est en cours → on marque « à refaire » et on sort.
      dirtyDuringRun.current = true;
      return;
    }
    running.current = true;
    setStatus('saving');
    let ok = false;
    let lastErr: string | undefined;
    for (let attempt = 0; attempt < 3 && !ok; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 400 * attempt));
      try {
        const res = await saveRef.current();
        if (res?.ok) ok = true;
        else lastErr = res?.error;
      } catch (e) {
        lastErr = (e as Error).message;
      }
    }
    running.current = false;
    if (ok) {
      setError(undefined);
      setStatus('saved');
      if (dirtyDuringRun.current) {
        dirtyDuringRun.current = false;
        run(); // du contenu a changé pendant la sauvegarde → on re-sauve
      }
    } else {
      setError(lastErr);
      setStatus('error');
    }
  }, []);

  const schedule = useCallback(() => {
    setStatus('pending');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(run, delay);
  }, [run, delay]);

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    run();
  }, [run]);

  // Nettoyage du timer au démontage.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return { status, error, schedule, flush };
}
