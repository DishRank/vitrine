import AuthShell from '../../_components/AuthShell';
import UpdatePasswordForm from './UpdatePasswordForm';
import { getSupabaseServer } from '@/lib/pro/supabaseServer';
import Link from 'next/link';

export const metadata = { title: 'Nouveau mot de passe' };

/**
 * Saisie du nouveau mot de passe. On arrive ici avec une session « recovery »
 * ouverte par /pro/callback (lien email → code PKCE → session). Le middleware
 * laisse passer uniquement les visiteurs authentifiés ; ce double-check couvre
 * la session expirée entre deux.
 */
export default async function UpdatePasswordPage() {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <AuthShell
      title="Nouveau mot de passe"
      subtitle={user?.email ? `Compte : ${user.email}` : undefined}
    >
      {user ? (
        <UpdatePasswordForm />
      ) : (
        <div className="space-y-4 text-sm text-[var(--text2)]">
          <p>Le lien a expiré ou la session n&apos;est plus valide.</p>
          <Link
            href="/pro/reset"
            className="block w-full rounded-xl bg-[var(--primary)] px-4 py-3 text-center text-[15px] font-bold text-white hover:opacity-90"
          >
            Redemander un lien
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
