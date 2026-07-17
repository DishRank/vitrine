'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useActionState } from 'react';
import { signInAction, sendMagicLinkAction, type AuthActionState } from '../actions';
import { SubmitButton, FormError, inputCls, labelCls } from '../_components/fields';
import OAuthButtons from '../_components/OAuthButtons';
import Turnstile from '../_components/Turnstile';

export default function LoginForm({
  next,
  callbackError,
  turnstileSiteKey,
  nonce,
}: {
  next: string;
  callbackError?: string;
  turnstileSiteKey?: string;
  nonce?: string;
}) {
  const [mode, setMode] = useState<'password' | 'magic'>('password');
  const [pwState, pwAction] = useActionState<AuthActionState, FormData>(signInAction, {});
  const [mlState, mlAction] = useActionState<AuthActionState, FormData>(sendMagicLinkAction, {});

  const tabCls = (active: boolean) =>
    `flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
      active
        ? 'bg-[var(--surface)] text-[var(--text)] shadow-sm'
        : 'text-[var(--text2)] hover:text-[var(--text)]'
    }`;

  return (
    <div>
      {/* Erreur remontée par le callback (lien expiré, OAuth annulé…) — visible
          quel que soit le mode. */}
      {callbackError ? <div className="mb-4"><FormError error={callbackError} /></div> : null}

      {/* Bascule du mode de connexion */}
      <div className="mb-4 flex gap-1 rounded-xl border border-[var(--border2)] bg-[var(--bg)] p-1">
        <button type="button" onClick={() => setMode('password')} className={tabCls(mode === 'password')}>
          Mot de passe
        </button>
        <button type="button" onClick={() => setMode('magic')} className={tabCls(mode === 'magic')}>
          Lien magique
        </button>
      </div>

      {mode === 'password' ? (
        <form action={pwAction} className="space-y-4">
          <input type="hidden" name="next" value={next} />
          <div>
            <label htmlFor="email" className={labelCls}>Email</label>
            <input
              id="email" name="email" type="email" required autoComplete="email"
              placeholder="vous@restaurant.fr" className={inputCls}
            />
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor="password" className={labelCls}>Mot de passe</label>
              <Link href="/pro/reset" className="text-xs font-semibold text-[var(--primary)] hover:underline">
                Mot de passe oublié ?
              </Link>
            </div>
            <input
              id="password" name="password" type="password" required autoComplete="current-password"
              placeholder="••••••••" className={inputCls}
            />
          </div>
          <Turnstile siteKey={turnstileSiteKey} nonce={nonce} resetKey={pwState.error} />
          <FormError error={pwState.error} />
          <SubmitButton>Se connecter</SubmitButton>
        </form>
      ) : (
        <form action={mlAction} className="space-y-4">
          <input type="hidden" name="next" value={next} />
          <div>
            <label htmlFor="magic-email" className={labelCls}>Email</label>
            <input
              id="magic-email" name="email" type="email" required autoComplete="email"
              placeholder="vous@restaurant.fr" className={inputCls}
            />
          </div>
          <p className="text-xs text-[var(--text3)]">
            Recevez un lien de connexion par email, sans mot de passe à retenir.
          </p>
          <Turnstile siteKey={turnstileSiteKey} nonce={nonce} resetKey={mlState.error} />
          {mlState.message ? (
            <p className="rounded-lg border border-[var(--border2)] bg-[var(--bg)] px-3 py-2.5 text-sm font-medium text-[var(--accent-success)]">
              {mlState.message}
            </p>
          ) : null}
          <FormError error={mlState.error} />
          <SubmitButton>Recevoir un lien de connexion</SubmitButton>
        </form>
      )}

      <OAuthButtons next={next} />

      <p className="mt-6 text-center text-sm text-[var(--text2)]">
        Pas encore de compte ?{' '}
        <Link href="/pro/signup" className="font-semibold text-[var(--primary)] hover:underline">
          Créer un compte
        </Link>
      </p>
    </div>
  );
}
