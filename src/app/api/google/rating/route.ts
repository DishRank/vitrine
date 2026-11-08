import { NextResponse } from 'next/server';
import { getAuthenticatedContext } from '@/lib/verifyAuth';
import { getCorsHeaders } from '@/lib/cors';
import { getSupabaseServiceClientFor } from '@/lib/supabase';
import { googleGateRefusal, googleQuotaGate } from '@/lib/googleQuota';
import { isSamePlace } from '@/lib/googleMatch';

/**
 * Note Google d'un restaurant — résolution + lecture en UN aller-retour.
 *
 * Pourquoi côté serveur, et pourquoi cette route en plus de find-place /
 * place-details :
 *
 *  1. CONDITIONS GOOGLE. Les Maps Platform Terms §3.2.3(b) autorisent un
 *     cache temporaire de la Places Content jusqu'à 30 jours consécutifs,
 *     à condition de la supprimer ensuite ; le Place ID, lui, est
 *     conservable indéfiniment. Cette route tient les deux bouts : elle
 *     PERSISTE le place_id (une fois, pour ne plus jamais le rechercher) et
 *     rafraîchit la note à 21 jours. La suppression à 28 jours est assurée
 *     en base par cleanup_old_data() (migration 160), y compris pour les
 *     fiches que plus personne ne consulte.
 *  2. LE CLIENT NE PEUT PAS ÉCRIRE. La seule policy UPDATE sur `restaurants`
 *     est `owner_id = auth.uid()` : l'app tentait d'y écrire le place_id en
 *     « fire-and-forget », la RLS filtrait sans erreur (0 ligne) et le code
 *     ignorait le résultat. Le place_id n'était donc jamais mémorisé et
 *     chaque ouverture de fiche relançait une recherche facturée. Ici,
 *     l'écriture passe par le service role : aucune surface RLS ouverte.
 *  3. DEUX SKU, DEUX COÛTS. Find Place (IDs only) = 10 000 appels/mois ;
 *     Place Details avec `rating` = 1 000/mois. Résoudre est bon marché,
 *     lire la note est la ressource rare — d'où la persistance du place_id,
 *     qui rend la résolution non récurrente.
 */

/** Préfixes des identifiants INTERNES du picker. Ce ne sont pas des Place IDs
 *  Google : les envoyer à Google échoue ET consomme du quota. 13 fiches notées
 *  en portaient un dans `google_place_id` (cf. migration de purge). */
const INTERNAL_PREFIXES = ['osm_', 'manual_', 'dishrank_'];

function isRealPlaceId(id: unknown): id is string {
  if (typeof id !== 'string' || id.length < 15) return false;
  return !INTERNAL_PREFIXES.some((p) => id.startsWith(p));
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Âge à partir duquel on redemande la note à Google. 25 jours ≈ 1,2
 * rafraîchissement par fiche et par mois, soit environ 70 appels mensuels
 * pour les 58 fiches notées — 7 % du plafond serveur de 950, et de quoi
 * tenir jusqu'à ~790 fiches notées avant de le toucher.
 *
 * Doit rester STRICTEMENT sous les 28 jours de la purge
 * (`cleanup_old_data()`, migration 160), elle-même sous les 30 jours
 * autorisés. Sinon une fiche consultée régulièrement verrait sa note
 * effacée par le cron avant d'avoir été rafraîchie, et repartirait de
 * zéro à chaque passage.
 *
 * Cette valeur est dupliquée côté app (lib/googleRatingTtl.ts) : les deux
 * dépôts sont séparés, il n'y a pas de module partagé. Les faire diverger
 * ne casse rien — au pire le client redemande une note que la route juge
 * encore fraîche, et la route répond depuis la base sans appeler Google.
 */
const REFRESH_AFTER_MS = 25 * 24 * 60 * 60 * 1000;

/**
 * Mémoire vive, en amont du cache base. Elle absorbe les rafales : dix
 * convives ouvrant la même fiche dans l'heure ne déclenchent qu'une seule
 * écriture. Meurt avec le process.
 */
const RAM_TTL_MS = 60 * 60 * 1000;
const ram = new Map<string, { at: number; rating: number | null; total: number }>();

/**
 * Fenêtre pendant laquelle on ne retente pas une fiche que Google ne
 * connaît pas — beaucoup de petits établissements OSM n'y figurent pas.
 * Sans cette trace, chaque ouverture relancerait une recherche Find Place
 * facturée pour rien.
 *
 * On l'inscrit en base via `google_rating_updated_at` seul (la note reste
 * NULL) : ce n'est pas du contenu Google, juste la date d'une tentative
 * infructueuse. Plus court que le rafraîchissement d'une vraie note, pour
 * qu'un établissement récemment ajouté chez Google soit retrouvé vite.
 */
const RETRY_NO_MATCH_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

function ramGet(placeId: string, now: number) {
  const hit = ram.get(placeId);
  if (!hit || now - hit.at > RAM_TTL_MS) return null;
  return hit;
}

function ramSet(placeId: string, now: number, rating: number | null, total: number) {
  // Purge paresseuse : la map ne dépasse jamais quelques centaines
  // d'entrées en pratique, mais on évite qu'un process long ne la laisse
  // grossir indéfiniment.
  if (ram.size > 500) {
    for (const [k, v] of ram) if (now - v.at > RAM_TTL_MS) ram.delete(k);
  }
  ram.set(placeId, { at: now, rating, total });
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { headers: getCorsHeaders(request) });
}

