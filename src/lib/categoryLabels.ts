/**
 * Localized labels for category slugs.
 * The slugs are stored in English in the database (`dish_categories.slug`),
 * but for SEO we need them translated in titles/descriptions/H1.
 *
 * Fallback: if a slug is missing, we capitalize the slug (e.g. "bibimbap" → "Bibimbap").
 */

type Locale = 'fr' | 'en' | 'es' | 'de' | 'it';

const LABELS: Record<string, Partial<Record<Locale, string>>> = {
  burger: { fr: 'burger', en: 'burger', es: 'hamburguesa', de: 'Burger', it: 'burger' },
  pizza: { fr: 'pizza', en: 'pizza', es: 'pizza', de: 'Pizza', it: 'pizza' },
  sushi: { fr: 'sushi', en: 'sushi', es: 'sushi', de: 'Sushi', it: 'sushi' },
  pasta: { fr: 'pâtes', en: 'pasta', es: 'pasta', de: 'Pasta', it: 'pasta' },
  salad: { fr: 'salade', en: 'salad', es: 'ensalada', de: 'Salat', it: 'insalata' },
  steak: { fr: 'steak', en: 'steak', es: 'filete', de: 'Steak', it: 'bistecca' },
  seafood: { fr: 'fruits de mer', en: 'seafood', es: 'mariscos', de: 'Meeresfrüchte', it: 'frutti di mare' },
  soup: { fr: 'soupe', en: 'soup', es: 'sopa', de: 'Suppe', it: 'zuppa' },
  sandwich: { fr: 'sandwich', en: 'sandwich', es: 'sándwich', de: 'Sandwich', it: 'sandwich' },
  tacos: { fr: 'tacos', en: 'tacos', es: 'tacos', de: 'Tacos', it: 'tacos' },
  ramen: { fr: 'ramen', en: 'ramen', es: 'ramen', de: 'Ramen', it: 'ramen' },
  pho: { fr: 'phở', en: 'pho', es: 'pho', de: 'Pho', it: 'pho' },
  curry: { fr: 'curry', en: 'curry', es: 'curry', de: 'Curry', it: 'curry' },
  dessert: { fr: 'dessert', en: 'dessert', es: 'postre', de: 'Dessert', it: 'dessert' },
  'ice-cream': { fr: 'glace', en: 'ice cream', es: 'helado', de: 'Eis', it: 'gelato' },
  coffee: { fr: 'café', en: 'coffee', es: 'café', de: 'Kaffee', it: 'caffè' },
  cocktail: { fr: 'cocktail', en: 'cocktail', es: 'cóctel', de: 'Cocktail', it: 'cocktail' },
  breakfast: { fr: 'petit-déjeuner', en: 'breakfast', es: 'desayuno', de: 'Frühstück', it: 'colazione' },
  bbq: { fr: 'barbecue', en: 'BBQ', es: 'barbacoa', de: 'Grill', it: 'barbecue' },
  vegan: { fr: 'vegan', en: 'vegan', es: 'vegano', de: 'vegan', it: 'vegano' },
  chicken: { fr: 'poulet', en: 'chicken', es: 'pollo', de: 'Hähnchen', it: 'pollo' },
  fish: { fr: 'poisson', en: 'fish', es: 'pescado', de: 'Fisch', it: 'pesce' },
  burrito: { fr: 'burrito', en: 'burrito', es: 'burrito', de: 'Burrito', it: 'burrito' },
  kebab: { fr: 'kebab', en: 'kebab', es: 'kebab', de: 'Kebab', it: 'kebab' },
  falafel: { fr: 'falafel', en: 'falafel', es: 'falafel', de: 'Falafel', it: 'falafel' },
  bowl: { fr: 'bowl', en: 'bowl', es: 'bowl', de: 'Bowl', it: 'bowl' },
  'dim-sum': { fr: 'dim sum', en: 'dim sum', es: 'dim sum', de: 'Dim Sum', it: 'dim sum' },
  'pad-thai': { fr: 'pad thaï', en: 'pad thai', es: 'pad thai', de: 'Pad Thai', it: 'pad thai' },
  bibimbap: { fr: 'bibimbap', en: 'bibimbap', es: 'bibimbap', de: 'Bibimbap', it: 'bibimbap' },
  wok: { fr: 'wok', en: 'wok', es: 'wok', de: 'Wok', it: 'wok' },
  teppanyaki: { fr: 'teppanyaki', en: 'teppanyaki', es: 'teppanyaki', de: 'Teppanyaki', it: 'teppanyaki' },
  gratin: { fr: 'gratin', en: 'gratin', es: 'gratinado', de: 'Gratin', it: 'gratin' },
  risotto: { fr: 'risotto', en: 'risotto', es: 'risotto', de: 'Risotto', it: 'risotto' },
  raclette: { fr: 'raclette', en: 'raclette', es: 'raclette', de: 'Raclette', it: 'raclette' },
  fondue: { fr: 'fondue', en: 'fondue', es: 'fondue', de: 'Fondue', it: 'fondue' },
  crepes: { fr: 'crêpes', en: 'crepes', es: 'crepes', de: 'Crêpes', it: 'crêpes' },
  brunch: { fr: 'brunch', en: 'brunch', es: 'brunch', de: 'Brunch', it: 'brunch' },
  eggs: { fr: 'œufs', en: 'eggs', es: 'huevos', de: 'Eier', it: 'uova' },
  pastry: { fr: 'viennoiserie', en: 'pastry', es: 'bollería', de: 'Gebäck', it: 'pasticceria' },
  chocolate: { fr: 'chocolat', en: 'chocolate', es: 'chocolate', de: 'Schokolade', it: 'cioccolato' },
  patisserie: { fr: 'pâtisserie', en: 'pastry', es: 'pastelería', de: 'Patisserie', it: 'pasticceria' },
  waffle: { fr: 'gaufre', en: 'waffle', es: 'gofre', de: 'Waffel', it: 'waffle' },
  cookie: { fr: 'cookie', en: 'cookie', es: 'galleta', de: 'Cookie', it: 'cookie' },
  donut: { fr: 'donut', en: 'donut', es: 'donut', de: 'Donut', it: 'donut' },
  tea: { fr: 'thé', en: 'tea', es: 'té', de: 'Tee', it: 'tè' },
  smoothie: { fr: 'smoothie', en: 'smoothie', es: 'smoothie', de: 'Smoothie', it: 'smoothie' },
  'bubble-tea': { fr: 'bubble tea', en: 'bubble tea', es: 'bubble tea', de: 'Bubble Tea', it: 'bubble tea' },
  juice: { fr: 'jus', en: 'juice', es: 'zumo', de: 'Saft', it: 'succo' },
  beer: { fr: 'bière', en: 'beer', es: 'cerveza', de: 'Bier', it: 'birra' },
  wine: { fr: 'vin', en: 'wine', es: 'vino', de: 'Wein', it: 'vino' },
  vegetarian: { fr: 'végétarien', en: 'vegetarian', es: 'vegetariano', de: 'vegetarisch', it: 'vegetariano' },
  'gluten-free': { fr: 'sans gluten', en: 'gluten-free', es: 'sin gluten', de: 'glutenfrei', it: 'senza glutine' },
  halal: { fr: 'halal', en: 'halal', es: 'halal', de: 'Halal', it: 'halal' },
  kosher: { fr: 'casher', en: 'kosher', es: 'kosher', de: 'koscher', it: 'kosher' },
  organic: { fr: 'bio', en: 'organic', es: 'ecológico', de: 'Bio', it: 'biologico' },
  healthy: { fr: 'healthy', en: 'healthy', es: 'saludable', de: 'gesund', it: 'sano' },
  keto: { fr: 'keto', en: 'keto', es: 'keto', de: 'Keto', it: 'keto' },
  french: { fr: 'français', en: 'French', es: 'francés', de: 'französisch', it: 'francese' },
  italian: { fr: 'italien', en: 'Italian', es: 'italiano', de: 'italienisch', it: 'italiano' },
  japanese: { fr: 'japonais', en: 'Japanese', es: 'japonés', de: 'japanisch', it: 'giapponese' },
  chinese: { fr: 'chinois', en: 'Chinese', es: 'chino', de: 'chinesisch', it: 'cinese' },
  thai: { fr: 'thaï', en: 'Thai', es: 'tailandés', de: 'thailändisch', it: 'thailandese' },
  indian: { fr: 'indien', en: 'Indian', es: 'indio', de: 'indisch', it: 'indiano' },
  mexican: { fr: 'mexicain', en: 'Mexican', es: 'mexicano', de: 'mexikanisch', it: 'messicano' },
  lebanese: { fr: 'libanais', en: 'Lebanese', es: 'libanés', de: 'libanesisch', it: 'libanese' },
  korean: { fr: 'coréen', en: 'Korean', es: 'coreano', de: 'koreanisch', it: 'coreano' },
  vietnamese: { fr: 'vietnamien', en: 'Vietnamese', es: 'vietnamita', de: 'vietnamesisch', it: 'vietnamita' },
  turkish: { fr: 'turc', en: 'Turkish', es: 'turco', de: 'türkisch', it: 'turco' },
  greek: { fr: 'grec', en: 'Greek', es: 'griego', de: 'griechisch', it: 'greco' },
  moroccan: { fr: 'marocain', en: 'Moroccan', es: 'marroquí', de: 'marokkanisch', it: 'marocchino' },
  ethiopian: { fr: 'éthiopien', en: 'Ethiopian', es: 'etíope', de: 'äthiopisch', it: 'etiope' },
  peruvian: { fr: 'péruvien', en: 'Peruvian', es: 'peruano', de: 'peruanisch', it: 'peruviano' },
  american: { fr: 'américain', en: 'American', es: 'americano', de: 'amerikanisch', it: 'americano' },
  african: { fr: 'africain', en: 'African', es: 'africano', de: 'afrikanisch', it: 'africano' },
  caribbean: { fr: 'caribéen', en: 'Caribbean', es: 'caribeño', de: 'karibisch', it: 'caraibico' },
  'street-food': { fr: 'street food', en: 'street food', es: 'comida callejera', de: 'Streetfood', it: 'street food' },
  fries: { fr: 'frites', en: 'fries', es: 'patatas fritas', de: 'Pommes', it: 'patatine fritte' },
  nuggets: { fr: 'nuggets', en: 'nuggets', es: 'nuggets', de: 'Nuggets', it: 'nuggets' },
  'hot-dog': { fr: 'hot-dog', en: 'hot dog', es: 'hot dog', de: 'Hotdog', it: 'hot dog' },
  empanadas: { fr: 'empanadas', en: 'empanadas', es: 'empanadas', de: 'Empanadas', it: 'empanadas' },
  naan: { fr: 'naan', en: 'naan', es: 'naan', de: 'Naan', it: 'naan' },
  tapas: { fr: 'tapas', en: 'tapas', es: 'tapas', de: 'Tapas', it: 'tapas' },
  'fried-rice': { fr: 'riz cantonais', en: 'fried rice', es: 'arroz frito', de: 'gebratener Reis', it: 'riso fritto' },
  asian: { fr: 'asiatique', en: 'Asian', es: 'asiático', de: 'asiatisch', it: 'asiatico' },
  german: { fr: 'allemand', en: 'German', es: 'alemán', de: 'deutsch', it: 'tedesco' },
  british: { fr: 'britannique', en: 'British', es: 'británico', de: 'britisch', it: 'britannico' },
  egyptian: { fr: 'égyptien', en: 'Egyptian', es: 'egipcio', de: 'ägyptisch', it: 'egiziano' },
  cambodian: { fr: 'cambodgien', en: 'Cambodian', es: 'camboyano', de: 'kambodschanisch', it: 'cambogiano' },
  laotian: { fr: 'laotien', en: 'Laotian', es: 'laosiano', de: 'laotisch', it: 'laotiano' },
  nepali: { fr: 'népalais', en: 'Nepali', es: 'nepalí', de: 'nepalesisch', it: 'nepalese' },
  kurdish: { fr: 'kurde', en: 'Kurdish', es: 'kurdo', de: 'kurdisch', it: 'curdo' },
  afghan: { fr: 'afghan', en: 'Afghan', es: 'afgano', de: 'afghanisch', it: 'afghano' },
  congolese: { fr: 'congolais', en: 'Congolese', es: 'congoleño', de: 'kongolesisch', it: 'congolese' },
  ivorian: { fr: 'ivoirien', en: 'Ivorian', es: 'marfileño', de: 'ivorisch', it: 'ivoriano' },

  // === Additional cuisines ===
  algerian: { fr: 'algérien', en: 'Algerian', es: 'argelino', de: 'algerisch', it: 'algerino' },
  argentinian: { fr: 'argentin', en: 'Argentinian', es: 'argentino', de: 'argentinisch', it: 'argentino' },
  brazilian: { fr: 'brésilien', en: 'Brazilian', es: 'brasileño', de: 'brasilianisch', it: 'brasiliano' },
  canadian: { fr: 'canadien', en: 'Canadian', es: 'canadiense', de: 'kanadisch', it: 'canadese' },
  colombian: { fr: 'colombien', en: 'Colombian', es: 'colombiano', de: 'kolumbianisch', it: 'colombiano' },
  creole: { fr: 'créole', en: 'Creole', es: 'criollo', de: 'kreolisch', it: 'creolo' },
  filipino: { fr: 'philippin', en: 'Filipino', es: 'filipino', de: 'philippinisch', it: 'filippino' },
  hawaiian: { fr: 'hawaïen', en: 'Hawaiian', es: 'hawaiano', de: 'hawaiianisch', it: 'hawaiano' },
  indonesian: { fr: 'indonésien', en: 'Indonesian', es: 'indonesio', de: 'indonesisch', it: 'indonesiano' },
  iranian: { fr: 'iranien', en: 'Iranian', es: 'iraní', de: 'iranisch', it: 'iraniano' },
  israeli: { fr: 'israélien', en: 'Israeli', es: 'israelí', de: 'israelisch', it: 'israeliano' },
  jamaican: { fr: 'jamaïcain', en: 'Jamaican', es: 'jamaicano', de: 'jamaikanisch', it: 'giamaicano' },
  malaysian: { fr: 'malaisien', en: 'Malaysian', es: 'malayo', de: 'malaysisch', it: 'malese' },
  pakistani: { fr: 'pakistanais', en: 'Pakistani', es: 'paquistaní', de: 'pakistanisch', it: 'pakistano' },
  polish: { fr: 'polonais', en: 'Polish', es: 'polaco', de: 'polnisch', it: 'polacco' },
  portuguese: { fr: 'portugais', en: 'Portuguese', es: 'portugués', de: 'portugiesisch', it: 'portoghese' },
  reunion: { fr: 'réunionnais', en: 'Reunionese', es: 'reunionés', de: 'Réunion', it: 'della Réunion' },
  russian: { fr: 'russe', en: 'Russian', es: 'ruso', de: 'russisch', it: 'russo' },
  senegalese: { fr: 'sénégalais', en: 'Senegalese', es: 'senegalés', de: 'senegalesisch', it: 'senegalese' },
  spanish: { fr: 'espagnol', en: 'Spanish', es: 'español', de: 'spanisch', it: 'spagnolo' },
  'sri-lankan': { fr: 'sri-lankais', en: 'Sri Lankan', es: 'esrilanqués', de: 'sri-lankisch', it: 'singalese' },
  tibetan: { fr: 'tibétain', en: 'Tibetan', es: 'tibetano', de: 'tibetisch', it: 'tibetano' },
  tunisian: { fr: 'tunisien', en: 'Tunisian', es: 'tunecino', de: 'tunesisch', it: 'tunisino' },
  welsh: { fr: 'gallois', en: 'Welsh', es: 'galés', de: 'walisisch', it: 'gallese' },

  // === Common food types ===
  meat: { fr: 'viande', en: 'meat', es: 'carne', de: 'Fleisch', it: 'carne' },
  cheese: { fr: 'fromage', en: 'cheese', es: 'queso', de: 'Käse', it: 'formaggio' },
  duck: { fr: 'canard', en: 'duck', es: 'pato', de: 'Ente', it: 'anatra' },
  lamb: { fr: 'agneau', en: 'lamb', es: 'cordero', de: 'Lamm', it: 'agnello' },
  rice: { fr: 'riz', en: 'rice', es: 'arroz', de: 'Reis', it: 'riso' },
  noodles: { fr: 'nouilles', en: 'noodles', es: 'fideos', de: 'Nudeln', it: 'noodles' },

  // === Burgers, meat dishes ===
  'smash-burger': { fr: 'smash burger', en: 'smash burger', es: 'smash burger', de: 'Smash Burger', it: 'smash burger' },
  brisket: { fr: 'brisket', en: 'brisket', es: 'brisket', de: 'Brisket', it: 'brisket' },
  ribs: { fr: 'travers de porc', en: 'ribs', es: 'costillas', de: 'Rippchen', it: 'costolette' },
  'pulled-pork': { fr: 'porc effiloché', en: 'pulled pork', es: 'cerdo desmechado', de: 'Pulled Pork', it: 'pulled pork' },
  'fried-chicken': { fr: 'poulet frit', en: 'fried chicken', es: 'pollo frito', de: 'Brathähnchen', it: 'pollo fritto' },
  wings: { fr: 'ailes de poulet', en: 'wings', es: 'alitas', de: 'Chicken Wings', it: 'ali di pollo' },
  'cordon-bleu': { fr: 'cordon-bleu', en: 'cordon bleu', es: 'cordon bleu', de: 'Cordon bleu', it: 'cordon bleu' },
  schnitzel: { fr: 'schnitzel', en: 'schnitzel', es: 'schnitzel', de: 'Schnitzel', it: 'cotoletta' },
  tartare: { fr: 'tartare', en: 'tartare', es: 'tartar', de: 'Tatar', it: 'tartare' },
  carpaccio: { fr: 'carpaccio', en: 'carpaccio', es: 'carpaccio', de: 'Carpaccio', it: 'carpaccio' },
  'filet-mignon': { fr: 'filet mignon', en: 'filet mignon', es: 'filete mignon', de: 'Filet Mignon', it: 'filetto mignon' },
  entrecote: { fr: 'entrecôte', en: 'entrecôte', es: 'entrecot', de: 'Entrecôte', it: 'entrecôte' },
  magret: { fr: 'magret de canard', en: 'duck magret', es: 'magret de pato', de: 'Entenbrust', it: 'magret d\'anatra' },
  'confit-canard': { fr: 'confit de canard', en: 'duck confit', es: 'confit de pato', de: 'Entenconfit', it: 'confit d\'anatra' },
  'foie-gras': { fr: 'foie gras', en: 'foie gras', es: 'foie gras', de: 'Foie Gras', it: 'foie gras' },
  'souris-agneau': { fr: 'souris d\'agneau', en: 'lamb shank', es: 'jarrete de cordero', de: 'Lammhaxe', it: 'stinco d\'agnello' },
  pierrade: { fr: 'pierrade', en: 'pierrade', es: 'pierrade', de: 'Pierrade', it: 'pierrade' },
  plancha: { fr: 'plancha', en: 'plancha', es: 'plancha', de: 'Plancha', it: 'plancha' },
  charcuterie: { fr: 'charcuterie', en: 'charcuterie', es: 'embutidos', de: 'Wurstwaren', it: 'salumi' },
  andouillette: { fr: 'andouillette', en: 'andouillette', es: 'andouillette', de: 'Andouillette', it: 'andouillette' },

  // === French traditional dishes (proper nouns, identical or near-identical across langs) ===
  'boeuf-bourguignon': { fr: 'bœuf bourguignon', en: 'beef bourguignon', es: 'bœuf bourguignon', de: 'Bœuf Bourguignon', it: 'bœuf bourguignon' },
  'pot-au-feu': { fr: 'pot-au-feu', en: 'pot-au-feu', es: 'pot-au-feu', de: 'Pot-au-feu', it: 'pot-au-feu' },
  blanquette: { fr: 'blanquette de veau', en: 'blanquette', es: 'blanquette', de: 'Blanquette', it: 'blanquette' },
  cassoulet: { fr: 'cassoulet', en: 'cassoulet', es: 'cassoulet', de: 'Cassoulet', it: 'cassoulet' },
  ratatouille: { fr: 'ratatouille', en: 'ratatouille', es: 'ratatouille', de: 'Ratatouille', it: 'ratatouille' },
  bouillabaisse: { fr: 'bouillabaisse', en: 'bouillabaisse', es: 'bullabesa', de: 'Bouillabaisse', it: 'bouillabaisse' },
  'moules-frites': { fr: 'moules frites', en: 'mussels & fries', es: 'mejillones con patatas', de: 'Muscheln mit Pommes', it: 'cozze e patatine' },
  carbonnade: { fr: 'carbonnade flamande', en: 'flemish stew', es: 'carbonnade flamenca', de: 'Flämisches Bierfleisch', it: 'carbonnade fiamminga' },
  choucroute: { fr: 'choucroute', en: 'sauerkraut', es: 'chucrut', de: 'Sauerkraut', it: 'crauti' },
  flammekueche: { fr: 'flammekueche', en: 'tarte flambée', es: 'flammekueche', de: 'Flammkuchen', it: 'flammekueche' },
  tartiflette: { fr: 'tartiflette', en: 'tartiflette', es: 'tartiflette', de: 'Tartiflette', it: 'tartiflette' },
  'gratin-dauphinois': { fr: 'gratin dauphinois', en: 'dauphinoise gratin', es: 'gratén dauphinois', de: 'Kartoffelgratin', it: 'gratin dauphinois' },
  aligot: { fr: 'aligot', en: 'aligot', es: 'aligot', de: 'Aligot', it: 'aligot' },
  galette: { fr: 'galette', en: 'galette', es: 'galette', de: 'Galette', it: 'galette' },
  socca: { fr: 'socca', en: 'socca', es: 'socca', de: 'Socca', it: 'socca' },
  pissaladiere: { fr: 'pissaladière', en: 'pissaladière', es: 'pissaladière', de: 'Pissaladière', it: 'pissaladière' },
  'salade-lyonnaise': { fr: 'salade lyonnaise', en: 'lyonnaise salad', es: 'ensalada lyonesa', de: 'Lyoner Salat', it: 'insalata lionese' },
  'cervelle-canut': { fr: 'cervelle de canut', en: 'cervelle de canut', es: 'cervelle de canut', de: 'Cervelle de canut', it: 'cervelle de canut' },
  'tablier-sapeur': { fr: 'tablier de sapeur', en: 'tablier de sapeur', es: 'tablier de sapeur', de: 'Tablier de sapeur', it: 'tablier de sapeur' },
  quenelle: { fr: 'quenelle', en: 'quenelle', es: 'quenelle', de: 'Quenelle', it: 'quenelle' },
  'croque-monsieur': { fr: 'croque-monsieur', en: 'croque-monsieur', es: 'croque-monsieur', de: 'Croque Monsieur', it: 'croque-monsieur' },
  escargot: { fr: 'escargots', en: 'snails', es: 'caracoles', de: 'Schnecken', it: 'lumache' },
  croissant: { fr: 'croissant', en: 'croissant', es: 'croissant', de: 'Croissant', it: 'cornetto' },
  quiche: { fr: 'quiche', en: 'quiche', es: 'quiche', de: 'Quiche', it: 'quiche' },
  tarte: { fr: 'tarte', en: 'tart', es: 'tarta', de: 'Tarte', it: 'crostata' },
  'tarte-tatin': { fr: 'tarte tatin', en: 'tarte tatin', es: 'tarta tatin', de: 'Tarte Tatin', it: 'tarte tatin' },
  'creme-brulee': { fr: 'crème brûlée', en: 'crème brûlée', es: 'crema catalana', de: 'Crème brûlée', it: 'crème brûlée' },
  souffle: { fr: 'soufflé', en: 'soufflé', es: 'suflé', de: 'Soufflé', it: 'soufflé' },
  cheesecake: { fr: 'cheesecake', en: 'cheesecake', es: 'tarta de queso', de: 'Käsekuchen', it: 'cheesecake' },
  tiramisu: { fr: 'tiramisu', en: 'tiramisu', es: 'tiramisú', de: 'Tiramisu', it: 'tiramisù' },
  churros: { fr: 'churros', en: 'churros', es: 'churros', de: 'Churros', it: 'churros' },

  // === Italian dishes ===
  lasagna: { fr: 'lasagnes', en: 'lasagna', es: 'lasaña', de: 'Lasagne', it: 'lasagne' },
  gnocchi: { fr: 'gnocchis', en: 'gnocchi', es: 'ñoquis', de: 'Gnocchi', it: 'gnocchi' },
  bruschetta: { fr: 'bruschetta', en: 'bruschetta', es: 'bruschetta', de: 'Bruschetta', it: 'bruschetta' },
  panini: { fr: 'panini', en: 'panini', es: 'panini', de: 'Panini', it: 'panini' },
  'osso-buco': { fr: 'osso buco', en: 'osso buco', es: 'ossobuco', de: 'Ossobuco', it: 'ossobuco' },
  'vitello-tonnato': { fr: 'vitello tonnato', en: 'vitello tonnato', es: 'vitello tonnato', de: 'Vitello Tonnato', it: 'vitello tonnato' },

  // === Spanish/Latin dishes ===
  paella: { fr: 'paella', en: 'paella', es: 'paella', de: 'Paella', it: 'paella' },
  croquetas: { fr: 'croquetas', en: 'croquetas', es: 'croquetas', de: 'Croquetas', it: 'crocchette' },
  ceviche: { fr: 'ceviche', en: 'ceviche', es: 'ceviche', de: 'Ceviche', it: 'ceviche' },
  arepas: { fr: 'arepas', en: 'arepas', es: 'arepas', de: 'Arepas', it: 'arepas' },
  feijoada: { fr: 'feijoada', en: 'feijoada', es: 'feijoada', de: 'Feijoada', it: 'feijoada' },
  poutine: { fr: 'poutine', en: 'poutine', es: 'poutine', de: 'Poutine', it: 'poutine' },

  // === Japanese dishes ===
  sashimi: { fr: 'sashimi', en: 'sashimi', es: 'sashimi', de: 'Sashimi', it: 'sashimi' },
  maki: { fr: 'maki', en: 'maki', es: 'maki', de: 'Maki', it: 'maki' },
  chirashi: { fr: 'chirashi', en: 'chirashi', es: 'chirashi', de: 'Chirashi', it: 'chirashi' },
  'california-roll': { fr: 'california roll', en: 'california roll', es: 'california roll', de: 'California Roll', it: 'california roll' },
  onigiri: { fr: 'onigiri', en: 'onigiri', es: 'onigiri', de: 'Onigiri', it: 'onigiri' },
  donburi: { fr: 'donburi', en: 'donburi', es: 'donburi', de: 'Donburi', it: 'donburi' },
  katsu: { fr: 'katsu', en: 'katsu', es: 'katsu', de: 'Katsu', it: 'katsu' },
  tempura: { fr: 'tempura', en: 'tempura', es: 'tempura', de: 'Tempura', it: 'tempura' },
  yakitori: { fr: 'yakitori', en: 'yakitori', es: 'yakitori', de: 'Yakitori', it: 'yakitori' },
  takoyaki: { fr: 'takoyaki', en: 'takoyaki', es: 'takoyaki', de: 'Takoyaki', it: 'takoyaki' },
  okonomiyaki: { fr: 'okonomiyaki', en: 'okonomiyaki', es: 'okonomiyaki', de: 'Okonomiyaki', it: 'okonomiyaki' },
  teriyaki: { fr: 'teriyaki', en: 'teriyaki', es: 'teriyaki', de: 'Teriyaki', it: 'teriyaki' },
  tataki: { fr: 'tataki', en: 'tataki', es: 'tataki', de: 'Tataki', it: 'tataki' },
  udon: { fr: 'udon', en: 'udon', es: 'udon', de: 'Udon', it: 'udon' },
  gyoza: { fr: 'gyoza', en: 'gyoza', es: 'gyoza', de: 'Gyoza', it: 'gyoza' },
  matcha: { fr: 'matcha', en: 'matcha', es: 'matcha', de: 'Matcha', it: 'matcha' },
  mochi: { fr: 'mochi', en: 'mochi', es: 'mochi', de: 'Mochi', it: 'mochi' },
  sake: { fr: 'saké', en: 'sake', es: 'sake', de: 'Sake', it: 'sakè' },

  // === Chinese / Asian dishes ===
  bao: { fr: 'bao', en: 'bao', es: 'bao', de: 'Bao', it: 'bao' },
  dumpling: { fr: 'raviolis', en: 'dumplings', es: 'empanadillas', de: 'Teigtaschen', it: 'ravioli' },
  'spring-rolls': { fr: 'rouleaux de printemps', en: 'spring rolls', es: 'rollitos de primavera', de: 'Frühlingsrollen', it: 'involtini primavera' },

  // === Vietnamese ===
  'banh-mi': { fr: 'bánh mì', en: 'banh mi', es: 'banh mi', de: 'Bánh mì', it: 'banh mi' },
  'pho-bo': { fr: 'phở bò', en: 'pho bo', es: 'pho bo', de: 'Pho Bo', it: 'pho bo' },

  // === Thai ===
  'tom-yum': { fr: 'tom yum', en: 'tom yum', es: 'tom yum', de: 'Tom Yum', it: 'tom yum' },

  // === Korean ===
  'tikka-masala': { fr: 'tikka masala', en: 'tikka masala', es: 'tikka masala', de: 'Tikka Masala', it: 'tikka masala' },

  // === Indian ===
  biryani: { fr: 'biryani', en: 'biryani', es: 'biryani', de: 'Biryani', it: 'biryani' },
  samosa: { fr: 'samoussa', en: 'samosa', es: 'samosa', de: 'Samosa', it: 'samosa' },
  daal: { fr: 'daal', en: 'daal', es: 'daal', de: 'Daal', it: 'daal' },

  // === Indonesian/Malaysian ===
  rendang: { fr: 'rendang', en: 'rendang', es: 'rendang', de: 'Rendang', it: 'rendang' },
  'nasi-goreng': { fr: 'nasi goreng', en: 'nasi goreng', es: 'nasi goreng', de: 'Nasi Goreng', it: 'nasi goreng' },

  // === Middle Eastern / North African ===
  shawarma: { fr: 'shawarma', en: 'shawarma', es: 'shawarma', de: 'Shawarma', it: 'shawarma' },
  hummus: { fr: 'houmous', en: 'hummus', es: 'hummus', de: 'Hummus', it: 'hummus' },
  tajine: { fr: 'tajine', en: 'tagine', es: 'tayín', de: 'Tajine', it: 'tajine' },

  // === Mediterranean / Greek ===
  moussaka: { fr: 'moussaka', en: 'moussaka', es: 'musaca', de: 'Moussaka', it: 'moussaka' },
  gyros: { fr: 'gyros', en: 'gyros', es: 'gyros', de: 'Gyros', it: 'gyros' },

  // === Polish/Eastern European ===
  pierogi: { fr: 'pierogi', en: 'pierogi', es: 'pierogi', de: 'Pierogi', it: 'pierogi' },
  pretzel: { fr: 'bretzel', en: 'pretzel', es: 'pretzel', de: 'Brezel', it: 'pretzel' },

  // === African/Caribbean ===
  'jerk-chicken': { fr: 'poulet jerk', en: 'jerk chicken', es: 'pollo jerk', de: 'Jerk-Hähnchen', it: 'jerk chicken' },
  'piri-piri': { fr: 'piri piri', en: 'piri piri', es: 'piri piri', de: 'Piri Piri', it: 'piri piri' },

  // === Hawaii / Pacific ===
  poke: { fr: 'poke', en: 'poke', es: 'poke', de: 'Poke', it: 'poke' },

  // === Snacks / fast food ===
  wrap: { fr: 'wrap', en: 'wrap', es: 'wrap', de: 'Wrap', it: 'wrap' },
  'corn-dog': { fr: 'corn dog', en: 'corn dog', es: 'corn dog', de: 'Corn Dog', it: 'corn dog' },
  'hot-chocolate': { fr: 'chocolat chaud', en: 'hot chocolate', es: 'chocolate caliente', de: 'heiße Schokolade', it: 'cioccolata calda' },
  pancake: { fr: 'pancake', en: 'pancake', es: 'tortita', de: 'Pfannkuchen', it: 'pancake' },
  omelette: { fr: 'omelette', en: 'omelette', es: 'tortilla', de: 'Omelett', it: 'frittata' },
  porridge: { fr: 'porridge', en: 'porridge', es: 'gachas', de: 'Haferbrei', it: 'porridge' },
  granola: { fr: 'granola', en: 'granola', es: 'granola', de: 'Granola', it: 'granola' },
  acai: { fr: 'açaï', en: 'acai', es: 'açaí', de: 'Açaí', it: 'açaí' },

  // === Beverages ===
  cider: { fr: 'cidre', en: 'cider', es: 'sidra', de: 'Apfelwein', it: 'sidro' },
  lemonade: { fr: 'limonade', en: 'lemonade', es: 'limonada', de: 'Limonade', it: 'limonata' },
  milkshake: { fr: 'milkshake', en: 'milkshake', es: 'batido', de: 'Milchshake', it: 'milkshake' },
  kombucha: { fr: 'kombucha', en: 'kombucha', es: 'kombucha', de: 'Kombucha', it: 'kombucha' },

  // === Misc ===
  chili: { fr: 'chili', en: 'chili', es: 'chili', de: 'Chili', it: 'chili' },
  couscous: { fr: 'couscous', en: 'couscous', es: 'cuscús', de: 'Couscous', it: 'cous cous' },
};

/**
 * Returns a localized label for a category slug.
 * Falls back to a title-cased version of the slug if no translation exists.
 */
export function localizedCategory(slug: string, locale: string): string {
  const entry = LABELS[slug];
  if (entry && entry[locale as Locale]) return entry[locale as Locale]!;
  // Fallback: replace dashes with spaces, lowercase
  return slug.replace(/-/g, ' ');
}
