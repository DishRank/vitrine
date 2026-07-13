import Link from 'next/link';
import { requireOwnedRestaurant, isPremium, requireUser } from '@/lib/pro/data';
import { normalizeMenuTheme } from '../themeConstants';
import ThemeEditor from './ThemeEditor';

export const metadata = { title: 'Apparence du menu' };

export default async function AppearancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resto = await requireOwnedRestaurant(id);
  const premium = isPremium(resto);
  const { supabase } = await requireUser();
  const { data } = await supabase.from('restaurants').select('menu_theme').eq('id', id).maybeSingle();
  const theme = normalizeMenuTheme((data as { menu_theme?: unknown } | null)?.menu_theme);

  return (
    <div>
      <Link href={`/pro/r/${id}/menu`} className="text-xs font-semibold text-[var(--text3)] hover:text-[var(--text2)]">
        ← Retour au menu
      </Link>
      <h2 className="mt-1 mb-1 text-lg font-extrabold">Apparence du menu</h2>
      <p className="mb-5 text-sm text-[var(--text2)]">
        Personnalisez l&apos;ambiance de votre menu numérique. Les photos de plats sont incluses
        gratuitement ; l&apos;ambiance, la couleur, la police et le logo sont réservés au Premium.
      </p>
      <ThemeEditor restaurantId={id} initial={theme} premium={premium} />
    </div>
  );
}
