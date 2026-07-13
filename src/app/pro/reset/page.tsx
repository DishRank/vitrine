import { headers } from 'next/headers';
import AuthShell from '../_components/AuthShell';
import ResetForm from './ResetForm';

export const metadata = { title: 'Mot de passe oublié' };

export default async function ResetPage() {
  const nonce = (await headers()).get('x-nonce') || undefined;

  return (
    <AuthShell
      title="Mot de passe oublié"
      subtitle="Entrez votre email : nous vous envoyons un lien pour choisir un nouveau mot de passe."
    >
      <ResetForm turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} nonce={nonce} />
    </AuthShell>
  );
}
