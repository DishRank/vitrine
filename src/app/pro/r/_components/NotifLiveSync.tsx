'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserPro } from '@/lib/pro/supabaseBrowser';

/**
 * Temps réel de la cloche pro.
 *
 * Même stratégie que MenuLiveSync sur le menu public : on ne patche pas le DOM,
 * on déclenche un `router.refresh()` debouncé et on laisse le layout serveur
 * refaire la lecture. Une seule source de rendu, donc pas de divergence
 * possible entre l'état affiché et la base.
 *
 * Prérequis vérifiés : `notifications` est dans la publication
 * `supabase_realtime` (dev ET prod), et la CSP de /pro autorise déjà `wss:`
 * (`supabaseConnect()` émet les deux schémas — attention, le schéma fait
 * partie du match CSP : `https://x.supabase.co` n'autorise PAS `wss://`).
 *
 * On filtre sur `user_id` (le seul filtre que Realtime accepte ici) et on
 * écarte côté client les INSERT sans `restaurant_id` : les notifications
 * perso de l'owner n'ont rien à faire dans l'espace pro et ne doivent pas
 * provoquer de rafraîchissement inutile.
 *
 * ⚠️ Client OBLIGATOIREMENT `getSupabaseBrowserPro` (session en COOKIES,
 * la même que le SSR), jamais `getSupabaseBrowser` : ce dernier porte la
 * session localStorage anonyme de la notation QR. Realtime applique la RLS
 * avec le JWT de la connexion — sans la session de l'owner, `auth.uid()` est
 * nul, la policy « Voir ses notifications » ne passe pas et AUCUN événement
 * n'est livré. L'abonnement paraîtrait sain tout en restant muet.
 */
export default function NotifLiveSync({ userId }: { userId: string }) {
  const router = useRouter();

  useEffect(() => {
    if (!userId) return;
    // Null si les variables publiques Supabase manquent (build sans env) :
    // on dégrade en « pas de temps réel », la cloche reste correcte au
    // chargement de page.
    const supabase = getSupabaseBrowserPro();
    if (!supabase) return;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const channel = supabase
      .channel(`pro-notifs:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (!(payload.new as { restaurant_id?: string | null })?.restaurant_id) return;
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => router.refresh(), 900);
        }
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [userId, router]);

  return null;
}
