import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';
import { demoOuting, isDemoToken } from './fixtures';
import type { Outing } from './types';

/** Jeton du lien de vote : 22 caractères base64url générés en base (marge 16–40). */
export const OUTING_TOKEN_RE = /^[A-Za-z0-9_-]{16,40}$/;

export type SharedOutingResult =
  | { kind: 'ok'; outing: Outing }
  | { kind: 'missing' }
  | { kind: 'error' };

/**
 * Lecture serveur d'une sortie partagée (rendu initial + métadonnées OG).
 *
 * Clé ANON, pas service_role : `get_shared_outing` est la seule porte prévue
 * pour les invités (droits accordés à anon par la migration 202) ; on passe
 * par la même que le navigateur. URL et clé viennent de la MÊME paire d'env
 * (NEXT_PUBLIC_* d'abord, comme le client navigateur → même projet des deux
 * côtés), sinon SUPABASE_URL / SUPABASE_ANON_KEY.
 *
 * `cache` (React) : generateMetadata et la page partagent un seul appel.
 */
export const getSharedOuting = cache(async (token: string): Promise<SharedOutingResult> => {
  if (!OUTING_TOKEN_RE.test(token)) return { kind: 'missing' };
  if (process.env.NODE_ENV !== 'production' && isDemoToken(token)) {
    const demo = demoOuting(token);
    return demo ? { kind: 'ok', outing: demo } : { kind: 'missing' };
  }

  const pub = [process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY] as const;
  const srv = [process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY] as const;
  const [url, key] = pub[0] && pub[1] ? pub : srv;
  if (!url || !key) return { kind: 'error' };

  try {
    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await supabase.rpc('get_shared_outing', { p_token: token });
    if (error) return { kind: 'error' };
    const outing = data as Outing | null;
    if (!outing || outing.flow !== 'v2') return { kind: 'missing' };
    return { kind: 'ok', outing };
  } catch {
    return { kind: 'error' };
  }
});
