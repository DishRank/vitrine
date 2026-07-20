'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServer } from '@/lib/pro/supabaseServer';

/**
 * Marque des notifications d'établissement comme lues.
 *
 * UPDATE uniquement — JAMAIS de DELETE. Ces lignes vivent aussi dans la feuille
 * de notifications de l'app mobile, et la migration 130 les exempte des purges
 * grand public (`cleanup_old_data`, `delete_read_notifications`) précisément
 * pour qu'elles restent consultables des deux côtés. Les effacer ici viderait
 * l'historique dans l'app.
 *
 * La RLS fait le reste : la policy « Marquer ses notifications comme lues »
 * (`auth.uid() = user_id`) empêche de toucher celles d'un autre owner, donc pas
 * besoin de re-vérifier la possession du restaurant ici.
 */
export async function markNotificationsReadAction(
  ids: string[]
): Promise<{ ok?: boolean; error?: string }> {
  if (ids.length === 0) return { ok: true };
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Session expirée.' };

  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .in('id', ids)
    .eq('user_id', user.id);
  if (error) return { error: 'Enregistrement impossible.' };

  // Le journal est chargé par le layout `/pro/r`, pas par une page : revalider
  // un chemin de page laisserait la cloche sur son ancien état (même piège que
  // `setDigestOptOutAction`).
  revalidatePath('/pro', 'layout');
  return { ok: true };
}
