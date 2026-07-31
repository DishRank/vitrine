/**
 * Détection des fermetures d'établissement, via le registre SIRENE.
 *
 * DÉCLENCHEMENT : par `pg_cron` côté Supabase (gratuit — pas de Vercel Cron),
 * même patron que `/api/cron/owner-digest` : `pg_net` appelle cet endpoint en
 * `Authorization: Bearer <secret DB>` (cf. migration 166). Déclenchement
 * manuel possible avec `CRON_SECRET`.
 *
 * POURQUOI. Nos fiches viennent d'OSM et d'Overture, qui ne signalent pas les
 * fermetures : `operating_status` d'Overture a été mesuré à 522 425 valeurs
 * nulles pour 213 renseignées, et OSM dépend des contributeurs. Sans ce
 * contrôle, la base pourrit et on finit par proposer un dîner dans un
 * établissement fermé. Le registre expose `etat_administratif` et
 * `date_fermeture` — seule source gratuite qui le fasse.
 *
 * `?dry=1` : renvoie le plan SANS rien écrire. `?limit=N` : borne le lot.
 */
import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServiceClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 300;

const SIRENE = 'https://recherche-entreprises.api.gouv.fr/search';
const FOOD_NAF = '56.10A,56.10B,56.10C,56.30Z';
/** Un lieu n'est le même que sous ce rayon, même à nom identique. */
const SAME_PLACE_M = 200;
/** Ne pas réinterroger le registre pour une fiche vue récemment. */
const RECHECK_DAYS = 30;
/** Borne par exécution : l'API est publique, on ne la martèle pas. */
const DEFAULT_LIMIT = 120;

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

async function isAuthorized(request: Request, supabase: SupabaseClient): Promise<boolean> {
  const header = request.headers.get('authorization') || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!bearer) return false;
  if (process.env.CRON_SECRET && safeEqual(bearer, process.env.CRON_SECRET)) return true;
  const { data } = await supabase
    .from('app_internal_config')
    .select('value')
    .eq('key', 'closures_cron_secret')
    .maybeSingle();
  const dbSecret = (data as { value?: string } | null)?.value;
  return !!dbSecret && safeEqual(bearer, dbSecret);
}

const norm = (s: string | null | undefined) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '');

function distM(a: number, b: number, x: number, y: number): number {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dx = (y - b) * rad * Math.cos(((a + x) / 2) * rad);
  const dy = (x - a) * rad;
  return Math.sqrt(dx * dx + dy * dy) * R;
}

interface Etab {
  siret?: string;
  etat_administratif?: string;
  date_fermeture?: string | null;
  liste_enseignes?: string[] | null;
  nom_commercial?: string | null;
  latitude?: string | null;
  longitude?: string | null;
}
interface Entreprise {
  nom_complet?: string;
  matching_etablissements?: Etab[] | null;
}
interface Resto {
  id: string;
  name: string;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  siret: string | null;
  closed_at: string | null;
}
interface Verdict {
  siret: string;
  etat: string;
  fermeture: string | null;
}

