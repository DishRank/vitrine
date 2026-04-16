/**
 * Category hierarchy (parent → children).
 *
 * The DB has a `parent_id` column on `dish_categories` but it is currently
 * unused (all entries are NULL in the CSV dump). Rather than running a data
 * migration, we maintain the hierarchy here in TypeScript so it's easy to
 * extend and doesn't require DB round-trips.
 *
 * When a user visits `/c/salad`, we want them to see not only dishes tagged
 * `salad` directly but also subtypes like `salade-lyonnaise`. Same for:
 *  - /c/burger  → includes smash-burger
 *  - /c/pasta   → includes lasagna, gnocchi
 *  - /c/steak   → includes entrecote, filet-mignon, tartare, carpaccio
 *  - /c/dessert → includes tiramisu, cheesecake, crème brûlée, soufflé…
 *  - /c/french  → includes all French signature dishes
 *
 * Rules:
 * - A child can belong to MULTIPLE parents (e.g. `entrecote` is under both
 *   `steak` and `meat` and `french`). This is a DAG, not a tree.
 * - `expandCategorySlug(slug)` always includes the slug itself + all its
 *   declared children. Transitive children are NOT followed automatically
 *   (keep the map simple and predictable).
 * - Adding new parent→children relationships is safe and additive.
 */

