import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { assertOwner } from '@/lib/pro/data';

/**
 * Réglages « remerciements d'avis » (POST JSON) : message par défaut + envoi
 * automatique. Sauvegarde background (fetch) sans refresh de route. Auth session
 * owner + RLS. Colonnes non protégées → éditables par l'owner.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const id = typeof body?.id === 'string' ? body.id : '';
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 });

  const ctx = await assertOwner(id);
  if (!ctx) return NextResponse.json({ error: "Tu n'es pas le propriétaire de cet établissement." }, { status: 403 });
  const { supabase, user } = ctx;

  const enabled = body?.auto_thank_enabled === true;
  const rawT = typeof body?.thank_template === 'string' ? body.thank_template.trim() : '';
  const template = rawT === '' ? null : rawT.slice(0, 1000);

  const { error, count } = await supabase
    .from('restaurants')
    .update({ auto_thank_enabled: enabled, thank_template: template }, { count: 'exact' })
    .eq('id', id)
    .eq('owner_id', user.id);

  if (error) return NextResponse.json({ error: 'Échec de la sauvegarde. Nouvelle tentative…' }, { status: 500 });
  if (!count) return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });

  revalidatePath(`/pro/r/${id}/avis`);
  return NextResponse.json({ ok: true });
}
