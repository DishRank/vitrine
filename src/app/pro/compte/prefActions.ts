'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServer } from '@/lib/pro/supabaseServer';

/** Bascule l'abonnement aux emails de rappel (digest avis). RLS « Modifier son
 *  profil » : l'owner ne touche que sa propre ligne ; email_digest_opt_out
 *  n'est pas une colonne protégée. */
export async function setDigestOptOutAction(optOut: boolean): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Session expirée.' };
  const { error } = await supabase
    .from('profiles')
    .update({ email_digest_opt_out: optOut })
    .eq('id', user.id);
  if (error) return { error: 'Enregistrement impossible.' };
  // Revalider `/pro/compte` seul ne suffisait pas : le même toggle vit aussi
  // dans la modale « Mon compte » du shell, dont la valeur vient du layout
  // `/pro/r`. Ce layout gardait sa version en cache → à la réouverture de la
  // modale, le toggle réaffichait l'ancien état et semblait ne rien enregistrer.
  revalidatePath('/pro', 'layout');
  return { ok: true };
}
