import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// Note : la Content-Security-Policy n'est PAS définie ici. Elle est générée
// par requête dans `src/proxy.ts` avec un nonce cryptographique +
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

  // Cache client (App Router) des segments dynamiques : revenir sur un onglet
  // /pro visité il y a < 30 s est INSTANTANÉ (pas de re-SSR). Les mutations
  // (Server Actions + revalidatePath) invalident le cache, donc pas de données
  // périmées après une édition.
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },

  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 31536000,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      // Hôtes d'images de DÉMO (données de seed DEV : loremflickr / unsplash),
      // autorisés UNIQUEMENT en dev local. En prod les photos viennent
      // toujours du storage Supabase → on garde l'allowlist prod minimale.
      ...(process.env.NODE_ENV === 'production'
        ? []
        : [
            { protocol: 'https' as const, hostname: 'loremflickr.com' },
            { protocol: 'https' as const, hostname: 'images.unsplash.com' },
          ]),
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
      // Chrome Privacy Preserving Prefetch Proxy probe — expects JSON
      // following the trafficadvice spec.
      {
        source: '/.well-known/traffic-advice',
        headers: [
          { key: 'Content-Type', value: 'application/trafficadvice+json; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=86400' },
        ],
      },
      // /favicon.ico contient en réalité une image WebP (renommée pour
      // satisfaire les probers /favicon.ico des browsers et Vercel).
      // On force le Content-Type pour que les browsers utilisent le
      // bon décodeur ; ils détectent de toute façon le format via
      // les magic bytes RIFF...WEBP.
      {
        source: '/favicon.ico',
        headers: [
          { key: 'Content-Type', value: 'image/webp' },
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/favicon.png',
        headers: [
          { key: 'Content-Type', value: 'image/png' },
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // iOS Safari et plusieurs navigateurs probent ces deux URLs à la
      // racine pour récupérer l'icône d'accueil même si <link rel=
      // "apple-touch-icon"> pointe ailleurs. Sans le fichier au root,
      // chaque visiteur iOS génère un 404 + un SSR par-dessus.
      {
        source: '/apple-touch-icon.png',
        headers: [
          { key: 'Content-Type', value: 'image/png' },
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/apple-touch-icon-precomposed.png',
        headers: [
          { key: 'Content-Type', value: 'image/png' },
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // RFC 9116 : indique aux chercheurs en sécurité comment signaler
      // une vulnérabilité. Mozilla Observatory et plusieurs scanners
      // de conformité vérifient sa présence.
      {
        source: '/.well-known/security.txt',
        headers: [
          { key: 'Content-Type', value: 'text/plain; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=86400' },
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
