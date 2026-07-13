'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { signUpAction, type AuthActionState } from '../actions';
import { checkPassword, PASSWORD_RULES_FR, type PasswordCheck } from '@/lib/pro/authErrors';
import { SubmitButton, FormError, FormSuccess, inputCls, labelCls } from '../_components/fields';
import Turnstile from '../_components/Turnstile';

export default function SignupForm({
  turnstileSiteKey,
  nonce,
}: {
  turnstileSiteKey?: string;
  nonce?: string;
}) {
  const [state, action] = useActionState<AuthActionState, FormData>(signUpAction, {});
  const [pw, setPw] = useState('');
  const checks = checkPassword(pw);

  if (state.ok) {
    return (
      <div className="space-y-4">
        <FormSuccess message={state.message} />
        <Link
          href="/pro/login"
          className="block w-full rounded-xl bg-[var(--primary)] px-4 py-3 text-center text-[15px] font-bold text-white hover:opacity-90"
        >
          Aller à la connexion
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="displayName" className={labelCls}>Votre nom (affiché sur vos réponses aux avis)</label>
        <input
          id="displayName" name="displayName" type="text" autoComplete="name" maxLength={40}
          placeholder="Chez Marie — Marie D." className={inputCls}
        />
      </div>
      <div>
        <label htmlFor="email" className={labelCls}>Email</label>
        <input
          id="email" name="email" type="email" required autoComplete="email"
          placeholder="vous@restaurant.fr" className={inputCls}
        />
      </div>
      <div>
        <label htmlFor="password" className={labelCls}>Mot de passe</label>
        <input
          id="password" name="password" type="password" required autoComplete="new-password"
          placeholder="••••••••" className={inputCls}
          value={pw} onChange={(e) => setPw(e.target.value)}
        />
        {pw ? (
          <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5">
            {(Object.keys(PASSWORD_RULES_FR) as (keyof PasswordCheck)[]).map((k) => (
              <li
                key={k}
                className={`text-[12px] ${checks[k] ? 'text-[var(--accent-success)]' : 'text-[var(--text3)]'}`}
              >
                {checks[k] ? '✓' : '·'} {PASSWORD_RULES_FR[k]}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <Turnstile siteKey={turnstileSiteKey} nonce={nonce} resetKey={state.error} />
      <FormError error={state.error} />
      <SubmitButton>Créer mon compte</SubmitButton>
      <p className="text-center text-sm text-[var(--text2)]">
        Déjà un compte ?{' '}
        <Link href="/pro/login" className="font-semibold text-[var(--primary)] hover:underline">
          Se connecter
        </Link>
      </p>
    </form>
  );
}
