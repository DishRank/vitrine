'use client';
import { useState, useEffect, FormEvent } from 'react';

export default function BetaModal() {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('open-beta', handler);
    return () => window.removeEventListener('open-beta', handler);
  }, []);

  const close = () => {
    setClosing(true);
    setTimeout(() => { setOpen(false); setClosing(false); setSubmitted(false); setEmail(''); }, 250);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    try {
      await fetch('https://yztbhdvrvgozhyaujtjz.supabase.co/rest/v1/beta_requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dGJoZHZydmdvemh5YXVqdGp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MTA1NzcsImV4cCI6MjA4OTQ4NjU3N30.4PzVhZu7jLvtJ_VAizSv-encm8t22Mz11mJ228FPGPE',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ email: email.trim() }),
      });
    } catch { /* silently fail */ }
    setSending(false);
    setSubmitted(true);
  };

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 z-[300] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 ${closing ? 'animate-[fadeOut_0.25s_ease_forwards]' : 'animate-[fadeIn_0.2s_ease]'}`}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-[420px] p-6 sm:p-8 text-center ${closing ? 'animate-[sheetDown_0.25s_ease_forwards]' : 'animate-[slideUp_0.3s_ease]'}`}
      >
        <span className="inline-flex items-center gap-2 px-3 py-1 text-xs font-bold bg-[var(--primary-container)] text-[var(--primary)] rounded-full mb-4">
          {/* Google Play icon */}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.807 1.626a1 1 0 0 1 0 1.732l-2.807 1.626L15.206 12l2.492-2.492zM5.864 2.658L16.8 8.99l-2.302 2.302-8.634-8.634z"/></svg>
          {/* Apple icon */}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
          Beta fermee
        </span>

        {!submitted ? (
          <>
            <h2 className="text-xl font-extrabold mb-2">
              Rejoins les premiers testeurs
            </h2>
            <p className="text-sm text-[var(--text2)] mb-6 leading-relaxed">
              DishRank est en beta fermee sur <strong>Android</strong> et <strong>iOS</strong>. Entre ton email
              et nous t&apos;enverrons une invitation sous 24h !
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ton email"
                className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm outline-none focus:border-[var(--primary)] transition-colors placeholder:text-[var(--text3)]"
              />
              <button
                type="submit"
                disabled={sending}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--primary)] text-white font-semibold rounded-full hover:bg-[var(--primary-light)] hover:text-[var(--bg)] transition-all text-sm w-full justify-center disabled:opacity-60"
              >
                {sending ? 'Envoi...' : "Demander l'acces"}
              </button>
              <p className="text-xs text-[var(--text3)]">
                Utilise l&apos;email de ton compte Google Play ou Apple ID
              </p>
            </form>
          </>
        ) : (
          <>
            <div className="text-4xl mb-3">🎉</div>
            <h2 className="text-xl font-extrabold mb-2">
              Demande envoyee !
            </h2>
            <p className="text-sm text-[var(--text2)] mb-4 leading-relaxed">
              Nous t&apos;ajoutons a la beta. Tu recevras une invitation
              <strong> sous 24h</strong>.
            </p>
          </>
        )}

        <button
          onClick={close}
          className="mt-4 text-xs text-[var(--text3)] hover:text-[var(--text)] transition-colors"
        >
          Fermer
        </button>
      </div>
    </div>
  );
}

/** Helper : ouvre la modal beta depuis n'importe quel composant */
export function openBetaModal(e: React.MouseEvent) {
  e.preventDefault();
  window.dispatchEvent(new Event('open-beta'));
}
