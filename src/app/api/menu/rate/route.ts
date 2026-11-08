import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import {
  GUEST_COOKIE,
  GUEST_COOKIE_MAX_AGE,
  issueGuestId,
  readGuestId,
} from '@/lib/guestIdentity';
import { clientIp, ipBucket } from '@/lib/clientIp';
import { rateLimit } from '@/lib/pro/rateLimit';
import { verifyMenuTurnstile } from '@/lib/turnstile';

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
 *  3. UN ROBOT NE NOTE PAS EN BOUCLE. Le frein principal porte sur l'APPAREIL
 *     (cookie signé), parce qu'une salle partage son wifi donc son IP — et
 *     qu'on ne voit jamais l'IP locale du téléphone derrière la box (elle
 *     serait de toute façon falsifiable). Mais le cookie se renouvelle
 *     gratuitement (il suffit de ne pas le renvoyer) : l'audit sécurité de
 *     nov. 2026 a montré qu'un script obtenait un nouvel invité à chaque
 *     requête, sur les 1 314 menus publics. C'est TURNSTILE qui rend ce
 *     renouvellement coûteux : chaque requête exige un défi résolu. Derrière :
 *     un plafond PAR IP assez haut pour une salle pleine, et les plafonds en
 *     base (par appareil, restaurant et plat, mig.129 puis 212 — erreur PT429).
 *
 * L'identité d'appareil est un cookie httpOnly signé (cf. lib/guestIdentity) :
 * zéro ligne dans auth.users, zéro MAU facturé, et le cooldown 30 j/plat tient
 * quand même. Elle n'authentifie rien — elle déduplique.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_COMMENT = 500;

/** Réponses volontairement AVARES : on distingue ce que l'utilisateur doit
 *  comprendre (déjà noté, trop de notes, vérification anti-robot) du reste
 *  (générique — ne pas cartographier les gardes). */
type Fail = 'already' | 'limited' | 'comment_limited' | 'verify' | 'error';

function fail(kind: Fail, status: number, extra?: { message?: string; retryAfter?: number }) {
  const res = NextResponse.json(
    { ok: false, reason: kind, ...(extra?.message ? { message: extra.message } : {}) },
    { status }
  );
  if (extra?.retryAfter) res.headers.set('Retry-After', String(extra.retryAfter));
  return res;
}

const MSG_TOO_MANY = 'Trop de notes envoyées depuis cette connexion. Réessaie plus tard.';
const MSG_COMMENT_TOO_MANY =
  'Trop de commentaires envoyés pour le moment. Tu peux quand même publier ta note sans commentaire.';
const MSG_VERIFY = 'La vérification anti-robot a échoué. Recharge la page puis réessaie.';

/** Plafonds journaliers posés en base (mig. 212). SQLSTATE `PT429` : PostgREST
 *  le traduit en vrai HTTP 429 ; `P0429` accepté aussi (première version). */
const DB_CAP_CODES = new Set(['PT429', 'P0429']);

function dbCapMessage(dbMessage: string | undefined): string {
  const m = (dbMessage ?? '').toLowerCase();
  if (m.includes('guest_dish_daily_cap')) {
    return 'Ce plat a reçu beaucoup de notes sans compte aujourd’hui. Réessaie demain, ou note-le depuis l’app.';
  }
  if (m.includes('guest_venue_daily_cap')) {
    return 'Ce restaurant a reçu beaucoup de notes sans compte aujourd’hui. Réessaie demain, ou note depuis l’app.';
  }
  return 'Trop de notes pour le moment. Réessaie plus tard.';
}

/**
 * Freins anti-abus, tous partagés entre instances (Upstash via
 * lib/pro/rateLimit ; repli en mémoire par instance si Upstash n'est pas
 * configuré). Trois étages :
 *
 *  1. IP_FLOOD_MAX, AVANT Turnstile : plafond d'inondation très haut. Il borne
 *     les appels à Cloudflare et à la base sans jamais gêner une salle pleine.
 *  2. Le budget de NOTES, consommé JUSTE AVANT l'insertion (jeton accepté, plat
 *     validé) — sinon des requêtes sans jeton depuis la même IP épuiseraient
 *     le budget de toute la salle :
 *       • par APPAREIL (cookie signé) : le frein principal. Il ne pénalise que
 *         l'appareil qui s'emballe, jamais ses voisins. La base plafonne en
 *         plus à 10 notes réussies / 24 h par appareil (GUEST_RATE_LIMIT) ;
 *         ici on compte les tentatives, d'où un peu de marge.
 *       • par IP : un simple filet, dimensionné pour qu'une salle entière sur
 *         un seul wifi (ou un NAT d'opérateur : le site est IPv4 seul) ne
 *         l'atteigne pas.
 *  3. Le budget de COMMENTAIRES, plus strict (texte libre = spam, insultes),
 *     consommé au même endroit et AVANT celui des notes : un refus pour
 *     commentaire ne coûte donc rien au budget de notes.
 *
 * Un appareil sans cookie reçoit un nouvel invité, donc un budget appareil
 * neuf : c'est Turnstile, puis le filet par IP, qui bornent ce cas.
 */
const IP_FLOOD_MAX = 240; // / heure / IP, avant Turnstile
const DEVICE_HOUR_MAX = 10; // notes / heure / appareil
const DEVICE_DAY_MAX = 20; // tentatives / 24 h / appareil (la base en accepte 10)
const IP_HOUR_MAX = 60; // notes / heure / IP (filet)
const IP_DAY_MAX = 200; // notes / 24 h / IP (filet)
const COMMENT_DEVICE_HOUR_MAX = 3; // commentaires / heure / appareil
const COMMENT_IP_HOUR_MAX = 10; // commentaires / heure / IP
const COMMENT_IP_DAY_MAX = 30; // commentaires / 24 h / IP
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

