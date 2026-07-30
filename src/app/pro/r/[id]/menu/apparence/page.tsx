import Link from 'next/link';
import { requireOwnedRestaurant, isPremium, getMenuThemeLibrary } from '@/lib/pro/data';
import { normalizeMenuTheme } from '../themeConstants';
import { MENU_FONT_VARS } from '../menuFonts';
import ThemeEditor from './ThemeEditor';

export const metadata = { title: 'Apparence du menu' };

export default async function AppearancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resto = await requireOwnedRestaurant(id);
  const premium = isPremium(resto);
  // `requireOwnedRestaurant` ramène déjà menu_theme + logo_url (LISTING_COLS,
  // et c'est un React.cache) → inutile de refaire une requête ici.
  const theme = normalizeMenuTheme(resto.menu_theme);
  const library = (await getMenuThemeLibrary(id)).map((row) => ({
    id: row.id, name: row.name, config: normalizeMenuTheme(row.config), updated_at: row.updated_at,
  }));

  return (
    <div className={MENU_FONT_VARS}>
      <Link href={`/pro/r/${id}/menu`} className="text-xs font-semibold text-[var(--text3)] hover:text-[var(--text2)]">
        ← Retour au menu
      </Link>
      <h2 className="mt-1 mb-1 text-lg font-extrabold">Apparence du menu</h2>
      <p className="mb-5 text-sm text-[var(--text2)]">
        Personnalisez l&apos;ambiance de votre menu numérique. Le logo et les photos de plats sont
        inclus gratuitement ; l&apos;ambiance, la couleur et la police sont réservés au Premium.
      </p>
      <ThemeEditor restaurantId={id} initial={theme} premium={premium} logoUrl={resto.logo_url} initialLibrary={library} />
    </div>
  );
}
