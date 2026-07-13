'use client';
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Client Supabase NAVIGATEUR de l'espace pro (@supabase/ssr → session en
 * COOKIES, flow PKCE). Sert uniquement aux flows qui exigent le navigateur :
 * OAuth Google/Apple (redirection + code verifier PKCE en cookie).
 *
 * ⚠️ Distinct de `src/lib/supabaseBrowser.ts` (client localStorage
 * 'dishrank-web-auth' qui porte la session ANONYME de notation QR) : ne pas
 * fusionner, sinon un login pro écraserait l'identité anonyme de l'appareil
 * (dédup des notes par appareil, v2 §5.4) et vice-versa.
 */
let _client: SupabaseClient | null = null;

export function getSupabaseBrowserPro(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!_client) {
    _client = createBrowserClient(url, key);
  }
  return _client;
}
