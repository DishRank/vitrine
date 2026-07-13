'use client';

import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id: string) => void;
    };
  }
}

/**
 * Widget Cloudflare Turnstile — rendu UNIQUEMENT si le site key est configuré
 * (NEXT_PUBLIC_TURNSTILE_SITE_KEY + activation côté dashboard Supabase Auth →
 * Attack protection). Le token est posté sous `cf-turnstile-response` (champ
 * implicite du widget) et relayé à GoTrue par les Server Actions.
 *
 * Rendu EXPLICITE (`?render=explicit` + turnstile.render) et non implicite :
 * en navigation client login ⇄ signup ⇄ reset, next/script dédupe le script
 * et ne relance jamais le scan DOM automatique — le widget ne se rendrait
 * qu'au premier chargement. `onReady` refire à chaque montage du composant,
 * même script déjà chargé.
 *
 * `resetKey` : à brancher sur l'erreur du formulaire — un token Turnstile est
 * À USAGE UNIQUE ; après un échec GoTrue (mauvais mot de passe), le widget
 * doit émettre un nouveau token sinon la tentative suivante échoue en
 * `captchaFailed` même avec les bons identifiants.
 *
 * CSP : script noncé (strict-dynamic) ; le proxy ajoute frame-src/connect-src
 * challenges.cloudflare.com sur la zone /pro quand le site key est présent.
 */
export default function Turnstile({
  siteKey,
  nonce,
  resetKey,
}: {
  siteKey?: string;
  nonce?: string;
  resetKey?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!siteKey || !ready || !ref.current || widgetId.current) return;
    widgetId.current =
      window.turnstile?.render(ref.current, { sitekey: siteKey, language: 'fr' }) ?? null;
    return () => {
      if (widgetId.current) {
        window.turnstile?.remove(widgetId.current);
        widgetId.current = null;
      }
    };
  }, [siteKey, ready]);

  useEffect(() => {
    if (resetKey && widgetId.current) window.turnstile?.reset(widgetId.current);
  }, [resetKey]);

  if (!siteKey) return null;
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
