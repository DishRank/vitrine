/**
 * Rate limiter des Server Actions auth de l'espace pro.
 *
 * Deux backends :
 *  • Upstash Redis (REST) si UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 *    (ou KV_REST_API_URL + KV_REST_API_TOKEN, noms de l'intégration Vercel)
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
  // L'intégration Upstash de Vercel (Marketplace) crée KV_REST_API_URL /
  // KV_REST_API_TOKEN, pas les noms UPSTASH_* : sans ce repli, le projet en
  // prod (qui n'a que KV_*) tombait sur la Map en mémoire, par instance.
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
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

/**
 * Lecture SANS incrément d'un compteur tenu par `rateLimit`, pour les limites
 * « sur échec » : on ne compte que les ratés (appel à `rateLimit` au moment de
 * l'échec), mais on refuse TOUTE tentative une fois `max` ratés atteints. Sans
 * ça, le limiteur ne masquerait que les ratés et laisserait voir les succès —
 * exactement ce qu'une énumération cherche. Même fail-open que `rateLimit`.
 */
export async function peekLimit(key: string, max: number): Promise<LimitResult> {
  const results = await upstash([
    ['GET', key],
    ['PTTL', key],
  ]);

  if (results) {
    const count = Number((results[0] as { result?: unknown })?.result ?? 0);
    const ttl = Number((results[1] as { result?: unknown })?.result ?? 0);
    if (count >= max) return { ok: false, retryAfter: Math.max(1, Math.ceil(ttl / 1000)) };
    return { ok: true, retryAfter: 0 };
  }

  const now = Date.now();
  const entry = memory.get(key);
  if (entry && now < entry.reset && entry.count >= max) {
    return { ok: false, retryAfter: Math.ceil((entry.reset - now) / 1000) };
  }
  return { ok: true, retryAfter: 0 };
}

/**
 * Heartbeat : une écriture minimale pour garder la base Upstash ACTIVE. Le plan
 * gratuit supprime une base sans aucune commande depuis ~14 jours. Or Redis
 * n'est sollicité que par les formulaires auth pro (login/inscription/reset/
 * lien magique/claim) : avant l'ouverture publique, la base ne reçoit rien et
 * se fait supprimer. Le cron hebdo appelle ceci → une commande/semaine, bien en
 * deçà de la fenêtre. Clé à TTL 30 j (auto-nettoyée si le cron s'arrête).
 *
 * Réutilise le MÊME transport REST + fail-open que rateLimit : renvoie false si
 * Upstash n'est pas configuré ou injoignable, sans jamais throw (ne doit pas
 * faire échouer le job cron qui l'héberge).
 */
export async function redisHeartbeat(): Promise<boolean> {
  const res = await upstash([['SET', 'ops:heartbeat', String(Date.now()), 'EX', 2_592_000]]);
  return res !== null;
}
