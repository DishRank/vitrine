/**
 * Feuilles JSONB d'un plat (variantes / options / disponibilité) — miroir web
 * de dishrank/lib/menuTypes.ts. Types + validation client alignés sur le trigger
 * DB `validate_menu_item_leaves()` (le serveur reste juge). Les validateurs
 * renvoient un message FR ou null (la vitrine est FR-only).
 */

export const MENU_SERVICES = ['lunch', 'dinner'] as const;
export type MenuService = (typeof MENU_SERVICES)[number];

/** Feuilles de traduction des variantes/options (EN/ES/DE/IT). fr = champ source
 *  (label/name). Même convention que menu_items.i18n : une entrée sans contenu
 *  est omise ; le renderer retombe sur la source si la locale manque. */
export type LeafI18nLabel = Record<string, { label?: string }>;
export type LeafI18nName = Record<string, { name?: string }>;

export interface MenuVariant {
  id: string;
  label: string;
  price: number;
  i18n?: LeafI18nLabel;
}

export interface MenuOptionChoice {
  label: string;
  price_delta?: number;
  i18n?: LeafI18nLabel;
}

export interface MenuOption {
  id: string;
  name: string;
  required?: boolean;
  max?: number;
  choices: MenuOptionChoice[];
  i18n?: LeafI18nName;
}

export interface MenuAvailability {
  services?: MenuService[];
  days?: number[];
  season?: { from: string; to: string };
}

// ── Formules (kind='formula') ────────────────────────────────────────────────

export interface FormulaPrice {
  label: string;
  price: number;
}

/** Un cran de formule (Entrée / Plat / Dessert) : soit tous les items d'une
 *  section, soit une liste d'items explicite. */
export interface FormulaSlot {
  name: string;
  source: { section_id?: string | null; item_ids?: string[] };
  supplements?: { item_id: string; price_delta: number }[];
}

export interface FormulaConfig {
  prices: FormulaPrice[];
  slots: FormulaSlot[];
}

/** Id local stable pour les entrées de tableaux (jamais joint en base). */
export function newLeafId(): string {
  return `l_${Math.random().toString(36).slice(2, 10)}`;
}

// ── Validation (miroir du trigger) ──────────────────────────────────────────

export function validateVariants(variants: MenuVariant[]): string | null {
  for (const v of variants) {
    if (!v.label || !v.label.trim()) return 'Chaque variante doit avoir un libellé.';
    if (typeof v.price !== 'number' || !Number.isFinite(v.price) || v.price < 0)
      return 'Prix de variante invalide.';
  }
  return null;
}

export function validateOptions(options: MenuOption[]): string | null {
  for (const o of options) {
    if (!o.name || !o.name.trim()) return 'Chaque groupe d’options doit avoir un nom.';
    if (!Array.isArray(o.choices) || o.choices.length === 0)
      return 'Chaque groupe d’options doit avoir au moins un choix.';
    for (const ch of o.choices) {
      if (!ch.label || !ch.label.trim()) return 'Chaque choix doit avoir un libellé.';
      if (
        ch.price_delta != null &&
        (typeof ch.price_delta !== 'number' || !Number.isFinite(ch.price_delta) || ch.price_delta < 0)
      )
        return 'Supplément de choix invalide.';
    }
  }
  return null;
}

export function validateFormulaConfig(c: FormulaConfig | null): string | null {
  if (!c || !Array.isArray(c.prices) || c.prices.length === 0)
    return 'Une formule doit avoir au moins un prix.';
  for (const p of c.prices) {
    if (!p.label || !p.label.trim()) return 'Chaque prix de formule doit avoir un libellé.';
    if (typeof p.price !== 'number' || !Number.isFinite(p.price) || p.price < 0)
      return 'Prix de formule invalide.';
  }
  if (!Array.isArray(c.slots)) return 'Formule invalide.';
  for (const s of c.slots) {
    if (!s.name || !s.name.trim()) return 'Chaque étape de la formule doit avoir un nom.';
  }
  return null;
}

const MMDD = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function validateAvailability(av: MenuAvailability): string | null {
  if (av.season) {
    if (!MMDD.test(av.season.from) || !MMDD.test(av.season.to))
      return 'Saison invalide (format attendu MM-JJ).';
  }
  return null;
}

/**
 * Nettoie ce que renvoie le formulaire en objet `availability` canonique :
 * un service/jour n'est enregistré QUE s'il restreint réellement (sinon =
 * toujours disponible → on omet), pour rester cohérent avec l'app.
 */
export function normalizeAvailability(input: {
  services: string[];
  days: number[];
  seasonFrom: string;
  seasonTo: string;
}): MenuAvailability {
  const out: MenuAvailability = {};
  const services = input.services.filter((s): s is MenuService => s === 'lunch' || s === 'dinner');
  if (services.length === 1) out.services = services;
  const days = input.days.filter((d) => d >= 1 && d <= 7);
  if (days.length > 0 && days.length < 7) out.days = [...days].sort((a, b) => a - b);
  const from = input.seasonFrom.trim();
  const to = input.seasonTo.trim();
  if (from && to) out.season = { from, to };
  return out;
}
