/**
 * Destination de retour (`next`) réduite à un chemin INTERNE — anti
 * open-redirect, partagé par le proxy, les pages auth, le callback et les
 * Server Actions.
 *
 * Vérifier le texte ne suffit pas : le parseur d'URL (navigateur comme
 * `new URL`) retire tabulations et retours à la ligne et lit `\` comme `/`.
 * `/\t/evil.com` passait donc « commence par / mais pas par // » et devenait
 * `//evil.com`, soit evil.com (audit M1, puis relecture MFA du 05/11). On
 * refuse les caractères de contrôle et `\`, puis on parse réellement et on
 * exige la même origine.
 */
const BASE = 'https://dishrank.invalid';

export function safeNextPath(raw: unknown, fallback = '/pro/espace'): string {
  if (typeof raw !== 'string' || !raw.startsWith('/')) return fallback;
  if (/[\x00-\x1f\x7f\\]/.test(raw)) return fallback;
  try {
    const url = new URL(raw, BASE);
    if (url.origin !== BASE) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

/** Variante sans repli : `undefined` si la destination n'est pas sûre. */
export function safeNextPathOrUndefined(raw: unknown): string | undefined {
  const v = safeNextPath(raw, '');
  return v || undefined;
}
