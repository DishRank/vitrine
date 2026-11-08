import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Garde de quota des appels Google Places (find-place, place-details, rating).
 *
 * `try_log_google_api_call` compte ET journalise l'appel avant qu'on ne le
 * fasse. Contrat : une ligne `{ allowed, current_count, monthly_cap, category }` ;
 * `allowed = false` ⇒ plafond atteint, rien n'est inséré.
 *
 * ÉCHEC FERMÉ : si le RPC échoue (base injoignable, fonction cassée, réponse
 * inattendue), on NE laisse PAS passer l'appel Google. Avant, on le laissait
 * passer : une panne du compteur ouvrait un appel facturé sans aucune borne.
 * Mieux vaut une note Google absente quelques minutes (l'app la traite comme
 * absente) qu'une facture.
 */

export type GoogleEndpoint = 'find_place' | 'place_details';

type GateRow = {
  allowed?: unknown;
  current_count?: unknown;
  monthly_cap?: unknown;
  category?: unknown;
};

type GateRefusal = {
  ok: false;
  status: 429 | 503;
  body: Record<string, unknown>;
  retryAfter?: number;
};

export type GoogleGate = { ok: true } | GateRefusal;

const MSG_CAPPED = 'Quota d’appels Google atteint. Réessaie plus tard.';
const MSG_UNAVAILABLE = 'Service momentanément indisponible. Réessaie dans quelques minutes.';

const unavailable: GateRefusal = {
  ok: false,
  status: 503,
  body: { error: 'quota_unavailable', message: MSG_UNAVAILABLE },
  retryAfter: 60,
};

export async function googleQuotaGate(
  supabase: SupabaseClient,
  endpoint: GoogleEndpoint,
  userId: string,
  logTag: string
): Promise<GoogleGate> {
  try {
    const { data, error } = await supabase.rpc('try_log_google_api_call', {
      p_endpoint: endpoint,
      p_user_id: userId,
    });
    if (error) {
      console.error(`[${logTag}] quota ${endpoint} : RPC en échec, appel refusé :`, error.message);
      return unavailable;
    }
    const row = (Array.isArray(data) ? data[0] : data) as GateRow | null | undefined;
    if (row?.allowed === true) return { ok: true };
    if (row?.allowed === false) {
      return {
        ok: false,
        status: 429,
        body: {
          // Clé historique conservée : l'app et les logs la connaissent.
          error: 'monthly_cap_reached',
          message: MSG_CAPPED,
          category: row.category ?? null,
          current_count: row.current_count ?? null,
          monthly_cap: row.monthly_cap ?? null,
        },
      };
    }
    console.error(`[${logTag}] quota ${endpoint} : réponse inattendue du RPC, appel refusé`);
    return unavailable;
  } catch (e) {
    const msg = (e as Error).message;
    console.error(`[${logTag}] quota ${endpoint} : RPC injoignable, appel refusé :`, msg);
    return unavailable;
  }
}

/** Réponse HTTP d'un refus de la garde : 429 (plafond) ou 503 (compteur HS). */
export function googleGateRefusal(gate: GateRefusal, cors: Record<string, string>) {
  const headers = gate.retryAfter ? { ...cors, 'Retry-After': String(gate.retryAfter) } : cors;
  return NextResponse.json(gate.body, { status: gate.status, headers });
}
