import { headers } from 'next/headers';
import { safeNextPathOrUndefined } from '@/lib/pro/safeNext';
import AuthShell from '../_components/AuthShell';
import SignupForm from './SignupForm';

export const metadata = { title: 'Créer un compte' };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  const nonce = (await headers()).get('x-nonce') || undefined;
  const next = safeNextPathOrUndefined(sp.next);

  return (
    <AuthShell
      title="Créer un compte"
      subtitle="Un seul compte DishRank pour tout : gérer votre établissement ici, et l'appli si vous l'utilisez déjà."
    >
      <SignupForm turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} nonce={nonce} next={next} />
    </AuthShell>
  );
}
