/**
 * Long-form SEO content templates for <CityGuide />.
 *
 * These templates are paramétrés by actual DB data (dishCount, avgPrice,
 * topRestaurant, etc.) so each rendered page produces a unique ~800-1200
 * word guide, which is necessary to compete on long-tail queries like
 * "meilleur burger à Lyon 2026" (which are currently dominated by 1500-3000
 * word articles).
 *
 * Each locale provides templates for four page types:
 *   - cityCategory : /lyon/burger   (most common)
 *   - city         : /lyon          (city only)
 *   - category     : /c/burger      (category only)
 */

import {
  theBestOf,
  ofBestArticle,
  aOf,
  aGoodOf,
  goodAdj,
  beenRated,
  partitiveOf,
} from './categoryGrammar';

type Locale = 'fr' | 'en' | 'es' | 'de' | 'it';

export type GuideContext = {
  locale: string;
  category: string; // localized category label, e.g. "burger"
  city: string; // original city name, e.g. "Lyon"
  dishCount: number;
  avgPrice: number | null;
  currencySymbol: string;
  topDish?: { dishName: string; restaurantName: string; rating: number };
  yearSuffix: string; // e.g. "2026"
};

export type GuideSection = {
  heading: string;
  body: string;
};

export type Guide = {
  intro: string;
  sections: GuideSection[];
  conclusion: string;
};

// === Category-specific quality criteria (FR base, translated per locale) ===
// These make each page UNIQUE vs other categories and add real editorial value.
const CATEGORY_CRITERIA: Record<string, Record<Locale, string[]>> = {
  burger: {
    fr: [
      'Le pain : brioché ou bun maison, légèrement grillé et qui tient à la sauce sans s\'effriter.',
      'La viande : haché au couteau ou façon smash, cuite à la demande, pas trop pressée.',
      'Le fromage : fondu à cœur, pas juste posé froid sur un steak tiède.',
      'Les garnitures fraîches : salade croquante, tomate mûre, pickles maison.',
      'La sauce : signature, équilibrée, pas noyée dans la mayo industrielle.',
    ],
    en: [
      'The bun: brioche or house-made, lightly toasted, holds the sauce without falling apart.',
      'The meat: hand-chopped or smashed style, cooked to order, not over-pressed.',
      'The cheese: properly melted through, not just cold on a warm patty.',
      'Fresh toppings: crisp lettuce, ripe tomato, house pickles.',
      'The sauce: signature, balanced, not drowning in industrial mayo.',
    ],
    es: [
      'El pan: brioche o casero, ligeramente tostado, que aguante la salsa.',
      'La carne: picada a cuchillo o smash, al punto deseado, sin prensar demasiado.',
      'El queso: fundido de verdad, no frío sobre carne tibia.',
      'Acompañamientos frescos: lechuga crujiente, tomate maduro, pepinillos caseros.',
      'La salsa: con firma propia, equilibrada, sin ahogar en mayonesa industrial.',
    ],
    de: [
      'Das Brötchen: Brioche oder hausgemacht, leicht getoastet, hält die Sauce stand.',
      'Das Fleisch: handgehackt oder Smash-Style, auf Wunsch gegart, nicht zerdrückt.',
      'Der Käse: richtig durchgeschmolzen, nicht kalt auf lauwarmem Patty.',
      'Frische Beilagen: knackiger Salat, reife Tomate, hausgemachte Pickles.',
      'Die Sauce: Signature, ausgewogen, nicht in Industriemayo ertrunken.',
    ],
    it: [
      'Il panino: brioche o fatto in casa, leggermente tostato, che regge la salsa.',
      'La carne: tritata al coltello o smash, cotta su richiesta, non pressata.',
      'Il formaggio: ben fuso, non freddo su una carne tiepida.',
      'Contorni freschi: insalata croccante, pomodoro maturo, pickles fatti in casa.',
      'La salsa: signature, bilanciata, senza annegare nella maionese industriale.',
    ],
  },
  pizza: {
    fr: [
      'La pâte : longue fermentation (48h minimum), bien levée, légère à digérer.',
      'Le fournil : four à bois ou électrique pro, cuisson 60-90 secondes à 450°C.',
      'La sauce tomate : San Marzano de préférence, non sucrée, sans concentré.',
      'Le fromage : mozzarella fior di latte ou di bufala, pas de râpé industriel.',
      'L\'équilibre : croûte aérée au bord (cornicione), base fine au centre.',
    ],
    en: [
      'The dough: long fermentation (48h+), properly risen, light on the stomach.',
      'The oven: wood-fired or pro electric, 60-90 seconds at 450°C.',
      'The tomato sauce: San Marzano preferred, not sweet, no tomato paste.',
      'The cheese: fior di latte or buffalo mozzarella, no industrial shredded blend.',
      'Balance: airy crust (cornicione) on the edge, thin base in the middle.',
    ],
    es: [
      'La masa: fermentación larga (48h mínimo), bien levada, ligera de digerir.',
      'El horno: de leña o eléctrico profesional, 60-90 segundos a 450°C.',
      'La salsa de tomate: San Marzano preferiblemente, sin azúcar, sin concentrado.',
      'El queso: mozzarella fior di latte o di bufala, no rallado industrial.',
      'El equilibrio: corteza aireada en el borde (cornicione), base fina al centro.',
    ],
    de: [
      'Der Teig: lange Fermentation (mind. 48h), gut aufgegangen, leicht verdaulich.',
      'Der Ofen: Holzofen oder Profi-Elektro, 60-90 Sekunden bei 450°C.',
      'Die Tomatensauce: San Marzano bevorzugt, nicht süß, ohne Tomatenmark.',
      'Der Käse: Mozzarella Fior di Latte oder di Bufala, kein Industrie-Streukäse.',
      'Das Gleichgewicht: luftige Kruste am Rand (Cornicione), dünn in der Mitte.',
    ],
    it: [
      'L\'impasto: lievitazione lunga (almeno 48h), ben alzato, leggero da digerire.',
      'Il forno: a legna o elettrico professionale, 60-90 secondi a 450°C.',
      'La salsa di pomodoro: San Marzano preferibilmente, non dolce, senza concentrato.',
      'Il formaggio: mozzarella fior di latte o di bufala, non grattugiato industriale.',
      'L\'equilibrio: cornicione arioso sul bordo, base sottile al centro.',
    ],
  },
  sushi: {
    fr: [
      'Le riz : vinaigré au bon dosage, tiède, grains entiers qui se tiennent.',
      'Le poisson : ultra-frais, provenance traçable, découpe à contre-fibre.',
      'La wasabi : fraîche râpée si possible, pas tube industriel.',
      'Le soja : artisanal, pas de sauce basique au goût chimique.',
      'L\'omakase : fait à la demande, pas empilé dans une vitrine depuis 2h.',
    ],
    en: [
      'The rice: properly seasoned with vinegar, warm, grains staying together.',
      'The fish: ultra-fresh, traceable origin, cut against the grain.',
      'The wasabi: freshly grated if possible, not industrial tube.',
      'The soy: artisanal, not basic chemical-tasting sauce.',
      'Omakase: made to order, not sitting in a display case for 2 hours.',
    ],
    es: [
      'El arroz: bien aliñado con vinagre, tibio, granos que se mantienen.',
      'El pescado: ultra fresco, origen trazable, corte contra la fibra.',
      'El wasabi: rallado fresco si es posible, no en tubo industrial.',
      'La soja: artesanal, no salsa básica con sabor químico.',
      'El omakase: hecho al momento, no apilado en una vitrina desde hace 2h.',
    ],
    de: [
      'Der Reis: richtig mit Essig gewürzt, lauwarm, Körner bleiben zusammen.',
      'Der Fisch: ultrafrisch, nachvollziehbare Herkunft, gegen die Faser geschnitten.',
      'Das Wasabi: frisch gerieben wenn möglich, keine Industrietube.',
      'Die Sojasauce: handwerklich, keine chemisch schmeckende Billigsauce.',
      'Omakase: auf Bestellung zubereitet, nicht 2h in der Vitrine gelegen.',
    ],
    it: [
      'Il riso: aceto ben dosato, tiepido, chicchi interi che si tengono.',
      'Il pesce: freschissimo, origine tracciabile, taglio controfibra.',
      'Il wasabi: grattugiato fresco se possibile, non tubetto industriale.',
      'La soia: artigianale, non salsa base dal gusto chimico.',
      'L\'omakase: fatto su richiesta, non impilato in vetrina da 2 ore.',
    ],
  },
};

