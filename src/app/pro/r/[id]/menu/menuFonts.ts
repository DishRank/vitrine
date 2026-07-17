import { Fraunces, Cormorant_Garamond, Bitter, Playfair_Display, Oswald, Poppins } from 'next/font/google';

/**
 * Webfonts d'affichage du menu (choix premium) — auto-hébergées par next/font
 * (woff2 sous /_next/static/media, même origine → CSP-safe, cf. audit). Chaque
 * police expose une var CSS que `MENU_FONTS.stack` (themeConstants) référence.
 *
 * Module partagé : la page menu publique (MenuBridge, route autonome sans layout)
 * ET l'aperçu de l'éditeur d'apparence chargent la MÊME classe de vars → le
 * rendu live et la prévisualisation utilisent exactement les mêmes polices.
 * Les clés/vars doivent rester alignées sur MENU_FONTS.
 */
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', display: 'swap' });
const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-cormorant',
  display: 'swap',
});
const bitter = Bitter({ subsets: ['latin'], variable: '--font-bitter', display: 'swap' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair', display: 'swap' });
const oswald = Oswald({ subsets: ['latin'], variable: '--font-oswald', display: 'swap' });
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
});

/** Classe cumulant les vars CSS — à poser sur un ancêtre (html de MenuBridge, ou
 *  le conteneur de l'aperçu éditeur) pour que `var(--font-*)` résolve. */
export const MENU_FONT_VARS = [fraunces, cormorant, bitter, playfair, oswald, poppins]
  .map((f) => f.variable)
  .join(' ');