type Budget = { key: string; max: number; windowMs: number };

/** Consomme tous les budgets (en parallèle). 0 si tout passe, sinon l'attente
 *  en secondes avant que le plus long refus ne se lève. */
async function consume(budgets: Budget[]): Promise<number> {
  const results = await Promise.all(budgets.map((b) => rateLimit(b.key, b.max, b.windowMs)));
  return results.reduce((wait, r) => (r.ok ? wait : Math.max(wait, r.retryAfter || 1)), 0);
}

export async function POST(req: NextRequest) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return fail('error', 500);

  let body: {
    restaurantId?: unknown;
    menuItemId?: unknown;
    stars?: unknown;
    comment?: unknown;
    turnstileToken?: unknown;
  };
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

  // Identité d'appareil : le budget par appareil porte dessus, et le cooldown
  // 30 j/plat en base aussi. Réutilisée si le cookie est valide, sinon émise.
  const existing = readGuestId(req.cookies.get(GUEST_COOKIE)?.value);
  const issued = existing ? null : issueGuestId();
  const guestId = existing ?? issued?.id;
  // Pas de secret configuré ⇒ pas de notation invité (échec fermé, cf. lib).
  if (!guestId) return fail('error', 503);

  // Plafond d'INONDATION par IP (/64 en IPv6), AVANT Turnstile : une rafale
  // sans jeton s'arrête ici sans coûter un appel à Cloudflare. Très haut : il
  // ne doit jamais gêner une salle légitime.
  const ip = clientIp(req.headers);
  const bucket = ipBucket(ip);
  const flood = await rateLimit(`menu:rate:ip:flood:${bucket}`, IP_FLOOD_MAX, HOUR_MS);
  if (!flood.ok) {
    return withCookie(
      fail('limited', 429, { message: MSG_TOO_MANY, retryAfter: flood.retryAfter }),
      issued?.cookie,
      req
    );
  }

  // Jeton anti-robot. Non configuré ⇒ « skipped » (journalisé une fois) ;
  // Cloudflare injoignable ⇒ « unavailable », on laisse passer : les budgets
  // et les plafonds en base tiennent toujours.
  const verdict = await verifyMenuTurnstile(body.turnstileToken, ip);
  if (verdict === 'rejected') {
    return withCookie(fail('verify', 403, { message: MSG_VERIFY }), issued?.cookie, req);
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

  // Budgets consommés ICI seulement : la requête a passé Turnstile et vise un
  // plat publié. Un refus de la base à l'insertion (cooldown 409, plafonds) les
  // consomme quand même — on ne le sait qu'après.
  //
  // Commentaire d'abord. Au-delà, on REFUSE la requête plutôt que publier la
  // note en jetant le commentaire en silence : le texte reste dans la feuille,
  // la personne voit pourquoi et republie sans commentaire si elle veut.
  if (comment) {
    const commentWait = await consume([
      { key: `menu:comment:dev:h:${guestId}`, max: COMMENT_DEVICE_HOUR_MAX, windowMs: HOUR_MS },
      { key: `menu:comment:ip:h:${bucket}`, max: COMMENT_IP_HOUR_MAX, windowMs: HOUR_MS },
      { key: `menu:comment:ip:d:${bucket}`, max: COMMENT_IP_DAY_MAX, windowMs: DAY_MS },
    ]);
    if (commentWait) {
      return withCookie(
        fail('comment_limited', 429, { message: MSG_COMMENT_TOO_MANY, retryAfter: commentWait }),
        issued?.cookie,
        req
      );
    }
  }
  const rateWait = await consume([
    { key: `menu:rate:dev:h:${guestId}`, max: DEVICE_HOUR_MAX, windowMs: HOUR_MS },
    { key: `menu:rate:dev:d:${guestId}`, max: DEVICE_DAY_MAX, windowMs: DAY_MS },
    { key: `menu:rate:ip:h:${bucket}`, max: IP_HOUR_MAX, windowMs: HOUR_MS },
    { key: `menu:rate:ip:d:${bucket}`, max: IP_DAY_MAX, windowMs: DAY_MS },
  ]);
  if (rateWait) {
    return withCookie(
      fail('limited', 429, { message: MSG_TOO_MANY, retryAfter: rateWait }),
      issued?.cookie,
      req
    );
  }

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

    // Il a déjà noté ce plat récemment.
    if (msg.includes('GUEST_COOLDOWN')) {
      return withCookie(fail('already', 409), issued?.cookie, req);
    }
    // Plafonds journaliers de la base (mig. 212) : un 429 explicite, pas un
    // échec générique — c'est une limite, pas une panne.
    if (DB_CAP_CODES.has(error.code ?? '')) {
      return withCookie(
        fail('limited', 429, { message: dbCapMessage(error.message) }),
        issued?.cookie,
        req
      );
    }
    // Plafonds historiques du trigger (mig. 129) : 10 notes / 24 h par
    // appareil, 40/h par restaurant. Même nature, même réponse.
    if (msg.includes('GUEST_RATE_LIMIT') || msg.includes('GUEST_VENUE_FLOOD')) {
      return withCookie(fail('limited', 429, { message: MSG_TOO_MANY }), issued?.cookie, req);
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
