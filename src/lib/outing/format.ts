import { CUISINE_BY_SLUG } from '@/lib/pro/cuisines';
import type { Outing, OutingCandidate, OutingWinner } from './types';

/**
 * Mise en forme des sorties (page /s/<jeton>). Tout est calculé dans le fuseau
 * de Paris, côté serveur comme côté navigateur : le rendu serveur et
 * l'hydratation produisent le même texte, quel que soit le fuseau du visiteur.
 */

const TZ = 'Europe/Paris';

const dayFmt = new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' });
const shortDayFmt = new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' });
const timeFmt = new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
const ymdFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** « Jeudi 23 octobre » */
export function dayLabel(iso: string): string {
  return cap(dayFmt.format(new Date(iso)));
}

/** « 20:00 » */
export function timeLabel(iso: string): string {
  return timeFmt.format(new Date(iso)).replace(/\s/g, '');
}

/** « jeudi 23 octobre à 20:00 » (dans une phrase). */
export function whenSentence(iso: string): string {
  return `${dayFmt.format(new Date(iso))} à ${timeLabel(iso)}`;
}

/** « jeu. 23 oct. à 20:00 » (titres courts, OG). */
export function whenShort(iso: string): string {
  return `${shortDayFmt.format(new Date(iso))} à ${timeLabel(iso)}`;
}

const sameParisDay = (a: string, b: string) => ymdFmt.format(new Date(a)) === ymdFmt.format(new Date(b));

/** « jusqu’à 18:00 » si le vote se clôt le jour de la sortie, sinon « jusqu’au mer. 22 oct. à 18:00 ». */
export function deadlineLabel(deadline: string, planned: string | null): string {
  if (planned && sameParisDay(deadline, planned)) return `jusqu’à ${timeLabel(deadline)}`;
  return `jusqu’au ${whenShort(deadline)}`;
}

/** Temps restant avant l'heure limite : « encore 3 h 12 », « encore 8 min ». */
export function remainingLabel(deadline: string, now: number): string | null {
  const ms = new Date(deadline).getTime() - now;
  if (ms <= 0) return null;
  const min = Math.ceil(ms / 60_000);
  if (min < 60) return `encore ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) {
    const m = min % 60;
    return m ? `encore ${h} h ${String(m).padStart(2, '0')}` : `encore ${h} h`;
  }
  return `encore ${Math.round(h / 24)} jours`;
}

const num1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const euro = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const euroCents = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function distanceLabel(km: number | null): string | null {
  if (km == null || !Number.isFinite(km)) return null;
  if (km < 1) return `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m`;
  return `${num1.format(km)} km`;
}

/** « 15 € » ou « 7,50 € » — jamais « 15,00 € ». */
export function priceLabel(price: number | null): string | null {
  if (price == null || !Number.isFinite(price) || price <= 0) return null;
  const rounded = Math.round(price * 100) / 100;
  return `${Number.isInteger(rounded) ? euro.format(rounded) : euroCents.format(rounded)}\u00a0€`;
}

export function ratingLabel(rating: number | null): string | null {
  if (rating == null || !Number.isFinite(rating)) return null;
  return num1.format(Math.round(rating * 10) / 10);
}

/** Cuisines lisibles (2 au plus), à partir des slugs stockés en base. */
export function cuisineLabels(slugs: string[]): string[] {
  const out: string[] = [];
  for (const s of slugs ?? []) {
    const c = CUISINE_BY_SLUG.get(s);
    if (c && !out.includes(c.name)) out.push(c.name);
    if (out.length === 2) break;
  }
  return out;
}

const PLACE_WORD: Record<OutingCandidate['place_type'], string> = {
  restaurant: 'Restaurant',
  bar: 'Bar',
  cafe: 'Café',
};
export const placeWord = (t: OutingCandidate['place_type']) => PLACE_WORD[t] ?? 'Restaurant';

export function centerLabel(o: Outing): string | null {
  if (o.center?.from_group) return 'Au milieu du groupe';
  const l = o.center?.label?.trim();
  return l ? `Autour de ${l}` : null;
}

export function firstLetter(name: string | null | undefined): string {
  const t = (name ?? '').trim();
  return t ? t.charAt(0).toUpperCase() : '?';
}

/** « Léa », « Léa et Tom », « Léa, Tom et 2 autres ». */
export function namesSentence(names: string[], max = 2): string {
  const n = names.filter(Boolean);
  if (n.length === 0) return '';
  if (n.length === 1) return n[0];
  if (n.length <= max) return `${n.slice(0, -1).join(', ')} et ${n[n.length - 1]}`;
  const rest = n.length - max;
  return `${n.slice(0, max).join(', ')} et ${rest} autre${rest > 1 ? 's' : ''}`;
}

type Place = Pick<OutingWinner, 'name' | 'address' | 'city' | 'lat' | 'lng' | 'google_place_id'>;

/** Fiche Google Maps : par identifiant de lieu si connu, sinon recherche nom + adresse. */
export function googleMapsUrl(p: Place): string {
  const q = [p.name, p.address, p.city].filter(Boolean).join(', ');
  const base = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q || `${p.lat},${p.lng}`)}`;
  return p.google_place_id ? `${base}&query_place_id=${encodeURIComponent(p.google_place_id)}` : base;
}

