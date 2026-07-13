import { requireUser } from '@/lib/pro/data';
import ProHeader from '../_components/ProHeader';
import RestaurantCarousel, { type CarouselResto } from './_components/RestaurantCarousel';
import AnimatedOutlet from './_components/AnimatedOutlet';

/**
 * Shell PERSISTANT du workspace restaurateur (segment /pro/r, au-dessus de
 * [id]). En restant monté pendant qu'on change de resto ([id] varie), il évite
 * de recharger l'en-tête + le carrousel à chaque bascule : seul le contenu sous
 * l'AnimatedOutlet se re-rend (soft-nav), d'où le ressenti « le dessous change
 * avec une animation » et une navigation bien plus rapide.
 */
export default async function ProWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from('restaurants')
    .select('id, name, photo_url, subscription_tier')
    .eq('owner_id', user.id)
    .order('name');
  const restaurants = (data ?? []) as CarouselResto[];

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <ProHeader email={user.email} />
      <RestaurantCarousel restaurants={restaurants} />
      <AnimatedOutlet>{children}</AnimatedOutlet>
    </div>
  );
}
