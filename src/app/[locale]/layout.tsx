import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import '../globals.css';

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
    <html lang={locale} suppressHydrationWarning>
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
        <meta name="theme-color" content="#0F0D1A" />
        <link rel="icon" type="image/png" href="/img/icon.png" media="(prefers-color-scheme: light)" />
        <link rel="icon" type="image/png" href="/img/logo-light.png" media="(prefers-color-scheme: dark)" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
        {/* Skip to main content for accessibility */}
        <style dangerouslySetInnerHTML={{ __html: `.skip-link{position:absolute;top:-40px;left:0;z-index:9999;padding:8px 16px;background:var(--primary);color:#fff;font-weight:700;border-radius:0 0 8px 0}.skip-link:focus{top:0}` }} />
        <link rel="dns-prefetch" href="https://yztbhdvrvgozhyaujtjz.supabase.co" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var d=document.documentElement;if(window.matchMedia('(prefers-color-scheme:dark)').matches)d.classList.add('dark');})()`,
          }}
        />
        {/* GA4 Consent Mode: default denied until user accepts */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('consent','default',{analytics_storage:'denied'});gtag('js',new Date());`,
          }}
        />
        {/* Organization JSON-LD */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'DishRank',
              url: 'https://dishrank.fr',
              logo: 'https://dishrank.fr/img/icon.png',
              description: 'Note les plats, pas les restos.',
              contactPoint: { '@type': 'ContactPoint', email: 'contact@dishrank.fr', contactType: 'customer service' },
              sameAs: ['https://play.google.com/store/apps/details?id=com.dishrank.app'],
            }),
          }}
        />
        {/* WebApplication JSON-LD */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebApplication',
              name: 'DishRank',
              url: 'https://dishrank.fr',
              applicationCategory: 'FoodEstablishment',
              operatingSystem: 'Android',
              offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
              aggregateRating: { '@type': 'AggregateRating', ratingValue: '5', ratingCount: '1', bestRating: '5' },
            }),
          }}
        />
      </head>
      <body className="antialiased">
        <a href="#main-content" className="skip-link">Skip to content</a>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
