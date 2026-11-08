'use client';
import { useState, useEffect, FormEvent } from 'react';

export default function BetaModal() {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('open-beta', handler);
    return () => window.removeEventListener('open-beta', handler);
  }, []);

  const close = () => {
    setClosing(true);
    // 280ms = durée de l'animation `modal-down` définie dans globals.css.
    setTimeout(() => { setOpen(false); setClosing(false); setSubmitted(false); setFailed(false); setEmail(''); }, 280);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    setFailed(false);
    // Projet et clé publique du déploiement (NEXT_PUBLIC_*), comme le reste du
    // site : l'adresse et l'ancienne clé de la prod étaient écrites en dur (les
    // tests locaux écrivaient en prod, et la demande serait perdue sans bruit
    // à la fin des anciennes clés). La RLS « Anyone can request beta » autorise
    // l'insertion seule.
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    try {
      if (!url || !key) throw new Error('config');
      const res = await fetch(`${url}/rest/v1/beta_requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: key, Prefer: 'return=minimal' },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setSubmitted(true);
    } catch {
      // Plus de faux « Demande envoyée » quand l'envoi échoue.
      setFailed(true);
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 z-[300] bg-black/50 flex items-center justify-center p-4 ${closing ? 'backdrop-out' : 'backdrop-in'}`}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-[420px] p-6 sm:p-8 text-center ${closing ? 'modal-down' : 'modal-up'}`}
      >
        <span className="inline-flex items-center gap-2 px-3 py-1 text-xs font-bold bg-[var(--primary-container)] text-[var(--primary)] rounded-full mb-4">
          {/* Google Play icon */}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.807 1.626a1 1 0 0 1 0 1.732l-2.807 1.626L15.206 12l2.492-2.492zM5.864 2.658L16.8 8.99l-2.302 2.302-8.634-8.634z"/></svg>
          Bêta fermée Android
        </span>

        {!submitted ? (
          <>
            <h2 className="text-xl font-extrabold mb-2">
              Rejoins les premiers testeurs Android
            </h2>
            <p className="text-sm text-[var(--text2)] mb-6 leading-relaxed">
              DishRank est en bêta fermée sur <strong>Android</strong>. Entre ton email
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
                {sending ? 'Envoi…' : "Demander l'accès"}
              </button>
              {failed && (
                <p role="alert" className="text-xs font-semibold text-[var(--primary)]">
                  L&apos;envoi n&apos;a pas marché. Réessaie dans un instant.
                </p>
              )}
              <p className="text-xs text-[var(--text3)]">
                Utilise l&apos;email de ton compte Google Play
              </p>
            </form>
          </>
        ) : (
          <>
            <div className="text-4xl mb-3">🎉</div>
            <h2 className="text-xl font-extrabold mb-2">
              Demande envoyée !
            </h2>
            <p className="text-sm text-[var(--text2)] mb-4 leading-relaxed">
              Nous t&apos;ajoutons à la bêta. Tu recevras une invitation
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