/** Direct children for each parent slug. Missing parents = no children. */
const CATEGORY_CHILDREN: Record<string, readonly string[]> = {
  // === Salades ===
  salad: ['salade-lyonnaise', 'poke'],

  // === Burgers ===
  burger: ['smash-burger'],

  // === Pâtes & italien ===
  pasta: ['lasagna', 'gnocchi', 'pad-thai'],
  pizza: ['pissaladiere', 'flammekueche'],

  // === Sushi / japonais ===
  sushi: ['sashimi', 'maki', 'chirashi', 'california-roll', 'onigiri'],

  // === Riz ===
  rice: ['bibimbap', 'donburi', 'onigiri', 'risotto', 'fried-rice', 'nasi-goreng', 'paella', 'biryani'],

  // === Nouilles ===
  noodles: ['ramen', 'udon', 'pho', 'pho-bo', 'pad-thai', 'tom-yum'],

  // === Viande ===
  meat: [
    'steak', 'bbq', 'ribs', 'brisket', 'pulled-pork', 'schnitzel', 'magret',
    'entrecote', 'filet-mignon', 'tartare', 'carpaccio', 'osso-buco',
    'charcuterie', 'andouillette', 'cordon-bleu', 'vitello-tonnato', 'pierrade',
  ],
  steak: ['entrecote', 'filet-mignon', 'tartare', 'carpaccio'],
  bbq: ['ribs', 'brisket', 'pulled-pork', 'wings', 'jerk-chicken'],

  // === Volaille ===
  chicken: ['fried-chicken', 'wings', 'nuggets', 'cordon-bleu', 'katsu', 'teriyaki', 'jerk-chicken'],

  // === Canard ===
  duck: ['magret', 'confit-canard', 'foie-gras'],

  // === Agneau ===
  lamb: ['souris-agneau'],

  // === Poisson / mer ===
  fish: ['ceviche', 'tataki', 'sashimi', 'quenelle', 'bouillabaisse'],
  seafood: ['moules-frites', 'bouillabaisse', 'takoyaki'],

  // === Fromage ===
  cheese: ['fondue', 'raclette', 'tartiflette', 'aligot', 'croque-monsieur', 'welsh', 'gratin', 'gratin-dauphinois'],

  // === Desserts ===
  dessert: [
    'tiramisu', 'cheesecake', 'creme-brulee', 'souffle', 'tarte-tatin', 'tarte',
    'mochi', 'churros', 'donut', 'cookie', 'waffle', 'chocolate', 'patisserie',
    'crepes', 'pancake', 'pastry',
  ],
  pastry: ['croissant', 'patisserie', 'tarte', 'tarte-tatin', 'quiche'],
  'ice-cream': ['mochi'],

  // === Petit-déj ===
  breakfast: ['pancake', 'granola', 'porridge', 'waffle', 'eggs', 'omelette', 'brunch'],
  brunch: ['pancake', 'granola', 'eggs', 'omelette', 'waffle'],

  // === Boissons ===
  coffee: ['hot-chocolate'],
  tea: ['matcha', 'bubble-tea', 'kombucha'],
  cocktail: ['sake'],

  // === Street food & snacks ===
  'street-food': ['kebab', 'shawarma', 'tacos', 'burrito', 'hot-dog', 'corn-dog', 'bao', 'bruschetta'],
  sandwich: ['panini', 'banh-mi', 'bruschetta', 'croque-monsieur', 'wrap'],

  // === Dim sum / raviolis asiatiques ===
  'dim-sum': ['bao', 'gyoza', 'dumpling', 'spring-rolls'],
  dumpling: ['gyoza', 'bao', 'pierogi', 'samosa', 'empanadas'],

  // === Tapas ===
  tapas: ['croquetas', 'tortilla'],

  // === Soupes ===
  soup: ['ramen', 'pho', 'pho-bo', 'tom-yum', 'bouillabaisse'],

  // === Curry / indien ===
  curry: ['tikka-masala', 'biryani', 'daal', 'rendang'],

  // === Cuisines nationales — on laisse Google les traiter indépendamment
  //     sauf pour le français où la richesse SEO du parent est clé
  french: [
    'tartiflette', 'raclette', 'fondue', 'flammekueche', 'quiche', 'ratatouille',
    'bouillabaisse', 'blanquette', 'cassoulet', 'pot-au-feu', 'escargot',
    'salade-lyonnaise', 'cervelle-canut', 'tablier-sapeur', 'andouillette',
    'quenelle', 'boeuf-bourguignon', 'confit-canard', 'pissaladiere', 'socca',
    'galette', 'magret', 'carbonnade', 'choucroute', 'entrecote', 'filet-mignon',
    'souris-agneau', 'foie-gras', 'croque-monsieur', 'tarte-tatin', 'creme-brulee',
    'souffle', 'crepes', 'pierrade', 'aligot', 'gratin', 'gratin-dauphinois',
    'moules-frites', 'charcuterie', 'tartare',
  ],
  italian: [
    'pizza', 'pasta', 'lasagna', 'gnocchi', 'risotto', 'panini', 'tiramisu',
    'bruschetta', 'carpaccio', 'osso-buco', 'vitello-tonnato',
  ],
  japanese: [
    'sushi', 'ramen', 'udon', 'sashimi', 'maki', 'chirashi', 'california-roll',
    'onigiri', 'donburi', 'katsu', 'tempura', 'yakitori', 'takoyaki',
    'okonomiyaki', 'teriyaki', 'tataki', 'gyoza', 'matcha', 'mochi', 'sake',
  ],
  chinese: ['bao', 'dumpling', 'spring-rolls', 'fried-rice', 'wok', 'dim-sum'],
  indian: ['curry', 'biryani', 'samosa', 'daal', 'tikka-masala', 'naan'],
  mexican: ['tacos', 'burrito', 'arepas'],
  thai: ['pad-thai', 'tom-yum'],
  korean: ['bibimbap'],
  vietnamese: ['pho', 'pho-bo', 'banh-mi', 'spring-rolls'],
  lebanese: ['falafel', 'hummus', 'shawarma', 'kebab'],
  greek: ['moussaka', 'gyros'],
  moroccan: ['tajine', 'couscous'],
  spanish: ['paella', 'tapas', 'croquetas', 'churros'],
  german: ['schnitzel', 'pretzel'],
  british: ['fish'],
  indonesian: ['rendang', 'nasi-goreng'],

  // === Diététiques ===
  vegetarian: ['vegan', 'salad'],
  healthy: ['poke', 'bowl', 'salad', 'granola', 'acai', 'smoothie'],
};

/**
 * Returns all slugs that should be included when filtering by `slug`:
 * the slug itself plus all its declared children (non-transitive).
 *
 * Dedupes in case a slug is listed multiple times across the map.
 */
export function expandCategorySlug(slug: string): string[] {
  const children = CATEGORY_CHILDREN[slug];
  if (!children || children.length === 0) return [slug];
  return Array.from(new Set<string>([slug, ...children]));
}

/** True if `slug` has at least one declared child. */
export function hasChildren(slug: string): boolean {
  const c = CATEGORY_CHILDREN[slug];
  return !!c && c.length > 0;
}
