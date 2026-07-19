'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabaseBrowser';

/**
 * Menu QR « vivant » : le client assis à table voit un plat passer en « épuisé »
 * SANS recharger la page.
 *
 * Pourquoi un refresh serveur et pas un patch du DOM : le rendu de l'état
 * épuisé (nom grisé + libellé) vit dans MenuBridge, côté serveur. Le reproduire
 * en JS dupliquerait la présentation et finirait par diverger — on garde donc
 * UNE seule source de rendu et on redemande la page au serveur.
 *
 * Le délai est volontaire. La séquence est : l'app UPDATE la ligne → Postgres
 * émet l'événement → en parallèle l'app appelle /api/revalidate-menu qui purge
 * le tag `menu:{id}`. Sans attendre, `router.refresh()` pourrait arriver AVANT
 * la purge et re-servir la page en cache (donc l'ancien état). Le debounce
 * couvre la course et regroupe au passage les rafales (l'owner qui bascule
 * plusieurs plats d'affilée ne déclenche qu'un seul refresh).
 *
 * Dégradation propre : sans les env NEXT_PUBLIC_* (client null) ou sans la
 * migration 124 (table hors publication), il ne se passe rien — la page reste
 * exactement ce qu'elle est aujourd'hui.
 */
export default function MenuLiveSync({ restaurantId }: { restaurantId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    if (!supabase || !restaurantId) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel(`menu-live:${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'menu_items',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => {
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => router.refresh(), 900);
        }
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [restaurantId, router]);

  return null;
}