// Generic criteria used as fallback when the category has no specific entry.
const GENERIC_CRITERIA: Record<Locale, string[]> = {
  fr: [
    'Des produits frais et de saison, pas de surgelés industriels.',
    'Une cuisson maîtrisée, jamais trop ni pas assez.',
    'Un assaisonnement équilibré qui met en valeur le produit principal.',
    'Une présentation soignée, signe d\'attention au détail.',
    'Un rapport qualité-prix honnête pour le quartier.',
  ],
  en: [
    'Fresh, seasonal ingredients, no industrial frozen products.',
    'Controlled cooking, never over- or undercooked.',
    'Balanced seasoning that enhances the main ingredient.',
    'Careful plating, a sign of attention to detail.',
    'Honest price-to-quality ratio for the neighborhood.',
  ],
  es: [
    'Productos frescos y de temporada, sin congelados industriales.',
    'Cocción controlada, nunca demasiado ni poco.',
    'Sazonado equilibrado que realza el producto principal.',
    'Presentación cuidada, signo de atención al detalle.',
    'Relación calidad-precio honesta para el barrio.',
  ],
  de: [
    'Frische, saisonale Produkte, keine Industrietiefkühlware.',
    'Kontrollierte Garung, nie zu viel oder zu wenig.',
    'Ausgewogene Würzung, die das Hauptprodukt hervorhebt.',
    'Sorgfältige Präsentation als Zeichen von Liebe zum Detail.',
    'Faires Preis-Leistungs-Verhältnis für das Viertel.',
  ],
  it: [
    'Prodotti freschi e di stagione, niente surgelati industriali.',
    'Cottura controllata, mai troppo né poco.',
    'Condimento equilibrato che valorizza il prodotto principale.',
    'Presentazione curata, segno di attenzione al dettaglio.',
    'Rapporto qualità-prezzo onesto per il quartiere.',
  ],
};

function criteriaFor(categorySlug: string | undefined, locale: Locale): string[] {
  if (categorySlug && CATEGORY_CRITERIA[categorySlug]) {
    return CATEGORY_CRITERIA[categorySlug][locale];
  }
  return GENERIC_CRITERIA[locale];
}

// ===================================================================
// === GUIDE BUILDERS — one per (locale × pageType) combination ===
// ===================================================================

