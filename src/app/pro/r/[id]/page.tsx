import { requireOwnedRestaurant } from '@/lib/pro/data';
import ListingForm from './ListingForm';

export const metadata = { title: 'Fiche' };

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resto = await requireOwnedRestaurant(id);

  return (
    <ListingForm
      id={id}
      initial={{
        description: resto.description ?? '',
        accepts_groups: resto.accepts_groups,
        group_offer: resto.group_offer ?? '',
        phone: resto.phone ?? '',
        website: resto.website ?? '',
        reservation_url: resto.reservation_url ?? '',
        menu_url: resto.menu_url ?? '',
        instagram: resto.instagram ?? '',
        price_level: resto.price_level,
        cuisines: (resto.cuisines ?? []).join(', '),
      }}
    />
  );
}
