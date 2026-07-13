'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServer } from '@/lib/pro/supabaseServer';
import { logProEvent } from '@/lib/pro/instrument';

export interface ReplyActionState {
  error?: string;
  ok?: boolean;
}

/** Codes d'exception serveur (triggers mig. 086/097) → messages FR. */
function mapReplyError(error: { message?: string } | null): string {
  const m = (error?.message ?? '').toUpperCase();
  if (m.includes('REPLY_LOCKED')) return 'Une réponse ne peut plus être modifiée après 48 h.';
  if (m.includes('PIN_PREMIUM')) return 'Épingler une réponse est réservé au forfait Premium.';
  return 'Une erreur est survenue. Réessaie.';
}

async function assertOwner(supabase: Awaited<ReturnType<typeof getSupabaseServer>>, restaurantId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('restaurants')
    .select('owner_id')
    .eq('id', restaurantId)
    .maybeSingle();
  return (data as { owner_id: string | null } | null)?.owner_id === user.id ? user : null;
}

/** Créer ou mettre à jour LA réponse (UNIQUE(review_id) → upsert). */
export async function upsertReplyAction(
  restaurantId: string,
  _prev: ReplyActionState,
  formData: FormData
): Promise<ReplyActionState> {
  const reviewId = String(formData.get('reviewId') ?? '');
  const body = String(formData.get('body') ?? '').trim();
  if (!reviewId) return { error: 'Avis introuvable.' };
  if (body.length < 2) return { error: 'La réponse est trop courte.' };
  if (body.length > 1000) return { error: 'La réponse est trop longue (1000 caractères max).' };

  const supabase = await getSupabaseServer();
  const user = await assertOwner(supabase, restaurantId);
  if (!user) return { error: "Tu n'es pas le propriétaire de cet établissement." };

  const { error } = await supabase.from('review_replies').upsert(
    {
      review_id: reviewId,
      restaurant_id: restaurantId,
      owner_id: user.id,
      body,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'review_id' }
  );
  if (error) return { error: mapReplyError(error) };

  await logProEvent(supabase, 'pro_review_reply', restaurantId);
  revalidatePath(`/pro/r/${restaurantId}/avis`);
  return { ok: true };
}

/** Supprimer sa réponse (verrou 48 h côté serveur). */
export async function deleteReplyAction(
  restaurantId: string,
  _prev: ReplyActionState,
  formData: FormData
): Promise<ReplyActionState> {
  const replyId = String(formData.get('replyId') ?? '');
  if (!replyId) return { error: 'Réponse introuvable.' };

  const supabase = await getSupabaseServer();
  const user = await assertOwner(supabase, restaurantId);
  if (!user) return { error: "Tu n'es pas le propriétaire de cet établissement." };

  const { error } = await supabase.from('review_replies').delete().eq('id', replyId);
  if (error) return { error: mapReplyError(error) };

  revalidatePath(`/pro/r/${restaurantId}/avis`);
  return { ok: true };
}

/** Épingler / désépingler (PREMIUM, max 1 par resto — auto-swap serveur). */
export async function togglePinAction(
  restaurantId: string,
  _prev: ReplyActionState,
  formData: FormData
): Promise<ReplyActionState> {
  const replyId = String(formData.get('replyId') ?? '');
  const pinned = formData.get('pinned') === 'true';
  if (!replyId) return { error: 'Réponse introuvable.' };

  const supabase = await getSupabaseServer();
  const user = await assertOwner(supabase, restaurantId);
  if (!user) return { error: "Tu n'es pas le propriétaire de cet établissement." };

  const { error } = await supabase.from('review_replies').update({ is_pinned: pinned }).eq('id', replyId);
  if (error) return { error: mapReplyError(error) };

  revalidatePath(`/pro/r/${restaurantId}/avis`);
  return { ok: true };
}
