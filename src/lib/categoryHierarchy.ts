/**
 * Category hierarchy (DAG: parent → direct children).
 *
 * Shared exactly between mobile app and vitrine — keep this file in sync with
 * `vitrine/src/lib/categoryHierarchy.ts`.
 *
 * Covers every slug present in the `dish_categories` table. Structured in
 * three layers:
 *   1. Continental  (asian, african, european, latin-american, middle-eastern)
 *   2. National     (french, italian, japanese, mexican, american, …)
 *   3. Dish / ingredient / style (burger, steak, pasta, street-food, drinks, …)
 *
 * Filtering by any parent expands transitively to every descendant, so
 * filtering by `asian` returns sushi, ramen, tacos's-not-asian-nvm, bibimbap,
 * pad-thai, pho, …; filtering by `european` returns french/italian/… dishes.
 *
 * Rules:
 *   - A child may have multiple parents (DAG, not a tree).
 *   - `expandCategorySlug(slug)` walks the DAG breadth-first with a visited
 *     set, so cycles (if ever introduced) can't infinite-loop.
 *   - Dietary tags (halal, keto, kosher, organic, gluten-free) are NOT
 *     parented — they're orthogonal tags, not hierarchical categories.
 */

const CATEGORY_CHILDREN: Record<string, readonly string[]> = {
  // ═══════════════════════════════════════════════════════════════
  // 1. CONTINENTAL / MACRO-REGIONAL
  // ═══════════════════════════════════════════════════════════════
  asian: [
    'japanese', 'chinese', 'korean', 'thai', 'vietnamese', 'indonesian',
    'indian', 'pakistani', 'sri-lankan', 'nepali', 'tibetan', 'filipino',
    'malaysian', 'cambodian', 'laotian',
  ],
  'middle-eastern': [
    'lebanese', 'turkish', 'iranian', 'israeli', 'kurdish', 'afghan',
  ],
  african: [
    'moroccan', 'tunisian', 'egyptian', 'algerian', 'ethiopian',
    'senegalese', 'congolese', 'ivorian',
  ],
  european: [
    'french', 'italian', 'spanish', 'portuguese', 'german', 'british',
    'greek', 'polish', 'russian',
  ],
  'latin-american': [
    'mexican', 'brazilian', 'peruvian', 'argentinian', 'colombian',
  ],
  'north-american': ['american', 'canadian'],
  caribbean: ['jamaican'],

  // ═══════════════════════════════════════════════════════════════
  // 2. NATIONAL CUISINES → their dishes
  // ═══════════════════════════════════════════════════════════════
  french: [
    'tartiflette', 'raclette', 'fondue', 'flammekueche', 'quiche',
    'ratatouille', 'bouillabaisse', 'blanquette', 'cassoulet', 'pot-au-feu',
    'escargot', 'salade-lyonnaise', 'cervelle-canut', 'tablier-sapeur',
    'andouillette', 'quenelle', 'boeuf-bourguignon', 'confit-canard',
    'pissaladiere', 'socca', 'galette', 'magret', 'carbonnade',
    'choucroute', 'entrecote', 'filet-mignon', 'souris-agneau', 'foie-gras',
    'croque-monsieur', 'tarte-tatin', 'creme-brulee', 'souffle', 'crepes',
    'pierrade', 'aligot', 'gratin', 'gratin-dauphinois', 'moules-frites',
    'charcuterie', 'tartare', 'reunion', 'creole', 'fries',
  ],
  italian: [
    'pizza', 'pasta', 'lasagna', 'gnocchi', 'risotto', 'panini',
    'tiramisu', 'bruschetta', 'carpaccio', 'osso-buco', 'vitello-tonnato',
  ],
  spanish: [
    'paella', 'tapas', 'croquetas', 'churros', 'plancha',
  ],
  portuguese: ['piri-piri'],
  german: ['schnitzel', 'pretzel'],
  british: [], // No dedicated British dishes in DB (yet).
  greek: ['moussaka', 'gyros'],
  polish: ['pierogi'],
  russian: [],

  japanese: [
    'sushi', 'ramen', 'udon', 'sashimi', 'maki', 'chirashi', 'california-roll',
    'onigiri', 'donburi', 'katsu', 'tempura', 'yakitori', 'takoyaki',
    'okonomiyaki', 'teriyaki', 'tataki', 'gyoza', 'matcha', 'mochi', 'sake',
    'teppanyaki',
  ],
  chinese: ['bao', 'dumpling', 'spring-rolls', 'fried-rice', 'wok', 'dim-sum'],
  korean: ['bibimbap'],
  thai: ['pad-thai', 'tom-yum'],
  vietnamese: ['pho', 'pho-bo', 'banh-mi', 'spring-rolls'],
  indonesian: ['rendang', 'nasi-goreng'],
  indian: ['curry', 'biryani', 'samosa', 'daal', 'tikka-masala', 'naan'],
  pakistani: [],
  'sri-lankan': [],
  nepali: [],
  tibetan: [],
  filipino: [],
  malaysian: [],
  cambodian: [],
  laotian: [],

  lebanese: ['falafel', 'hummus', 'shawarma', 'kebab'],
  turkish: ['kebab', 'shawarma'],
  iranian: [],
  israeli: ['falafel', 'hummus'],
  kurdish: ['kebab'],
  afghan: [],

  moroccan: ['tajine', 'couscous'],
  tunisian: ['couscous'],
  egyptian: [],
  algerian: ['couscous'],
  ethiopian: [],
  senegalese: [],
  congolese: [],
  ivorian: [],

  american: [
    'burger', 'smash-burger', 'fried-chicken', 'hot-dog', 'corn-dog',
    'nuggets', 'wings', 'ribs', 'brisket', 'pulled-pork', 'bbq',
    'cheesecake', 'donut', 'cookie', 'pancake', 'waffle', 'chili',
    'fries', 'hawaiian', 'poke',
  ],
  canadian: ['poutine'],
  mexican: ['tacos', 'burrito', 'arepas', 'chili'],
  brazilian: ['feijoada'],
  peruvian: ['ceviche'],
  argentinian: [],
  colombian: ['arepas'],
  jamaican: ['jerk-chicken'],

  // ═══════════════════════════════════════════════════════════════
  // 3. DISH / INGREDIENT / STYLE parents
  // ═══════════════════════════════════════════════════════════════

  // Dish types
  salad: ['salade-lyonnaise', 'poke'],
  burger: ['smash-burger'],
  pasta: ['lasagna', 'gnocchi'],
  pizza: ['pissaladiere', 'flammekueche'],
  sushi: ['sashimi', 'maki', 'chirashi', 'california-roll', 'onigiri'],
  rice: [
    'bibimbap', 'donburi', 'onigiri', 'risotto', 'fried-rice',
    'nasi-goreng', 'paella', 'biryani',
  ],
  noodles: ['ramen', 'udon', 'pho', 'pho-bo', 'pad-thai', 'tom-yum'],
  soup: ['ramen', 'pho', 'pho-bo', 'tom-yum', 'bouillabaisse'],
  sandwich: ['panini', 'banh-mi', 'bruschetta', 'croque-monsieur', 'wrap'],
  'street-food': [
    'kebab', 'shawarma', 'tacos', 'burrito', 'hot-dog', 'corn-dog',
    'bao', 'bruschetta', 'fries', 'poutine', 'pretzel', 'arepas',
  ],
  'dim-sum': ['bao', 'gyoza', 'dumpling', 'spring-rolls'],
  dumpling: ['gyoza', 'bao', 'pierogi', 'samosa', 'empanadas'],
  tapas: ['croquetas'],
  curry: ['tikka-masala', 'biryani', 'daal', 'rendang'],
  bowl: ['poke', 'bibimbap', 'donburi'],

  // Ingredient / protein
  meat: [
    'steak', 'bbq', 'ribs', 'brisket', 'pulled-pork', 'schnitzel', 'magret',
    'entrecote', 'filet-mignon', 'tartare', 'carpaccio', 'osso-buco',
    'charcuterie', 'andouillette', 'cordon-bleu', 'vitello-tonnato',
    'pierrade', 'chili',
  ],
  steak: ['entrecote', 'filet-mignon', 'tartare', 'carpaccio'],
  bbq: ['ribs', 'brisket', 'pulled-pork', 'wings', 'jerk-chicken'],
  chicken: [
    'fried-chicken', 'wings', 'nuggets', 'cordon-bleu', 'katsu',
    'teriyaki', 'jerk-chicken',
  ],
  duck: ['magret', 'confit-canard', 'foie-gras'],
  lamb: ['souris-agneau'],
  fish: ['ceviche', 'tataki', 'sashimi', 'quenelle', 'bouillabaisse'],
  seafood: ['moules-frites', 'bouillabaisse', 'takoyaki', 'ceviche'],
  cheese: [
    'fondue', 'raclette', 'tartiflette', 'aligot', 'croque-monsieur',
    'welsh', 'gratin', 'gratin-dauphinois',
  ],

  // Desserts / pastry / ice
  dessert: [
    'tiramisu', 'cheesecake', 'creme-brulee', 'souffle', 'tarte-tatin',
    'tarte', 'mochi', 'churros', 'donut', 'cookie', 'waffle', 'chocolate',
    'patisserie', 'crepes', 'pancake', 'pastry', 'ice-cream',
  ],
  pastry: ['croissant', 'patisserie', 'tarte', 'tarte-tatin', 'quiche'],
  'ice-cream': ['mochi'],

  // Meals
  breakfast: [
    'pancake', 'granola', 'porridge', 'waffle', 'eggs', 'omelette', 'brunch',
  ],
  brunch: ['pancake', 'granola', 'eggs', 'omelette', 'waffle'],

  // Drinks
  drinks: [
    'coffee', 'tea', 'cocktail', 'beer', 'wine', 'cider', 'juice',
    'lemonade', 'milkshake', 'smoothie',
  ],
  coffee: ['hot-chocolate'],
  tea: ['matcha', 'bubble-tea', 'kombucha'],
  cocktail: ['sake'],

  // Dietary umbrellas (vegan/halal/keto/kosher/organic/gluten-free stay as
  // orthogonal tags with no parent).
  vegetarian: ['vegan'],
  healthy: ['poke', 'bowl', 'salad', 'granola', 'acai', 'smoothie'],
};

/**
 * Transitive BFS expansion: returns the slug + every descendant in the DAG.
 * A visited set guarantees no infinite loop if a cycle is ever introduced.
 */
export function expandCategorySlug(slug: string): string[] {
  const visited = new Set<string>();
  const queue: string[] = [slug];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    const children = CATEGORY_CHILDREN[current];
    if (children) {
      for (const c of children) {
        if (!visited.has(c)) queue.push(c);
      }
    }
  }
  return Array.from(visited);
}

/** True if `slug` is declared as a parent (has at least one child). */
export function hasChildren(slug: string): boolean {
  const c = CATEGORY_CHILDREN[slug];
  return !!c && c.length > 0;
}

/** All declared parent slugs (for sitemap / filter UI generation). */
export function allParentSlugs(): string[] {
  return Object.keys(CATEGORY_CHILDREN).filter(
    (s) => CATEGORY_CHILDREN[s] && CATEGORY_CHILDREN[s].length > 0,
  );
}