/** /lyon/burger — city + category */
export function buildCityCategoryGuide(ctx: GuideContext, categorySlug: string): Guide {
  const l = (ctx.locale as Locale) in {fr:1,en:1,es:1,de:1,it:1} ? (ctx.locale as Locale) : 'fr';
  const { category, city, dishCount, avgPrice, currencySymbol, topDish, yearSuffix } = ctx;
  const criteria = criteriaFor(categorySlug, l);
  const priceStr = avgPrice ? `${avgPrice.toFixed(2)} ${currencySymbol}` : '—';

  // FR grammar fragments (agree with category gender+number)
  const theBest = theBestOf(categorySlug, category); // "le meilleur burger" / "la meilleure pizza" / "les meilleures pâtes"
  const ofBest = ofBestArticle(categorySlug); // "du meilleur" / "de la meilleure" / "des meilleures"
  const aCat = aOf(categorySlug, category); // "un burger" / "une pizza" / "des pâtes"
  const aGoodCat = aGoodOf(categorySlug, category); // "un bon burger" / "une bonne pizza" / "de bonnes pâtes"
  const good = goodAdj(categorySlug); // "bon" / "bonne" / "bons" / "bonnes"
  const rated = beenRated(categorySlug); // "a été noté" / "ont été notées"
  const partitive = partitiveOf(categorySlug, category); // "du burger" / "de la pizza" / "des pâtes"

  const templates: Record<Locale, Guide> = {
    fr: {
      intro: `Tu cherches où manger ${theBest} à ${city} en ${yearSuffix} ? Tu es au bon endroit. Sur DishRank, ${dishCount} ${category} ${rated} par la communauté à ${city}. Contrairement aux plateformes qui notent des restaurants dans leur globalité, DishRank se concentre sur un seul critère : ce plat précis, mérite-t-il le détour ? La réponse est basée sur les avis de vrais gourmets locaux, pas sur des algorithmes opaques.`,
      sections: [
        {
          heading: `Notre classement ${ofBest} ${category} à ${city}`,
          body: topDish
            ? `Notre top ${category} à ${city} en ${yearSuffix} est actuellement « ${topDish.dishName} » servi chez ${topDish.restaurantName}, avec une note de ${topDish.rating.toFixed(1)}/5 attribuée par la communauté. Ce classement est mis à jour en temps réel à chaque nouvel avis posté — ce que tu vois aujourd'hui n'est pas figé : demain, un nouveau plat peut rejoindre le top si les notes des utilisateurs l'y placent. C'est ça, la force de DishRank : un classement vivant, transparent et basé uniquement sur l'expérience de clients qui ont vraiment payé pour le plat.`
            : `Découvre le classement complet ci-dessus, mis à jour en temps réel à chaque nouvel avis posté par la communauté. Pas de classement figé, pas d'algorithme opaque — juste les notes de vrais clients qui ont payé leur repas.`,
        },
        {
          heading: `Comment reconnaître ${aGoodCat} à ${city}`,
          body: `${aGoodCat.charAt(0).toUpperCase() + aGoodCat.slice(1)}, ça ne se juge pas aux étoiles Michelin ni au design du restaurant. Voici les critères que la communauté DishRank prend en compte pour noter ${aCat} à sa juste valeur :\n\n• ${criteria.join('\n• ')}\n\nCes critères sont présents dans chaque avis posté sur DishRank : tu peux donc filtrer et trouver ${aCat} qui correspond exactement à tes attentes — et pas juste « le mieux noté globalement ».`,
        },
        {
          heading: `Prix moyen ${partitive} à ${city}`,
          body: avgPrice
            ? `Selon les avis DishRank, le prix moyen ${partitive} à ${city} tourne autour de ${priceStr}. C'est une fourchette large : tu trouveras des adresses honnêtes autour de ${Math.max(avgPrice - 4, 6).toFixed(0)} ${currencySymbol} pour un repas simple et correct, et des expériences plus premium qui montent jusqu'à ${(avgPrice + 8).toFixed(0)} ${currencySymbol} ou plus. L'important n'est pas de payer cher, mais de payer le juste prix pour ce que tu manges.`
            : `Le prix ${partitive} à ${city} varie selon le quartier, le standing du restaurant et la qualité des produits. Consulte les prix affichés sur chaque fiche plat dans le classement : ils sont renseignés par les utilisateurs au moment où ils postent leur avis, donc ils reflètent ce que tu paieras vraiment.`,
        },
        {
          heading: `Pourquoi faire confiance à DishRank pour trouver ${theBest} à ${city} ?`,
          body: `DishRank part d'un constat simple : un restaurant peut être excellent sur un plat et médiocre sur un autre. Noter un établissement avec une seule étoile globale n'a aucun sens pour un client qui veut savoir si le plat qui l'intéresse est ${good}, pas si le service est souriant ou si le parking est facile. Notre communauté de foodies note chaque plat séparément, avec photo, prix et commentaire. Tu as ainsi accès à une information vraie, granulaire et surtout utile : quel ${category} commander ce soir à ${city}, et où.`,
        },
      ],
      conclusion: `Tu connais une meilleure adresse pour ${category} à ${city} qui n'apparaît pas encore dans notre classement ? Télécharge DishRank sur iOS ou Android, poste ton avis avec photo, et aide la communauté à découvrir les vraies pépites locales. Chaque avis compte : le classement évolue à chaque nouveau vote.`,
    },
    en: {
      intro: `Looking for the best ${category} in ${city} in ${yearSuffix}? You're in the right place. On DishRank, ${dishCount} ${category}${dishCount > 1 ? 's have' : ' has'} been rated by the community in ${city}. Unlike platforms that rate restaurants overall, DishRank focuses on a single criterion: does this specific dish deserve the detour? The answer is based on real local foodies' reviews, not opaque algorithms.`,
      sections: [
        {
          heading: `Our ranking for the best ${category} in ${city}`,
          body: topDish
            ? `Our top ${category} in ${city} for ${yearSuffix} is currently "${topDish.dishName}" served at ${topDish.restaurantName}, rated ${topDish.rating.toFixed(1)}/5 by the community. This ranking is updated in real time with each new review posted — what you see today isn't fixed: tomorrow, a new dish can join the top if user ratings take it there. That's the strength of DishRank: a living, transparent ranking based solely on the experience of customers who actually paid for the dish.`
            : `Check out the full ranking above, updated in real time with each new community review. No frozen rankings, no opaque algorithm — just ratings from real customers who paid for their ${category}.`,
        },
        {
          heading: `How to recognize a great ${category} in ${city}`,
          body: `A great ${category} isn't judged by Michelin stars or restaurant design. Here are the criteria the DishRank community uses to rate a ${category} on its true merit:\n\n• ${criteria.join('\n• ')}\n\nThese criteria are present in every DishRank review: you can filter and find a ${category} that exactly matches your expectations — not just "best rated overall".`,
        },
        {
          heading: `Average price of a ${category} in ${city}`,
          body: avgPrice
            ? `According to DishRank reviews, the average price of a ${category} in ${city} is around ${priceStr}. It's a wide range: you'll find honest places around ${Math.max(avgPrice - 4, 6).toFixed(0)} ${currencySymbol} for a simple correct meal, and more premium experiences up to ${(avgPrice + 8).toFixed(0)} ${currencySymbol} or more. The point isn't to pay more, it's to pay the right price for what you eat.`
            : `The price of a ${category} in ${city} varies by neighborhood, restaurant standing and product quality. Check the prices shown on each dish card in the ranking: they are filled in by users when they post their review, so they reflect what you'll actually pay.`,
        },
        {
          heading: `Why trust DishRank for the best ${category} in ${city}?`,
          body: `DishRank starts from a simple observation: a restaurant can be excellent for one dish and mediocre for another. Rating an establishment with a single overall star makes no sense for a customer who wants to know if their ${category} is good, not whether the service is smiling or if parking is easy. Our community of foodies rates each dish separately, with photo, price and comment. You get real, granular and above all useful information: which ${category} to order tonight in ${city}, and where.`,
        },
      ],
      conclusion: `Know a better ${category} in ${city} that's not in our ranking yet? Download DishRank on iOS or Android, post your review with a photo, and help the community discover real local gems. Every review counts: the ranking evolves with each new vote.`,
    },
    es: {
      intro: `¿Buscas dónde comer el mejor ${category} en ${city} en ${yearSuffix}? Estás en el lugar adecuado. En DishRank, ${dishCount} ${category}${dishCount > 1 ? 's han' : ' ha'} sido valorado${dishCount > 1 ? 's' : ''} por la comunidad en ${city}. A diferencia de las plataformas que valoran restaurantes globalmente, DishRank se centra en un solo criterio: este plato en concreto, ¿merece el desvío? La respuesta se basa en opiniones de verdaderos gourmets locales, no en algoritmos opacos.`,
      sections: [
        {
          heading: `Nuestro ranking del mejor ${category} en ${city}`,
          body: topDish
            ? `Nuestro top ${category} en ${city} en ${yearSuffix} es actualmente "${topDish.dishName}" servido en ${topDish.restaurantName}, valorado con ${topDish.rating.toFixed(1)}/5 por la comunidad. Este ranking se actualiza en tiempo real con cada nueva opinión publicada — lo que ves hoy no es fijo: mañana, un nuevo plato puede entrar en el top si las valoraciones lo llevan ahí. Esa es la fuerza de DishRank: un ranking vivo, transparente y basado únicamente en la experiencia de clientes que realmente pagaron por el plato.`
            : `Descubre la clasificación completa arriba, actualizada en tiempo real con cada nueva opinión. Sin rankings fijos, sin algoritmos opacos — solo valoraciones de clientes reales que pagaron por su ${category}.`,
        },
        {
          heading: `Cómo reconocer un buen ${category} en ${city}`,
          body: `Un buen ${category} no se juzga por las estrellas Michelin ni por el diseño del restaurante. Estos son los criterios que usa la comunidad DishRank para valorar un ${category} en su justa medida:\n\n• ${criteria.join('\n• ')}\n\nEstos criterios están presentes en cada opinión publicada en DishRank: puedes filtrar y encontrar un ${category} que coincida exactamente con tus expectativas — no solo "el mejor valorado globalmente".`,
        },
        {
          heading: `Precio medio de un ${category} en ${city}`,
          body: avgPrice
            ? `Según las opiniones DishRank, el precio medio de un ${category} en ${city} ronda los ${priceStr}. Es un rango amplio: encontrarás sitios honestos en torno a ${Math.max(avgPrice - 4, 6).toFixed(0)} ${currencySymbol} para una comida simple y correcta, y experiencias más premium que suben hasta ${(avgPrice + 8).toFixed(0)} ${currencySymbol} o más. Lo importante no es pagar caro, sino pagar el precio justo por lo que comes.`
            : `El precio de un ${category} en ${city} varía según el barrio, el nivel del restaurante y la calidad de los productos. Consulta los precios mostrados en cada ficha de plato: los rellenan los usuarios al publicar su opinión, así que reflejan lo que pagarás realmente.`,
        },
        {
          heading: `¿Por qué confiar en DishRank para el mejor ${category} en ${city}?`,
          body: `DishRank parte de una constatación simple: un restaurante puede ser excelente en un plato y mediocre en otro. Valorar un establecimiento con una sola estrella global no tiene sentido para un cliente que quiere saber si el ${category} de la casa es bueno, no si el servicio es amable o el parking fácil. Nuestra comunidad de foodies valora cada plato por separado, con foto, precio y comentario. Así obtienes información verdadera, granular y sobre todo útil: qué ${category} pedir esta noche en ${city}, y dónde.`,
        },
      ],
      conclusion: `¿Conoces un mejor ${category} en ${city} que no aparezca en nuestro ranking? Descarga DishRank en iOS o Android, publica tu opinión con foto y ayuda a la comunidad a descubrir verdaderas joyas locales. Cada opinión cuenta: el ranking evoluciona con cada nuevo voto.`,
    },
    de: {
      intro: `Suchst du den besten ${category} in ${city} in ${yearSuffix}? Du bist hier richtig. Auf DishRank wurden ${dishCount} ${category} von der Community in ${city} bewertet. Im Gegensatz zu Plattformen, die Restaurants insgesamt bewerten, konzentriert sich DishRank auf ein einziges Kriterium: Verdient dieses spezifische Gericht den Umweg? Die Antwort basiert auf echten lokalen Foodies, nicht auf undurchsichtigen Algorithmen.`,
      sections: [
        {
          heading: `Unser Ranking des besten ${category} in ${city}`,
          body: topDish
            ? `Unser Top ${category} in ${city} für ${yearSuffix} ist derzeit "${topDish.dishName}" serviert bei ${topDish.restaurantName}, mit ${topDish.rating.toFixed(1)}/5 von der Community bewertet. Dieses Ranking wird in Echtzeit mit jeder neuen Bewertung aktualisiert — was du heute siehst, ist nicht festgeschrieben: morgen kann ein neues Gericht ins Top gelangen, wenn die Nutzerbewertungen es dorthin bringen. Das ist die Stärke von DishRank: ein lebendiges, transparentes Ranking, das ausschließlich auf der Erfahrung von Kunden basiert, die tatsächlich für das Gericht bezahlt haben.`
            : `Schau dir das vollständige Ranking oben an, in Echtzeit mit jeder neuen Community-Bewertung aktualisiert. Keine eingefrorenen Rankings, keine undurchsichtigen Algorithmen — nur Bewertungen von echten Kunden, die für ihren ${category} bezahlt haben.`,
        },
        {
          heading: `Wie erkennt man einen guten ${category} in ${city}`,
          body: `Ein guter ${category} wird nicht an Michelin-Sternen oder am Design des Restaurants beurteilt. Hier sind die Kriterien, die die DishRank-Community anwendet, um einen ${category} fair zu bewerten:\n\n• ${criteria.join('\n• ')}\n\nDiese Kriterien sind in jeder DishRank-Bewertung enthalten: Du kannst filtern und einen ${category} finden, der genau deinen Erwartungen entspricht — nicht nur "insgesamt am besten bewertet".`,
        },
        {
          heading: `Durchschnittspreis eines ${category} in ${city}`,
          body: avgPrice
            ? `Laut DishRank-Bewertungen liegt der Durchschnittspreis für einen ${category} in ${city} bei etwa ${priceStr}. Das ist eine breite Spanne: Du findest ehrliche Adressen um ${Math.max(avgPrice - 4, 6).toFixed(0)} ${currencySymbol} für eine einfache, korrekte Mahlzeit, und gehobenere Erfahrungen, die bis zu ${(avgPrice + 8).toFixed(0)} ${currencySymbol} oder mehr reichen. Es geht nicht darum, teuer zu zahlen, sondern den richtigen Preis für das, was man isst.`
            : `Der Preis eines ${category} in ${city} variiert nach Viertel, Restaurant-Standing und Produktqualität. Konsultiere die Preise auf jeder Gerichtskarte im Ranking: Sie werden von den Nutzern beim Posten ihrer Bewertung eingetragen und spiegeln den tatsächlichen Preis wider.`,
        },
        {
          heading: `Warum DishRank für den besten ${category} in ${city} vertrauen?`,
          body: `DishRank geht von einer einfachen Feststellung aus: Ein Restaurant kann bei einem Gericht exzellent und bei einem anderen mittelmäßig sein. Ein Lokal mit einem einzigen globalen Stern zu bewerten, macht für einen Kunden keinen Sinn, der wissen will, ob der ${category} des Hauses gut ist — nicht, ob der Service freundlich oder der Parkplatz einfach ist. Unsere Foodie-Community bewertet jedes Gericht separat, mit Foto, Preis und Kommentar. So erhältst du echte, granulare und vor allem nützliche Informationen: welchen ${category} heute Abend in ${city} bestellen, und wo.`,
        },
      ],
      conclusion: `Kennst du einen besseren ${category} in ${city}, der noch nicht in unserem Ranking ist? Lade DishRank auf iOS oder Android herunter, poste deine Bewertung mit Foto und hilf der Community, echte lokale Perlen zu entdecken. Jede Bewertung zählt: Das Ranking entwickelt sich mit jeder neuen Stimme weiter.`,
    },
    it: {
      intro: `Stai cercando il miglior ${category} a ${city} nel ${yearSuffix}? Sei nel posto giusto. Su DishRank, ${dishCount} ${category} ${dishCount > 1 ? 'sono stati valutati' : 'è stato valutato'} dalla community a ${city}. A differenza delle piattaforme che valutano i ristoranti complessivamente, DishRank si concentra su un solo criterio: questo piatto specifico, merita la deviazione? La risposta è basata su veri gourmet locali, non su algoritmi opachi.`,
      sections: [
        {
          heading: `La nostra classifica del miglior ${category} a ${city}`,
          body: topDish
            ? `Il nostro top ${category} a ${city} nel ${yearSuffix} è attualmente "${topDish.dishName}" servito da ${topDish.restaurantName}, votato ${topDish.rating.toFixed(1)}/5 dalla community. Questa classifica è aggiornata in tempo reale ad ogni nuova recensione pubblicata — quello che vedi oggi non è fisso: domani, un nuovo piatto può entrare nel top se i voti degli utenti lo portano lì. È questa la forza di DishRank: una classifica viva, trasparente e basata solo sull'esperienza di clienti che hanno davvero pagato per il piatto.`
            : `Scopri la classifica completa sopra, aggiornata in tempo reale ad ogni nuova recensione della community. Nessuna classifica congelata, nessun algoritmo opaco — solo voti di veri clienti che hanno pagato il loro ${category}.`,
        },
        {
          heading: `Come riconoscere un buon ${category} a ${city}`,
          body: `Un buon ${category} non si giudica dalle stelle Michelin né dal design del ristorante. Ecco i criteri che la community DishRank usa per valutare un ${category} al giusto valore:\n\n• ${criteria.join('\n• ')}\n\nQuesti criteri sono presenti in ogni recensione pubblicata su DishRank: puoi filtrare e trovare un ${category} che corrisponda esattamente alle tue aspettative — non solo "il più votato complessivamente".`,
        },
        {
          heading: `Prezzo medio di un ${category} a ${city}`,
          body: avgPrice
            ? `Secondo le recensioni DishRank, il prezzo medio di un ${category} a ${city} si aggira intorno a ${priceStr}. È una fascia ampia: troverai indirizzi onesti intorno a ${Math.max(avgPrice - 4, 6).toFixed(0)} ${currencySymbol} per un pasto semplice e corretto, ed esperienze più premium che salgono fino a ${(avgPrice + 8).toFixed(0)} ${currencySymbol} o più. L'importante non è pagare caro, ma pagare il giusto prezzo per quello che mangi.`
            : `Il prezzo di un ${category} a ${city} varia secondo il quartiere, lo standing del ristorante e la qualità dei prodotti. Consulta i prezzi mostrati su ogni scheda piatto nella classifica: sono inseriti dagli utenti al momento della recensione, quindi riflettono quello che pagherai davvero.`,
        },
        {
          heading: `Perché fidarsi di DishRank per il miglior ${category} a ${city}?`,
          body: `DishRank parte da una constatazione semplice: un ristorante può essere eccellente su un piatto e mediocre su un altro. Valutare un locale con una sola stella globale non ha senso per un cliente che vuole sapere se il ${category} della casa è buono, non se il servizio è sorridente o il parcheggio facile. La nostra community di gourmet valuta ogni piatto separatamente, con foto, prezzo e commento. Hai così accesso a un'informazione vera, granulare e soprattutto utile: quale ${category} ordinare stasera a ${city}, e dove.`,
        },
      ],
      conclusion: `Conosci un miglior ${category} a ${city} che non compare ancora nella nostra classifica? Scarica DishRank su iOS o Android, pubblica la tua recensione con foto e aiuta la community a scoprire vere perle locali. Ogni recensione conta: la classifica si evolve ad ogni nuovo voto.`,
    },
  };

  return templates[l];
}

