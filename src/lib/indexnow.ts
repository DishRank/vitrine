/**
 * IndexNow — protocole partagé Bing/Yandex pour notifier instantanément les
 * search engines quand un contenu a été créé, mis à jour ou supprimé.
 * Doc officielle : https://www.indexnow.org/documentation
 *
 * Setup DishRank :
 *  1. Clé publique = nom du fichier dans `/public/`
 *     `public/c6fbedd4ce85838de39ac82edffa1ecc.txt` contient juste la clé
 *     (Bing valide en GET sur cette URL avant d'accepter les soumissions).
 *  2. Cette lib expose `submitToIndexNow(urls)` qui POST en batch à
 *     `api.indexnow.org`. Endpoint unique géré par Bing + Yandex (et autres
 *     moteurs compatibles), donc 1 call = 1 ping multi-engine.
 *  3. L'endpoint API `/api/indexnow/submit` est le déclencheur côté server
 *     (cron Vercel, deploy hook, webhook Supabase…) — protégé par un secret.
 */

const INDEXNOW_KEY = 'c6fbedd4ce85838de39ac82edffa1ecc';
const HOST = 'dishrank.fr';
const KEY_LOCATION = `https://${HOST}/${INDEXNOW_KEY}.txt`;
const API_ENDPOINT = 'https://api.indexnow.org/indexnow';

/** Limite officielle IndexNow : 10 000 URLs max par requête batch. On reste
 *  largement en dessous pour DishRank (sitemap ≈ 300 URLs aujourd'hui). */
const MAX_URLS_PER_BATCH = 10_000;

export interface IndexNowResult {
  /** HTTP status code retourné par IndexNow. 200/202 = OK, autres = erreur. */
  status: number;
  /** Réponse brute si non-200 (utile pour diagnostic). */
  body?: string;
  /** Nombre d'URLs effectivement soumises (après dédup + filtrage). */
  submittedCount: number;
  /** URLs ignorées car hors-domain ou format invalide. */
  skippedUrls: string[];
}

/**
 * Soumet une liste d'URLs à IndexNow. Filtre celles qui ne sont pas sur
 * `dishrank.fr` (IndexNow refuse les soumissions cross-domain).
 *
 * @param urls Liste d'URLs absolues à signaler comme nouvelles/modifiées
 * @returns Résultat de la soumission (status HTTP + URLs effectivement envoyées)
 */
export async function submitToIndexNow(urls: string[]): Promise<IndexNowResult> {
  // Dédup + filtrage : on garde uniquement les URLs sur notre host (IndexNow
  // refuse les cross-domain submissions, anti-spam protocole).
  const seen = new Set<string>();
  const valid: string[] = [];
  const skipped: string[] = [];

  for (const raw of urls) {
    if (!raw || typeof raw !== 'string') {
      skipped.push(String(raw));
      continue;
    }
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      skipped.push(raw);
      continue;
    }
    if (parsed.host !== HOST) {
      skipped.push(raw);
      continue;
    }
    const normalized = parsed.toString();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    valid.push(normalized);
  }

  if (valid.length === 0) {
    return { status: 200, submittedCount: 0, skippedUrls: skipped };
  }

  // Slice en batchs de MAX_URLS_PER_BATCH si jamais on dépasse (improbable
  // pour DishRank avant longtemps, mais robuste). On envoie séquentiellement
  // — IndexNow rate-limit à ~10k URLs/jour par host, pas par requête.
  let lastStatus = 200;
  let lastBody = '';
  let totalSubmitted = 0;

  for (let i = 0; i < valid.length; i += MAX_URLS_PER_BATCH) {
    const batch = valid.slice(i, i + MAX_URLS_PER_BATCH);
    const payload = {
      host: HOST,
      key: INDEXNOW_KEY,
      keyLocation: KEY_LOCATION,
      urlList: batch,
    };

    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    lastStatus = res.status;
    if (res.status >= 200 && res.status < 300) {
      totalSubmitted += batch.length;
    } else {
      // 4xx/5xx → on récupère le body pour diagnostic mais on continue les
      // autres batchs (un batch invalide n'invalide pas le reste).
      lastBody = await res.text().catch(() => '');
    }
  }

  return {
    status: lastStatus,
    body: lastBody || undefined,
    submittedCount: totalSubmitted,
    skippedUrls: skipped,
  };
}

/** Helper : retourne l'URL du fichier de vérification (utile pour debug). */
export function getKeyLocation(): string {
  return KEY_LOCATION;
}
