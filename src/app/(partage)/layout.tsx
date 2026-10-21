import type { Metadata, Viewport } from 'next';
import { Outfit } from 'next/font/google';
import localFont from 'next/font/local';
import '../globals.css';

/**
 * Racine des pages de PARTAGE ouvertes depuis un message (WhatsApp, SMS…) :
 *  - /s/<jeton> : vote d'une sortie sans compte ;
 *  - /g/<code>  : invitation à rejoindre un groupe.
 *
 * Comme /join et /menu, ce segment vit hors de [locale] (URL courtes, FR) et
 * rend son propre <html> — il n'y a pas de layout racine global. Le groupe de
 * routes `(partage)` n'apparaît pas dans l'URL.
 *
 * `force-dynamic` : le proxy pose un nonce CSP par requête (strict-dynamic) ;
 * un rendu statique aurait des scripts non noncés, jamais hydratés.
 */
export const dynamic = 'force-dynamic';

const outfit = Outfit({ subsets: ['latin'], display: 'swap', variable: '--font-outfit' });
const display = localFont({
  src: '../../fonts/bricolage-grotesque-latin-wdth.woff2',
  variable: '--font-display',
  weight: '200 800',
  display: 'swap',
  declarations: [{ prop: 'font-stretch', value: '75% 100%' }],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://dishrank.fr'),
  applicationName: 'DishRank',
  robots: { index: false, follow: false },
  icons: { icon: '/img/icon-v2.webp', apple: '/apple-touch-icon.png' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FAF7F2' },
    { media: '(prefers-color-scheme: dark)', color: '#14100E' },
  ],
};

export default function PartageLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${outfit.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
