import Link from 'next/link';
import { requireUser } from '@/lib/pro/data';
import ProHeader from '../_components/ProHeader';
import DigestToggle from './DigestToggle';

export const metadata = { title: 'Mon compte' };

export default async function AccountPage() {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from('profiles')
    .select('email_digest_opt_out')
    .eq('id', user.id)
    .maybeSingle();
  const optOut = !!(data as { email_digest_opt_out?: boolean } | null)?.email_digest_opt_out;

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <ProHeader email={user.email} />

      <div className="mt-6">
        <Link href="/pro" className="text-xs font-semibold text-[var(--text3)] hover:text-[var(--text2)]">
          ← Mes établissements
        </Link>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Mon compte</h1>
      </div>

      <section className="mt-6 rounded-2xl border border-[var(--border2)] bg-[var(--surface)] p-5">
        <h2 className="text-base font-extrabold mb-1">Compte</h2>
        <p className="text-sm text-[var(--text2)]">Connecté en tant que <strong>{user.email}</strong>.</p>
      </section>

      <section className="mt-4 rounded-2xl border border-[var(--border2)] bg-[var(--surface)] p-5">
        <h2 className="text-base font-extrabold mb-3">Notifications par email</h2>
        <DigestToggle initialOptOut={optOut} />
      </section>

      <section className="mt-4 rounded-2xl border border-[var(--border2)] bg-[var(--surface)] p-5">
        <h2 className="text-base font-extrabold mb-1">Données personnelles</h2>
        <p className="text-sm text-[var(--text2)]">
          Pour exporter ou supprimer vos données, écrivez-nous à{' '}
          <a href="mailto:contact@dishrank.fr" className="text-[var(--primary)] hover:underline">contact@dishrank.fr</a>.
        </p>
      </section>
    </main>
  );
}
