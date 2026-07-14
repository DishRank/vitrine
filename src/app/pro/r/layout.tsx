import { requireUser, getPendingReviewCounts } from '@/lib/pro/data';
import ProShell, { type ShellResto } from './_components/ProShell';

/**
 * Shell PERSISTANT du workspace restaurateur (segment /pro/r, au-dessus de
 * [id]) — mise en page « dashboard » : sidebar + topbar (ProShell). En restant
 * monté pendant qu'on change de resto ([id] varie), il évite de reconstruire
 * la nav à chaque bascule : seul le contenu sous l'AnimatedOutlet se re-rend
 * (soft-nav), d'où une navigation quasi instantanée.
 */
export default async function ProWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await requireUser();
  // Tout ce dont le shell a besoin est chargé ICI, en une passe : la sheet
  // « Mon compte » (préférence digest) s'ouvre ensuite sans aucun chargement.
  const [{ data }, profileRes] = await Promise.all([
    supabase
      .from('restaurants')
      .select('id, name, photo_url, subscription_tier')
      .eq('owner_id', user.id)
      .order('name'),
    supabase.from('profiles').select('email_digest_opt_out').eq('id', user.id).maybeSingle(),
  ]);
  const restaurants = (data ?? []) as ShellResto[];
  const digestOptOut = !!(profileRes.data as { email_digest_opt_out?: boolean } | null)?.email_digest_opt_out;

  // Avis publiés sans réponse, par resto — pastille « Avis » de la sidebar et
  // point de notification de la topbar (le resto actif n'est connu que du
  // client via l'URL, donc on charge la map complète).
  const pending = await getPendingReviewCounts(restaurants.map((r) => r.id));

  return (
    <ProShell restaurants={restaurants} pending={pending} email={user.email} digestOptOut={digestOptOut}>
      {children}
    </ProShell>
  );
}
