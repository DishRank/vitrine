import { NextResponse } from 'next/server';
import { assertOwner } from '@/lib/pro/data';
import { normalizeMenuTheme, type MenuThemeConfig } from '@/app/pro/r/[id]/menu/themeConstants';

/**
 * Bibliothèque d'apparences (mig.159) — tiroir de brouillons NOMMÉS.
 *
 * À ne pas confondre avec /api/pro/theme, qui écrit l'apparence ACTIVE
 * (`restaurants.menu_theme`) et se heurte au gate premium. Ici on ne fait que
 * ranger : enregistrer un brouillon est ouvert même en gratuit, et c'est
 * précisément ce qui évite de perdre son travail quand l'abonnement tombe.
 * Activer une apparence reste un POST sur /api/pro/theme.
 *
 * Le quota (1 gratuit / 5 premium) est tenu par le trigger en base et n'est
 * vérifié qu'à la CRÉATION : une fiche qui perd son premium conserve ses
 * apparences et peut continuer à les éditer et à les supprimer.
 */

type Row = { id: string; name: string; config: MenuThemeConfig; updated_at: string };

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('id') ?? '';
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 });

  const ctx = await assertOwner(id);
  if (!ctx) return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });

  const { data, error } = await ctx.supabase
    .from('restaurant_menu_themes')
    .select('id, name, config, updated_at')
    .eq('restaurant_id', id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Lecture impossible.' }, { status: 500 });

  const themes: Row[] = (data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    config: normalizeMenuTheme(r.config),
    updated_at: r.updated_at as string,
  }));
  return NextResponse.json({ ok: true, themes });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    id?: string; themeId?: string; name?: string; config?: MenuThemeConfig;
  } | null;

  const id = typeof body?.id === 'string' ? body.id : '';
  const name = (body?.name ?? '').trim();
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 });
  if (!name) return NextResponse.json({ error: 'Donnez un nom à cette apparence.' }, { status: 400 });
  if (name.length > 60) return NextResponse.json({ error: 'Nom trop long (60 max).' }, { status: 400 });
  if (!body?.config) return NextResponse.json({ error: 'config requise' }, { status: 400 });

  const ctx = await assertOwner(id);
  if (!ctx) return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });

  // Même normalisation que l'apparence active : la bibliothèque ne doit jamais
  // stocker une forme que le menu public ne saurait pas relire.
  const config = normalizeMenuTheme(body.config);

  const { error } = body.themeId
    ? await ctx.supabase
        .from('restaurant_menu_themes')
        .update({ name, config })
        .eq('id', body.themeId)
        .eq('restaurant_id', id)
    : await ctx.supabase.from('restaurant_menu_themes').insert({ restaurant_id: id, name, config });

  if (error) {
    // Le quota est une règle métier : on la traduit, on ne la masque pas.
    if ((error.message ?? '').toUpperCase().includes('THEME_LIMIT')) {
      return NextResponse.json(
        { error: 'Vous avez atteint le nombre d’apparences enregistrables sur votre formule. Supprimez-en une, ou passez au Premium pour en garder cinq.' },
        { status: 403 },
      );
    }
    return NextResponse.json({ error: 'Échec de l’enregistrement.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const body = (await req.json().catch(() => null)) as { id?: string; themeId?: string } | null;
  const id = typeof body?.id === 'string' ? body.id : '';
  const themeId = typeof body?.themeId === 'string' ? body.themeId : '';
  if (!id || !themeId) return NextResponse.json({ error: 'id requis' }, { status: 400 });

  const ctx = await assertOwner(id);
  if (!ctx) return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });

  const { error } = await ctx.supabase
    .from('restaurant_menu_themes')
    .delete()
    .eq('id', themeId)
    .eq('restaurant_id', id);

  if (error) return NextResponse.json({ error: 'Échec de la suppression.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