/** /lyon — city only */
export function buildCityGuide(ctx: GuideContext): Guide {
  const l = (ctx.locale as Locale) in {fr:1,en:1,es:1,de:1,it:1} ? (ctx.locale as Locale) : 'fr';
  const { city, dishCount, avgPrice, currencySymbol, topDish, yearSuffix } = ctx;
  const priceStr = avgPrice ? `${avgPrice.toFixed(2)} ${currencySymbol}` : '—';

  const templates: Record<Locale, Guide> = {
    fr: {
      intro: `Où manger à ${city} en ${yearSuffix} ? DishRank répertorie ${dishCount} plats notés par la communauté dans la ville — burger, sushi, pizza, ramen, dessert, café et bien plus. Contrairement aux guides traditionnels qui notent des restaurants de manière globale, ici chaque plat a sa propre note, sa propre photo, son propre prix et ses propres avis. Tu sais exactement quoi commander et où.`,
      sections: [
        {
          heading: `Le top des plats à ${city}`,
          body: topDish
            ? `Actuellement, le plat le mieux noté à ${city} sur DishRank est "${topDish.dishName}" chez ${topDish.restaurantName}, avec une note de ${topDish.rating.toFixed(1)}/5. Ce classement évolue à chaque nouvel avis posté : la force de DishRank, c'est que rien n'est figé. Un bon restaurant qui rate une saison peut perdre sa première place, et une nouvelle adresse prometteuse peut surgir en un week-end.`
            : `Le classement complet est disponible ci-dessus, organisé par catégorie pour t'aider à trouver rapidement ce que tu cherches. Filtre par burger, sushi, pizza ou toute autre catégorie, et découvre ce que la communauté locale de ${city} recommande vraiment.`,
        },
        {
          heading: `Les meilleurs quartiers pour bien manger à ${city}`,
          body: `${city} offre une scène gastronomique riche et variée. Selon les avis de la communauté DishRank, les quartiers les plus prisés pour bien manger changent selon le type de cuisine recherchée — street food, gastronomique, bistrot authentique ou cuisine du monde. Utilise la carte interactive dans l'app pour explorer les meilleurs plats à proximité de toi et trouver la pépite du quartier.`,
        },
        {
          heading: `Prix moyen d'un repas à ${city}`,
          body: avgPrice
            ? `Le prix moyen d'un plat à ${city} sur DishRank est d'environ ${priceStr}, ce qui couvre aussi bien les restaurants abordables que les adresses plus haut de gamme. Tu peux filtrer par prix pour trouver un bon plat à moins de ${Math.max(avgPrice - 3, 8).toFixed(0)} ${currencySymbol} ou une expérience gastronomique plus ambitieuse.`
            : `Les prix affichés sur DishRank sont renseignés par les utilisateurs au moment où ils postent leur avis. Tu peux filtrer les résultats par budget pour trouver une adresse qui correspond à tes envies, qu'elles soient économiques ou plus ambitieuses.`,
        },
        {
          heading: `Pourquoi DishRank plutôt qu'un autre guide food ?`,
          body: `Les guides food traditionnels notent des restaurants. Mais un restaurant, c'est 30, 40, parfois 60 plats différents — et tous ne se valent pas. Le chef peut exceller sur son burger et être moyen sur ses pâtes. DishRank résout ce problème : chaque plat a sa propre note, sa propre photo, son propre prix. Tu ne choisis plus un restaurant au hasard en espérant commander le bon plat, tu choisis directement le plat qui a été testé et approuvé par la communauté locale de ${city}.`,
        },
      ],
      conclusion: `Tu es un foodie de ${city} ? Rejoins la communauté DishRank en téléchargeant l'app sur iOS ou Android, poste tes premiers avis et aide les autres gourmets à éviter les déceptions. Plus il y a d'avis, plus le classement est fiable — et plus on peut tous manger mieux à ${city}.`,
    },
    en: {
      intro: `Where to eat in ${city} in ${yearSuffix}? DishRank lists ${dishCount} dishes rated by the community in the city — burgers, sushi, pizza, ramen, dessert, coffee and more. Unlike traditional guides that rate restaurants overall, here each dish has its own rating, photo, price and reviews. You know exactly what to order and where.`,
      sections: [
        {
          heading: `Top dishes in ${city}`,
          body: topDish
            ? `Currently, the top-rated dish in ${city} on DishRank is "${topDish.dishName}" at ${topDish.restaurantName}, with a rating of ${topDish.rating.toFixed(1)}/5. This ranking evolves with each new review: the strength of DishRank is that nothing is fixed. A good restaurant that misses a season can lose its top spot, and a promising new address can rise in a weekend.`
            : `The full ranking is available above, organized by category to help you quickly find what you're looking for. Filter by burger, sushi, pizza or any other category, and discover what the local ${city} community really recommends.`,
        },
        {
          heading: `Best neighborhoods to eat in ${city}`,
          body: `${city} offers a rich and varied food scene. According to DishRank community reviews, the most popular neighborhoods for good food change based on the type of cuisine you're looking for — street food, fine dining, authentic bistro or world cuisine. Use the interactive map in the app to explore the best dishes near you and find the neighborhood gem.`,
        },
        {
          heading: `Average price of a meal in ${city}`,
          body: avgPrice
            ? `The average price of a dish in ${city} on DishRank is around ${priceStr}, covering both affordable restaurants and higher-end addresses. You can filter by price to find a good dish under ${Math.max(avgPrice - 3, 8).toFixed(0)} ${currencySymbol} or a more ambitious gourmet experience.`
            : `Prices shown on DishRank are filled in by users when they post their review. You can filter results by budget to find an address that matches your cravings, from budget-friendly to more ambitious.`,
        },
        {
          heading: `Why DishRank instead of another food guide?`,
          body: `Traditional food guides rate restaurants. But a restaurant has 30, 40, sometimes 60 different dishes — and they're not all equal. The chef can excel at their burger and be average at their pasta. DishRank solves this problem: each dish has its own rating, photo, price. You no longer pick a restaurant at random hoping to order the right dish — you directly pick the dish that has been tested and approved by the local ${city} community.`,
        },
      ],
      conclusion: `Are you a ${city} foodie? Join the DishRank community by downloading the app on iOS or Android, post your first reviews and help other foodies avoid disappointments. The more reviews, the more reliable the ranking — and the better we can all eat in ${city}.`,
    },
    es: {
      intro: `¿Dónde comer en ${city} en ${yearSuffix}? DishRank lista ${dishCount} platos valorados por la comunidad en la ciudad — hamburguesa, sushi, pizza, ramen, postre, café y mucho más. A diferencia de las guías tradicionales que valoran restaurantes globalmente, aquí cada plato tiene su propia valoración, foto, precio y opiniones. Sabes exactamente qué pedir y dónde.`,
      sections: [
        {
          heading: `Los mejores platos en ${city}`,
          body: topDish
            ? `Actualmente, el plato mejor valorado en ${city} en DishRank es "${topDish.dishName}" en ${topDish.restaurantName}, con una nota de ${topDish.rating.toFixed(1)}/5. Esta clasificación evoluciona con cada nueva opinión: la fuerza de DishRank es que nada está fijo. Un buen restaurante que falla una temporada puede perder su primer puesto, y una nueva dirección prometedora puede surgir en un fin de semana.`
            : `La clasificación completa está disponible arriba, organizada por categoría para ayudarte a encontrar rápidamente lo que buscas. Filtra por hamburguesa, sushi, pizza o cualquier otra categoría, y descubre lo que la comunidad local de ${city} realmente recomienda.`,
        },
        {
          heading: `Los mejores barrios para comer en ${city}`,
          body: `${city} ofrece una escena gastronómica rica y variada. Según las opiniones de la comunidad DishRank, los barrios más apreciados para comer bien cambian según el tipo de cocina buscada — comida callejera, gastronómica, bistró auténtico o cocina del mundo. Usa el mapa interactivo en la app para explorar los mejores platos cerca de ti y encontrar la joya del barrio.`,
        },
        {
          heading: `Precio medio de una comida en ${city}`,
          body: avgPrice
            ? `El precio medio de un plato en ${city} en DishRank es de unos ${priceStr}, cubriendo tanto restaurantes asequibles como direcciones más altas de gama. Puedes filtrar por precio para encontrar un buen plato por menos de ${Math.max(avgPrice - 3, 8).toFixed(0)} ${currencySymbol} o una experiencia gastronómica más ambiciosa.`
            : `Los precios mostrados en DishRank son introducidos por los usuarios al publicar su opinión. Puedes filtrar los resultados por presupuesto para encontrar una dirección que coincida con tus antojos, desde económicos hasta más ambiciosos.`,
        },
        {
          heading: `¿Por qué DishRank en lugar de otra guía food?`,
          body: `Las guías food tradicionales valoran restaurantes. Pero un restaurante tiene 30, 40, a veces 60 platos diferentes — y no todos valen lo mismo. El chef puede destacar en su hamburguesa y ser mediocre en su pasta. DishRank resuelve este problema: cada plato tiene su propia valoración, foto y precio. Ya no eliges un restaurante al azar esperando pedir el plato correcto, eliges directamente el plato que ha sido probado y aprobado por la comunidad local de ${city}.`,
        },
      ],
      conclusion: `¿Eres un foodie de ${city}? Únete a la comunidad DishRank descargando la app en iOS o Android, publica tus primeras opiniones y ayuda a otros gourmets a evitar decepciones. Cuantas más opiniones haya, más fiable será el ranking — y mejor podremos comer todos en ${city}.`,
    },
    de: {
      intro: `Wo essen in ${city} im Jahr ${yearSuffix}? DishRank listet ${dishCount} Gerichte auf, die von der Community in der Stadt bewertet wurden — Burger, Sushi, Pizza, Ramen, Dessert, Kaffee und mehr. Im Gegensatz zu traditionellen Guides, die Restaurants insgesamt bewerten, hat hier jedes Gericht seine eigene Bewertung, sein eigenes Foto, seinen eigenen Preis und seine eigenen Kommentare. Du weißt genau, was zu bestellen und wo.`,
      sections: [
        {
          heading: `Die besten Gerichte in ${city}`,
          body: topDish
            ? `Derzeit ist das am besten bewertete Gericht in ${city} auf DishRank "${topDish.dishName}" bei ${topDish.restaurantName}, mit einer Bewertung von ${topDish.rating.toFixed(1)}/5. Dieses Ranking entwickelt sich mit jeder neuen Bewertung: Die Stärke von DishRank liegt darin, dass nichts festgeschrieben ist. Ein gutes Restaurant, das eine Saison verpasst, kann seinen ersten Platz verlieren, und eine vielversprechende neue Adresse kann an einem Wochenende aufsteigen.`
            : `Das vollständige Ranking ist oben verfügbar, nach Kategorie organisiert, damit du schnell findest, was du suchst. Filtere nach Burger, Sushi, Pizza oder jeder anderen Kategorie und entdecke, was die lokale ${city}-Community wirklich empfiehlt.`,
        },
        {
          heading: `Die besten Viertel zum Essen in ${city}`,
          body: `${city} bietet eine reiche und abwechslungsreiche Gastroszene. Laut den DishRank-Community-Bewertungen ändern sich die beliebtesten Viertel für gutes Essen je nach gesuchter Küche — Streetfood, Feinschmecker, authentische Bistros oder Weltküche. Nutze die interaktive Karte in der App, um die besten Gerichte in deiner Nähe zu erkunden und die Perle des Viertels zu finden.`,
        },
        {
          heading: `Durchschnittspreis einer Mahlzeit in ${city}`,
          body: avgPrice
            ? `Der Durchschnittspreis eines Gerichts in ${city} auf DishRank liegt bei etwa ${priceStr}, was sowohl erschwingliche Restaurants als auch gehobenere Adressen abdeckt. Du kannst nach Preis filtern, um ein gutes Gericht unter ${Math.max(avgPrice - 3, 8).toFixed(0)} ${currencySymbol} oder eine ambitioniertere Gourmet-Erfahrung zu finden.`
            : `Die auf DishRank angezeigten Preise werden von den Nutzern beim Posten ihrer Bewertung eingetragen. Du kannst die Ergebnisse nach Budget filtern, um eine Adresse zu finden, die zu deinen Gelüsten passt — von günstig bis ambitionierter.`,
        },
        {
          heading: `Warum DishRank statt eines anderen Food-Guides?`,
          body: `Traditionelle Food-Guides bewerten Restaurants. Aber ein Restaurant hat 30, 40, manchmal 60 verschiedene Gerichte — und nicht alle sind gleich. Der Chef kann beim Burger glänzen und bei der Pasta durchschnittlich sein. DishRank löst dieses Problem: Jedes Gericht hat seine eigene Bewertung, sein Foto, seinen Preis. Du wählst kein Restaurant mehr zufällig aus und hoffst, das richtige Gericht zu bestellen — du wählst direkt das Gericht, das von der lokalen ${city}-Community getestet und genehmigt wurde.`,
        },
      ],
      conclusion: `Bist du ein ${city}-Foodie? Schließe dich der DishRank-Community an, indem du die App auf iOS oder Android herunterlädst, deine ersten Bewertungen postest und anderen Feinschmeckern hilfst, Enttäuschungen zu vermeiden. Je mehr Bewertungen, desto zuverlässiger das Ranking — und desto besser können wir alle in ${city} essen.`,
    },
    it: {
      intro: `Dove mangiare a ${city} nel ${yearSuffix}? DishRank elenca ${dishCount} piatti votati dalla community nella città — burger, sushi, pizza, ramen, dolci, caffè e molto altro. A differenza delle guide tradizionali che valutano i ristoranti complessivamente, qui ogni piatto ha il proprio voto, la propria foto, il proprio prezzo e le proprie recensioni. Sai esattamente cosa ordinare e dove.`,
      sections: [
        {
          heading: `I migliori piatti a ${city}`,
          body: topDish
            ? `Attualmente, il piatto più votato a ${city} su DishRank è "${topDish.dishName}" da ${topDish.restaurantName}, con un voto di ${topDish.rating.toFixed(1)}/5. Questa classifica si evolve ad ogni nuova recensione: la forza di DishRank è che nulla è fisso. Un buon ristorante che perde una stagione può perdere il primo posto, e un nuovo indirizzo promettente può emergere in un weekend.`
            : `La classifica completa è disponibile sopra, organizzata per categoria per aiutarti a trovare rapidamente quello che cerchi. Filtra per burger, sushi, pizza o qualsiasi altra categoria, e scopri quello che la community locale di ${city} consiglia davvero.`,
        },
        {
          heading: `I migliori quartieri per mangiare a ${city}`,
          body: `${city} offre una scena gastronomica ricca e variata. Secondo le recensioni della community DishRank, i quartieri più apprezzati per mangiare bene cambiano in base al tipo di cucina cercato — street food, gastronomica, bistrot autentico o cucina del mondo. Usa la mappa interattiva nell'app per esplorare i migliori piatti vicino a te e trovare la perla del quartiere.`,
        },
        {
          heading: `Prezzo medio di un pasto a ${city}`,
          body: avgPrice
            ? `Il prezzo medio di un piatto a ${city} su DishRank è di circa ${priceStr}, coprendo sia ristoranti abbordabili che indirizzi più alti di gamma. Puoi filtrare per prezzo per trovare un buon piatto sotto ${Math.max(avgPrice - 3, 8).toFixed(0)} ${currencySymbol} o un'esperienza gastronomica più ambiziosa.`
            : `I prezzi mostrati su DishRank sono inseriti dagli utenti al momento della pubblicazione della recensione. Puoi filtrare i risultati per budget per trovare un indirizzo che corrisponda alle tue voglie, da economici a più ambiziosi.`,
        },
        {
          heading: `Perché DishRank invece di un'altra guida food?`,
          body: `Le guide food tradizionali valutano i ristoranti. Ma un ristorante ha 30, 40, a volte 60 piatti diversi — e non tutti valgono la stessa cosa. Lo chef può eccellere nel burger ed essere mediocre nella pasta. DishRank risolve questo problema: ogni piatto ha il proprio voto, la propria foto, il proprio prezzo. Non scegli più un ristorante a caso sperando di ordinare il piatto giusto — scegli direttamente il piatto che è stato testato e approvato dalla community locale di ${city}.`,
        },
      ],
      conclusion: `Sei un foodie di ${city}? Unisciti alla community DishRank scaricando l'app su iOS o Android, pubblica le tue prime recensioni e aiuta altri gourmet a evitare delusioni. Più recensioni ci sono, più affidabile è la classifica — e meglio possiamo mangiare tutti a ${city}.`,
    },
  };

  return templates[l];
}

