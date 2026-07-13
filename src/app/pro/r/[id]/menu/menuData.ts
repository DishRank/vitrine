import { getSupabaseServer } from '@/lib/pro/supabaseServer';
import type { MenuVariant, MenuOption, MenuAvailability } from './menuLeaves';

/**
 * Lecture de l'arbre menu pour l'ÉDITEUR (session RLS de l'owner → inclut les
 * sections/plats masqués, contrairement à fetchMenuTree public qui refiltre).
 * Tri client (display_order puis created_at), 1 seul niveau de section.
 */

export interface EditorItem {
  id: string;
  section_id: string;
  kind: 'item' | 'formula';
  name: string;
  description: string | null;
  price: number | null;
  currency: string;
  photo_url: string | null;
  display_order: number;
  is_visible: boolean;
  is_available: boolean;
  is_signature: boolean;
  allergens: string[];
  diet_tags: string[];
  variants: MenuVariant[];
  options: MenuOption[];
  availability: MenuAvailability;
  updated_at: string;
  created_at: string;
}

export interface EditorSection {
  id: string;
  name: string;
  description: string | null;
  display_order: number;
  is_visible: boolean;
  created_at: string;
  items: EditorItem[];
}

export interface EditorMenu {
  id: string;
  name: string;
  version: number;
  sections: EditorSection[];
}

const byOrder = <T extends { display_order: number; created_at: string }>(a: T, b: T) =>
  a.display_order - b.display_order || a.created_at.localeCompare(b.created_at);

const SELECT = `id, name, version, display_order, created_at,
  menu_sections(id, name, description, parent_section_id, display_order, is_visible, created_at,
    menu_items(id, section_id, kind, name, description, price, currency, photo_url, display_order, is_visible, is_available, is_signature, allergens, diet_tags, variants, options, availability, updated_at, created_at))`;

/** L'arbre complet des cartes du resto (souvent une seule, « Notre carte »). */
export async function getEditorMenus(restaurantId: string): Promise<EditorMenu[]> {
  const supabase = await getSupabaseServer();
  const { data } = await supabase
    .from('restaurant_menus')
    .select(SELECT)
    .eq('restaurant_id', restaurantId);

  type RawItem = EditorItem & { parent_section_id?: string | null };
  type RawSection = Omit<EditorSection, 'items'> & {
    parent_section_id: string | null;
    menu_items: RawItem[];
  };
  type RawMenu = Omit<EditorMenu, 'sections'> & { display_order: number; created_at: string; menu_sections: RawSection[] };

  return ((data ?? []) as unknown as RawMenu[])
    .sort(byOrder)
    .map((m) => ({
      id: m.id,
      name: m.name,
      version: m.version,
      sections: (m.menu_sections ?? [])
        .filter((s) => !s.parent_section_id) // 1 niveau : on ignore les sous-sections en v1
        .sort(byOrder)
        .map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          display_order: s.display_order,
          is_visible: s.is_visible,
          created_at: s.created_at,
          items: (s.menu_items ?? [])
            .map((it) => ({
              ...it,
              price: it.price != null ? Number(it.price) : null,
              allergens: Array.isArray(it.allergens) ? it.allergens : [],
              diet_tags: Array.isArray(it.diet_tags) ? it.diet_tags : [],
              variants: Array.isArray(it.variants) ? it.variants : [],
              options: Array.isArray(it.options) ? it.options : [],
              availability:
                it.availability && typeof it.availability === 'object' ? it.availability : {},
            }))
            .sort(byOrder),
        })),
    }));
}
