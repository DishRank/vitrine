import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import {
  GUEST_COOKIE,
  GUEST_COOKIE_MAX_AGE,
  issueGuestId,
  readGuestId,
} from '@/lib/guestIdentity';

/**
 * Notation d'un plat SANS COMPTE depuis le menu QR.
 *
 * Ce chemin remplace l'écriture directe client → PostgREST qui exigeait
 * `signInAnonymously()`. Il n'y a plus AUCUNE session Supabase côté visiteur :
 * l'écriture se fait ici, en service_role, et c'est le serveur qui décide.
 *
 * Ce que ce détour achète, et qui était structurellement impossible avant :
 *
 *  1. LE PLAT N'EST PAS DU TEXTE LIBRE. Le client envoie un `menuItemId` ; le
 *     nom canonique est relu en base. Avant, on postait `dish_name` arbitraire
 *     sur n'importe quel `restaurant_id` — et le trigger censé l'empêcher était
 *     inerte pour 4492 restaurants sur 4492 en prod (il ne se déclenche que si
 *     le resto a déjà des plats visibles).
 *  2. LE PLAT DOIT APPARTENIR AU RESTAURANT SCANNÉ. Vérifié ici ET re-vérifié
 *     par le trigger `check_guest_review` (mig.129) : la base garde le dernier
 *     mot, pour qu'un futur second appelant ne rouvre pas le trou.
 *  3. L'IP EST VISIBLE, donc limitable — un plafond par identité ne vaut rien
 *     quand l'identité est gratuite à renouveler.
 *
 * L'identité d'appareil est un cookie httpOnly signé (cf. lib/guestIdentity) :
 * zéro ligne dans auth.users, zéro MAU facturé, et le cooldown 30 j/plat tient
 * quand même. Elle n'authentifie rien — elle déduplique.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_COMMENT = 500;

/** Réponses volontairement AVARES : on distingue « déjà noté » (l'utilisateur
 *  doit comprendre) du reste (générique — ne pas cartographier les gardes). */
type Fail = 'already' | 'error';

function fail(kind: Fail, status: number) {
  return NextResponse.json({ ok: false, reason: kind }, { status });
}

/**
 * Étranglement par IP, en mémoire du process. Volontairement modeste : sur
 * serverless chaque instance a sa propre fenêtre, donc ce n'est PAS la garantie
 * — la vraie borne est le plafond par restaurant, en base (mig.129). C'est un
 * amortisseur bon marché contre la rafale évidente, rien de plus, et c'est
 * écrit ici pour que personne ne le prenne pour une protection sérieuse.
 */
const ipHits = new Map<string, { n: number; reset: number }>();
const IP_MAX = 12;
const IP_WINDOW_MS = 60 * 60 * 1000;

function ipThrottled(ip: string): boolean {
  const now = Date.now();
  const cur = ipHits.get(ip);
  if (!cur || now > cur.reset) {
    ipHits.set(ip, { n: 1, reset: now + IP_WINDOW_MS });
    if (ipHits.size > 5000) {
      for (const [k, v] of ipHits) if (now > v.reset) ipHits.delete(k);
    }
    return false;
  }
  cur.n += 1;
  return cur.n > IP_MAX;
}

