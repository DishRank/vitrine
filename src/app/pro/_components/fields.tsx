'use client';

import { useFormStatus } from 'react-dom';

/** Styles partagés des formulaires auth /pro. */
export const inputCls =
  'w-full rounded-xl border border-[var(--border2)] bg-[var(--bg)] px-4 py-3 text-[15px] ' +
  'text-[var(--text)] placeholder-[var(--text3)] outline-none transition-colors ' +
  'focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-glow)]';

export const labelCls = 'block text-[13px] font-semibold text-[var(--text2)] mb-1.5';

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
