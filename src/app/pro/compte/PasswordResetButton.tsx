'use client';

import { useActionState } from 'react';
import { requestPasswordResetAction, type AuthActionState } from '../actions';

/** Envoie un lien de réinitialisation de mot de passe à l'email du compte
 *  (réutilise le flux `requestPasswordResetAction` — rate-limité, anti-énumération).
 *  Plus sûr qu'un changement en place : le lien passe par la boîte mail. */
export default function PasswordResetButton({ email }: { email: string }) {
  const [state, action, pending] = useActionState<AuthActionState, FormData>(
    requestPasswordResetAction,
    {},
  );
  return (
    <form action={action}>
      <input type="hidden" name="email" value={email} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-[var(--border2)] px-3 py-2 text-sm font-semibold text-[var(--text2)] transition-colors hover:border-[var(--primary)] hover:text-[var(--text)] disabled:opacity-50"
      >
        {pending ? 'Envoi…' : 'Recevoir un lien de réinitialisation'}
      </button>
      {state.message ? (
        <p className="mt-2 text-sm font-medium text-[var(--accent-success)]">{state.message}</p>
      ) : null}
      {state.error ? <p className="mt-2 text-sm font-medium text-red-500">{state.error}</p> : null}
    </form>
  );
}
