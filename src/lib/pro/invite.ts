/**
 * Lien personnel « tableau des allergènes » (mig. 196).
 *
 * Un restaurant dont la carte a été relevée reçoit par email un lien
 * /pro/allergenes/<jeton>. Le jeton (32 caractères base64url, 192 bits) est la
 * seule clé : il n'est stocké en base que sous forme de haché, et toutes les
 * lectures/écritures passent par des RPC SECURITY DEFINER qui le vérifient.
 *
 * Fichier client-safe (types + constantes) : importé par la page serveur, les
 * Server Actions et le composant client.
 */

export const INVITE_TOKEN_RE = /^[A-Za-z0-9_-]{32}$/;

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Clés INCO, identiques à la contrainte CHECK de menu_items.allergens. */
export const ALLERGEN_KEYS = [
  'gluten',
  'crustaces',
  'oeufs',
  'poissons',
  'arachides',
  'soja',
  'lait',
  'fruits_coque',
  'celeri',
  'moutarde',
  'sesame',
  'sulfites',
  'lupin',
  'mollusques',
] as const;

export type AllergenKey = (typeof ALLERGEN_KEYS)[number];

export function isAllergenKey(v: unknown): v is AllergenKey {
  return typeof v === 'string' && (ALLERGEN_KEYS as readonly string[]).includes(v);
}

/** Abréviations des colonnes du tableau imprimé (14 colonnes sur un A4 paysage). */
export const ALLERGEN_SHORT: Record<AllergenKey, string> = {
  gluten: 'Gluten',
  crustaces: 'Crustacés',
  oeufs: 'Œufs',
  poissons: 'Poissons',
  arachides: 'Arachides',
  soja: 'Soja',
  lait: 'Lait',
  fruits_coque: 'Fruits à coque',
  celeri: 'Céleri',
  moutarde: 'Moutarde',
  sesame: 'Sésame',
  sulfites: 'Sulfites',
  lupin: 'Lupin',
  mollusques: 'Mollusques',
};

export interface InviteSuggestion {
  allergen: AllergenKey;
  /** Mots du nom/de la description qui ont déclenché la suggestion. */
  reasons: string[];
}

export interface InviteDraft {
  allergens: AllergenKey[];
  confirmed: boolean;
  /** Ligne relevée qui n'est pas un plat : écartée du tableau par le restaurateur. */
  excluded?: boolean;
  at: string;
}

export interface InviteItem {
  id: string;
  section: string | null;
  name: string;
  description: string | null;
  price: number | null;
  /** Allergènes déjà publiés sur la carte (vide pour une carte relevée). */
  published: AllergenKey[];
  suggested: InviteSuggestion[];
  draft: InviteDraft | null;
}

export interface InvitePayload {
  restaurant: {
    id: string;
    name: string;
    address: string | null;
    postal_code: string | null;
    city: string | null;
    claimed: boolean;
    is_owner: boolean;
  };
  menu: { source: 'owner' | 'scraped' | 'photo'; captured_at: string | null; name: string | null } | null;
  items: InviteItem[];
  confirmed_count: number;
  applied_at: string | null;
  contact_opt_out: boolean;
  menu_removed: boolean;
}
