import { MetadataRoute } from 'next';
import { fetchCategories } from '@/lib/supabase';

const BASE = 'https://dishrank.fr';
const CITIES = [
  'Lyon', 'Paris', 'Marseille', 'Toulouse', 'Bordeaux', 'Lille', 'Nice', 'Nantes',
  'Strasbourg', 'Montpellier', 'Rennes', 'Grenoble', 'Rouen', 'Toulon', 'Dijon',
  'Angers', 'Saint-Etienne', 'Le Havre', 'Reims', 'Clermont-Ferrand', 'Tours',
  'Limoges', 'Metz', 'Besancon', 'Perpignan', 'Orleans', 'Caen', 'Brest',
  'Mulhouse', 'Nancy',
];
const TOP_SLUGS = ['burger', 'pizza', 'sushi', 'tacos', 'ramen', 'kebab', 'pasta', 'dessert', 'curry', 'steak', 'pho', 'coffee', 'couscous', 'crepes'];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let categories: { slug: string }[] = [];
  try {
    categories = await fetchCategories();
  } catch {}

  const urls: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${BASE}/?page=privacy`, priority: 0.3 },
    { url: `${BASE}/?page=terms`, priority: 0.3 },
  ];

  // All categories
  for (const cat of categories.slice(0, 50)) {
    urls.push({
      url: `${BASE}/?categorie=${cat.slug}`,
      changeFrequency: 'daily',
      priority: TOP_SLUGS.includes(cat.slug) ? 0.8 : 0.6,
    });
  }

  // Top categories x cities
  for (const slug of TOP_SLUGS) {
    for (const city of CITIES) {
      urls.push({
        url: `${BASE}/?categorie=${slug}&ville=${city}`,
        changeFrequency: 'daily',
        priority: city === 'Lyon' || city === 'Paris' ? 0.9 : 0.7,
      });
    }
  }

  // Cities alone
  for (const city of CITIES) {
    urls.push({
      url: `${BASE}/?ville=${city}`,
      changeFrequency: 'daily',
      priority: 0.6,
    });
  }

  return urls;
}
