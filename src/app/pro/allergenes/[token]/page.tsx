import type { Metadata } from 'next';
import Link from 'next/link';
import AnimatedLogo from '@/components/AnimatedLogo';
import { getSupabaseServer } from '@/lib/pro/supabaseServer';
import { INVITE_TOKEN_RE, type InvitePayload } from '@/lib/pro/invite';
import AllergenWorkbench from './AllergenWorkbench';

/**
 * /pro/allergenes/<jeton> — le cadeau envoyé aux restaurants (mig. 196).
 *
 * Le restaurateur arrive SANS compte, depuis un email. Il trouve sa carte
 * (relevée sur son site), les 14 allergènes pré-cochés d'après le nom de chaque
 * plat, vérifie plat par plat et imprime son tableau. Revendiquer sa fiche
 * (gratuit) est proposé ensuite, pour publier les allergènes sur sa carte QR.
 *
 * Rien n'est publié depuis cette page sans compte propriétaire vérifié.
 * Route publique dans proxy.ts (préfixe + format exact du jeton), jamais indexée.
 */
export const metadata: Metadata = {
  title: 'Votre tableau des allergènes',
  // Le jeton est dans l'URL : ne jamais le transmettre en Referer.
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl px-4 pb-28 pt-6 print:max-w-none print:p-0">
      <header className="mb-6 flex items-center justify-between gap-4 border-b border-[var(--border2)] pb-4 print:hidden">
        <Link href="/" className="flex items-center gap-2.5 text-[var(--text)]">
          <AnimatedLogo size={30} />
          <span className="text-lg font-extrabold tracking-tight">
            DishRank <span className="text-[var(--primary)]">Pro</span>
          </span>
        </Link>
        <a href="mailto:contact@dishrank.fr" className="text-sm font-semibold text-[var(--text2)] hover:text-[var(--primary)]">
          Une question ?
        </a>
      </header>
      {children}
    </main>
  );
}

export default async function AllergenGiftPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let payload: InvitePayload | null = null;
  let unavailable = false;
  if (INVITE_TOKEN_RE.test(token)) {
    const supabase = await getSupabaseServer();
    const { data, error } = await supabase.rpc('invite_get', { p_token: token });
    if (error) unavailable = true;
    else payload = (data as InvitePayload | null) ?? null;
  }

  if (!payload) {
    return (
      <Shell>
        <div className="rounded-2xl border border-[var(--border2)] bg-[var(--surface)] p-6 text-center">
          <div className="text-4xl">🔗</div>
          <h1 className="mt-3 text-xl font-extrabold">
            {unavailable ? 'Service momentanément indisponible' : 'Ce lien n’est pas valide'}
          </h1>
          <p className="mt-2 text-sm text-[var(--text2)]">
            {unavailable
              ? 'Réessayez dans quelques minutes.'
              : 'Il a peut-être été mal copié. Écrivez-nous à contact@dishrank.fr et nous vous renverrons votre tableau.'}
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <AllergenWorkbench token={token} payload={payload} />
    </Shell>
  );
}
