import { cache } from 'react';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Client Supabase SERVEUR de l'espace pro (@supabase/ssr, session en cookies).
 *
 * À utiliser dans les Server Components, Server Actions et Route Handlers de
 * la zone /pro. La session vit dans des cookies `sb-<ref>-…` : elle est donc
 * lisible côté serveur (SSR authentifié + garde middleware), contrairement à
 * la session ANONYME de notation QR qui reste dans le localStorage du
 * navigateur (`supabaseBrowser.ts`, storageKey 'dishrank-web-auth') — les deux
 * identités coexistent sans se marcher dessus.
 *
 * Un projet Supabase par déploiement (D3 du plan espace-pro-web) : prod Vercel
 * → projet prod, préprod → projet DEV via ses propres NEXT_PUBLIC_*.
 */
// `cache()` : un SEUL client Supabase par requête (le rendu d'une page appelle
// getSupabaseServer plusieurs fois — layout /pro/r, layout [id], page — sans
// ça = autant de clients + autant de getUser réseau).
export const getSupabaseServer = cache(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY manquantes');

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Render d'un Server Component : les cookies sont en lecture seule.
          // Sans gravité — le refresh de session est fait par le middleware
          // (proxy.ts) qui, lui, peut écrire les cookies.
        }
      },
    },
  });
});
