import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Don't index endpoints that don't add value to search results.
        // - /auth/*  : Supabase email confirm landing (deeplink target only)
        // - /dish?*  : deeplink page (already noindex via meta but belt-and-suspenders)
        // - /*?q=*   : in-page text search results (would create infinite duplicates)
        // - /*?page= : legal sheet open state (rendered modally on the homepage)
        disallow: ['/auth/', '/dish', '/*?q=', '/*?page='],
      },
      // Block known scraper bots that abuse crawl budget without sending traffic
      { userAgent: 'AhrefsBot', disallow: '/' },
      { userAgent: 'SemrushBot', disallow: '/' },
      { userAgent: 'MJ12bot', disallow: '/' },
      { userAgent: 'DotBot', disallow: '/' },
    ],
    sitemap: 'https://dishrank.fr/sitemap.xml',
    host: 'https://dishrank.fr',
  };
}
