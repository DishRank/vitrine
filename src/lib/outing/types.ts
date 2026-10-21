/**
 * Sorties v2 — copie EXACTE de `hooks/outings/types.ts` de l'app (migration 202,
 * RPC `get_shared_outing` / `outing_guest_join` / `outing_guest_toggle`).
 * Garder les deux fichiers alignés : c'est le contrat JSON partagé app ↔ site.
 *
 * Sur la page publique, `group.id`, `members[].id` et `share_token` valent null
 * et les noms sont réduits au prénom.
 */

export type OutingCategory = 'eat' | 'drink' | 'coffee';
export type OutingStatus = 'waiting' | 'active' | 'decided' | 'abandoned' | 'expired';

export type OutingDish = {
  name: string;
  /** Prix moyen payé (avis) ou prix de la carte. */
  price: number | null;
  /** Moyenne brute des avis sur ce plat (null pour un plat de la carte). */
  rating: number | null;
  reviews: number;
  photo_url: string | null;
  /** `review` : plat noté sur DishRank ; `menu` : plat lu sur la carte publiée. */
  source: 'review' | 'menu';
};

export type OutingVoter = {
  name: string | null;
  avatar_url: string | null;
  kind: 'member' | 'guest';
};

export type OutingCandidate = {
  id: string;
  /** Rang dans la réserve (1 = meilleure proposition). */
  rank: number;
  /** `top` : 5 propositions ; `added` : ajouté par un membre ; `more` : autres idées. */
  section: 'top' | 'added' | 'more';
  added_by: string | null;
  name: string;
  address: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  /** Distance au centre de la sortie, en km. */
  distance_km: number | null;
  place_type: 'restaurant' | 'bar' | 'cafe';
  cuisines: string[];
  photo_url: string | null;
  /** Référence photo Google (à passer à getRestaurantPhotoUri). */
  photo_ref: string | null;
  google_place_id: string | null;
  phone: string | null;
  website: string | null;
  reservation_url: string | null;
  menu_url: string | null;
  opening_hours_raw: string | null;
  /** Ouvert à l'heure prévue : true / false / null (inconnu). */
  open_at_planned: boolean | null;
  has_menu: boolean;
  /** Prix médian des plats de la carte (5–60 €), null sans carte. */
  price_median: number | null;
  dishes: OutingDish[];
  approvals: number;
  approvers: OutingVoter[];
  /** La personne qui regarde (membre ou invité) a coché ce lieu. */
  mine: boolean;
};

export type OutingMember = {
  /** null sur la page publique. */
  id: string | null;
  name: string | null;
  avatar_url: string | null;
  voted: boolean;
  is_me: boolean;
};

export type OutingGuest = {
  name: string;
  voted: boolean;
  is_me: boolean;
};

export type OutingWinner = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  website: string | null;
  reservation_url: string | null;
  menu_url: string | null;
  photo_url: string | null;
  photo_ref: string | null;
  google_place_id: string | null;
  approvals: number;
  dishes: OutingDish[];
};

export type Outing = {
  id: string;
  flow: 'v1' | 'v2';
  status: OutingStatus;
  category: OutingCategory | null;
  planned_at: string | null;
  vote_deadline: string | null;
  decided_at: string | null;
  winner_id: string | null;
  /** `from_group` : centre recalculé au milieu des domiciles des membres. */
  center: { lat: number; lng: number; label: string | null; from_group: boolean };
  /** `id` null sur la page publique. */
  group: { id: string | null; name: string; emoji: string | null };
  is_initiator: boolean;
  initiator_name: string | null;
  /** Jeton du lien de vote sans compte (membres seulement ; null en public). */
  share_token: string | null;
  members: OutingMember[];
  guests: OutingGuest[];
  candidates: OutingCandidate[];
  winner: OutingWinner | null;
};

/** Réponse de `outing_guest_join` (page web). */
export type OutingGuestSession = {
  guest_id: string;
  guest_secret: string;
  outing: Outing;
};

