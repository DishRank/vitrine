import type { Metadata, Viewport } from 'next';
import { Outfit } from 'next/font/google';
import '../globals.css';

/**
 * Layout racine de la zone /pro (espace restaurateur).
 *
 * /pro vit HORS de [locale] (D1 du plan espace-pro-web) : URLs propres sans
 * préfixe de langue, FR-only au lancement, jamais indexé. Comme les autres
 * zones hors-locale (/join, /menu), ce segment rend son propre <html> — il n'y
 * a pas de root layout global.
 *
 * `force-dynamic` : les pages /pro reçoivent un nonce CSP par requête via le
 * proxy (strict-dynamic) — un prerender statique aurait des scripts non-noncés
 * jamais hydratés (cf. la leçon /auth/confirm dans proxy.ts).
 */
export const dynamic = 'force-dynamic';

const outfit = Outfit({ subsets: ['latin'], display: 'swap', variable: '--font-outfit' });

export const metadata: Metadata = {
  title: { default: 'Espace restaurateur — DishRank', template: '%s — DishRank Pro' },
  description: 'Gérez votre établissement sur DishRank : fiche, menu, avis et statistiques.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#6C5CE7',
};

export default function ProLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={outfit.variable}>
      <body className="min-h-screen bg-[var(--bg)] text-[var(--text)] antialiased">
        {children}
      </body>
    </html>
  );
}
