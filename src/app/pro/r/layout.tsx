import { requireUser, getPendingReviewCounts, getOwnerNotifications } from '@/lib/pro/data';
import ProShell, { type ShellResto } from './_components/ProShell';
import NotifLiveSync from './_components/NotifLiveSync';

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
      .select('id, name, photo_url, subscription_tier, address, city, subscription_expires_at')
      .eq('owner_id', user.id)
      .order('name'),
    supabase.from('profiles').select('email_digest_opt_out').eq('id', user.id).maybeSingle(),
  ]);
  const restaurants = (data ?? []) as ShellResto[];
  const digestOptOut = !!(profileRes.data as { email_digest_opt_out?: boolean } | null)?.email_digest_opt_out;

  // Deux choses DISTINCTES, volontairement gardées séparées :
  //  · `pending` = liste de travail (avis publiés sans réponse) → pastille
  //    « Avis » de la sidebar. Répond à « me reste-t-il du travail ? ».
  //  · `notifications` = journal d'événements horodaté, lu/non-lu, partagé
  //    avec l'app mobile → cloche de la topbar. Répond à « que s'est-il
  //    passé ? ». Un journal ne peut pas répondre à la première question
  //    (une notif lue ne dit pas si l'avis a été traité), d'où les deux.
  const ids = restaurants.map((r) => r.id);
  const [pending, notifications] = await Promise.all([
    getPendingReviewCounts(ids),
    getOwnerNotifications(ids),
  ]);

  return (
    <ProShell
      restaurants={restaurants}
      pending={pending}
      notifications={notifications}
      email={user.email}
      digestOptOut={digestOptOut}
    >
      <NotifLiveSync userId={user.id} />
      {children}
    </ProShell>
  );
}
