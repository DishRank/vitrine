import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// Note : la Content-Security-Policy n'est PAS définie ici. Elle est générée
// par requête dans `src/middleware.ts` avec un nonce cryptographique +
// `'strict-dynamic'`. Définir une CSP statique ici l'écraserait avec une
// version sans nonce (= regression sécurité).
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,

  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 31536000,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      // Cache static assets aggressively
      {
        source: '/img/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // .well-known files (assetlinks.json, apple-app-site-association, …)
      // must be served with the correct Content-Type and a short cache so that
      // Google / Apple re-validate quickly when we change fingerprints.
      {
        source: '/.well-known/assetlinks.json',
        headers: [
          { key: 'Content-Type', value: 'application/json; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=300, must-revalidate' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
      {
        source: '/.well-known/apple-app-site-association',
        headers: [
          { key: 'Content-Type', value: 'application/json; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=300, must-revalidate' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
    ];
  },

  // RGPD + Play Store redirects
  async redirects() {
    return [
      { source: '/privacy', destination: '/?page=privacy', permanent: false },
      { source: '/privacy/', destination: '/?page=privacy', permanent: false },
      { source: '/legal', destination: '/?page=privacy', permanent: false },
      { source: '/legal/', destination: '/?page=privacy', permanent: false },
      { source: '/terms', destination: '/?page=terms', permanent: false },
      { source: '/terms/', destination: '/?page=terms', permanent: false },
      { source: '/delete-account', destination: '/?page=delete', permanent: false },
      { source: '/delete-account/', destination: '/?page=delete', permanent: false },
    ];
  },
};

export default withNextIntl(nextConfig);
