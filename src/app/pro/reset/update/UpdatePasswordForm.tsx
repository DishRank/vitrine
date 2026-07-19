'use client';

import { useActionState, useState } from 'react';
import { updatePasswordAction, type AuthActionState } from '../../actions';
import { checkPassword, PASSWORD_RULES_FR, type PasswordCheck } from '@/lib/pro/authErrors';
import { SubmitButton, FormError, PasswordInput, labelCls } from '../../_components/fields';

export default function UpdatePasswordForm() {
  const [state, action] = useActionState<AuthActionState, FormData>(updatePasswordAction, {});
  const [pw, setPw] = useState('');
  const checks = checkPassword(pw);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="password" className={labelCls}>Nouveau mot de passe</label>
        <PasswordInput
          id="password"
          autoComplete="new-password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
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
      <div>
        <label htmlFor="confirm" className={labelCls}>Confirmer le mot de passe</label>
        <PasswordInput id="confirm" name="confirm" autoComplete="new-password" />
      </div>
      <FormError error={state.error} />
      <SubmitButton>Enregistrer le mot de passe</SubmitButton>
    </form>
  );
}
