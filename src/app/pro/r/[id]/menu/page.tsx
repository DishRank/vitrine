import { requireOwnedRestaurant, isPremium } from '@/lib/pro/data';
import { getEditorMenus } from './menuData';
import MenuEditor from './MenuEditor';

export const metadata = { title: 'Menu' };

export default async function MenuPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resto = await requireOwnedRestaurant(id);
  const premium = isPremium(resto);
  const menus = await getEditorMenus(id);
  const menu = menus[0] ?? null;

  return <MenuEditor restaurantId={id} menu={menu} premium={premium} />;
}
