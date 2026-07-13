/**
 * Taxonomie « types de cuisine » de l'espace pro — miroir web des entrées
 * `group === 'cuisine'` de l'app (dishrank/constants/categories.ts). Les slugs
 * DOIVENT rester identiques à ceux stockés dans `restaurants.cuisines` (text[])
 * pour que la fiche web et l'app parlent le même vocabulaire.
 *
 * `icon` = l'emoji exact de l'app. Note : sur Chrome/Windows les emoji drapeau
 * s'affichent en 2 lettres (ex. « FR ») faute de police drapeau — le libellé
 * reste toujours visible à côté, donc pas de perte d'info.
 */
export interface Cuisine {
  slug: string;
  icon: string;
  name: string;
}

export const CUISINES: Cuisine[] = [
  { slug: 'french', icon: '🇫🇷', name: 'Français' },
  { slug: 'italian', icon: '🇮🇹', name: 'Italien' },
  { slug: 'japanese', icon: '🇯🇵', name: 'Japonais' },
  { slug: 'chinese', icon: '🇨🇳', name: 'Chinois' },
  { slug: 'thai', icon: '🇹🇭', name: 'Thaï' },
  { slug: 'indian', icon: '🇮🇳', name: 'Indien' },
  { slug: 'mexican', icon: '🇲🇽', name: 'Mexicain' },
  { slug: 'lebanese', icon: '🇱🇧', name: 'Libanais' },
  { slug: 'korean', icon: '🇰🇷', name: 'Coréen' },
  { slug: 'vietnamese', icon: '🇻🇳', name: 'Vietnamien' },
  { slug: 'turkish', icon: '🇹🇷', name: 'Turc' },
  { slug: 'greek', icon: '🇬🇷', name: 'Grec' },
  { slug: 'moroccan', icon: '🇲🇦', name: 'Marocain' },
  { slug: 'ethiopian', icon: '🇪🇹', name: 'Éthiopien' },
  { slug: 'peruvian', icon: '🇵🇪', name: 'Péruvien' },
  { slug: 'american', icon: '🇺🇸', name: 'Américain' },
  { slug: 'african', icon: '🌍', name: 'Africain' },
  { slug: 'caribbean', icon: '🏝️', name: 'Antillais' },
  { slug: 'spanish', icon: '🇪🇸', name: 'Espagnol' },
  { slug: 'brazilian', icon: '🇧🇷', name: 'Brésilien' },
  { slug: 'pakistani', icon: '🇵🇰', name: 'Pakistanais' },
  { slug: 'filipino', icon: '🇵🇭', name: 'Philippin' },
  { slug: 'sri-lankan', icon: '🇱🇰', name: 'Sri-lankais' },
  { slug: 'canadian', icon: '🇨🇦', name: 'Canadien' },
  { slug: 'portuguese', icon: '🇵🇹', name: 'Portugais' },
  { slug: 'russian', icon: '🇷🇺', name: 'Russe' },
  { slug: 'polish', icon: '🇵🇱', name: 'Polonais' },
  { slug: 'indonesian', icon: '🇮🇩', name: 'Indonésien' },
  { slug: 'tibetan', icon: '🏔️', name: 'Tibétain' },
  { slug: 'algerian', icon: '🇩🇿', name: 'Algérien' },
  { slug: 'tunisian', icon: '🇹🇳', name: 'Tunisien' },
  { slug: 'israeli', icon: '🇮🇱', name: 'Israélien' },
  { slug: 'argentinian', icon: '🇦🇷', name: 'Argentin' },
  { slug: 'colombian', icon: '🇨🇴', name: 'Colombien' },
  { slug: 'hawaiian', icon: '🌺', name: 'Hawaïen' },
  { slug: 'malaysian', icon: '🇲🇾', name: 'Malaisien' },
  { slug: 'iranian', icon: '🇮🇷', name: 'Iranien' },
  { slug: 'jamaican', icon: '🇯🇲', name: 'Jamaïcain' },
  { slug: 'senegalese', icon: '🇸🇳', name: 'Sénégalais' },
  { slug: 'reunion', icon: '🇷🇪', name: 'Réunionnais' },
  { slug: 'creole', icon: '🌴', name: 'Créole' },
  { slug: 'asian', icon: '🥢', name: 'Asiatique' },
  { slug: 'mediterranean', icon: '🫒', name: 'Méditerranéen' },
  { slug: 'cajun', icon: '🌶️', name: 'Cajun' },
  { slug: 'tex-mex', icon: '🌮', name: 'Tex-Mex' },
  { slug: 'sichuan', icon: '🌶️', name: 'Sichuan' },
  { slug: 'cantonese', icon: '🥟', name: 'Cantonais' },
  { slug: 'german', icon: '🇩🇪', name: 'Allemand' },
  { slug: 'british', icon: '🇬🇧', name: 'Britannique' },
  { slug: 'egyptian', icon: '🇪🇬', name: 'Égyptien' },
  { slug: 'cambodian', icon: '🇰🇭', name: 'Cambodgien' },
  { slug: 'laotian', icon: '🇱🇦', name: 'Laotien' },
  { slug: 'nepali', icon: '🇳🇵', name: 'Népalais' },
  { slug: 'kurdish', icon: '☀️', name: 'Kurde' },
  { slug: 'afghan', icon: '🇦🇫', name: 'Afghan' },
  { slug: 'congolese', icon: '🇨🇩', name: 'Congolais' },
  { slug: 'ivorian', icon: '🇨🇮', name: 'Ivoirien' },
];

export const CUISINE_BY_SLUG = new Map(CUISINES.map((c) => [c.slug, c]));

/** Slugs valides — pour filtrer côté serveur ce que le formulaire envoie. */
export const CUISINE_SLUGS = new Set(CUISINES.map((c) => c.slug));

/** Retire les accents/casse pour une recherche tolérante. */
function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** Recherche par nom OU slug, insensible aux accents/casse. */
export function searchCuisines(query: string, exclude: Set<string>): Cuisine[] {
  const q = normalize(query);
  return CUISINES.filter((c) => {
    if (exclude.has(c.slug)) return false;
    if (!q) return true;
    return normalize(c.name).includes(q) || c.slug.includes(q);
  });
}
