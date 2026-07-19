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
  /**
   * Fond LIBRE (#RRGGBB) — prioritaire sur `theme` quand présent. null/absent ⇒
   * ambiance preset (comportement historique, zéro migration). Le reste de la
   * palette (card/text/sub/line/dark) n'est JAMAIS stocké : il est recalculé au
   * rendu par `deriveMenuPalette` → aucun chemin d'écriture ne peut produire un
   * menu illisible. Priorité figée partout : bg valide > preset > ivoire.
   */
  bg: string | null;
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
  theme: 'ivory', bg: null, accent: '#AE8324', font: 'serif', photos: true, logo_url: null, show_logo: true,
};

// ── Maths couleur & dérivation de palette ────────────────────────────────────
// ⚠️ Copie MIROIR de app/constants/menuTheme.ts (dépôts séparés) : toute
// divergence de formule ⇒ aperçu mobile ≠ menu réel. Garder les deux identiques.

interface RGB { r: number; g: number; b: number }
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

function hexToRgb(hex: string): RGB {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  const int = m ? parseInt(m[1], 16) : 0;
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}
const to2 = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');
const rgbToHex = ({ r, g, b }: RGB) => `#${to2(r)}${to2(g)}${to2(b)}`.toUpperCase();

const lin = (c: number) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
const unlin = (c: number) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(Math.max(0, c), 1 / 2.4) - 0.055);

