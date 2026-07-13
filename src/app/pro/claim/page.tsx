import Link from 'next/link';
import { requireUser } from '@/lib/pro/data';
import ProHeader from '../_components/ProHeader';
import ClaimClient from './ClaimClient';

export const metadata = { title: 'Revendiquer un établissement' };

export default async function ClaimPage() {
  const { user } = await requireUser();

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <ProHeader email={user.email} />

      <div className="mt-6">
        <Link href="/pro" className="text-xs font-semibold text-[var(--text3)] hover:text-[var(--text2)]">
          ← Mes établissements
        </Link>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Revendiquer votre établissement</h1>
        <p className="mt-1 text-sm text-[var(--text2)]">
          Trouvez votre établissement, prouvez que vous en êtes responsable, et gérez sa fiche, son
          menu et ses avis.
        </p>
      </div>

      <div className="mt-6">
        <ClaimClient />
      </div>
    </main>
  );
}
