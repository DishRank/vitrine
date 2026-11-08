'use client';

import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  remove: (id: string) => void;
};

// Typage local plutôt qu'un second `declare global` : le widget /pro déclare
// déjà `window.turnstile`, une redéclaration différente casserait tsc.
const turnstileApi = () => (window as Window & { turnstile?: TurnstileApi }).turnstile;

/**
 * Widget Cloudflare Turnstile SANS formulaire, pour la notation du menu.
 *
 * Le composant de /pro (`app/pro/_components/Turnstile`) poste son jeton par
 * le champ caché d'un <form> ; ici l'envoi est un fetch JSON, il faut donc le
 * jeton en main : il remonte par `onToken` (null quand il expire ou échoue).
 * Même rendu EXPLICITE et même script que /pro.
 *
 * `appearance: 'interaction-only'` : rien ne s'affiche, sauf si Cloudflare
 * exige une interaction (widget en mode « Géré ») — la case apparaît alors à
 * l'endroit du composant. En mode « Invisible », jamais rien d'affiché.
 *
 * `resetKey` : à incrémenter après chaque envoi. Un jeton est À USAGE UNIQUE ;
 * un nouvel essai a besoin d'un nouveau jeton.
 */
export default function TurnstileInvisible({
  siteKey,
  nonce,
  action,
  onToken,
  resetKey,
}: {
  siteKey: string;
  nonce?: string;
  action: string;
  onToken: (token: string | null) => void;
  resetKey: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  // Le widget n'est rendu qu'une fois : il lit le callback courant via ref.
  const onTokenRef = useRef(onToken);
  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!ready || !ref.current || widgetId.current) return;
    widgetId.current =
      turnstileApi()?.render(ref.current, {
        sitekey: siteKey,
        action,
        appearance: 'interaction-only',
        callback: (token: string) => onTokenRef.current(token),
        'expired-callback': () => onTokenRef.current(null),
        'error-callback': () => onTokenRef.current(null),
      }) ?? null;
    return () => {
      if (widgetId.current) {
        turnstileApi()?.remove(widgetId.current);
        widgetId.current = null;
      }
    };
  }, [siteKey, action, ready]);

  useEffect(() => {
    if (resetKey > 0 && widgetId.current) {
      onTokenRef.current(null);
      turnstileApi()?.reset(widgetId.current);
    }
  }, [resetKey]);

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        nonce={nonce}
        onReady={() => setReady(true)}
      />
      <div ref={ref} />
    </>
  );
}
