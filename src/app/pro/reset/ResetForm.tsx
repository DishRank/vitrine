'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { requestPasswordResetAction, type AuthActionState } from '../actions';
import { SubmitButton, FormError, FormSuccess, inputCls, labelCls } from '../_components/fields';
import Turnstile from '../_components/Turnstile';

export default function ResetForm({
  turnstileSiteKey,
  nonce,
}: {
  turnstileSiteKey?: string;
  nonce?: string;
}) {
  const [state, action] = useActionState<AuthActionState, FormData>(requestPasswordResetAction, {});

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="email" className={labelCls}>Email</label>
        <input
          id="email" name="email" type="email" required autoComplete="email"
          placeholder="vous@restaurant.fr" className={inputCls}
        />
      </div>
      <Turnstile siteKey={turnstileSiteKey} nonce={nonce} resetKey={state.error} />
      <FormError error={state.error} />
      <FormSuccess message={state.ok ? state.message : undefined} />
      {!state.ok ? <SubmitButton>Envoyer le lien</SubmitButton> : null}
      <p className="text-center text-sm text-[var(--text2)]">
        <Link href="/pro/login" className="font-semibold text-[var(--primary)] hover:underline">
          ← Retour à la connexion
        </Link>
      </p>
    </form>
  );
}
