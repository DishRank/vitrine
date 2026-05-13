import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Outfit } from 'next/font/google';
import Script from 'next/script';
import { headers } from 'next/headers';
import { routing } from '@/i18n/routing';
import FlagPolyfill from '@/components/FlagPolyfill';
import '../globals.css';

const outfit = Outfit({ subsets: ['latin'], display: 'swap', variable: '--font-outfit' });

/**
 * Global metadata defaults — `metadataBase` is required so that relative paths
 * in `openGraph.images`, `twitter.images`, etc. resolve to absolute URLs in
 * the rendered HTML. Children pages override `title`/`description`/etc. via
 * their own `generateMetadata` exports.
 */
export const metadata: Metadata = {
  metadataBase: new URL('https://dishrank.fr'),
  applicationName: 'DishRank',
  authors: [{ name: 'DishRank' }],
  creator: 'DishRank',
  publisher: 'DishRank',
  // Default robots — pages override to noindex when needed (e.g. ?q= search results)
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  formatDetection: { telephone: false },
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as any)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();

  // Nonce CSP injecté par le middleware. Permet aux scripts inline (Next.js
  // bundle, JSON-LD, polyfill) d'être autorisés par la CSP `'strict-dynamic'`.
  const nonce = (await headers()).get('x-nonce') || undefined;

  return (
    <html
      lang={locale}
      className={outfit.variable}
      // Indique à Next.js que `scroll-behavior: smooth` est appliqué sur
      // <html> (cf. globals.css) — il peut donc désactiver temporairement
      // le smooth scroll pendant les transitions de route (sinon Next 16
      // log un warning et l'animation "smooth scroll to top" rend la nav
      // saccadée).
      // Ref : https://nextjs.org/docs/messages/missing-data-scroll-behavior
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        {/* Tags non-couverts par l'API metadata de Next.js (charset/viewport
            sont auto-générés ; on garde uniquement les tags qui sortent du
            scope du `Metadata` object). */}
        <meta name="google-site-verification" content="2eAhok2-Sg89V8rG2zC2vZ2vZsAPb_theQuN0GSc0QA" />
        <meta name="theme-color" content="#0F0D1A" />
        <meta name="color-scheme" content="light dark" />
        {/* Standard PWA tag (supersedes the deprecated apple-mobile-web-app-capable).
            We keep the Apple-prefixed version for older iOS versions that still require it. */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="DishRank" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" type="image/webp" href="/img/icon.webp" media="(prefers-color-scheme: light)" />
        <link rel="icon" type="image/webp" href="/img/logo-light.webp" media="(prefers-color-scheme: dark)" />
        <link rel="apple-touch-icon" href="/img/apple-touch-icon.png" />
        {/* Performance hints — preconnect to font CDN + dns-prefetch to Supabase
            so images and HTTP requests start earlier on first paint. */}
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://yztbhdvrvgozhyaujtjz.supabase.co" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://yztbhdvrvgozhyaujtjz.supabase.co" />
      </head>
      <body className="antialiased">
        <Script src="/js/init.js" strategy="afterInteractive" nonce={nonce} />
        <FlagPolyfill />
        <a href="#main-content" className="absolute -top-10 left-0 z-[9999] px-4 py-2 bg-[var(--primary)] text-white font-bold rounded-br-lg focus:top-0">Skip to content</a>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
