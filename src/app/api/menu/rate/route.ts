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
 *  3. L'ÉTRANGLEMENT PORTE SUR L'APPAREIL (cookie signé), pas sur l'IP : une
 *     salle partage son wifi donc son IP, et plafonner l'IP capait la soirée
 *     entière. L'IP ne reste qu'un backstop grossier ; la vraie borne anti-abus
 *     vit en base (plafond par restaurant, mig.129 + cooldown 30 j/plat).
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
 * Étranglement à fenêtre glissante, en mémoire du process. Deux clés :
 *
 *  - guest_id (cookie signé) : la limite COURTOISE par appareil. Dans une salle,
 *    tous les convives partagent le wifi donc l'IP — plafonner par IP capait la
 *    soirée ENTIÈRE (le 13ᵉ vote/h de la salle prenait un 429 silencieux). Le
 *    cookie est propre à chaque appareil : un plafond par cookie ne pénalise que
 *    l'appareil qui s'emballe, jamais ses voisins.
 *  - ip : un backstop GROSSIER, volontairement TRÈS haut. Une salle animée ne
 *    l'atteint jamais ; il ne sert qu'à borner une inondation depuis une seule
 *    source avant qu'elle ne touche la base.
 *
 * Aucun des deux n'est LA garantie : sur serverless chaque instance a sa propre
 * fenêtre. La vraie borne anti-abus vit en base — plafond par restaurant
 * (mig.129) + cooldown 30 j/plat par guest_id. Le cookie étant « gratuit à
 * renouveler » (il suffit de ne pas le renvoyer), un plafond par cookie n'arrête
 * pas un attaquant déterminé : il rend l'usage HONNÊTE propre, sans punir la
 * salle. C'est écrit ici pour que personne ne le prenne pour plus que ça.
 */
const WINDOW_MS = 60 * 60 * 1000;
const guestHits = new Map<string, { n: number; reset: number }>();
const ipHits = new Map<string, { n: number; reset: number }>();
const GUEST_MAX = 12; // votes / heure / appareil
const IP_MAX = 240; // backstop grossier / heure / IP (≈ salle très animée jamais atteinte)

function throttled(
  map: Map<string, { n: number; reset: number }>,
  key: string,
  max: number
): boolean {
  const now = Date.now();
  const cur = map.get(key);
  if (!cur || now > cur.reset) {
    map.set(key, { n: 1, reset: now + WINDOW_MS });
    if (map.size > 5000) {
      for (const [k, v] of map) if (now > v.reset) map.delete(k);
    }
    return false;
  }
  cur.n += 1;
  return cur.n > max;
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

  // Identité d'appareil D'ABORD : le throttle porte dessus, pas sur l'IP.
  // Réutilisée si le cookie est valide, sinon émise.
  const existing = readGuestId(req.cookies.get(GUEST_COOKIE)?.value);
  const issued = existing ? null : issueGuestId();
  const guestId = existing ?? issued?.id;
  // Pas de secret configuré ⇒ pas de notation invité (échec fermé, cf. lib).
  if (!guestId) return fail('error', 503);

  // Plafond COURTOIS par APPAREIL (cookie), pas par IP : ne cape jamais la salle
  // (wifi partagé = IP partagée), seulement l'appareil qui s'emballe. Un cookie
  // fraîchement émis a n=1 → jamais throttlé au premier vote.
  if (throttled(guestHits, guestId, GUEST_MAX)) {
    return withCookie(fail('error', 429), issued?.cookie, req);
  }

  // Backstop grossier par IP (très haut) : anti-inondation depuis une source
  // unique, jamais atteint par une salle légitime.
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';
  if (throttled(ipHits, ip, IP_MAX)) {
    return withCookie(fail('error', 429), issued?.cookie, req);
  }

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
    // Note rapide assumée (mig.161) : la note du plat reste juste, mais cette
    // ligne doit rester HORS de la ventilation par critere de la fiche plat —
    // ses quatre valeurs sont identiques par construction.
    rating_detailed: false,
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
