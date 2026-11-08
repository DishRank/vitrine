import { safeNextPath } from '@/lib/pro/safeNext';
import AuthShell from '../_components/AuthShell';
import MfaForm from './MfaForm';

export const metadata = { title: 'Vérification en deux étapes' };

/**
 * Saisie du code de double authentification. N'est joignable qu'avec une
 * session en attente du code : le proxy y envoie ces sessions et renvoie les
 * autres (connectées → destination, déconnectées → /pro/login).
 */
export default async function MfaPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  const next = safeNextPath(sp.next);

  return (
    <AuthShell
      title="Vérification en deux étapes"
      subtitle="Saisissez le code à 6 chiffres affiché par votre appli de codes (Google Authenticator, KeePassXC…)."
    >
      <MfaForm next={next} />
    </AuthShell>
  );
}