/** /c/burger — category only */
export function buildCategoryGuide(ctx: GuideContext, categorySlug: string): Guide {
  const l = (ctx.locale as Locale) in {fr:1,en:1,es:1,de:1,it:1} ? (ctx.locale as Locale) : 'fr';
  const { category, dishCount, avgPrice, currencySymbol, topDish, yearSuffix } = ctx;
  const criteria = criteriaFor(categorySlug, l);
  const priceStr = avgPrice ? `${avgPrice.toFixed(2)} ${currencySymbol}` : '—';

  // FR grammar fragments
  const theBest = theBestOf(categorySlug, category); // "le meilleur burger" / "la meilleure pizza" / "les meilleures pâtes"
  const aCat = aOf(categorySlug, category); // "un burger" / "une pizza" / "des pâtes"
  const aGoodCat = aGoodOf(categorySlug, category); // "un bon burger" / "une bonne pizza" / "de bonnes pâtes"
  const partitive = partitiveOf(categorySlug, category); // "du burger" / "de la pizza" / "des pâtes"

  const templates: Record<Locale, Guide> = {
    fr: {
      intro: `Quel est ${theBest} en ${yearSuffix} ? DishRank a collecté ${dishCount} avis sur ce type de plat de la part de notre communauté de gourmets. Chaque avis contient une note de 1 à 5, une photo, le prix payé et un commentaire détaillé. Tu n'as plus besoin de parcourir 10 blogs food différents : tout est centralisé, filtrable par ville et trié par note moyenne.`,
      sections: [
        {
          heading: `Comment reconnaître ${aGoodCat}`,
          body: `Avant même de consulter le classement, savoir ce qui fait ${aGoodCat} t'aide à poser tes propres critères. Voici ceux que la communauté DishRank utilise :\n\n• ${criteria.join('\n• ')}\n\nCes critères ne sont pas subjectifs : ils se vérifient à la première bouchée. ${aCat.charAt(0).toUpperCase() + aCat.slice(1)} qui coche ces cases mérite d'être dans notre top.`,
        },
        {
          heading: `Le top ${category} du moment`,
          body: topDish
            ? `${theBest.charAt(0).toUpperCase() + theBest.slice(1)} actuellement en tête du classement DishRank est « ${topDish.dishName} » chez ${topDish.restaurantName}, avec ${topDish.rating.toFixed(1)}/5 et un consensus clair de la communauté. Ce top est mis à jour automatiquement à chaque nouvel avis — si une adresse rate ses produits un week-end, elle peut perdre sa place dès le lendemain.`
            : `Le classement complet ci-dessus est trié par note moyenne, avec les meilleures adresses en haut. Tu peux filtrer par ville pour trouver ce qui est disponible près de chez toi, et par prix pour rester dans ton budget.`,
        },
        {
          heading: `Prix moyen ${partitive}`,
          body: avgPrice
            ? `Selon les avis collectés sur DishRank, le prix moyen ${partitive} est d'environ ${priceStr}. C'est un bon repère pour savoir si une adresse est dans la norme ou pratique des prix abusifs. Méfie-toi autant des adresses à moins de ${Math.max(avgPrice - 5, 5).toFixed(0)} ${currencySymbol} (souvent synonyme de produit industriel) que de celles vendant leurs plats plus de ${(avgPrice + 10).toFixed(0)} ${currencySymbol} sans justification qualitative évidente.`
            : `Le prix ${partitive} varie énormément selon la ville, le quartier et la qualité des produits. Consulte le prix affiché sur chaque fiche plat pour savoir si l'adresse est dans ta fourchette.`,
        },
        {
          heading: `Filtrer le classement par ville`,
          body: `Tu cherches ${theBest} dans ta ville spécifiquement ? Clique sur une ville dans la liste ci-dessous ou utilise la barre de recherche en haut pour filtrer le classement géographiquement. Chaque ville a son propre top ${category}, basé uniquement sur les avis locaux — ce qui est ${theBest} à Lyon ne l'est pas forcément à Paris ou Marseille.`,
        },
      ],
      conclusion: `Tu connais une adresse incontournable pour ${category} qui n'est pas encore dans notre classement ? Télécharge DishRank, poste ton avis avec photo et prix, et contribue à la communauté. Chaque nouvel avis rend le classement plus précis et plus utile pour tous ceux qui cherchent ${theBest}.`,
    },
    en: {
      intro: `What's the best ${category} in ${yearSuffix}? DishRank has collected ${dishCount} reviews on this type of dish from our community of foodies. Each review contains a 1-5 rating, a photo, the price paid and a detailed comment. No more browsing 10 different food blogs: everything is centralized, filterable by city and sorted by average rating.`,
      sections: [
        {
          heading: `How to recognize a great ${category}`,
          body: `Before even checking the ranking, knowing what makes a great ${category} helps you set your own criteria. Here are the ones the DishRank community uses:\n\n• ${criteria.join('\n• ')}\n\nThese criteria are not subjective: they can be checked at the first bite. A ${category} that ticks these boxes deserves to be in our top.`,
        },
        {
          heading: `The top ${category} right now`,
          body: topDish
            ? `The ${category} currently topping the DishRank ranking is "${topDish.dishName}" at ${topDish.restaurantName}, with ${topDish.rating.toFixed(1)}/5 and a clear community consensus. This top is automatically updated with each new review — if an address messes up its products one weekend, it can lose its spot the next day.`
            : `The full ranking above is sorted by average rating, with the best addresses at the top. You can filter by city to find what's available near you, and by price to stay within your budget.`,
        },
        {
          heading: `Average price of a ${category}`,
          body: avgPrice
            ? `According to reviews collected on DishRank, the average price of a ${category} is around ${priceStr}. It's a good benchmark to know whether an address is within norms or practices abusive pricing. Be suspicious of ${category} under ${Math.max(avgPrice - 5, 5).toFixed(0)} ${currencySymbol} (often industrial products) as well as those sold over ${(avgPrice + 10).toFixed(0)} ${currencySymbol} without obvious quality justification.`
            : `The price of a ${category} varies enormously by city, neighborhood and product quality. Check the price shown on each dish card to know if the address is in your range.`,
        },
        {
          heading: `Filter the ranking by city`,
          body: `Looking for the best ${category} specifically in your city? Click on a city in the list below or use the search bar at the top to filter the ranking geographically. Each city has its own ${category} top, based solely on local reviews — what's the best ${category} in Lyon isn't necessarily the best in Paris or Marseille.`,
        },
      ],
      conclusion: `Know an essential address for ${category} that's not in our ranking yet? Download DishRank, post your review with photo and price, and contribute to the community. Every new review makes the ranking more accurate and more useful for everyone looking for the best ${category}.`,
    },
    es: {
      intro: `¿Cuál es el mejor ${category} en ${yearSuffix}? DishRank ha recopilado ${dishCount} opiniones sobre este tipo de plato de nuestra comunidad de gourmets. Cada opinión contiene una nota de 1 a 5, una foto, el precio pagado y un comentario detallado. Ya no necesitas recorrer 10 blogs food diferentes: todo está centralizado, filtrable por ciudad y ordenado por nota media.`,
      sections: [
        {
          heading: `Cómo reconocer un buen ${category}`,
          body: `Antes incluso de consultar el ranking, saber qué hace un buen ${category} te ayuda a establecer tus propios criterios. Estos son los que la comunidad DishRank utiliza:\n\n• ${criteria.join('\n• ')}\n\nEstos criterios no son subjetivos: se verifican al primer bocado. Un ${category} que marca estas casillas merece estar en nuestro top.`,
        },
        {
          heading: `El top ${category} del momento`,
          body: topDish
            ? `El ${category} actualmente en cabeza del ranking DishRank es "${topDish.dishName}" en ${topDish.restaurantName}, con ${topDish.rating.toFixed(1)}/5 y un consenso claro de la comunidad. Este top se actualiza automáticamente con cada nueva opinión — si una dirección falla sus productos un fin de semana, puede perder su puesto al día siguiente.`
            : `El ranking completo arriba está ordenado por nota media, con las mejores direcciones en la parte superior. Puedes filtrar por ciudad para encontrar lo disponible cerca de ti, y por precio para mantener tu presupuesto.`,
        },
        {
          heading: `Precio medio de un ${category}`,
          body: avgPrice
            ? `Según las opiniones recopiladas en DishRank, el precio medio de un ${category} ronda los ${priceStr}. Es un buen punto de referencia para saber si una dirección está dentro de la norma o practica precios abusivos. Desconfía tanto de los ${category} por menos de ${Math.max(avgPrice - 5, 5).toFixed(0)} ${currencySymbol} (a menudo sinónimo de producto industrial) como de los vendidos por más de ${(avgPrice + 10).toFixed(0)} ${currencySymbol} sin una justificación cualitativa evidente.`
            : `El precio de un ${category} varía enormemente según la ciudad, el barrio y la calidad de los productos. Consulta el precio mostrado en cada ficha de plato para saber si la dirección está en tu rango.`,
        },
        {
          heading: `Filtrar el ranking por ciudad`,
          body: `¿Buscas el mejor ${category} específicamente en tu ciudad? Haz clic en una ciudad de la lista de abajo o usa la barra de búsqueda de arriba para filtrar el ranking geográficamente. Cada ciudad tiene su propio top ${category}, basado únicamente en opiniones locales — lo que es el mejor ${category} en Lyon no lo es necesariamente en París o Marsella.`,
        },
      ],
      conclusion: `¿Conoces una dirección imprescindible para el ${category} que aún no está en nuestro ranking? Descarga DishRank, publica tu opinión con foto y precio, y contribuye a la comunidad. Cada nueva opinión hace el ranking más preciso y útil para todos los que buscan el mejor ${category}.`,
    },
    de: {
      intro: `Was ist der beste ${category} im Jahr ${yearSuffix}? DishRank hat ${dishCount} Bewertungen zu dieser Art von Gericht von unserer Foodie-Community gesammelt. Jede Bewertung enthält eine Note von 1 bis 5, ein Foto, den gezahlten Preis und einen detaillierten Kommentar. Du musst nicht mehr 10 verschiedene Food-Blogs durchsuchen: Alles ist zentralisiert, nach Stadt filterbar und nach Durchschnittsnote sortiert.`,
      sections: [
        {
          heading: `Wie man einen guten ${category} erkennt`,
          body: `Bevor du überhaupt das Ranking prüfst, hilft dir das Wissen, was einen guten ${category} ausmacht, deine eigenen Kriterien zu setzen. Hier sind die der DishRank-Community:\n\n• ${criteria.join('\n• ')}\n\nDiese Kriterien sind nicht subjektiv: Sie können beim ersten Bissen überprüft werden. Ein ${category}, der diese Punkte abhakt, verdient einen Platz in unserem Top.`,
        },
        {
          heading: `Der Top ${category} gerade jetzt`,
          body: topDish
            ? `Der ${category}, der derzeit an der Spitze des DishRank-Rankings steht, ist "${topDish.dishName}" bei ${topDish.restaurantName}, mit ${topDish.rating.toFixed(1)}/5 und einem klaren Community-Konsens. Dieses Top wird automatisch mit jeder neuen Bewertung aktualisiert — wenn eine Adresse ihre Produkte an einem Wochenende vermasselt, kann sie ihren Platz am nächsten Tag verlieren.`
            : `Das vollständige Ranking oben ist nach Durchschnittsnote sortiert, mit den besten Adressen oben. Du kannst nach Stadt filtern, um zu finden, was in deiner Nähe verfügbar ist, und nach Preis, um in deinem Budget zu bleiben.`,
        },
        {
          heading: `Durchschnittspreis eines ${category}`,
          body: avgPrice
            ? `Laut den auf DishRank gesammelten Bewertungen liegt der Durchschnittspreis eines ${category} bei etwa ${priceStr}. Es ist ein guter Referenzwert, um zu wissen, ob eine Adresse im Rahmen oder bei missbräuchlichen Preisen liegt. Sei bei ${category} unter ${Math.max(avgPrice - 5, 5).toFixed(0)} ${currencySymbol} (oft Synonym für Industrieprodukt) ebenso vorsichtig wie bei solchen, die über ${(avgPrice + 10).toFixed(0)} ${currencySymbol} ohne offensichtliche Qualitätsrechtfertigung verkauft werden.`
            : `Der Preis eines ${category} variiert enorm nach Stadt, Viertel und Produktqualität. Konsultiere den auf jeder Gerichtskarte angezeigten Preis, um zu wissen, ob die Adresse in deinem Rahmen liegt.`,
        },
        {
          heading: `Ranking nach Stadt filtern`,
          body: `Suchst du den besten ${category} speziell in deiner Stadt? Klicke auf eine Stadt in der Liste unten oder verwende die Suchleiste oben, um das Ranking geografisch zu filtern. Jede Stadt hat ihr eigenes ${category}-Top, basierend ausschließlich auf lokalen Bewertungen — der beste ${category} in Lyon ist nicht unbedingt der beste in Paris oder Marseille.`,
        },
      ],
      conclusion: `Kennst du eine unumgängliche Adresse für ${category}, die noch nicht in unserem Ranking ist? Lade DishRank herunter, poste deine Bewertung mit Foto und Preis und trage zur Community bei. Jede neue Bewertung macht das Ranking genauer und nützlicher für alle, die den besten ${category} suchen.`,
    },
    it: {
      intro: `Qual è il miglior ${category} nel ${yearSuffix}? DishRank ha raccolto ${dishCount} recensioni su questo tipo di piatto dalla nostra community di gourmet. Ogni recensione contiene un voto da 1 a 5, una foto, il prezzo pagato e un commento dettagliato. Non devi più sfogliare 10 blog food diversi: tutto è centralizzato, filtrabile per città e ordinato per voto medio.`,
      sections: [
        {
          heading: `Come riconoscere un buon ${category}`,
          body: `Prima ancora di consultare la classifica, sapere cosa rende un buon ${category} ti aiuta a stabilire i tuoi criteri. Ecco quelli usati dalla community DishRank:\n\n• ${criteria.join('\n• ')}\n\nQuesti criteri non sono soggettivi: si verificano al primo morso. Un ${category} che spunta queste caselle merita di essere nel nostro top.`,
        },
        {
          heading: `Il top ${category} del momento`,
          body: topDish
            ? `Il ${category} attualmente in testa alla classifica DishRank è "${topDish.dishName}" da ${topDish.restaurantName}, con ${topDish.rating.toFixed(1)}/5 e un chiaro consenso della community. Questo top si aggiorna automaticamente ad ogni nuova recensione — se un indirizzo sbaglia i suoi prodotti un weekend, può perdere il suo posto il giorno dopo.`
            : `La classifica completa sopra è ordinata per voto medio, con i migliori indirizzi in cima. Puoi filtrare per città per trovare quello disponibile vicino a te, e per prezzo per rimanere nel tuo budget.`,
        },
        {
          heading: `Prezzo medio di un ${category}`,
          body: avgPrice
            ? `Secondo le recensioni raccolte su DishRank, il prezzo medio di un ${category} si aggira intorno a ${priceStr}. È un buon punto di riferimento per sapere se un indirizzo è nella norma o pratica prezzi abusivi. Diffida tanto dei ${category} sotto i ${Math.max(avgPrice - 5, 5).toFixed(0)} ${currencySymbol} (spesso sinonimo di prodotto industriale) quanto di quelli venduti oltre ${(avgPrice + 10).toFixed(0)} ${currencySymbol} senza giustificazione qualitativa evidente.`
            : `Il prezzo di un ${category} varia enormemente secondo la città, il quartiere e la qualità dei prodotti. Consulta il prezzo mostrato su ogni scheda piatto per sapere se l'indirizzo è nella tua fascia.`,
        },
        {
          heading: `Filtrare la classifica per città`,
          body: `Cerchi il miglior ${category} specificamente nella tua città? Clicca su una città nell'elenco qui sotto o usa la barra di ricerca in alto per filtrare la classifica geograficamente. Ogni città ha il proprio top ${category}, basato unicamente su recensioni locali — quello che è il miglior ${category} a Lione non lo è necessariamente a Parigi o Marsiglia.`,
        },
      ],
      conclusion: `Conosci un indirizzo imprescindibile per il ${category} che non è ancora nella nostra classifica? Scarica DishRank, pubblica la tua recensione con foto e prezzo, e contribuisci alla community. Ogni nuova recensione rende la classifica più precisa e utile per tutti quelli che cercano il miglior ${category}.`,
    },
  };

  return templates[l];
}
