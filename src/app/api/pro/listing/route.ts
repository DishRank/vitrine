import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { assertOwner } from '@/lib/pro/data';
import { CUISINE_SLUGS } from '@/lib/pro/cuisines';

/**
 * Auto-save de la fiche (POST JSON). Route Handler plutôt que Server Action :
 * un `fetch` en arrière-plan NE déclenche PAS de refresh de la route courante
 * (contrairement à un Server Action), donc l'édition reste fluide, sans
 * re-rendu ni perte de focus. Auth par session owner (cookies @supabase/ssr) ;
 * la RLS UPDATE (owner_id = auth.uid()) reste le garde. Cookies SameSite=Lax →
 * pas envoyés en cross-site POST, ce qui neutralise le CSRF.
 */

function nn(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  return s === '' ? null : s;
}
function toUrl(v: string | null): string | null {
  if (!v) return null;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const id = typeof body?.id === 'string' ? body.id : '';
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 });

  const ctx = await assertOwner(id);
  if (!ctx) return NextResponse.json({ error: "Tu n'es pas le propriétaire de cet établissement." }, { status: 403 });
  const { supabase, user } = ctx;

  const priceRaw = body?.price_level;
  const priceLevel =
    typeof priceRaw === 'string' && priceRaw !== ''
      ? Math.min(4, Math.max(1, Number(priceRaw)))
      : typeof priceRaw === 'number'
        ? Math.min(4, Math.max(1, priceRaw))
        : null;

  const rawCuisines = Array.isArray(body?.cuisines)
    ? (body!.cuisines as unknown[])
    : typeof body?.cuisines === 'string'
      ? (body!.cuisines as string).split(',')
      : [];
  const cuisines = [
    ...new Set(rawCuisines.map((c) => String(c).trim().toLowerCase()).filter((c) => CUISINE_SLUGS.has(c))),
  ].slice(0, 8);

  const patch = {
    description: nn(body?.description),
    phone: nn(body?.phone),
    website: toUrl(nn(body?.website)),
    reservation_url: toUrl(nn(body?.reservation_url)),
    menu_url: toUrl(nn(body?.menu_url)),
    instagram: nn(body?.instagram),
    price_level: priceLevel,
    cuisines,
  };

  const { error, count } = await supabase
    .from('restaurants')
    .update(patch, { count: 'exact' })
    .eq('id', id)
    .eq('owner_id', user.id);

  if (error) return NextResponse.json({ error: 'Échec de la sauvegarde. Nouvelle tentative…' }, { status: 500 });
  if (!count) return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });

  // Marque le cache public stale (fiche/restaurant) sans refresh de la route
  // courante — l'auto-save reste invisible pour l'éditeur.
  revalidatePath(`/pro/r/${id}`);
  return NextResponse.json({ ok: true });
}
