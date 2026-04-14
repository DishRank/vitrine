/**
 * French grammar helpers for category labels.
 *
 * Background: category slugs are stored in English in the DB (`burger`,
 * `pizza`, `pasta`…). When we render them in French via
 * `localizedCategory(slug, 'fr')`, we get `burger` / `pizza` / `pâtes` / etc.
 *
 * Problem: French needs gender and number agreement. "Le meilleur burger" is
 * correct but "Le meilleur pizza" is wrong (pizza is feminine → "la meilleure
 * pizza"). "Le meilleur pâtes" is double-wrong (feminine plural → "les
 * meilleures pâtes"). We need to know the gender+number of each category to
 * build grammatically correct sentences for the Hero, CityGuide, meta title,
 * etc.
 *
 * Design: a map from English slug → { gender, number } for every category
 * present in `categoryLabels.ts`, plus helper functions that output the
 * correct articles and adjectives given this grammar info.
 */

type Gender = 'm' | 'f';
type Number = 's' | 'p';
export type Grammar = { g: Gender; n: Number };

/**
 * Grammar data for every category slug (FR only — other languages either
 * don't have grammatical gender in adjectives or handle it differently).
 *
 * Default when a slug is missing from this map: masculine singular (safe
 * fallback, works for most new categories that are loanwords like "burger",
 * "wok", "bao", etc.).
 */
