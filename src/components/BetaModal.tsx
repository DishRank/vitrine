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
          Beta fermee Android
        </span>

        {!submitted ? (
          <>
            <h2 className="text-xl font-extrabold mb-2">
              Rejoins les premiers testeurs Android
            </h2>
            <p className="text-sm text-[var(--text2)] mb-6 leading-relaxed">
              DishRank est en beta fermee sur <strong>Android</strong>. Entre ton email
              et nous t&apos;enverrons une invitation sous 24h ! Sur iPhone&nbsp;? L&apos;app
              est disponible sur l&apos;<a href="https://apps.apple.com/fr/app/dishrank/id6761752556" target="_blank" rel="noopener" className="text-[var(--primary)] font-semibold hover:underline">App Store</a>.
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
                Utilise l&apos;email de ton compte Google Play
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
