import { headers } from 'next/headers';
import { safeNextPath } from '@/lib/pro/safeNext';
import AuthShell from '../_components/AuthShell';
import LoginForm from './LoginForm';

export const metadata = { title: 'Connexion' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const nonce = (await headers()).get('x-nonce') || undefined;
  const next = safeNextPath(sp.next);

  return (
    <AuthShell title="Connexion" subtitle="Accédez à votre espace restaurateur.">
      <LoginForm
        next={next}
        callbackError={sp.error}
        turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
        nonce={nonce}
      />
    </AuthShell>
  );
}