const FR_GRAMMAR: Record<string, Grammar> = {
  // === Core dishes ===
  burger: { g: 'm', n: 's' },
  pizza: { g: 'f', n: 's' },
  sushi: { g: 'm', n: 's' }, // usage flottant, on garde masc sing
  pasta: { g: 'f', n: 'p' }, // pâtes → fem pluriel
  salad: { g: 'f', n: 's' }, // salade
  steak: { g: 'm', n: 's' },
  seafood: { g: 'm', n: 'p' }, // fruits de mer
  soup: { g: 'f', n: 's' }, // soupe
  sandwich: { g: 'm', n: 's' },
  tacos: { g: 'm', n: 'p' },
  ramen: { g: 'm', n: 's' }, // "un ramen"
  pho: { g: 'm', n: 's' }, // "un phở"
  curry: { g: 'm', n: 's' },
  dessert: { g: 'm', n: 's' },
  'ice-cream': { g: 'f', n: 's' }, // glace
  coffee: { g: 'm', n: 's' }, // café
  cocktail: { g: 'm', n: 's' },
  breakfast: { g: 'm', n: 's' }, // petit-déjeuner
  bbq: { g: 'm', n: 's' }, // barbecue
  vegan: { g: 'm', n: 's' },
  chicken: { g: 'm', n: 's' }, // poulet
  fish: { g: 'm', n: 's' }, // poisson
  burrito: { g: 'm', n: 's' },
  kebab: { g: 'm', n: 's' },
  falafel: { g: 'm', n: 's' },
  bowl: { g: 'm', n: 's' },
  'dim-sum': { g: 'm', n: 's' },
  'pad-thai': { g: 'm', n: 's' }, // "un pad thaï"
  bibimbap: { g: 'm', n: 's' },
  wok: { g: 'm', n: 's' },
  teppanyaki: { g: 'm', n: 's' },
  gratin: { g: 'm', n: 's' },
  risotto: { g: 'm', n: 's' },
  raclette: { g: 'f', n: 's' },
  fondue: { g: 'f', n: 's' },
  crepes: { g: 'f', n: 'p' }, // crêpes
  brunch: { g: 'm', n: 's' },
  eggs: { g: 'm', n: 'p' }, // œufs
  pastry: { g: 'f', n: 's' }, // viennoiserie
  chocolate: { g: 'm', n: 's' }, // chocolat
  patisserie: { g: 'f', n: 's' }, // pâtisserie
  waffle: { g: 'f', n: 's' }, // gaufre
  cookie: { g: 'm', n: 's' },
  donut: { g: 'm', n: 's' },
  tea: { g: 'm', n: 's' }, // thé
  smoothie: { g: 'm', n: 's' },
  'bubble-tea': { g: 'm', n: 's' },
  juice: { g: 'm', n: 's' }, // jus
  beer: { g: 'f', n: 's' }, // bière
  wine: { g: 'm', n: 's' }, // vin
  vegetarian: { g: 'm', n: 's' },
  'gluten-free': { g: 'm', n: 's' },
  halal: { g: 'm', n: 's' },
  kosher: { g: 'm', n: 's' }, // casher (masc)
  organic: { g: 'm', n: 's' }, // bio
  healthy: { g: 'm', n: 's' },
  keto: { g: 'm', n: 's' },

  // === Cuisines nationales (masc sing par défaut, "un restaurant [X]") ===
  french: { g: 'm', n: 's' },
  italian: { g: 'm', n: 's' },
  japanese: { g: 'm', n: 's' },
  chinese: { g: 'm', n: 's' },
  thai: { g: 'm', n: 's' },
  indian: { g: 'm', n: 's' },
  mexican: { g: 'm', n: 's' },
  lebanese: { g: 'm', n: 's' },
  korean: { g: 'm', n: 's' },
  vietnamese: { g: 'm', n: 's' },
  turkish: { g: 'm', n: 's' },
  greek: { g: 'm', n: 's' },
  moroccan: { g: 'm', n: 's' },
  ethiopian: { g: 'm', n: 's' },
  peruvian: { g: 'm', n: 's' },
  american: { g: 'm', n: 's' },
  african: { g: 'm', n: 's' },
  caribbean: { g: 'm', n: 's' },
  algerian: { g: 'm', n: 's' },
  argentinian: { g: 'm', n: 's' },
  brazilian: { g: 'm', n: 's' },
  canadian: { g: 'm', n: 's' },
  colombian: { g: 'm', n: 's' },
  creole: { g: 'm', n: 's' },
  filipino: { g: 'm', n: 's' },
  hawaiian: { g: 'm', n: 's' },
  indonesian: { g: 'm', n: 's' },
  iranian: { g: 'm', n: 's' },
  israeli: { g: 'm', n: 's' },
  jamaican: { g: 'm', n: 's' },
  malaysian: { g: 'm', n: 's' },
  pakistani: { g: 'm', n: 's' },
  polish: { g: 'm', n: 's' },
  portuguese: { g: 'm', n: 's' },
  reunion: { g: 'm', n: 's' },
  russian: { g: 'm', n: 's' },
  senegalese: { g: 'm', n: 's' },
  spanish: { g: 'm', n: 's' },
  'sri-lankan': { g: 'm', n: 's' },
  tibetan: { g: 'm', n: 's' },
  tunisian: { g: 'm', n: 's' },
  welsh: { g: 'm', n: 's' },
  asian: { g: 'm', n: 's' },
  german: { g: 'm', n: 's' },
  british: { g: 'm', n: 's' },
  egyptian: { g: 'm', n: 's' },
  cambodian: { g: 'm', n: 's' },
  laotian: { g: 'm', n: 's' },
  nepali: { g: 'm', n: 's' },
  kurdish: { g: 'm', n: 's' },
  afghan: { g: 'm', n: 's' },
  congolese: { g: 'm', n: 's' },
  ivorian: { g: 'm', n: 's' },

  // === Food types (generic) ===
  meat: { g: 'f', n: 's' }, // viande
  cheese: { g: 'm', n: 's' }, // fromage
  duck: { g: 'm', n: 's' }, // canard
  lamb: { g: 'm', n: 's' }, // agneau
  rice: { g: 'm', n: 's' }, // riz
  noodles: { g: 'f', n: 'p' }, // nouilles

  // === Burgers/meat variants ===
  'smash-burger': { g: 'm', n: 's' },
  brisket: { g: 'm', n: 's' },
  ribs: { g: 'm', n: 'p' }, // travers de porc
  'pulled-pork': { g: 'm', n: 's' }, // porc effiloché
  'fried-chicken': { g: 'm', n: 's' },
  wings: { g: 'f', n: 'p' }, // ailes
  'cordon-bleu': { g: 'm', n: 's' },
  schnitzel: { g: 'm', n: 's' },
  tartare: { g: 'm', n: 's' },
  carpaccio: { g: 'm', n: 's' },
  'filet-mignon': { g: 'm', n: 's' },
  entrecote: { g: 'f', n: 's' }, // entrecôte
  magret: { g: 'm', n: 's' },
  'confit-canard': { g: 'm', n: 's' },
  'foie-gras': { g: 'm', n: 's' },
  'souris-agneau': { g: 'f', n: 's' }, // souris d'agneau
  pierrade: { g: 'f', n: 's' },
  plancha: { g: 'f', n: 's' },
  charcuterie: { g: 'f', n: 's' },
  andouillette: { g: 'f', n: 's' },

  // === French traditional ===
  'boeuf-bourguignon': { g: 'm', n: 's' },
  'pot-au-feu': { g: 'm', n: 's' },
  blanquette: { g: 'f', n: 's' },
  cassoulet: { g: 'm', n: 's' },
  ratatouille: { g: 'f', n: 's' },
  bouillabaisse: { g: 'f', n: 's' },
  'moules-frites': { g: 'f', n: 'p' }, // moules frites
  carbonnade: { g: 'f', n: 's' },
  choucroute: { g: 'f', n: 's' },
  flammekueche: { g: 'f', n: 's' },
  tartiflette: { g: 'f', n: 's' },
  'gratin-dauphinois': { g: 'm', n: 's' },
  aligot: { g: 'm', n: 's' },
  galette: { g: 'f', n: 's' },
  socca: { g: 'f', n: 's' },
  pissaladiere: { g: 'f', n: 's' },
  'salade-lyonnaise': { g: 'f', n: 's' },
  'cervelle-canut': { g: 'f', n: 's' },
  'tablier-sapeur': { g: 'm', n: 's' },
  quenelle: { g: 'f', n: 's' },
  'croque-monsieur': { g: 'm', n: 's' },
  escargot: { g: 'm', n: 'p' }, // escargots
  croissant: { g: 'm', n: 's' },
  quiche: { g: 'f', n: 's' },
  tarte: { g: 'f', n: 's' },
  'tarte-tatin': { g: 'f', n: 's' },
  'creme-brulee': { g: 'f', n: 's' },
  souffle: { g: 'm', n: 's' },
  cheesecake: { g: 'm', n: 's' },
  tiramisu: { g: 'm', n: 's' },
  churros: { g: 'm', n: 'p' },

  // === Italian dishes ===
  lasagna: { g: 'f', n: 'p' }, // lasagnes
  gnocchi: { g: 'm', n: 'p' }, // gnocchis
  bruschetta: { g: 'f', n: 's' },
  panini: { g: 'm', n: 's' },
  'osso-buco': { g: 'm', n: 's' },
  'vitello-tonnato': { g: 'm', n: 's' },

  // === Spanish/Latin ===
  paella: { g: 'f', n: 's' },
  croquetas: { g: 'f', n: 'p' },
  ceviche: { g: 'm', n: 's' },
  empanadas: { g: 'f', n: 'p' },
  arepas: { g: 'f', n: 'p' },
  feijoada: { g: 'f', n: 's' },
  poutine: { g: 'f', n: 's' },

  // === Japanese ===
  sashimi: { g: 'm', n: 's' },
  maki: { g: 'm', n: 's' },
  chirashi: { g: 'm', n: 's' },
  'california-roll': { g: 'm', n: 's' },
  onigiri: { g: 'm', n: 's' },
  donburi: { g: 'm', n: 's' },
  katsu: { g: 'm', n: 's' },
  tempura: { g: 'f', n: 's' }, // "une tempura"
  yakitori: { g: 'm', n: 's' },
  takoyaki: { g: 'm', n: 's' },
  okonomiyaki: { g: 'm', n: 's' },
  teriyaki: { g: 'm', n: 's' },
  tataki: { g: 'm', n: 's' },
  udon: { g: 'm', n: 's' }, // "un udon"
  gyoza: { g: 'm', n: 's' }, // "un gyoza"
  matcha: { g: 'm', n: 's' }, // "un matcha"
  mochi: { g: 'm', n: 's' },
  sake: { g: 'm', n: 's' }, // saké

  // === Chinese/Asian ===
  bao: { g: 'm', n: 's' },
  dumpling: { g: 'm', n: 's' }, // "un dumpling" / "un ravioli"
  'spring-rolls': { g: 'm', n: 'p' }, // rouleaux de printemps

  // === Vietnamese ===
  'banh-mi': { g: 'm', n: 's' },
  'pho-bo': { g: 'm', n: 's' },

  // === Thai ===
  'tom-yum': { g: 'm', n: 's' },

  // === Korean ===
  'tikka-masala': { g: 'm', n: 's' }, // (indien mais bon)

  // === Indian ===
  biryani: { g: 'm', n: 's' },
  samosa: { g: 'm', n: 's' }, // "un samoussa"
  daal: { g: 'm', n: 's' },

  // === Indonesian ===
  rendang: { g: 'm', n: 's' },
  'nasi-goreng': { g: 'm', n: 's' },

  // === Middle-East / North Africa ===
  shawarma: { g: 'm', n: 's' },
  hummus: { g: 'm', n: 's' }, // houmous
  tajine: { g: 'm', n: 's' }, // "un tajine"

  // === Mediterranean / Greek ===
  moussaka: { g: 'f', n: 's' },
  gyros: { g: 'm', n: 's' },

  // === Eastern Europe ===
  pierogi: { g: 'm', n: 'p' },
  pretzel: { g: 'm', n: 's' }, // bretzel

  // === Caribbean ===
  'jerk-chicken': { g: 'm', n: 's' },
  'piri-piri': { g: 'm', n: 's' },

  // === Pacific ===
  poke: { g: 'm', n: 's' }, // "un poke"

  // === Snacks / fast food ===
  wrap: { g: 'm', n: 's' },
  'corn-dog': { g: 'm', n: 's' },
  'hot-chocolate': { g: 'm', n: 's' },
  pancake: { g: 'm', n: 's' },
  omelette: { g: 'f', n: 's' },
  porridge: { g: 'm', n: 's' },
  granola: { g: 'm', n: 's' },
  acai: { g: 'm', n: 's' },

  // === Beverages ===
  cider: { g: 'm', n: 's' }, // cidre
  lemonade: { g: 'f', n: 's' }, // limonade
  milkshake: { g: 'm', n: 's' },
  kombucha: { g: 'm', n: 's' },

  // === Street food / misc ===
  fries: { g: 'f', n: 'p' }, // frites
  nuggets: { g: 'm', n: 'p' },
  'hot-dog': { g: 'm', n: 's' },
  naan: { g: 'm', n: 's' },
  tapas: { g: 'f', n: 'p' },
  'fried-rice': { g: 'm', n: 's' }, // riz cantonais
  'street-food': { g: 'f', n: 's' },
  couscous: { g: 'm', n: 's' },
  chili: { g: 'm', n: 's' },
};