/** Luminance relative WCAG. */
function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
/** Ratio de contraste WCAG (1 → 21). */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// OKLab (Björn Ottosson) : un même écart de L = un même écart de clarté PERÇUE
// sur les 360° de teinte. En HSL, un fond jaune et un bleu de même L divergent
// d'un facteur ~3 en contraste réel — d'où OKLab et pas HSL.
function rgbToOklab(hex: string): { L: number; a: number; b: number } {
  const { r, g, b } = hexToRgb(hex);
  const R = lin(r), G = lin(g), B = lin(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}
function oklabToRgb(L: number, a: number, bb: number): RGB {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * bb;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * bb;
  const s_ = L - 0.0894841775 * a - 1.291485548 * bb;
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  return {
    r: unlin(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: unlin(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: unlin(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  };
}
/** Même teinte, clarté OKLab cible. La chroma est réduite par dichotomie si la
 *  couleur sort du gamut sRGB — sans ça, clamper les canaux fait DÉRIVER la
 *  teinte et l'owner ne reconnaît plus sa couleur. */
function withLightness(hex: string, targetL: number): string {
  const { a, b } = rgbToOklab(hex);
  let lo = 0, hi = 1;
  let best = oklabToRgb(targetL, 0, 0);
  for (let i = 0; i < 14; i++) {
    const f = (lo + hi) / 2;
    const c = oklabToRgb(targetL, a * f, b * f);
    const ok = c.r >= -0.5 && c.r <= 255.5 && c.g >= -0.5 && c.g <= 255.5 && c.b >= -0.5 && c.b <= 255.5;
    if (ok) { best = c; lo = f; } else hi = f;
  }
  return rgbToHex(best);
}
function mix(a: string, b: string, t: number): string {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex({ r: A.r + (B.r - A.r) * t, g: A.g + (B.g - A.g) * t, b: A.b + (B.b - A.b) * t });
}

/** Encre à poser SUR l'accent — décidée par la luminance de l'ACCENT lui-même
 *  (et non par la clarté du fond, erreur historique des 4 ternaires du rendu). */
export function accentInk(accent: string): string {
  const a = HEX_RE.test(accent) ? accent : '#AE8324';
  return contrastRatio(a, '#FFFFFF') >= contrastRatio(a, '#000000') ? '#FFFFFF' : '#141018';
}

/**
 * Palette lisible dérivée d'un fond LIBRE. Le fond n'est JAMAIS modifié (WYSIWYG).
 * Théorème de polarité : sur n'importe quel fond sRGB, l'encre du meilleur pôle
 * (noir ou blanc) atteint ≥ 4.58:1 — la lisibilité est garantie par construction,
 * le clamp ne fait que la ramener après teintage. Renvoie null si hex invalide.
 */
export function deriveMenuPalette(bg: string): MenuPreset | null {
  if (!HEX_RE.test(bg)) return null;
  const BG = bg.toUpperCase();
  const dark = contrastRatio(BG, '#FFFFFF') >= contrastRatio(BG, '#000000');
  const pole = dark ? '#FFFFFF' : '#000000';
  const Lbg = rgbToOklab(BG).L;

  // Encre principale : le pôle garantit ≥ 4.58:1 sur le fond ; on la teinte
  // légèrement du fond pour l'harmonie, puis on la ramène vers le pôle pur
  // tant que AA n'est pas atteint.
  let text = withLightness(BG, dark ? 0.96 : 0.24);
  for (let i = 0; i < 14 && contrastRatio(text, BG) < 4.5; i++) text = mix(text, pole, 0.3);

  // Plan « carte » : on s'ÉLOIGNE du pôle de l'encre (encre claire ⇒ carte plus
  // sombre que le fond, et inversement). Conséquence : contraste texte/carte ≥
  // texte/fond, donc AA acquis SANS clamp. Élever la carte VERS le pôle (réflexe
  // « élévation » habituel) casse la lisibilité sur les fonds mi-saturés.
  const away = dark ? -1 : 1;
  // Escalade la clarté jusqu'à ce que la carte soit PERCEPTIBLE sur le fond :
  // sans ça la tuile du logo, les surfaces de la barre d'outils et la feuille de
  // notation se fondent dans le fond sur les couleurs extrêmes.
  const makeCard = (dir: number) => {
    let c = BG;
    for (let k = 1; k <= 6; k++) {
      c = withLightness(BG, clamp01(Lbg + dir * 0.055 * k));
      if (contrastRatio(c, BG) >= 1.05) break;
    }
    return c;
  };
  let card = makeCard(away);
  if (contrastRatio(card, BG) < 1.05) {
    // Pas de place dans ce sens (fond quasi noir/blanc) → sens opposé, et on
    // renforce l'encre pour tenir AA sur cette carte.
    card = makeCard(-away);
    for (let i = 0; i < 14 && contrastRatio(text, card) < 4.5; i++) text = mix(text, pole, 0.3);
  }

  // Filet : séparateur répété de toute la carte — visible mais discret.
  const line = mix(BG, text, dark ? 0.16 : 0.13);

  // Encre secondaire : atténuée, mais ≥ 3:1 sur le fond, la carte ET le filet
  // (les badges peignent `sub` SUR `line` — couple le plus fragile).
  let sub = mix(text, BG, 0.45);
  for (
    let i = 0;
    i < 14 &&
    (contrastRatio(sub, BG) < 3 || contrastRatio(sub, card) < 3 || contrastRatio(sub, line) < 3);
    i++
  ) {
    sub = mix(sub, text, 0.25);
  }

  return { bg: BG, card, text, sub, line, dark };
}

/** Preset le plus proche d'un fond libre — écrit dans `theme` comme repli pour
 *  les consommateurs pas encore à jour (ils affichent une ambiance voisine,
 *  jamais de l'ivoire hors sujet). */
export function nearestPreset(bg: string): MenuThemePreset {
  if (!HEX_RE.test(bg)) return 'ivory';
  const t = rgbToOklab(bg);
  const dark = contrastRatio(bg, '#FFFFFF') >= contrastRatio(bg, '#000000');
  let best: MenuThemePreset = dark ? 'charcoal' : 'ivory';
  let bestD = Infinity;
  for (const k of MENU_THEME_ORDER) {
    const p = MENU_THEME_PRESETS[k];
    if (p.dark !== dark) continue;
    const o = rgbToOklab(p.bg);
    const d = (o.L - t.L) ** 2 + (o.a - t.a) ** 2 + (o.b - t.b) ** 2;
    if (d < bestD) { bestD = d; best = k; }
  }
  return best;
}

export function normalizeMenuTheme(raw: unknown): MenuThemeConfig {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const theme = MENU_THEME_ORDER.includes(o.theme as MenuThemePreset) ? (o.theme as MenuThemePreset) : 'ivory';
  // Fond libre : validé strictement, jamais muté. Rien de DÉRIVÉ n'est accepté
  // ici (card/text/... arrivés par une route détournée sont activement jetés).
  const bg = typeof o.bg === 'string' && /^#[0-9a-fA-F]{6}$/.test(o.bg) ? o.bg.toUpperCase() : null;
  const accent = typeof o.accent === 'string' && /^#[0-9a-fA-F]{6}$/.test(o.accent) ? (o.accent as string) : '#AE8324';
  const font: MenuThemeFont = typeof o.font === 'string' && o.font in MENU_FONTS ? (o.font as MenuThemeFont) : 'serif';
  const photos = o.photos !== false;
  const logo_url = typeof o.logo_url === 'string' && o.logo_url ? (o.logo_url as string) : null;
  const show_logo = o.show_logo !== false; // clé absente ⇒ true (rétrocompat)
  return { theme, bg, accent, font, photos, logo_url, show_logo };
}

/** Le thème est-il « par défaut » (= vide côté serveur) ? Sert à autoriser le
 *  reset gratuit vs l'écriture premium (trigger 101). */
export function isDefaultTheme(t: MenuThemeConfig): boolean {
  // `t.bg == null` est OBLIGATOIRE : sans lui, un thème dont SEUL le fond change
  // reste « défaut » → l'API écrit {} en base, l'owner voit « Enregistré », et
  // le fond a disparu au rechargement (perte silencieuse).
  return (
    t.theme === 'ivory' && t.bg == null && t.accent === '#AE8324' && t.font === 'serif' &&
    t.photos && !t.logo_url && t.show_logo
  );
}
