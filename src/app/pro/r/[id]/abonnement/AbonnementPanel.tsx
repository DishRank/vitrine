'use client';

import { useState, useTransition } from 'react';
import { createCheckoutSession, createPortalSession, type BillingResult } from '../billingActions';
import ActivationPoller from './ActivationPoller';

const PRICE = '19,99 €';
const FEATURES = [
  'Traduction automatique du menu (5 langues)',
  'Thème du menu : ambiance, couleur, police',
  'Statistiques & alertes de la fiche',
  'Réponse épinglée + 5 plats signature',
  'Logo au centre du QR de table',
];

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function AbonnementPanel({
  restaurantId,
  name,
  premium,
  comped,
  source,
  expiresAt,
  billingEnabled,
  checkout,
}: {
  restaurantId: string;
  name: string;
  premium: boolean;
  comped: boolean;
  source: string | null;
  expiresAt: string | null;
  billingEnabled: boolean;
  checkout: string | null;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState('');

  const go = (fn: () => Promise<BillingResult>) =>
    start(async () => {
      setError('');
      const r = await fn();
      if (r.url) {
        window.location.href = r.url;
        return;
      }
      const MAP: Record<string, string> = {
        coming_soon: 'La souscription en ligne arrive très bientôt — le premium est offert 1 an au lancement.',
        already_comped: 'Premium déjà offert sur cet établissement.',
        already_premium: 'Votre abonnement est déjà actif.',
        no_subscription: 'Aucun abonnement à gérer.',
      };
      setError(MAP[r.error ?? ''] ?? r.error ?? 'Une erreur est survenue.');
    });

  const card = 'rounded-2xl border border-[var(--border2)] bg-[var(--surface)] p-5 sm:p-6';
  const errEl = error ? <p className="mt-3 text-sm font-medium text-red-500">{error}</p> : null;

  // ── Premium OFFERT (comp founder / admin) ────────────────────────────────────
  if (comped) {
    // « À vie » = Partenaire Fondateur SANS échéance uniquement. Toute comp AVEC
    // une échéance (lancement 1 an, ou ancienne comp fondateur datée) montre sa
    // date d'expiration — jamais « à vie ».
    const founderLifetime = source === 'founder_comp' && !expiresAt;
    return (
      <div className={card}>
        <span className="inline-flex rounded-full bg-[var(--primary-container)] px-3 py-1 text-xs font-extrabold text-[var(--primary)]">
          ✦ Premium
        </span>
        <h2 className="mt-3 text-lg font-extrabold">{founderLifetime ? 'Premium à vie' : 'Premium offert'}</h2>
        <p className="mt-1 text-sm text-[var(--text2)]">
          {founderLifetime
            ? 'Partenaire Fondateur — premium à vie, offert. Merci de votre confiance !'
            : expiresAt
              ? `Offre de lancement — premium offert jusqu'au ${fmtDate(expiresAt)}.`
              : 'Le premium est offert sur cet établissement.'}
        </p>
        <p className="mt-3 text-sm text-[var(--text3)]">
          Toutes les fonctionnalités premium sont débloquées sur <strong>{name}</strong>.
        </p>
      </div>
    );
  }

  // ── Premium Stripe payant ────────────────────────────────────────────────────
  if (premium) {
    return (
      <div className={card}>
        <span className="inline-flex rounded-full bg-[var(--primary-container)] px-3 py-1 text-xs font-extrabold text-[var(--primary)]">
          ✦ Premium actif
        </span>
        <h2 className="mt-3 text-lg font-extrabold">Abonnement actif</h2>
        <p className="mt-1 text-sm text-[var(--text2)]">
          Votre abonnement Premium est actif{expiresAt ? ` — prochain renouvellement le ${fmtDate(expiresAt)}` : ''}.
        </p>
        <button
          onClick={() => go(() => createPortalSession(restaurantId))}
          disabled={pending}
          className="mt-4 rounded-lg border border-[var(--border2)] px-4 py-2.5 text-sm font-bold text-[var(--text)] transition-colors hover:border-[var(--primary)] disabled:opacity-50"
        >
          {pending ? '…' : 'Gérer mon abonnement'}
        </button>
        <p className="mt-2 text-xs text-[var(--text3)]">Modifier le moyen de paiement, télécharger vos factures ou résilier.</p>
        {errEl}
      </div>
    );
  }

  // ── Gratuit — offre Premium ──────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {checkout === 'success' ? <ActivationPoller /> : null}
      {checkout === 'cancel' ? (
        <p className="rounded-xl border border-[var(--border2)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--text2)]">
          Paiement annulé — vous pouvez réessayer quand vous le souhaitez.
        </p>
      ) : null}

      <div className={card}>
        <h2 className="text-lg font-extrabold">Passer Premium</h2>
        <p className="mt-1">
          <span className="text-3xl font-extrabold text-[var(--text)]">{PRICE}</span>
          <span className="text-sm font-semibold text-[var(--text2)]"> / mois</span>
        </p>
        <ul className="mt-4 space-y-2">
          {FEATURES.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm text-[var(--text)]">
              <span className="mt-0.5 text-[var(--primary)]">✓</span>
              {f}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-[var(--text3)]">TVA non applicable, art. 293 B du CGI. Sans engagement, résiliable à tout moment.</p>

        <button
          onClick={() => go(() => createCheckoutSession(restaurantId))}
          disabled={pending || !billingEnabled}
          className="mt-4 w-full rounded-xl bg-[var(--primary)] px-5 py-3 text-[15px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50 sm:w-auto"
        >
          {pending ? 'Redirection…' : billingEnabled ? 'Passer Premium' : 'Bientôt disponible'}
        </button>
        {!billingEnabled ? (
          <p className="mt-2 text-sm font-semibold text-[var(--primary)]">
            🎁 Le Premium est offert 1 an au lancement — contactez-nous pour l&apos;activer sur votre établissement.
          </p>
        ) : null}
        {errEl}
      </div>
    </div>
  );
}
