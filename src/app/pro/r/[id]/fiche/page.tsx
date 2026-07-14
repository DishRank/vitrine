import { requireOwnedRestaurant, isPremium, requireUser } from '@/lib/pro/data';
import { normalizeMenuTheme } from '../menu/themeConstants';
import ListingForm from '../ListingForm';
import ListingImages, { type ReviewPhoto } from '../ListingImages';

export const metadata = { title: 'Fiche' };

/** Édition de la fiche établissement (déplacée de l'index vers /fiche depuis que
 *  l'index est le cockpit d'accueil). */
export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resto = await requireOwnedRestaurant(id);
  const premium = isPremium(resto);
  const { supabase } = await requireUser();

  // Photos d'avis publiés de ce resto → réutilisables comme image vitrine
  // (le picker copie simplement leur URL dans restaurants.photo_url).
  const { data: reviewPhotoRows } = await supabase
    .from('reviews')
    .select('id, photo_url')
    .eq('restaurant_id', id)
    .eq('pending_moderation', false)
    .not('photo_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(40);
  const reviewPhotos = (reviewPhotoRows ?? []) as ReviewPhoto[];

  const logoUrl = normalizeMenuTheme(resto.menu_theme).logo_url;

  return (
    <div className="space-y-6">
      <ListingImages
        restaurantId={id}
        initialPhotoUrl={resto.photo_url}
        initialLogoUrl={logoUrl}
        reviewPhotos={reviewPhotos}
        premium={premium}
      />
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
    </div>
  );
}
