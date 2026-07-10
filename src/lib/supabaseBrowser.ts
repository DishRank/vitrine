'use client';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Client Supabase NAVIGATEUR (clé anon publique, protégée par RLS) — sert la
// notation « sans compte » depuis le menu web : une session ANONYME Supabase
// (auth.signInAnonymously) donne un vrai auth.uid(), donc les policies RLS,
// les cooldowns (30 j/plat), le rate-limit (10 avis/24 h) et la contrainte
// carte (trigger 092) s'appliquent tels quels. La session persiste dans le
// localStorage du navigateur → le même client garde la même identité d'un
// scan à l'autre (dédup naturelle par appareil, §5.4).
//
// Nécessite « Allow anonymous sign-ins » activé dans les réglages Auth du
// projet Supabase. Sans les env NEXT_PUBLIC_*, retourne null (feature off).

let _client: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!_client) {
    _client = createClient(url, key, {
      auth: { persistSession: true, storageKey: 'dishrank-web-auth' },
    });
  }
  return _client;
}
