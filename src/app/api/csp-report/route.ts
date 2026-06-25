// Endpoint de réception des rapports de violation CSP.
//
// Quand le navigateur d'un visiteur bloque un script/style à cause de la
// CSP, il POST un JSON ici avec les détails (URL violante, directive,
// blocked-uri…). On log le tout dans la console serveur (visible dans les
// logs Vercel) pour diagnostic.
//
// Format du body envoyé par les browsers :
//   - CSP Level 2 : { "csp-report": { ... } } (Chrome, Firefox older)
//   - CSP Level 3 (Reporting API) : tableau d'objets avec `body` (Chrome récent)
//
// Pourquoi un endpoint custom plutôt qu'un service tiers (Sentry, Datadog) :
// gratuit, pas d'ajout de dépendance, suffit pour un projet à 0 user. Quand
// le volume monte, switcher vers un agrégateur dédié.
//
// Note volontaire : on n'authentifie PAS cet endpoint. Les browsers ne
// peuvent pas envoyer de credentials avec un report CSP, donc auth =
// impossible. Le rate limiting du middleware filtre déjà les abus, et le
// payload est petit (< 4 KB en pratique). Si on devient visible, ajouter
// un check de Content-Type et un body size limit.

import { NextResponse } from 'next/server';

// Cache anti-spam : si la même violation se répète, on log une fois par
// heure max (par signature) pour éviter de noyer les logs Vercel.
const recentSignatures = new Map<string, number>();
const SIGNATURE_TTL = 60 * 60 * 1000; // 1h

function shouldLog(signature: string): boolean {
  const now = Date.now();
  const last = recentSignatures.get(signature);
  if (last && now - last < SIGNATURE_TTL) return false;
  recentSignatures.set(signature, now);
  // Cleanup périodique (1% des appels) pour éviter une fuite mémoire
  if (Math.random() < 0.01) {
    for (const [key, ts] of recentSignatures) {
      if (now - ts > SIGNATURE_TTL) recentSignatures.delete(key);
    }
  }
  return true;
}

interface CspReportLevel2 {
  'csp-report'?: {
    'document-uri'?: string;
    'violated-directive'?: string;
    'effective-directive'?: string;
    'blocked-uri'?: string;
    'source-file'?: string;
    'line-number'?: number;
    'script-sample'?: string;
  };
}

interface CspReportLevel3Entry {
  type?: string;
  url?: string;
  body?: {
    documentURL?: string;
    effectiveDirective?: string;
    blockedURL?: string;
    sourceFile?: string;
    lineNumber?: number;
    sample?: string;
  };
}

export async function POST(request: Request) {
  // Body-size guard — CSP reports are tiny (<4 KB in practice). Reject
  // oversized payloads to avoid log-amplification / memory DoS on this
  // unauthenticated endpoint.
  const declaredLen = Number(request.headers.get('content-length') || '0');
  if (declaredLen > 16 * 1024) {
    return NextResponse.json({ ok: false }, { status: 413 });
  }
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Normalise les deux formats vers une seule shape compacte
  type Entry = {
    docUri?: string;
    directive?: string;
    blockedUri?: string;
    sourceFile?: string;
    line?: number;
    sample?: string;
  };

  const entries: Entry[] = [];

  if (Array.isArray(payload)) {
    // CSP Level 3 / Reporting API
    for (const item of payload as CspReportLevel3Entry[]) {
      if (item?.type !== 'csp-violation' && item?.type !== 'csp') continue;
      const b = item.body || {};
      entries.push({
        docUri: b.documentURL,
        directive: b.effectiveDirective,
        blockedUri: b.blockedURL,
        sourceFile: b.sourceFile,
        line: b.lineNumber,
        sample: b.sample,
      });
    }
  } else if (payload && typeof payload === 'object' && 'csp-report' in payload) {
    // CSP Level 2 (legacy)
    const r = (payload as CspReportLevel2)['csp-report'] || {};
    entries.push({
      docUri: r['document-uri'],
      directive: r['violated-directive'] || r['effective-directive'],
      blockedUri: r['blocked-uri'],
      sourceFile: r['source-file'],
      line: r['line-number'],
      sample: r['script-sample'],
    });
  }

  for (const e of entries) {
    // Signature = directive + blocked URI (déduplique le bruit)
    const signature = `${e.directive || '?'}|${e.blockedUri || '?'}`;
    if (!shouldLog(signature)) continue;
    console.warn('[CSP violation]', JSON.stringify({
      docUri: e.docUri,
      directive: e.directive,
      blockedUri: e.blockedUri,
      sourceFile: e.sourceFile,
      line: e.line,
      sample: e.sample?.slice(0, 200),
      ua: request.headers.get('user-agent')?.slice(0, 120),
    }));
  }

  return NextResponse.json({ ok: true });
}
