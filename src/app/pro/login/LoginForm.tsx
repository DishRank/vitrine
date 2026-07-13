'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { signInAction, type AuthActionState } from '../actions';
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
  const [state, action] = useActionState<AuthActionState, FormData>(signInAction, {});

  return (
    <div>
      <form action={action} className="space-y-4">
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
        <Turnstile siteKey={turnstileSiteKey} nonce={nonce} resetKey={state.error} />
        <FormError error={state.error ?? callbackError} />
        <SubmitButton>Se connecter</SubmitButton>
      </form>

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
