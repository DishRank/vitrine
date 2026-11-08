/**
 * IP du visiteur, pour les limiteurs (Route Handlers et Server Components).
 *
 * x-real-ip est posé par Vercel (fiable). À défaut, l'entrée la plus à DROITE
 * de x-forwarded-for, celle ajoutée par notre edge : la gauche est fournie par
 * le client et spoofable (cf. audit M2), une fausse IP par requête suffisait à
 * contourner le limiteur. Même logique que `src/proxy.ts` et
 * `src/app/pro/actions.ts`.
 */
export function clientIp(h: { get(name: string): string | null }): string {
  const real = h.get('x-real-ip');
  if (real) return real.trim();
  const xff = h.get('x-forwarded-for');
  if (xff) {
    const parts = xff
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return 'unknown';
}

/**
 * Clé de limiteur pour une IP : l'IPv4 telle quelle, l'IPv6 ramenée à son
 * préfixe /64. Un FAI ou un hébergeur attribue un /64 entier à un seul client :
 * limiter l'adresse exacte lui laisserait 2^64 adresses à faire tourner.
 */
export function ipBucket(ip: string): string {
  const clean = ip.replace(/^\[|\]$/g, '').split('%')[0];
  if (!clean.includes(':')) return clean;
  // IPv4 encapsulée (::ffff:1.2.3.4) : c'est l'IPv4 qui compte.
  const mapped = clean.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (mapped) return mapped[1];
  const [head, tail] = clean.split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const groups =
    tail === undefined
      ? left
      : [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right];
  const prefix = groups
    .slice(0, 4)
    .map((g) => (parseInt(g, 16) || 0).toString(16))
    .join(':');
  return `${prefix}::/64`;
}
