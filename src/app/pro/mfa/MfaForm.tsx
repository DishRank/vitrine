'use client';

import { useActionState } from 'react';
import { signOutAction, verifyMfaAction, type AuthActionState } from '../actions';
import { FormError, SubmitButton, inputCls, labelCls } from '../_components/fields';

export default function MfaForm({ next }: { next: string }) {
  const [state, action] = useActionState<AuthActionState, FormData>(verifyMfaAction, {});

  return (
    <div>
      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <div>
          <label htmlFor="code" className={labelCls}>
            Code
          </label>
          {/* Ni maxLength ni pattern : un code collé avec espace ou tiret
              (« 123 456 ») reste accepté, l'action ne garde que les chiffres. */}
          <input
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            autoFocus
            placeholder="123 456"
            className={`${inputCls} text-center text-xl tracking-[0.3em]`}
          />
        </div>
        <FormError error={state.error} />
        <SubmitButton>Vérifier</SubmitButton>
      </form>

      <p className="mt-6 text-xs text-[var(--text3)]">
        Appareil perdu ? Connectez-vous dans l&apos;app DishRank avec un code de secours pour en
        ajouter un nouveau, ou écrivez à{' '}
        <a href="mailto:contact@dishrank.fr" className="underline hover:text-[var(--text2)]">
          contact@dishrank.fr
        </a>
        .
      </p>

      <form action={signOutAction} className="mt-4 text-center">
        <button
          type="submit"
          className="text-sm font-semibold text-[var(--text2)] hover:text-[var(--text)] hover:underline"
        >
          Se déconnecter
        </button>
      </form>
    </div>
  );
}
