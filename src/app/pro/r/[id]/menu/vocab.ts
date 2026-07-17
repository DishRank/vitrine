/**
 * Vocabulaire allergènes (14 INCO) + régimes, libellés FR. Copie client-safe de
 * MENU_UI.fr côté '@/lib/menu' (qui importe next/cache → server-only, on ne peut
 * pas l'importer dans un composant client). Les CLÉS doivent rester identiques
 * (contrainte CHECK allergens + rendu de la page publique).
 */
export const ALLERGENS: { key: string; label: string }[] = [
  { key: 'gluten', label: 'Gluten' },
  { key: 'crustaces', label: 'Crustacés' },
  { key: 'oeufs', label: 'Œufs' },
  { key: 'poissons', label: 'Poissons' },
  { key: 'arachides', label: 'Arachides' },
  { key: 'soja', label: 'Soja' },
  { key: 'lait', label: 'Lait' },
  { key: 'fruits_coque', label: 'Fruits à coque' },
  { key: 'celeri', label: 'Céleri' },
  { key: 'moutarde', label: 'Moutarde' },
  { key: 'sesame', label: 'Sésame' },
  { key: 'sulfites', label: 'Sulfites' },
  { key: 'lupin', label: 'Lupin' },
  { key: 'mollusques', label: 'Mollusques' },
];

export const DIETS: { key: string; label: string }[] = [
  { key: 'vegetarien', label: 'Végétarien' },
  { key: 'vegan', label: 'Vegan' },
  { key: 'halal', label: 'Halal' },
  { key: 'casher', label: 'Casher' },
  { key: 'sans_gluten', label: 'Sans gluten' },
  { key: 'sans_lactose', label: 'Sans lactose' },
  { key: 'bio', label: 'Bio' },
  { key: 'fait_maison', label: 'Fait maison' },
  { key: 'de_saison', label: 'De saison' },
  { key: 'local', label: 'Local' },
  { key: 'epice', label: 'Épicé' },
  { key: 'nouveau', label: 'Nouveau' },
];

export const ALLERGEN_LABEL: Record<string, string> = Object.fromEntries(ALLERGENS.map((a) => [a.key, a.label]));
export const DIET_LABEL: Record<string, string> = Object.fromEntries(DIETS.map((d) => [d.key, d.label]));

export function formatPrice(price: number | null, currency = 'EUR'): string {
  if (price == null) return '';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(price);
}
