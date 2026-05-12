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
        //
        // Note : `/*?page=` est volontairement AUTORISÉ (privacy/terms/delete).
        // Le canonical URL renvoie vers `/` donc pas de risque de duplicate
        // content. Bloquer ces URLs faisait remonter une erreur "Blocked by
        // robots.txt" dans Bing Webmaster (les liens footer pointent dessus)
        // et empêchait la découverte des pages légales par les crawlers — ce
        // qui est contre-productif pour la conformité CNIL et la confiance.
        disallow: ['/auth/', '/dish', '/*?q='],
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
