import { localizedCategory } from '@/lib/categoryLabels';
import {
  buildCityCategoryGuide,
  buildCityGuide,
  buildCategoryGuide,
  type GuideContext,
} from '@/lib/cityGuideTemplates';

type Dish = {
  dish_name: string;
  restaurant_name: string;
  avg_rating: number;
  latest_price: number | null;
  currency: string;
};

type Props = {
  locale: string;
  /** Raw category slug from URL, e.g. "burger" */
  category?: string;
  /** Original DB city name, e.g. "Lyon" */
  city?: string;
  /** Dishes already fetched and filtered by the parent page */
  dishes: Dish[];
};

/**
 * Server component that renders a long-form SEO content block (800-1200 words)
 * on filtered pages (/lyon, /c/burger, /lyon/burger).
 *
 * The content is fully server-rendered (no client JS) and produces unique
 * text per combination via parameterized templates in `cityGuideTemplates.ts`.
 *
 * DOES NOT render on the homepage (untranslated/generic pages) to avoid
 * duplicating the same text on thousands of URLs.
 */
export default function CityGuide({ locale, category, city, dishes }: Props) {
  // Homepage → nothing
  if (!city && !category) return null;

  // Derived stats from actual DB data
  const dishCount = dishes.length;
  const avgPrice = computeAvgPrice(dishes);
  const topDish = dishes[0]
    ? {
        dishName: dishes[0].dish_name,
        restaurantName: dishes[0].restaurant_name,
        rating: Number(dishes[0].avg_rating),
      }
    : undefined;
  const currency = dishes[0]?.currency || 'EUR';
  const currencySymbol =
    currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency === 'GBP' ? '£' : currency;

  const ctx: GuideContext = {
    locale,
    category: category ? localizedCategory(category, locale) : '',
    city: city || '',
    dishCount,
    avgPrice,
    currencySymbol,
    topDish,
    yearSuffix: String(new Date().getFullYear()),
  };

  // Pick the right template based on page type
  const guide =
    city && category
      ? buildCityCategoryGuide(ctx, category)
      : city
      ? buildCityGuide(ctx)
      : buildCategoryGuide(ctx, category!);

  return (
    <section className="max-w-[1200px] mx-auto px-4 sm:px-8 py-10 sm:py-16">
      <div className="max-w-[820px] mx-auto">
        {/* Intro */}
        <p className="text-base sm:text-lg text-[var(--text2)] leading-relaxed mb-8">
          {guide.intro}
        </p>

        {/* Sections */}
        {guide.sections.map((section, i) => (
          <article key={i} className="mb-8">
            <h2 className="text-lg sm:text-xl font-extrabold text-[var(--text)] mb-3">
              {section.heading}
            </h2>
            <div className="text-sm sm:text-base text-[var(--text2)] leading-relaxed whitespace-pre-line">
              {section.body}
            </div>
          </article>
        ))}

        {/* Conclusion — petit accent visuel à gauche pour signaler "synthèse"
            sans transformer la box en CTA (les vrais CTA sont CtaBanner +
            DownloadButtons). Border opacity alignée sur le reste du site
            (≈30% au lieu de 20%). */}
        <div
          className="relative mt-10 p-5 sm:p-6 rounded-2xl"
          style={{
            background: 'var(--primary-container)',
            border: '1px solid color-mix(in srgb, var(--primary) 28%, transparent)',
          }}
        >
          <span
            className="absolute left-0 top-5 bottom-5 w-1 rounded-full"
            style={{ background: 'var(--primary)' }}
            aria-hidden="true"
          />
          <p className="text-sm sm:text-base text-[var(--text)] leading-relaxed pl-3">
            {guide.conclusion}
          </p>
        </div>
      </div>
    </section>
  );
}

function computeAvgPrice(dishes: Dish[]): number | null {
  const prices = dishes
    .map((d) => (d.latest_price != null ? Number(d.latest_price) : null))
    .filter((p): p is number => p !== null && !Number.isNaN(p));
  if (prices.length === 0) return null;
  const sum = prices.reduce((acc, p) => acc + p, 0);
  return Math.round((sum / prices.length) * 100) / 100;
}