/** Returns the grammar info for a slug, defaulting to masculine singular. */
export function grammarFor(slug: string): Grammar {
  return FR_GRAMMAR[slug] ?? { g: 'm', n: 's' };
}

/**
 * Slugs de cuisines nationales / origines culturelles.
 * Pour ces slugs, le label n'est PAS un plat mais un adjectif de nationalite
 * (francais, italien, chinois...). Il faut donc composer avec "plats" / "dishes"
 * dans les titres : "Les 10 meilleurs plats francais" plutot que "Les 10
 * meilleurs francais".
 */
const NATIONALITY_SLUGS = new Set<string>([
  'french', 'italian', 'japanese', 'chinese', 'thai', 'indian', 'mexican',
  'lebanese', 'korean', 'vietnamese', 'turkish', 'greek', 'moroccan',
  'ethiopian', 'peruvian', 'american', 'african', 'caribbean',
  'algerian', 'argentinian', 'brazilian', 'canadian', 'colombian', 'creole',
  'filipino', 'hawaiian', 'indonesian', 'iranian', 'israeli', 'jamaican',
  'malaysian', 'pakistani', 'polish', 'portuguese', 'reunion', 'russian',
  'senegalese', 'spanish', 'sri-lankan', 'tibetan', 'tunisian', 'welsh',
  'asian', 'german', 'british', 'egyptian', 'cambodian', 'laotian',
  'nepali', 'kurdish', 'afghan', 'congolese', 'ivorian',
]);