export async function POST(req: NextRequest) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return fail('error', 500);

  let body: { restaurantId?: unknown; menuItemId?: unknown; stars?: unknown; comment?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail('error', 400);
  }

  const restaurantId = typeof body.restaurantId === 'string' ? body.restaurantId : '';
  const menuItemId = typeof body.menuItemId === 'string' ? body.menuItemId : '';
  const stars = typeof body.stars === 'number' ? Math.round(body.stars) : 0;
  const comment =
    typeof body.comment === 'string' ? body.comment.trim().slice(0, MAX_COMMENT) : '';

  if (!UUID_RE.test(restaurantId) || !UUID_RE.test(menuItemId)) return fail('error', 400);
  if (stars < 1 || stars > 5) return fail('error', 400);

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';
  if (ipThrottled(ip)) return fail('error', 429);

  // Identité d'appareil : réutilisée si le cookie est valide, sinon émise.
  const existing = readGuestId(req.cookies.get(GUEST_COOKIE)?.value);
  const issued = existing ? null : issueGuestId();
  const guestId = existing ?? issued?.id;
  // Pas de secret configuré ⇒ pas de notation invité (échec fermé, cf. lib).
  if (!guestId) return fail('error', 503);

  const supabase = createClient(url, key);

  // Le nom du plat vient de la BASE, jamais du client — et il doit appartenir à
  // une carte PUBLIÉE du restaurant scanné.
  const { data: item } = await supabase
    .from('menu_items')
    .select('name, restaurant_id, is_visible, menu_sections!inner(is_visible, restaurant_menus!inner(is_active, status))')
    .eq('id', menuItemId)
    .eq('restaurant_id', restaurantId)
    .eq('is_visible', true)
    .maybeSingle();
  if (!item) return fail('error', 404);

  const section = (item as unknown as {
    menu_sections?: { is_visible?: boolean; restaurant_menus?: { is_active?: boolean; status?: string } };
  }).menu_sections;
  if (!section?.is_visible) return fail('error', 404);
  if (!section.restaurant_menus?.is_active || section.restaurant_menus.status !== 'published') {
    return fail('error', 404);
  }

  const dishName = (item as { name: string }).name;

  // La note rapide alimente les 4 sous-notes à l'identique — le détail
  // goût/présentation/prix/quantité reste la richesse du parcours in-app.
  // `rating` est une colonne GÉNÉRÉE : ne jamais l'envoyer.
  const { error } = await supabase.from('reviews').insert({
    guest_id: guestId,
    user_id: null,
    restaurant_id: restaurantId,
    menu_item_id: menuItemId,
    dish_name: dishName,
    rating_taste: stars,
    rating_presentation: stars,
    rating_value: stars,
    rating_quantity: stars,
    comment: comment || null,
    source: 'in_venue_scan',
  });

  if (error) {
    const msg = (error.message ?? '').toUpperCase();

    // La réponse au CLIENT reste avare (ne pas cartographier les gardes), mais
    // le serveur, lui, doit dire ce qui s'est passé — sinon tout échec se
    // ressemble et le diagnostic est impossible.
    console.error('[menu/rate] insert refusé', {
      code: error.code,
      message: error.message,
      restaurantId,
      menuItemId,
    });

    // 42501 = violation RLS. Ce n'est PAS une erreur utilisateur : cela signifie
    // que SUPABASE_SERVICE_ROLE_KEY ne porte pas le rôle service_role (en local,
    // .env.local y met délibérément la clé anon pour la lecture du menu). On le
    // dit franchement dans les logs, parce que le symptôme — un 400 générique à
    // chaque notation — n'oriente sinon vers rien.
    if (error.code === '42501') {
      console.error(
        '[menu/rate] → SUPABASE_SERVICE_ROLE_KEY ne semble pas être une clé service_role : ' +
          "la RLS a refusé l'insertion. La notation invitée est inopérante tant que la vraie " +
          'clé service_role du projet n’est pas fournie.'
      );
      return withCookie(fail('error', 503), issued?.cookie, req);
    }

    // Seul cas qu'on nomme au client : il a déjà noté ce plat récemment.
    if (msg.includes('GUEST_COOLDOWN')) {
      return withCookie(fail('already', 409), issued?.cookie, req);
    }
    return withCookie(fail('error', 400), issued?.cookie, req);
  }

  // La note doit apparaître sur le menu, servi via le Data Cache (tag menu:{id}).
  revalidateTag(`menu:${restaurantId}`, 'max');

  return withCookie(NextResponse.json({ ok: true }), issued?.cookie, req);
}

/** Pose le cookie d'appareil s'il vient d'être émis. `secure` seulement en
 *  HTTPS : en dev local (http://localhost) un cookie secure ne serait pas
 *  stocké, et le cooldown ne serait jamais testable. */
function withCookie(res: NextResponse, cookie: string | undefined, req: NextRequest) {
  if (!cookie) return res;
  res.cookies.set(GUEST_COOKIE, cookie, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.nextUrl.protocol === 'https:',
    path: '/',
    maxAge: GUEST_COOKIE_MAX_AGE,
  });
  return res;
}
