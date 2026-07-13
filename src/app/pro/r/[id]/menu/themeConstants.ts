/**
 * Constantes de thème du menu — copie CLIENT-SAFE de constants/menuTheme.ts
 * (app) et de la partie thème de '@/lib/menu' (qui importe next/cache →
 * server-only). Stocké dans restaurants.menu_theme (jsonb, mig.091) ; le premium
 * est imposé côté serveur (trigger 101) + au rendu (resolveMenuTheme vitrine).
 */
export type MenuThemePreset = 'ivory' | 'linen' | 'charcoal' | 'night';
export type MenuThemeFont = 'serif' | 'modern';

export interface MenuThemeConfig {
  theme: MenuThemePreset;
  accent: string;
  font: MenuThemeFont;
  photos: boolean;
  logo_url: string | null;
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
  charcoal: { bg: '#211D1B', card: '#2A2523', text: '#F2ECE3', sub: '#A89C8D', line: '#37312C', dark: true },
  night: { bg: '#14161F', card: '#1C1F2B', text: '#ECEEF5', sub: '#9AA0B0', line: '#262A38', dark: true },
};

export const MENU_THEME_ORDER: MenuThemePreset[] = ['ivory', 'linen', 'charcoal', 'night'];
export const PRESET_LABEL: Record<MenuThemePreset, string> = {
  ivory: 'Ivoire', linen: 'Lin', charcoal: 'Anthracite', night: 'Nuit',
};

export const MENU_ACCENTS: string[] = [
  '#AE8324', '#C0603A', '#6E8A5E', '#8A3B4C', '#2F8079', '#3F6DB5', '#B0722F', '#6C5CE7',
];

export const DEFAULT_MENU_THEME: MenuThemeConfig = {
  theme: 'ivory', accent: '#AE8324', font: 'serif', photos: true, logo_url: null,
};

export function normalizeMenuTheme(raw: unknown): MenuThemeConfig {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const theme = MENU_THEME_ORDER.includes(o.theme as MenuThemePreset) ? (o.theme as MenuThemePreset) : 'ivory';
  const accent = typeof o.accent === 'string' && /^#[0-9a-fA-F]{6}$/.test(o.accent) ? (o.accent as string) : '#AE8324';
  const font = o.font === 'modern' ? 'modern' : 'serif';
  const photos = o.photos !== false;
  const logo_url = typeof o.logo_url === 'string' && o.logo_url ? (o.logo_url as string) : null;
  return { theme, accent, font, photos, logo_url };
}

/** Le thème est-il « par défaut » (= vide côté serveur) ? Sert à autoriser le
 *  reset gratuit vs l'écriture premium (trigger 101). */
export function isDefaultTheme(t: MenuThemeConfig): boolean {
  return t.theme === 'ivory' && t.accent === '#AE8324' && t.font === 'serif' && t.photos && !t.logo_url;
}