export function isNationality(slug: string): boolean {
  return NATIONALITY_SLUGS.has(slug);
}

// ============================================================================
// Helpers that build agreement-correct French fragments.
// All helpers assume the caller already has the LOCALIZED label (e.g. "pizza",
// "pâtes", "ramen") and just need the correct article + adjective.
// ============================================================================

/**
 * Returns "le meilleur" / "la meilleure" / "les meilleurs" / "les meilleures".
 */
export function bestArticle(slug: string): string {
  const { g, n } = grammarFor(slug);
  if (n === 'p') return g === 'f' ? 'les meilleures' : 'les meilleurs';
  return g === 'f' ? 'la meilleure' : 'le meilleur';
}

/**
 * Returns "le meilleur pizza" → "la meilleure pizza" → "les meilleures pâtes"
 * Used in H1s, meta titles, CityGuide intro…
 */
export function theBestOf(slug: string, label: string): string {
  return `${bestArticle(slug)} ${label}`;
}

/** "un" / "une" / "des" */
export function indefArticle(slug: string): string {
  const { g, n } = grammarFor(slug);
  if (n === 'p') return 'des';
  return g === 'f' ? 'une' : 'un';
}

/** "un burger" / "une pizza" / "des pâtes" */
export function aOf(slug: string, label: string): string {
  return `${indefArticle(slug)} ${label}`;
}

