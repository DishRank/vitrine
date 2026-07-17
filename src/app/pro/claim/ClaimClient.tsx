'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  searchRestaurantsAction,
  requestClaimCodeAction,
  verifyClaimCodeAction,
  submitManualClaimAction,
  getMyClaimAction,
  type RestaurantHit,
} from './claimActions';
import { mapClaimError } from './claimErrors';
import { inputCls, labelCls } from '../_components/fields';

type Step = 'search' | 'intro' | 'email' | 'code' | 'manual' | 'verified' | 'pending' | 'rejected';

const btn =
  'rounded-xl bg-[var(--primary)] px-4 py-3 text-[15px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50';
const linkBtn = 'text-sm font-semibold text-[var(--text2)] hover:text-[var(--primary)]';

export default function ClaimClient({ onDone }: { onDone?: () => void } = {}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const [step, setStep] = useState<Step>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RestaurantHit[] | null>(null);
  const [picked, setPicked] = useState<RestaurantHit | null>(null);

  const [email, setEmail] = useState('');
  const [allowedDomain, setAllowedDomain] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);

  const search = () =>
    start(async () => {
      setError('');
      setResults(await searchRestaurantsAction(query));
    });

  const pick = (r: RestaurantHit) => {
    if (r.claimed) {
      setError('Cet établissement est déjà revendiqué.');
      return;
    }
    setPicked(r);
    setError('');
    // Résout une demande EXISTANTE (en attente / refusée + motif) au lieu de
    // repartir de l'étape email — parité avec l'app (useMyClaim).
    start(async () => {
      const claim = await getMyClaimAction(r.id);
      if (claim?.status === 'verified') setStep('verified');
      else if (claim?.status === 'pending') setStep('pending');
      else if (claim?.status === 'rejected') {
        setRejectionReason(claim.rejection_reason);
        setStep('rejected');
      } else setStep('intro');
    });
  };

  const request = (withEmail?: string) =>
    start(async () => {
      if (!picked) return;
      setError('');
      const res = await requestClaimCodeAction(picked.id, withEmail);
      if (res.ok) {
        setSentTo(res.sentToMasked || withEmail || '');
        if (res.devCode) setCode(res.devCode);
        setStep('code');
      } else if (res.error === 'email_required') {
        setAllowedDomain(res.allowedDomain || '');
        setStep('email');
      } else if (res.error === 'no_verifiable_contact') {
        setStep('manual');
      } else {
        if (res.allowedDomain) setAllowedDomain(res.allowedDomain);
        setError(mapClaimError(res.error, res.allowedDomain));
      }
    });

  const verify = () =>
    start(async () => {
      if (!picked || code.trim().length < 6) return;
      setError('');
      const res = await verifyClaimCodeAction(picked.id, code);
      if (res.ok && res.verified) setStep('verified');
      else setError(mapClaimError(res.error));
    });

  const submitManual = () =>
    start(async () => {
      if (!picked) return;
      setError('');
      const res = await submitManualClaimAction(picked.id, message);
      if (res.ok) setStep('pending');
      else setError(res.error || 'Erreur.');
    });

  const card = 'rounded-2xl border border-[var(--border2)] bg-[var(--surface)] p-5 sm:p-6';
  const err = error ? <p className="text-[13px] font-medium text-red-500">{error}</p> : null;

  // ── Écrans terminaux ────────────────────────────────────────────────────────
  if (step === 'verified') {
    return (
      <div className={`${card} text-center`}>
        <div className="text-5xl">👑</div>
        <h2 className="mt-3 text-xl font-extrabold">C&apos;est à vous !</h2>
        <p className="mt-1 text-sm text-[var(--text2)]">
          {picked?.name} vous appartient désormais. Vous pouvez gérer sa fiche et ses avis.
        </p>
        <button onClick={() => { onDone?.(); router.push(picked ? `/pro/r/${picked.id}` : '/pro'); }} className={`${btn} mt-5 w-full`}>
          Gérer mon établissement
        </button>
      </div>
    );
  }

  if (step === 'pending') {
    return (
      <div className={`${card} text-center`}>
        <div className="text-5xl">⏳</div>
        <h2 className="mt-3 text-xl font-extrabold">Demande envoyée</h2>
        <p className="mt-1 text-sm text-[var(--text2)]">
          Nous vérifions votre demande pour {picked?.name}. Vous serez notifié par email dès qu&apos;elle
          est validée.
        </p>
        <button onClick={() => { onDone?.(); router.push('/pro'); }} className={`${btn} mt-5 w-full`}>
          Retour à mes établissements
        </button>
      </div>
    );
  }

  if (step === 'rejected') {
    return (
      <div className={`${card} text-center`}>
        <div className="text-5xl">🙁</div>
        <h2 className="mt-3 text-xl font-extrabold">Demande refusée</h2>
        <p className="mt-1 text-sm text-[var(--text2)]">
          Votre demande pour {picked?.name} n&apos;a pas été validée.
        </p>
        {rejectionReason ? (
          <div className="mt-4 rounded-xl bg-[var(--surface-var)] p-3 text-left">
            <p className="text-xs font-bold text-[var(--text2)]">Motif du refus</p>
            <p className="mt-1 text-sm text-[var(--text)] whitespace-pre-line">{rejectionReason}</p>
          </div>
        ) : null}
        <button onClick={() => { setError(''); setStep('intro'); }} className={`${btn} mt-5 w-full`}>
          Refaire une demande
        </button>
        <button onClick={() => { onDone?.(); router.push('/pro'); }} className={`${linkBtn} mt-3 block w-full text-center`}>
          Retour à mes établissements
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Recherche */}
      {step === 'search' ? (
        <div className={card}>
          <label htmlFor="q" className={labelCls}>Nom de votre établissement</label>
          <div className="flex gap-2">
            <input
              id="q" type="text" value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') search(); }}
              placeholder="Chez Marie, La Pizzeria…" className={inputCls} autoFocus
            />
            <button onClick={search} disabled={pending || query.trim().length < 2} className={btn}>
              {pending ? '…' : 'Chercher'}
            </button>
          </div>
          {err}
          {results !== null ? (
            results.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--text2)]">
                Aucun résultat. Votre établissement n&apos;est peut-être pas encore sur DishRank —
                cette étape arrive bientôt.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-[var(--border2)]">
                {results.map((r) => (
                  <li key={r.id}>
                    <button
                      onClick={() => pick(r)}
                      disabled={r.claimed}
                      className="flex w-full items-center justify-between gap-3 py-3 text-left disabled:opacity-50"
                    >
                      <span className="min-w-0">
                        <span className="block font-bold truncate">{r.name}</span>
                        <span className="block text-sm text-[var(--text2)] truncate">
                          {[r.address, r.city].filter(Boolean).join(' · ') || '—'}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold text-[var(--primary)]">
                        {r.claimed ? 'Déjà pris' : 'Choisir →'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </div>
      ) : null}

      {/* Étapes de vérification */}
      {step !== 'search' && picked ? (
        <div className={card}>
          <div className="mb-4 rounded-xl border border-[var(--primary)]/30 bg-[var(--primary-container)] p-3">
            <p className="font-extrabold text-[var(--primary)] truncate">{picked.name}</p>
            <p className="text-sm text-[var(--text2)] truncate">
              {[picked.address, picked.city].filter(Boolean).join(' · ') || '—'}
            </p>
          </div>

          {step === 'intro' ? (
            <div className="space-y-3">
              <p className="text-sm text-[var(--text)]">
                Pour prouver que vous êtes responsable de cet établissement, nous vous envoyons un
                code sur l&apos;email de contact connu de l&apos;établissement.
              </p>
              <button onClick={() => request()} disabled={pending} className={`${btn} w-full`}>
                {pending ? 'Envoi…' : 'Vérifier par email'}
              </button>
              {err}
              <button onClick={() => setStep('manual')} className={`${linkBtn} block w-full text-center pt-1`}>
                Je n&apos;ai pas accès à cet email → demande manuelle
              </button>
            </div>
          ) : null}

          {step === 'email' ? (
            <div className="space-y-3">
              <label htmlFor="email" className={labelCls}>Votre email professionnel</label>
              <input
                id="email" type="email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={allowedDomain ? `vous@${allowedDomain}` : 'vous@restaurant.fr'}
                className={inputCls} autoFocus
              />
              {allowedDomain ? (
                <p className="text-xs text-[var(--text3)]">
                  L&apos;email doit être sur le domaine <strong>{allowedDomain}</strong>.
                </p>
              ) : null}
              {err}
              <button onClick={() => request(email.trim())} disabled={pending || !email.trim()} className={`${btn} w-full`}>
                {pending ? 'Envoi…' : 'Envoyer le code'}
              </button>
              <button onClick={() => setStep('manual')} className={`${linkBtn} block w-full text-center`}>
                Utiliser plutôt la demande manuelle
              </button>
            </div>
          ) : null}

          {step === 'code' ? (
            <div className="space-y-3">
              <p className="text-sm text-[var(--text2)]">
                Code envoyé à <strong>{sentTo}</strong>. Il expire dans 15 minutes.
              </p>
              <input
                inputMode="numeric" value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                maxLength={6} placeholder="000000"
                className={`${inputCls} text-center text-2xl font-extrabold tracking-[0.4em]`} autoFocus
              />
              {err}
              <button onClick={verify} disabled={pending || code.length < 6} className={`${btn} w-full`}>
                {pending ? 'Vérification…' : 'Valider'}
              </button>
              <button onClick={() => request(email.trim() || undefined)} disabled={pending} className={`${linkBtn} block w-full text-center`}>
                Renvoyer un code
              </button>
            </div>
          ) : null}

          {step === 'manual' ? (
            <div className="space-y-3">
              <label htmlFor="msg" className={labelCls}>Expliquez-nous (optionnel)</label>
              <textarea
                id="msg" rows={4} maxLength={400} value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Je suis le gérant de cet établissement. Vous pouvez me joindre au…"
                className={inputCls}
              />
              <p className="text-xs text-[var(--text3)]">
                Un membre de l&apos;équipe DishRank vérifiera votre demande manuellement.
              </p>
              {err}
              <button onClick={submitManual} disabled={pending} className={`${btn} w-full`}>
                {pending ? 'Envoi…' : 'Envoyer la demande'}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
