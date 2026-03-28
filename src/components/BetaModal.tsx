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
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dGJoZHZydmdvemh5YXVqdGp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIzMDczNzcsImV4cCI6MjA1Nzg4MzM3N30.4PzVhZJ52fk0IVS3mBSvpWG_vg_5RGqh3IqjPSB5hgY',
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
        <span className="inline-block px-3 py-1 text-xs font-bold bg-[var(--primary-container)] text-[var(--primary)] rounded-full mb-4">
          Beta fermee
        </span>

        {!submitted ? (
          <>
            <h2 className="text-xl font-extrabold mb-2">
              Rejoins les premiers testeurs
            </h2>
            <p className="text-sm text-[var(--text2)] mb-6 leading-relaxed">
              DishRank est en beta fermee sur Android. Entre ton email Google Play
              et nous t&apos;enverrons une invitation sous 24h !
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ton email Google Play"
                className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm outline-none focus:border-[var(--primary)] transition-colors placeholder:text-[var(--text3)]"
              />
              <button
                type="submit"
                disabled={sending}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--primary)] text-white font-semibold rounded-full hover:bg-[var(--primary-light)] hover:text-[var(--bg)] transition-all text-sm w-full justify-center disabled:opacity-60"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.807 1.626a1 1 0 0 1 0 1.732l-2.807 1.626L15.206 12l2.492-2.492zM5.864 2.658L16.8 8.99l-2.302 2.302-8.634-8.634z"/>
                </svg>
                {sending ? 'Envoi...' : "Demander l'acces"}
              </button>
              <p className="text-xs text-[var(--text3)]">
                Utilise l&apos;email associe a ton compte Google Play
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
              Nous t&apos;ajoutons a la beta. Tu recevras un email
              d&apos;invitation Google Play <strong>sous 24h</strong>.
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
