/**
 * Rate limiter des Server Actions auth de l'espace pro.
 *
 * Deux backends :
 *  • Upstash Redis (REST) si UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 *    sont posées — PARTAGÉ entre instances, c'est la seule protection réelle
 *    en multi-instance Vercel (lot 1.7 du plan espace-pro-web).
 *  • Fallback in-memory sinon (best-effort par instance, comme le limiteur du
 *    proxy) — suffisant en dev/préprod, à remplacer avant l'ouverture publique.
 *
 * Fenêtre fixe : INCR + PEXPIRE NX — simple, atomique, largement suffisant
 * pour du credential-stuffing/abus de formulaires.
 */

interface LimitResult {
  ok: boolean;
  /** Secondes avant la prochaine fenêtre (si bloqué). */
  retryAfter: number;
}

const memory = new Map<string, { count: number; reset: number }>();

async function upstash(commands: (string | number)[][]): Promise<unknown[] | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const res = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(commands),
      // Un limiteur ne doit jamais bloquer le flux longtemps.
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return null;
    return (await res.json()) as unknown[];
  } catch {
    return null;
  }
}

/**
 * `key` doit être préfixée par l'action (ex. `pro:login:ip:1.2.3.4`).
 * Fail-open : si Upstash est injoignable on retombe sur la Map locale —
 * mieux vaut un limiteur dégradé qu'un login indisponible.
 */
export async function rateLimit(key: string, max: number, windowMs: number): Promise<LimitResult> {
  const results = await upstash([
    ['INCR', key],
    ['PEXPIRE', key, windowMs, 'NX'],
    ['PTTL', key],
  ]);

  if (results) {
    const count = Number((results[0] as { result?: unknown })?.result ?? 0);
    const ttl = Number((results[2] as { result?: unknown })?.result ?? windowMs);
    if (count > max) return { ok: false, retryAfter: Math.max(1, Math.ceil(ttl / 1000)) };
    return { ok: true, retryAfter: 0 };
  }

  // Fallback in-memory (par instance).
  const now = Date.now();
  const entry = memory.get(key);
  if (entry && now < entry.reset) {
    entry.count++;
    if (entry.count > max) return { ok: false, retryAfter: Math.ceil((entry.reset - now) / 1000) };
  } else {
    memory.set(key, { count: 1, reset: now + windowMs });
  }
  if (memory.size > 10_000) {
    for (const [k, v] of memory) if (now > v.reset) memory.delete(k);
  }
  return { ok: true, retryAfter: 0 };
}
