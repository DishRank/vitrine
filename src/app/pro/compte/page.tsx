import Link from 'next/link';
import { requireUser } from '@/lib/pro/data';
import { signOutAction } from '../actions';
import ProHeader from '../_components/ProHeader';
import DigestToggle from './DigestToggle';
import PasswordResetButton from './PasswordResetButton';

export const metadata = { title: 'Mon compte' };

const cardCls = 'mt-4 rounded-2xl border border-[var(--border2)] bg-[var(--surface)] p-5';
const h2Cls = 'text-base font-extrabold';
const linkRow =
  'flex items-center justify-between rounded-lg px-2 py-2 -mx-2 text-sm font-semibold text-[var(--text2)] transition-colors hover:bg-[var(--bg)] hover:text-[var(--text)]';

interface Establishment {
  id: string;
  name: string;
  city: string | null;
  subscription_tier: string | null;
}

export default async function AccountPage() {
  const { supabase, user } = await requireUser();
  const [{ data: profile }, { data: restos }] = await Promise.all([
    supabase.from('profiles').select('email_digest_opt_out').eq('id', user.id).maybeSingle(),
    supabase
      .from('restaurants')
      .select('id, name, city, subscription_tier')
      .eq('owner_id', user.id)
      .order('name'),
  ]);
  const optOut = !!(profile as { email_digest_opt_out?: boolean } | null)?.email_digest_opt_out;
  const establishments = (restos ?? []) as Establishment[];

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <ProHeader email={user.email} />

      <div className="mt-6">
        <Link href="/pro" className="text-xs font-semibold text-[var(--text3)] hover:text-[var(--text2)]">
          ← Mes établissements
        </Link>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Mon compte</h1>
      </div>

      {/* Compte */}
      <section className={cardCls.replace('mt-4', 'mt-6')}>
        <h2 className={`${h2Cls} mb-1`}>Compte</h2>
        <p className="text-sm break-words text-[var(--text2)]">
          Connecté en tant que <strong className="text-[var(--text)]">{user.email}</strong>.
        </p>
      </section>

      {/* Mes établissements */}
      <section className={cardCls}>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className={h2Cls}>Mes établissements</h2>
          <Link href="/pro" className="text-xs font-semibold text-[var(--primary)] hover:underline">
            Tout gérer →
          </Link>
        </div>
        {establishments.length > 0 ? (
          <ul className="divide-y divide-[var(--border2)]">
            {establishments.map((r) => (
              <li key={r.id}>
                <Link href={`/pro/r/${r.id}`} className="group flex items-center justify-between gap-2 py-2.5">
                  <span className="min-w-0 truncate">
                    <span className="font-semibold text-[var(--text)] group-hover:text-[var(--primary)]">
                      {r.name}
                    </span>
                    {r.city ? <span className="text-[var(--text3)]"> · {r.city}</span> : null}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {r.subscription_tier === 'premium' ? (
                      <span className="rounded-full bg-[var(--primary-container)] px-2 py-0.5 text-[11px] font-bold text-[var(--primary)]">
                        Premium
                      </span>
                    ) : null}
                    <span aria-hidden className="text-[var(--text3)] transition-transform group-hover:translate-x-0.5">
                      →
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--text2)]">
            Aucun établissement pour l&apos;instant.{' '}
            <Link href="/pro/claim" className="font-semibold text-[var(--primary)] hover:underline">
              Revendiquer mon établissement →
            </Link>
          </p>
        )}
      </section>

      {/* Sécurité */}
      <section className={cardCls}>
        <h2 className={`${h2Cls} mb-1`}>Sécurité</h2>
        <p className="mb-3 text-sm text-[var(--text2)]">
          Recevez par email un lien sécurisé pour définir un nouveau mot de passe.
        </p>
        <PasswordResetButton email={user.email ?? ''} />
      </section>

      {/* Notifications par email */}
      <section className={cardCls}>
        <h2 className={`${h2Cls} mb-3`}>Notifications par email</h2>
        <DigestToggle initialOptOut={optOut} />
      </section>

      {/* Aide & ressources */}
      <section className={cardCls}>
        <h2 className={`${h2Cls} mb-2`}>Aide &amp; ressources</h2>
        <div className="flex flex-col">
          <a href="mailto:contact@dishrank.fr" className={linkRow}>
            <span>Contacter le support</span>
            <span aria-hidden className="text-[var(--text3)]">✉</span>
          </a>
          <Link href="/" className={linkRow}>
            <span>Découvrir DishRank</span>
            <span aria-hidden className="text-[var(--text3)]">↗</span>
          </Link>
          <a href="/?page=terms" className={linkRow}>
            <span>Conditions d&apos;utilisation</span>
            <span aria-hidden className="text-[var(--text3)]">↗</span>
          </a>
          <a href="/?page=privacy" className={linkRow}>
            <span>Confidentialité</span>
            <span aria-hidden className="text-[var(--text3)]">↗</span>
          </a>
        </div>
      </section>

      {/* Données personnelles */}
      <section className={cardCls}>
        <h2 className={`${h2Cls} mb-1`}>Données personnelles</h2>
        <p className="text-sm text-[var(--text2)]">
          Pour exporter ou supprimer vos données, écrivez-nous à{' '}
          <a href="mailto:contact@dishrank.fr" className="text-[var(--primary)] hover:underline">
            contact@dishrank.fr
          </a>
          .
        </p>
      </section>

      {/* Déconnexion */}
      <section className={cardCls}>
        <form action={signOutAction}>
          <button
            type="submit"
            className="rounded-lg border border-[var(--border2)] px-3 py-2 text-sm font-semibold text-[var(--text2)] transition-colors hover:border-red-500 hover:text-red-500"
          >
            Se déconnecter
          </button>
        </form>
      </section>
    </main>
  );
}
