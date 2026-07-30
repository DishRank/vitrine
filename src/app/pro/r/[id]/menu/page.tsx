import { requireOwnedRestaurant, isPremium, getMenuThemeLibrary } from '@/lib/pro/data';
import { getEditorMenus } from './menuData';
import { normalizeMenuTheme } from './themeConstants';
import MenuEditor from './MenuEditor';

export const metadata = { title: 'Menu' };

export default async function MenuPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { id } = await params;
  const { edit } = await searchParams;
  const resto = await requireOwnedRestaurant(id);
  const premium = isPremium(resto);
  const menus = await getEditorMenus(id);
  const menu = menus[0] ?? null;
  const initialTheme = normalizeMenuTheme(resto.menu_theme);
  const initialThemeLibrary = (await getMenuThemeLibrary(id)).map((row) => ({
    id: row.id, name: row.name, config: normalizeMenuTheme(row.config), updated_at: row.updated_at,
  }));

  return (
    <MenuEditor
      restaurantId={id}
      menu={menu}
      premium={premium}
      initialTheme={initialTheme}
      logoUrl={resto.logo_url}
      menuLanguages={resto.menu_languages ?? []}
      initialThemeLibrary={initialThemeLibrary}
      initialEditItemId={typeof edit === 'string' ? edit : undefined}
    />
  );
}
