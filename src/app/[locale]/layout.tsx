import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Outfit } from 'next/font/google';
import Script from 'next/script';
import { routing } from '@/i18n/routing';
import FlagPolyfill from '@/components/FlagPolyfill';
import '../globals.css';

const outfit = Outfit({ subsets: ['latin'], display: 'swap', variable: '--font-outfit' });

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

  return (
    <html lang={locale} className={outfit.variable} suppressHydrationWarning>
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover" />
        <meta name="robots" content="index, follow" />
        <meta name="google-site-verification" content="2eAhok2-Sg89V8rG2zC2vZ2vZsAPb_theQuN0GSc0QA" />
        <meta name="theme-color" content="#0F0D1A" />
        <meta name="color-scheme" content="light dark" />
        <meta name="author" content="DishRank" />
        <meta name="format-detection" content="telephone=no" />
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
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://yztbhdvrvgozhyaujtjz.supabase.co" />
      </head>
      <body className="antialiased">
        <Script src="/js/init.js" strategy="afterInteractive" />
        <FlagPolyfill />
        <a href="#main-content" className="absolute -top-10 left-0 z-[9999] px-4 py-2 bg-[var(--primary)] text-white font-bold rounded-br-lg focus:top-0">Skip to content</a>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
