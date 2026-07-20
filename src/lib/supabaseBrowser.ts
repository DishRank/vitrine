'use client';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Client Supabase NAVIGATEUR (clé anon publique, protégée par RLS).
//
// Ne sert plus QU'À l'abonnement temps réel du menu (MenuLiveSync) : une
// souscription en LECTURE, que le rôle anon peut ouvrir tel quel.
//
// ⚠️ IL NE SERT PLUS À LA NOTATION. Celle-ci passait par
// `auth.signInAnonymously()` + INSERT direct dans PostgREST ; ce chemin a été
// abandonné parce qu'il laissait le serveur aveugle — il ne voyait ni le
// restaurant réellement scanné (donc n'importe quel plat inventé passait sur
// n'importe quel établissement), ni l'IP (donc aucun plafond ne résistait à la
// création illimitée d'identités anonymes). La notation invitée est désormais
// écrite par la route serveur `/api/menu/rate`, avec une identité d'appareil en
// cookie signé (cf. lib/guestIdentity.ts).
//
// Conséquence : « Allow anonymous sign-ins » N'A PAS à être activé sur le
// projet Supabase. Ne pas le réactiver « pour dépanner » — cela rouvrirait la
// surface décrite ci-dessus.
//
// Sans les env NEXT_PUBLIC_*, retourne null (temps réel désactivé).

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
