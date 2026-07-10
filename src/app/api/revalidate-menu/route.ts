import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

// « Édition temps réel » (frontière v2 §2.1) : la page menu (QR) sert l'arbre
// via le Data Cache Next (tag `menu:{id}`, revalidate 300 s). L'app appelle
// cette route à chaque sauvegarde du menu pour purger le tag — un « épuisé »
// ou un prix modifié apparaît immédiatement sur la page scannée.
//
// Volontairement SANS secret : l'app est publique (tout jeton embarqué le
// serait aussi), et l'abus se limite à invalider un cache — la page suivante
// refait les lectures Supabase qu'un simple chargement ferait de toute façon.
// L'id est strictement validé (UUID) pour borner la surface.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  let restaurantId: unknown;
  try {
    ({ restaurantId } = await req.json());
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (typeof restaurantId !== 'string' || !UUID_RE.test(restaurantId)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  // Next 16 : le 2ᵉ argument (profil de cache) est requis — 'max' = purge
  // immédiate du tag, la prochaine requête refait les lectures.
  revalidateTag(`menu:${restaurantId}`, 'max');
  return NextResponse.json({ ok: true });
}