/** "ce burger" / "cette pizza" / "ces pâtes" */
export function thisOf(slug: string, label: string): string {
  const { g, n } = grammarFor(slug);
  if (n === 'p') return `ces ${label}`;
  return g === 'f' ? `cette ${label}` : `ce ${label}`;
}

/** "du" / "de la" / "des" — partitive article, e.g. "où manger du burger / des pâtes" */
export function partitiveOf(slug: string, label: string): string {
  const { g, n } = grammarFor(slug);
  if (n === 'p') return `des ${label}`;
  return g === 'f' ? `de la ${label}` : `du ${label}`;
}

/** "du meilleur" / "de la meilleure" / "des meilleurs" / "des meilleures" */
export function ofBestArticle(slug: string): string {
  const { g, n } = grammarFor(slug);
  if (n === 'p') return g === 'f' ? 'des meilleures' : 'des meilleurs';
  return g === 'f' ? 'de la meilleure' : 'du meilleur';
}

/**
 * Verb agreement for "to be rated": "a été noté" / "a été notée" / "ont été
 * notés" / "ont été notées".
 */
export function beenRated(slug: string): string {
  const { g, n } = grammarFor(slug);
  if (n === 'p') return g === 'f' ? 'ont été notées' : 'ont été notés';
  return g === 'f' ? 'a été notée' : 'a été noté';
}

/** "bon" / "bonne" / "bons" / "bonnes" */
export function goodAdj(slug: string): string {
  const { g, n } = grammarFor(slug);
  if (n === 'p') return g === 'f' ? 'bonnes' : 'bons';
  return g === 'f' ? 'bonne' : 'bon';
}

/** "un bon burger" / "une bonne pizza" / "de bonnes pâtes" */
export function aGoodOf(slug: string, label: string): string {
  const { g, n } = grammarFor(slug);
  if (n === 'p') return `de ${g === 'f' ? 'bonnes' : 'bons'} ${label}`;
  return `${g === 'f' ? 'une bonne' : 'un bon'} ${label}`;
}

/** "noté" / "notée" / "notés" / "notées" */
export function ratedAdj(slug: string): string {
  const { g, n } = grammarFor(slug);
  if (n === 'p') return g === 'f' ? 'notées' : 'notés';
  return g === 'f' ? 'notée' : 'noté';
}

/** "vendu" / "vendue" / "vendus" / "vendues" */
export function soldAdj(slug: string): string {
  const { g, n } = grammarFor(slug);
  if (n === 'p') return g === 'f' ? 'vendues' : 'vendus';
  return g === 'f' ? 'vendue' : 'vendu';
}

/** Returns "is" / "are" in French (est / sont) */
export function isOrAre(slug: string): string {
  const { n } = grammarFor(slug);
  return n === 'p' ? 'sont' : 'est';
}
