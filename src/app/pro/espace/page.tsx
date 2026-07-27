import Link from 'next/link';
import { redirect } from 'next/navigation';
import AnimatedLogo from '@/components/AnimatedLogo';
import { getSupabaseServer } from '@/lib/pro/supabaseServer';
import { signOutAction } from '../actions';

export const metadata = { title: 'Tableau de bord' };

interface OwnedRestaurant {
  id: string;
  name: string | null;
  city: string | null;
  photo_url: string | null;
  subscription_tier: string | null;
}

/**
 * Accueil connecté de l'espace pro (déplacé depuis /pro, devenu la landing
 * publique). Prouve la chaîne complète : session cookies → RLS
 * (`restaurants.owner_id = auth.uid()`) → données. Point d'atterrissage
 * post-login (cf. safeNext/callback/proxy qui pointent tous ici).
 */
export default async function ProEspacePage({
  searchParams,
}: {
  searchParams: Promise<{ pwd?: string }>;
}) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  // Le middleware garde déjà /pro/espace — ceinture si la session meurt entre-temps.
  if (!user) redirect('/pro/login');

  const sp = await searchParams;

  // Lecture RLS avec la session de l'utilisateur — AUCUN service role ici.
  const { data: restaurants } = await supabase
    .from('restaurants')
    .select('id, name, city, photo_url, subscription_tier')
    .eq('owner_id', user.id)
    .order('name');

  const owned = (restaurants ?? []) as OwnedRestaurant[];

  // Dès qu'on possède un resto, le workspace (avec le carrousel en haut) EST la
  // home : on y bascule directement au lieu d'afficher une liste séparée.
  if (owned.length > 0) redirect(`/pro/r/${owned[0].id}`);

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <header className="flex items-center justify-between gap-4 pb-6 border-b border-[var(--border2)]">
        <Link href="/pro/espace" className="flex items-center gap-2.5 text-[var(--text)]">
          <AnimatedLogo size={30} />
          <span className="text-lg font-extrabold tracking-tight">
            DishRank <span className="text-[var(--primary)]">Pro</span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden sm:block text-sm text-[var(--text2)]">{user.email}</span>
          <form action={signOutAction}>
            <button
              type="submit"
              className="rounded-lg border border-[var(--border2)] px-3 py-1.5 text-sm font-semibold text-[var(--text2)] hover:border-[var(--primary)] hover:text-[var(--text)] transition-colors"
            >
              Se déconnecter
            </button>
          </form>
        </div>
      </header>

      {sp.pwd === 'updated' ? (
        <p className="mt-4 rounded-lg border border-[var(--accent-success)]/40 bg-[var(--accent-success)]/10 px-3 py-2 text-sm font-medium text-[var(--accent-success)]">
          Mot de passe mis à jour ✓
        </p>
      ) : null}

      <section className="mt-8">
        <h1 className="text-xl font-extrabold tracking-tight mb-4">Mes établissements</h1>

        <div className="rounded-2xl border border-dashed border-[var(--border2)] bg-[var(--surface)] p-8 text-center">
          <p className="text-[15px] font-semibold mb-1">Aucun établissement pour l&apos;instant</p>
          <p className="text-sm text-[var(--text2)] max-w-md mx-auto mb-5">
            Revendiquez votre établissement pour gérer sa fiche, son menu et répondre aux avis
            de vos clients.
          </p>
          <Link
            href="/pro/claim"
            className="inline-block rounded-xl bg-[var(--primary)] px-5 py-3 text-[15px] font-bold text-white hover:opacity-90"
          >
            Revendiquer mon établissement
          </Link>
        </div>
      </section>
    </main>
  );
}
