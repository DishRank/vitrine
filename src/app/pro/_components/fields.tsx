'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';

/** Styles partagés des formulaires auth /pro. */
export const inputCls =
  'w-full rounded-xl border border-[var(--border2)] bg-[var(--bg)] px-4 py-3 text-[15px] ' +
  'text-[var(--text)] placeholder-[var(--text3)] outline-none transition-colors ' +
  'focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-glow)]';

export const labelCls = 'block text-[13px] font-semibold text-[var(--text2)] mb-1.5';

function EyeIcon({ off }: { off?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px]"
      aria-hidden
    >
      {off ? (
        <>
          <path d="M2 12s3.6-7 10-7c1.7 0 3.2.5 4.5 1.2M22 12s-3.6 7-10 7c-1.7 0-3.2-.5-4.5-1.2" />
          <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
          <path d="m3 3 18 18" />
        </>
      ) : (
        <>
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}

/**
 * Champ mot de passe avec bascule de visibilité (œil). Le `type` alterne
 * password/text — la valeur reste dans le même input, donc l'autofill du
 * gestionnaire de mots de passe et la soumission du formulaire ne changent pas.
 * Bouton focusable (a11y) avec `aria-pressed` + `aria-label` explicite.
 */
export function PasswordInput({
  id,
  name = 'password',
  autoComplete = 'current-password',
  placeholder = '••••••••',
  required = true,
  autoFocus,
  value,
  onChange,
}: {
  id: string;
  name?: string;
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
  autoFocus?: boolean;
  /** Optionnels : rendent le champ CONTRÔLÉ (indicateur de robustesse des
   *  formulaires d'inscription / de nouveau mot de passe). Omis = non contrôlé. */
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={show ? 'text' : 'password'}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        autoFocus={autoFocus}
        value={value}
        onChange={onChange}
        className={`${inputCls} pr-12`}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        aria-pressed={show}
        title={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        className="absolute right-0 top-0 flex h-full w-12 items-center justify-center rounded-r-xl
                   text-[var(--text3)] transition-colors hover:text-[var(--text)]
                   focus-visible:outline-none focus-visible:text-[var(--primary)]"
      >
        <EyeIcon off={show} />
      </button>
    </div>
  );
}

export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-[var(--primary)] px-4 py-3 text-[15px] font-bold text-white
                 transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-wait"
    >
      {pending ? 'Un instant…' : children}
    </button>
  );
}

export function FormError({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p
      role="alert"
      className="rounded-lg border border-red-300/40 bg-red-500/10 px-3 py-2 text-[13px] font-medium text-red-500"
    >
      {error}
    </p>
  );
}

export function FormSuccess({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="rounded-lg border border-[var(--accent-success)]/40 bg-[var(--accent-success)]/10 px-3 py-2 text-[13px] font-medium text-[var(--accent-success)]">
      {message}
    </p>
  );
}
