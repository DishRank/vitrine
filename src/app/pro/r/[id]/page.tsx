import { requireOwnedRestaurant, requireUser } from '@/lib/pro/data';
import ListingForm from './ListingForm';
import SetupGuide from './SetupGuide';

export const metadata = { title: 'Fiche' };

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resto = await requireOwnedRestaurant(id);

  // A-t-on déjà des plats ? (count seul, head:true → pas de lignes ramenées)
  const { supabase } = await requireUser();
  const { count } = await supabase
    .from('menu_items')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', id);
  const hasMenu = (count ?? 0) > 0;
  const hasDescription = !!(resto.description && resto.description.trim());

  return (
    <>
      <SetupGuide id={id} hasDescription={hasDescription} hasMenu={hasMenu} />
      <ListingForm
        id={id}
        initial={{
        description: resto.description ?? '',
        phone: resto.phone ?? '',
        website: resto.website ?? '',
        reservation_url: resto.reservation_url ?? '',
        menu_url: resto.menu_url ?? '',
        instagram: resto.instagram ?? '',
        price_level: resto.price_level,
        cuisines: resto.cuisines ?? [],
        }}
      />
    </>
  );
}
