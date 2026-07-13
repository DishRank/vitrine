'use client';

import { useState } from 'react';
import { getSupabaseBrowserPro } from '@/lib/pro/supabaseBrowser';

/**
 * Boutons Google / Apple — flow OAuth PKCE via le client navigateur pro
 * (le code verifier vit en cookie, échangé ensuite par /pro/callback).
 *
 * ⚠️ Nécessite la config WEB des providers sur le dashboard Supabase des DEUX
 * projets : redirect URIs Google + Services ID Apple (lot 1.3 du plan) — les
 * credentials natifs de l'app mobile ne suffisent pas. Indispensable pour les
 * owners inscrits via Apple « Hide My Email » (pas de login email possible).
 */
export default function OAuthButtons({ next }: { next: string }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const oauth = async (provider: 'google' | 'apple') => {
    const supabase = getSupabaseBrowserPro();
    if (!supabase) {
      setError('Configuration manquante — réessaie plus tard.');
      return;
    }
    setBusy(provider);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/pro/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setBusy(null);
      setError(
        provider === 'apple'
          ? "Connexion Apple indisponible pour le moment."
          : "Connexion Google indisponible pour le moment."
      );
    }
    // Succès → redirection pleine page initiée par Supabase, rien à faire.
  };

  const btnCls =
    'flex-1 flex items-center justify-center gap-2 rounded-xl border border-[var(--border2)] ' +
    'bg-[var(--bg)] px-4 py-2.5 text-sm font-semibold text-[var(--text)] transition-colors ' +
    'hover:border-[var(--primary)] disabled:opacity-50';

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 my-5">
        <div className="h-px flex-1 bg-[var(--border2)]" />
        <span className="text-xs text-[var(--text3)]">ou</span>
        <div className="h-px flex-1 bg-[var(--border2)]" />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => oauth('google')} disabled={busy !== null} className={btnCls}>
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.3-2.1 3.7-5.1 3.7-8.6z"/>
            <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.2 0-6-2.1-6.9-5.1L1.2 17.2C3.2 21.2 7.3 24 12 24z"/>
            <path fill="#FBBC05" d="M5.1 14.3c-.3-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3L1.2 6.8C.4 8.4 0 10.2 0 12s.4 3.6 1.2 5.2l3.9-2.9z"/>
            <path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17 1.1 15.2 0 12 0 7.3 0 3.2 2.8 1.2 6.8l3.9 2.9c1-3 3.7-5 6.9-5z"/>
          </svg>
          Google
        </button>
        <button type="button" onClick={() => oauth('apple')} disabled={busy !== null} className={btnCls}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M16.7 12.9c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8-1.6 0-3.1 1-4 2.4-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3.1 2.4 1.2-.1 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.6-1-2.7-3.9zM14.4 5.2c.7-.8 1.1-1.9 1-3.2-1 .1-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.5 2.9-1.3z"/>
          </svg>
          Apple
        </button>
      </div>
      {error ? <p className="text-[13px] text-red-500 font-medium">{error}</p> : null}
    </div>
  );
}