export function appleMapsUrl(p: Place): string {
  const q = encodeURIComponent(p.name);
  if (p.lat != null && p.lng != null) return `https://maps.apple.com/?q=${q}&ll=${p.lat},${p.lng}&daddr=${p.lat},${p.lng}`;
  return `https://maps.apple.com/?q=${encodeURIComponent([p.name, p.address, p.city].filter(Boolean).join(', '))}`;
}

/** Lien http(s) sûr ou null (les URL viennent d'OpenStreetMap / Google). */
export function safeHttpUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  const withScheme = /^https?:\/\//i.test(v) ? v : /^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(v) ? `https://${v}` : null;
  if (!withScheme) return null;
  try {
    const u = new URL(withScheme);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

export function telHref(phone: string | null | undefined): string | null {
  const digits = (phone ?? '').replace(/[^\d+]/g, '');
  return digits.length >= 6 ? `tel:${digits}` : null;
}

/* ── Calendrier ─────────────────────────────────────────────────────────── */

const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

/** Fichier .ics (événement de 2 h à l'heure prévue). */
export function buildIcs(o: Outing, w: OutingWinner, pageUrl: string): string | null {
  if (!o.planned_at) return null;
  const start = new Date(o.planned_at);
  const end = new Date(start.getTime() + 2 * 3600_000);
  const where = [w.name, w.address, w.city].filter(Boolean).join(', ');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//DishRank//Sorties//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    // L'id de la sortie n'est pas public : le jeton du lien identifie l'événement.
    `UID:dishrank-s-${pageUrl.split('/').pop()}@dishrank.fr`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsText(`${w.name} avec ${o.group.name}`)}`,
    `LOCATION:${icsText(where)}`,
    `DESCRIPTION:${icsText(`Sortie organisée sur DishRank\n${pageUrl}`)}`,
    `URL:${pageUrl}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n') + '\r\n';
}

/* ── Erreurs des RPC → phrases claires ──────────────────────────────────── */

export type OutingErrorKind =
  | 'closed' | 'gone' | 'full' | 'identity' | 'stale' | 'name' | 'network' | 'unavailable' | 'unknown';

export function classifyError(err: unknown): OutingErrorKind {
  const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  if (/Outing closed/i.test(msg)) return 'closed';
  if (/Outing not found/i.test(msg)) return 'gone';
  if (/Too many guests/i.test(msg)) return 'full';
  if (/Invalid guest/i.test(msg)) return 'identity';
  if (/not in candidates/i.test(msg)) return 'stale';
  if (/Name required/i.test(msg)) return 'name';
  if (msg === 'unavailable') return 'unavailable';
  if (/fetch|network|Load failed|NetworkError|timeout/i.test(msg)) return 'network';
  return 'unknown';
}

export const ERROR_TEXT: Record<OutingErrorKind, string> = {
  closed: 'Le vote est terminé : ton choix n’a pas pu être ajouté.',
  gone: 'Cette sortie n’existe plus.',
  full: 'Trente invités ont déjà rejoint cette sortie, c’est le maximum.',
  identity: 'Ton vote sur cet appareil a été réinitialisé. Indique ton prénom pour continuer.',
  stale: 'Ce lieu ne fait plus partie des propositions.',
  name: 'Écris ton prénom pour voter.',
  network: 'Pas de connexion : ton choix n’a pas été enregistré.',
  unavailable: 'Le vote en ligne est momentanément indisponible. Réessaie plus tard.',
  unknown: 'Ton choix n’a pas été enregistré.',
};
