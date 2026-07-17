/**
 * Constantes de thème du menu — copie CLIENT-SAFE de constants/menuTheme.ts
 * (app) et de la partie thème de '@/lib/menu' (qui importe next/cache →
 * server-only). Stocké dans restaurants.menu_theme (jsonb, mig.091) ; le premium
 * est imposé côté serveur (trigger 101) + au rendu (resolveMenuTheme vitrine).
 */
export type MenuThemePreset =
  | 'ivory' | 'linen' | 'sage' | 'blush' | 'charcoal' | 'night' | 'forest' | 'wine';
// ── Polices d'affichage du menu ──────────────────────────────────────────────
// Stacks 100 % système pour les 2 polices historiques (aucune webfont, CSP-safe).
const SERIF_STACK =
  "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, 'Times New Roman', serif";
const SANS_STACK =
  "'Avenir Next', 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif";

/**
 * Registre unique des polices d'affichage — source de vérité app↔vitrine pour
 * les CLÉS. `google` = nom d'export next/font/google chargé par MenuBridge (vide
 * = stack purement système, pas de webfont). `stack` = famille CSS du rendu web
 * (les webfonts pointent la var CSS injectée par next/font, avec repli système).
 * `serif`/`modern` restent LITTÉRAUX → zéro changement pour l'existant, zéro
 * migration. Mobile ne rend que le fallback système (parité picker = rebuild natif).
 */
export const MENU_FONTS = {
  serif: { label: 'Classique', google: '', stack: SERIF_STACK },
  modern: { label: 'Moderne', google: '', stack: SANS_STACK },
  fraunces: { label: 'Artisanale', google: 'Fraunces', stack: `var(--font-fraunces), ${SERIF_STACK}` },
  cormorant: { label: 'Gastronomique', google: 'Cormorant_Garamond', stack: `var(--font-cormorant), ${SERIF_STACK}` },
  bitter: { label: 'Rustique', google: 'Bitter', stack: `var(--font-bitter), ${SERIF_STACK}` },
  playfair: { label: 'Chic', google: 'Playfair_Display', stack: `var(--font-playfair), ${SERIF_STACK}` },
  oswald: { label: 'Bistrot', google: 'Oswald', stack: `var(--font-oswald), ${SANS_STACK}` },
  poppins: { label: 'Conviviale', google: 'Poppins', stack: `var(--font-poppins), ${SANS_STACK}` },
} as const;

export type MenuThemeFont = keyof typeof MENU_FONTS;
export const MENU_FONT_ORDER: MenuThemeFont[] = [
  'serif', 'modern', 'fraunces', 'cormorant', 'playfair', 'bitter', 'oswald', 'poppins',
];

export interface MenuThemeConfig {
  theme: MenuThemePreset;
  accent: string;
  font: MenuThemeFont;
  photos: boolean;
  /** LE logo unique du resto (celui de la fiche) — même champ des deux côtés. */
  logo_url: string | null;
  /** Afficher ce logo en tête du menu. Défaut true (clé absente ⇒ true). */
  show_logo: boolean;
}

export interface MenuPreset {
  bg: string;
  card: string;
  text: string;
  sub: string;
  line: string;
  dark: boolean;
}

export const MENU_THEME_PRESETS: Record<MenuThemePreset, MenuPreset> = {
  ivory: { bg: '#FBF8F3', card: '#FFFFFF', text: '#2A241E', sub: '#8C8478', line: '#EBE4D8', dark: false },
  linen: { bg: '#F5EEE3', card: '#FFFDF9', text: '#3A2E22', sub: '#90806A', line: '#E5DAC8', dark: false },
  sage: { bg: '#F1F4EC', card: '#FFFFFF', text: '#2C3327', sub: '#7C8570', line: '#E0E6D6', dark: false },
  blush: { bg: '#FBF3F1', card: '#FFFFFF', text: '#3A2A2A', sub: '#9A8480', line: '#F0E1DD', dark: false },
  charcoal: { bg: '#211D1B', card: '#2A2523', text: '#F2ECE3', sub: '#A89C8D', line: '#37312C', dark: true },
  night: { bg: '#14161F', card: '#1C1F2B', text: '#ECEEF5', sub: '#9AA0B0', line: '#262A38', dark: true },
  forest: { bg: '#12201A', card: '#1B2C24', text: '#E8F0E9', sub: '#93A89B', line: '#24382F', dark: true },
  wine: { bg: '#1E1315', card: '#2A1B1E', text: '#F2E7E5', sub: '#B39A9A', line: '#3A2429', dark: true },
};

export const MENU_THEME_ORDER: MenuThemePreset[] = [
  'ivory', 'linen', 'sage', 'blush', 'charcoal', 'night', 'forest', 'wine',
];
export const PRESET_LABEL: Record<MenuThemePreset, string> = {
  ivory: 'Ivoire', linen: 'Lin', sage: 'Sauge', blush: 'Rosé',
  charcoal: 'Anthracite', night: 'Nuit', forest: 'Forêt', wine: 'Bordeaux',
};

export const MENU_ACCENTS: string[] = [
  '#AE8324', '#C0603A', '#6E8A5E', '#8A3B4C', '#2F8079', '#3F6DB5', '#B0722F', '#6C5CE7',
];

export const DEFAULT_MENU_THEME: MenuThemeConfig = {
  theme: 'ivory', accent: '#AE8324', font: 'serif', photos: true, logo_url: null, show_logo: true,
};

export function normalizeMenuTheme(raw: unknown): MenuThemeConfig {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const theme = MENU_THEME_ORDER.includes(o.theme as MenuThemePreset) ? (o.theme as MenuThemePreset) : 'ivory';
  const accent = typeof o.accent === 'string' && /^#[0-9a-fA-F]{6}$/.test(o.accent) ? (o.accent as string) : '#AE8324';
  const font: MenuThemeFont = typeof o.font === 'string' && o.font in MENU_FONTS ? (o.font as MenuThemeFont) : 'serif';
  const photos = o.photos !== false;
  const logo_url = typeof o.logo_url === 'string' && o.logo_url ? (o.logo_url as string) : null;
  const show_logo = o.show_logo !== false; // clé absente ⇒ true (rétrocompat)
  return { theme, accent, font, photos, logo_url, show_logo };
}

/** Le thème est-il « par défaut » (= vide côté serveur) ? Sert à autoriser le
 *  reset gratuit vs l'écriture premium (trigger 101). */
export function isDefaultTheme(t: MenuThemeConfig): boolean {
  return (
    t.theme === 'ivory' && t.accent === '#AE8324' && t.font === 'serif' && t.photos && !t.logo_url && t.show_logo
  );
}