async function callSirene(params: Record<string, string>): Promise<{ results?: Entreprise[] } | null> {
  const url = `${SIRENE}?${new URLSearchParams(params)}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      if (!res.ok) return null;
      return (await res.json()) as { results?: Entreprise[] };
    } catch {
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  return null;
}

/**
 * Cherche le SIRET d'un restaurant. Renvoie null au moindre doute.
 *
 * PIÈGE MAJEUR. Un établissement qui change de société garde son adresse et
 * son enseigne : le registre porte alors DEUX fiches au même endroit, une
 * close et une active. « Carmelo », 7 rue Neuve à Lyon, en avait trois — dont
 * une fermée au 31/12/2024 et une ouverte. Prendre la première
 * correspondance revenait à déclarer fermé un restaurant qui tourne, donc à
 * le retirer de l'app et à rendre ses avis orphelins.
 *
 * D'où la règle : on collecte TOUTES les correspondances et l'ACTIF l'emporte.
 * On ne conclut à une fermeture que si aucune fiche active ne correspond.
 * Rater une fermeture coûte un candidat périmé ; en déclarer une à tort
 * supprime un restaurant qui existe.
 */
async function resolveSiret(resto: Resto): Promise<Verdict | null> {
  const data = await callSirene({
    q: [resto.name, resto.city].filter(Boolean).join(' '),
    activite_principale: FOOD_NAF,
    limite_matching_etablissements: '10',
    per_page: '10',
  });
  const wanted = norm(resto.name);
  if (!wanted) return null;

  const matches: Verdict[] = [];
  for (const company of data?.results ?? []) {
    for (const e of company.matching_etablissements ?? []) {
      const got = norm(e.liste_enseignes?.[0] || e.nom_commercial || company.nom_complet);
      if (!got || !e.siret) continue;
      // Inclusion à partir de 4 caractères, pour que « Le Bar » ne
      // s'accroche pas à n'importe quoi.
      const nameOk =
        got === wanted ||
        (wanted.length >= 4 && got.includes(wanted)) ||
        (got.length >= 4 && wanted.includes(got));
      if (!nameOk) continue;

      const lat = e.latitude != null ? parseFloat(e.latitude) : null;
      const lng = e.longitude != null ? parseFloat(e.longitude) : null;
      if (resto.latitude != null && resto.longitude != null && lat != null && lng != null) {
        if (distM(resto.latitude, resto.longitude, lat, lng) > SAME_PLACE_M) continue;
      } else if (got !== wanted) {
        // Sans coordonnées des deux côtés, on exige l'égalité stricte.
        continue;
      }
      matches.push({
        siret: e.siret,
        etat: e.etat_administratif ?? '',
        fermeture: e.date_fermeture ?? null,
      });
    }
  }
  if (matches.length === 0) return null;
  return (
    matches.find((m) => m.etat === 'A') ??
    matches.sort((a, b) => String(b.fermeture ?? '').localeCompare(String(a.fermeture ?? '')))[0]
  );
}

async function checkSiret(siret: string): Promise<Verdict | null> {
  const data = await callSirene({ q: siret, limite_matching_etablissements: '10' });
  for (const company of data?.results ?? []) {
    for (const e of company.matching_etablissements ?? []) {
      if (e.siret === siret) {
        return {
          siret,
          etat: e.etat_administratif ?? '',
          fermeture: e.date_fermeture ?? null,
        };
      }
    }
  }
  return null;
}

async function handle(request: Request) {
  const supabase = getSupabaseServiceClient();
  if (!(await isAuthorized(request, supabase))) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const dry = url.searchParams.get('dry') === '1';
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit')) || DEFAULT_LIMIT));

  // On ne contrôle que les fiches réellement exposées — celles qui portent au
  // moins un avis. Interroger le registre pour 4 500 lignes importées d'OSM
  // que personne n'a jamais ouvertes serait du gaspillage.
  const { data: rows, error } = await supabase.rpc('get_restaurants_to_check_closure', {
    p_recheck_days: RECHECK_DAYS,
    p_limit: limit,
  });
  if (error) {
    console.error('[cron/check-closures] rpc failed:', error.message);
    return NextResponse.json({ ok: false, error: 'rpc failed' }, { status: 502 });
  }

  const restos = (rows ?? []) as Resto[];
  const journal: string[] = [];
  let resolus = 0;
  let fermes = 0;
  let rouverts = 0;
  let inconnus = 0;

  for (const r of restos) {
    let info: Verdict | null = null;

    if (r.siret) {
      info = await checkSiret(r.siret);
      // Le SIRET connu est clos : avant de conclure, on cherche un
      // successeur actif à la même adresse. Un changement de société ne
      // ferme pas le restaurant.
      if (info?.etat === 'F') {
        const successeur = await resolveSiret(r);
        if (successeur?.etat === 'A') {
          info = successeur;
          journal.push(`repris:${r.name}`);
          if (!dry) await supabase.from('restaurants').update({ siret: successeur.siret }).eq('id', r.id);
        }
      }
    } else {
      const found = await resolveSiret(r);
      if (found) {
        resolus++;
        info = found;
        if (!dry) await supabase.from('restaurants').update({ siret: found.siret }).eq('id', r.id);
      }
    }

    if (!info) {
      inconnus++;
    } else if (info.etat === 'F') {
      fermes++;
      journal.push(`ferme:${r.name}:${info.fermeture ?? '?'}`);
      if (!dry) {
        await supabase
          .from('restaurants')
          .update({ closed_at: info.fermeture ?? new Date().toISOString() })
          .eq('id', r.id);
      }
    } else if (r.closed_at) {
      // Réouverture, ou fermeture relevée à tort : on lève le drapeau.
      rouverts++;
      journal.push(`rouvert:${r.name}`);
      if (!dry) await supabase.from('restaurants').update({ closed_at: null }).eq('id', r.id);
    }

    if (!dry) {
      await supabase
        .from('restaurants')
        .update({ closure_checked_at: new Date().toISOString() })
        .eq('id', r.id);
    }
    await new Promise((res) => setTimeout(res, 120));
  }

  return NextResponse.json({
    ok: true,
    dry,
    controlees: restos.length,
    siret_resolus: resolus,
    fermetures: fermes,
    reouvertures: rouverts,
    sans_correspondance: inconnus,
    journal,
  });
}

export async function GET(request: Request) {
  return handle(request);
}
export async function POST(request: Request) {
  return handle(request);
}