export async function POST(request: Request) {
  const cors = getCorsHeaders(request);
  const auth = await getAuthenticatedContext(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: cors });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GOOGLE_PLACES_API_KEY not set' }, { status: 500, headers: cors });
  }

  const body = await request.json().catch(() => null);
  const restaurantId = body?.restaurant_id;
  if (typeof restaurantId !== 'string' || !UUID_RE.test(restaurantId)) {
    return NextResponse.json({ error: 'restaurant_id required' }, { status: 400, headers: cors });
  }

  const supabase = getSupabaseServiceClientFor(auth.supabaseUrl, auth.serviceRoleKey);

  const { data: resto } = await supabase
    .from('restaurants')
    .select(
      'id, name, address, city, latitude, longitude, google_place_id, google_rating, google_review_count, google_rating_updated_at'
    )
    .eq('id', restaurantId)
    .maybeSingle();
  if (!resto) {
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers: cors });
  }

  // ── 0. Cache base encore valable → aucun appel Google ─────────────────────
  const cachedAt = resto.google_rating_updated_at
    ? new Date(resto.google_rating_updated_at).getTime()
    : null;
  const cacheAge =
    cachedAt !== null && !Number.isNaN(cachedAt) ? Date.now() - cachedAt : Number.POSITIVE_INFINITY;
  const hasCachedRating = typeof resto.google_rating === 'number' && resto.google_rating > 0;

  if (hasCachedRating && cacheAge < REFRESH_AFTER_MS) {
    return NextResponse.json(
      {
        rating: resto.google_rating,
        total_reviews: resto.google_review_count ?? 0,
        place_id: resto.google_place_id,
        url: isRealPlaceId(resto.google_place_id)
          ? `https://www.google.com/maps/place/?q=place_id:${resto.google_place_id}`
          : '',
        source: 'db',
      },
      { headers: cors }
    );
  }
  // Tentative infructueuse récente (horodatage sans note) : on ne redemande
  // pas à Google avant la fin de la fenêtre.
  if (!hasCachedRating && cacheAge < RETRY_NO_MATCH_AFTER_MS) {
    return NextResponse.json(
      { rating: null, reason: 'no_match', source: 'db' },
      { headers: cors }
    );
  }

  // ── 1. Place ID : réutilisé s'il est réel, sinon résolu UNE fois ──────────
  let placeId: string | null = isRealPlaceId(resto.google_place_id)
    ? (resto.google_place_id as string)
    : null;
  // Place ID déjà en base : il a pu être mémorisé avant le contrôle de
  // correspondance (lib/googleMatch.ts). On le revérifie à la lecture de la note.
  const placeIdFromDb = placeId !== null;
  const ours = { name: resto.name, latitude: resto.latitude, longitude: resto.longitude };
  // Aucune correspondance fiable : tentative horodatée sans note, rien n'est
  // gardé de Google, pas de nouvel essai avant RETRY_NO_MATCH_AFTER_MS.
  const noMatch = async () => {
    await supabase
      .from('restaurants')
      .update({
        google_place_id: null,
        google_rating: null,
        google_review_count: null,
        google_rating_updated_at: new Date().toISOString(),
      })
      .eq('id', restaurantId);
    return NextResponse.json({ rating: null, reason: 'no_match' }, { headers: cors });
  };

  if (!placeId) {
    // Plafond atteint → 429 ; compteur en panne → 503 (échec fermé).
    const findGate = await googleQuotaGate(supabase, 'find_place', auth.userId, 'google/rating');
    if (!findGate.ok) return googleGateRefusal(findGate, cors);
    const query = [resto.name, resto.address, resto.city].filter(Boolean).join(' ');
    // name + geometry : champs « Basic » (sans surcoût), pour vérifier que le
    // candidat est bien ce lieu-là — Find Place renvoie toujours quelque chose.
    const findParams = new URLSearchParams({
      input: query,
      inputtype: 'textquery',
      fields: 'place_id,name,geometry',
      key: apiKey,
    });
    if (typeof resto.latitude === 'number' && typeof resto.longitude === 'number') {
      findParams.set('locationbias', `circle:500@${resto.latitude},${resto.longitude}`);
    }
    const findRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?${findParams}`
    );
    const findData = await findRes.json().catch(() => null);
    const first = findData?.candidates?.[0];
    const candidate = first?.place_id;
    const loc = first?.geometry?.location;

    // Aucune correspondance Google (beaucoup de petits établissements OSM n'y
    // sont pas), ou un autre lieu que le nôtre : pas d'erreur, tentative
    // horodatée sans note, pas de nouvel essai avant une semaine.
    if (
      !isRealPlaceId(candidate) ||
      !isSamePlace(ours, { name: first?.name, latitude: loc?.lat, longitude: loc?.lng })
    ) {
      return noMatch();
    }
    placeId = candidate;

    // Mémorisation du Place ID — la SEULE donnée Google que les conditions
    // autorisent à conserver. Évite de refacturer une recherche à chaque vue.
    const { error: saveErr } = await supabase
      .from('restaurants')
      .update({ google_place_id: placeId })
      .eq('id', restaurantId);
    if (saveErr) console.warn('[google/rating] place_id non mémorisé:', saveErr.message);
  }

  // ── 2. Note : rafraîchie depuis Google, puis mise en cache 21 jours ───────
  const now = Date.now();
  const url = `https://www.google.com/maps/place/?q=place_id:${placeId}`;

  const hit = ramGet(placeId, now);
  if (hit) {
    return NextResponse.json(
      { rating: hit.rating, total_reviews: hit.total, place_id: placeId, url, source: 'ram' },
      { headers: cors }
    );
  }

  const detailsGate = await googleQuotaGate(supabase, 'place_details', auth.userId, 'google/rating');
  if (!detailsGate.ok) return googleGateRefusal(detailsGate, cors);
  const detailsParams = new URLSearchParams({
    place_id: placeId,
    fields: placeIdFromDb ? 'rating,user_ratings_total,name,geometry' : 'rating,user_ratings_total',
    key: apiKey,
  });
  const detailsRes = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?${detailsParams}`
  );
  const details = await detailsRes.json().catch(() => null);
  const result = details?.result;
  if (!result) {
    return NextResponse.json({ rating: null, reason: 'no_details' }, { headers: cors });
  }
  if (
    placeIdFromDb &&
    !isSamePlace(ours, {
      name: result.name,
      latitude: result.geometry?.location?.lat,
      longitude: result.geometry?.location?.lng,
    })
  ) {
    // Place ID mémorisé avant le contrôle et qui désigne un autre lieu : oublié.
    return noMatch();
  }

  const rating = typeof result.rating === 'number' ? result.rating : null;
  const total = typeof result.user_ratings_total === 'number' ? result.user_ratings_total : 0;
  ramSet(placeId, now, rating, total);

  // Écriture du cache — service role. C'est le point clé de tout ce
  // correctif : le client tentait la même écriture depuis l'app, mais la
  // seule policy UPDATE sur `restaurants` est `owner_id = auth.uid()`, donc
  // la RLS la filtrait sans lever d'erreur. Résultat : 0 note en base sur
  // 4 498 restaurants, et chaque ouverture de fiche repartait de zéro.
  //
  // `google_rating_updated_at` sert aussi de minuteur à la purge des
  // 28 jours (cleanup_old_data(), migration 160) : on l'horodate même
  // quand Google renvoie une fiche sans note, pour ne pas la redemander en
  // boucle.
  const { error: cacheErr } = await supabase
    .from('restaurants')
    .update({
      google_rating: rating,
      google_review_count: rating != null ? total : null,
      google_rating_updated_at: new Date(now).toISOString(),
    })
    .eq('id', restaurantId);
  if (cacheErr) console.warn('[google/rating] cache non écrit:', cacheErr.message);

  return NextResponse.json(
    { rating, total_reviews: total, place_id: placeId, url, source: 'google' },
    { headers: cors }
  );
}
