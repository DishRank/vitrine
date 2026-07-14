import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { assertOwner } from '@/lib/pro/data';
import { normalizeMenuTheme, isDefaultTheme, type MenuThemeConfig } from '@/app/pro/r/[id]/menu/themeConstants';

/**
 * Auto-save de l'apparence du menu (POST JSON). Comme /api/pro/listing : un
 * `fetch` en arrière-plan ne refreshe pas la route courante → l'aperçu en direct
 * (état local) reste fluide. Auth session owner + RLS. Le trigger 101 reste
 * l'autorité sur le premium (THEME_PREMIUM).
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { id?: string; theme?: MenuThemeConfig } | null;
  const id = typeof body?.id === 'string' ? body.id : '';
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 });
  if (!body?.theme) return NextResponse.json({ error: 'theme requis' }, { status: 400 });

  const ctx = await assertOwner(id);
  if (!ctx) return NextResponse.json({ error: "Tu n'es pas le propriétaire de cet établissement." }, { status: 403 });
  const { supabase, user } = ctx;

  const t = normalizeMenuTheme(body.theme);
  // Valide le logo (URL storage dans le dossier de l'owner, .webp) si présent.
  const logo = t.logo_url;
  if (logo) {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const prefix = base ? `${base}/storage/v1/object/public/dish-photos/${user.id}/` : null;
    if (!prefix || !logo.startsWith(prefix) || logo.length >= 500 || !/\.webp(\?|$)/.test(logo)) {
      return NextResponse.json({ error: 'Logo invalide.' }, { status: 400 });
    }
  }

  // Reset au défaut = {} (libre, non premium) ; sinon le trigger 101 gate premium.
  const payload = isDefaultTheme(t) ? {} : t;

  const { error, count } = await supabase
    .from('restaurants')
    .update({ menu_theme: payload }, { count: 'exact' })
    .eq('id', id)
    .eq('owner_id', user.id);

  if (error) {
    if ((error.message ?? '').toUpperCase().includes('THEME_PREMIUM'))
      return NextResponse.json({ error: "La personnalisation de l'apparence est réservée au forfait Premium." }, { status: 403 });
    return NextResponse.json({ error: 'Échec de la sauvegarde. Nouvelle tentative…' }, { status: 500 });
  }
  if (!count) return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });

  revalidateTag(`menu:${id}`, 'max');
  revalidatePath(`/pro/r/${id}/menu`);
  revalidatePath(`/pro/r/${id}/menu/apparence`);
  return NextResponse.json({ ok: true });
}
