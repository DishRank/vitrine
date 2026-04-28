import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';
import { citySlug } from './lib/slug';

const intlMiddleware = createMiddleware(routing);

/**
 * Detect locale prefix from a pathname (returns "" for the default fr locale).
 * "/en/foo" → "/en"
 * "/foo"    → ""
 */
function getLocalePrefix(pathname: string): string {
  const m = pathname.match(/^\/(fr|en|es|de|it)(\/|$)/);
  if (!m) return '';
  return m[1] === 'fr' ? '' : `/${m[1]}`;
}

// Simple in-memory rate limiter (per IP, resets every minute)
const rateMap = new Map<string, { count: number; reset: number }>();
const RATE_LIMIT = 60; // requests per minute
const WINDOW = 60_000; // 1 minute

// Legitimate search engine bots (whitelisted from rate limiting + blocking)
const SE_BOTS = [
  /googlebot/i, /bingbot/i, /slurp/i, /duckduckbot/i,
  /baiduspider/i, /yandexbot/i, /facebot/i, /twitterbot/i,
  /linkedinbot/i, /applebot/i, /petalbot/i,
];

// Known scraper/bot user agents to block
const BLOCKED_BOTS = [
  /scrapy/i, /python-requests/i, /wget\/\d/i,
  /httrack/i, /grab/i, /sitesucker/i, /copier/i,
];

function getClientIP(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';
}

/**
 * Génère un nonce CSP cryptographiquement sûr (128 bits, base64).
 * Edge-runtime safe : utilise Web Crypto API (pas de Buffer Node).
 */
function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/**
 * Construit la Content-Security-Policy stricte avec nonce + strict-dynamic.
 *
 * Pourquoi `'strict-dynamic'` :
 *   • Ignore les allowlists d'hôtes (script-src https://googletagmanager...)
 *     → moins de surface d'attaque qu'une whitelist statique.
 *   • Permet aux scripts noncés (Next.js bundle) de charger d'autres scripts
 *     dynamiquement (ex: GA chargé par CookieConsent via createElement) sans
 *     avoir à les whitelister un par un.
 *   • Les directives `https:` et `'unsafe-inline'` sont des fallbacks pour
 *     les vieux navigateurs (CSP1/CSP2) ; les navigateurs modernes les
 *     ignorent quand `'strict-dynamic'` est présent (cf. web.dev/strict-csp).
 *
 * style-src garde `'unsafe-inline'` car Next.js + Tailwind + composants React
 * utilisent des styles inline (`style={...}`, `<style>` runtime) omniprésents
 * impossibles à noncer un par un. Mitigation : `frame-ancestors 'none'`,
 * `object-src 'none'`, `base-uri 'self'` ferment les vecteurs d'attaque
 * principaux qu'un attaquant pourrait exploiter via XSS de style.
 */
function buildCsp(nonce: string, isDev: boolean): string {
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    // Fallbacks pour navigateurs CSP1/CSP2 (ignorés par les modernes)
    "'unsafe-inline'",
    'https:',
    isDev ? "'unsafe-eval'" : '',
  ].filter(Boolean).join(' ');

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net",
    "img-src 'self' https: data:",
    "connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://yztbhdvrvgozhyaujtjz.supabase.co",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
}

/**
 * Force la propagation du header `x-nonce` vers le server component qui
 * traite la requête, indépendamment de ce que fait next-intl. C'est le
 * mécanisme interne que Next.js utilise sous le capot pour
 * `NextResponse.next({ request: { headers } })` : on liste les headers à
 * override dans `x-middleware-override-headers` et on met chaque valeur
 * dans `x-middleware-request-{name}`.
 *
 * Belt-and-suspenders nécessaire car `intlMiddleware(req)` ne forward pas
 * toujours `req.headers` (sur les redirects de locale, la response perd les
 * mutations qu'on aurait faites sur `req.headers`).
 */
function injectRequestHeaderOverride(response: NextResponse, name: string, value: string) {
  const existing = response.headers.get('x-middleware-override-headers');
  const lower = name.toLowerCase();
  const list = existing ? existing.split(',').map(s => s.trim()) : [];
  if (!list.includes(lower)) list.push(lower);
  response.headers.set('x-middleware-override-headers', list.join(','));
  response.headers.set(`x-middleware-request-${lower}`, value);
}

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip static files and internal Next.js routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/img') ||
    pathname.startsWith('/js') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml'
  ) {
    return NextResponse.next();
  }

  const isDev = process.env.NODE_ENV === 'development';
  const nonce = generateNonce();
  const csp = buildCsp(nonce, isDev);

  // Top-level deep-link landing pages (outside [locale]) — bypass intl rewrite,
  // otherwise next-intl rewrites /dish to /[locale]/dish which 404s.
  // CSP + nonce sont quand même appliqués (les pages /dish et /join ont un
  // script inline qui lit `headers().get('x-nonce')` pour s'auto-noncer).
  if (
    pathname === '/dish' ||
    pathname.startsWith('/dish/') ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/join/')
  ) {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-nonce', nonce);
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set('Content-Security-Policy', csp);
    return response;
  }

  // === SEO: 301 redirect from old query-string URLs to new path-based URLs ===
  // Old: /?categorie=burger&ville=Lyon  →  /lyon/burger
  // Old: /?categorie=burger             →  /c/burger
  // Old: /?ville=Lyon                   →  /lyon
  // Only triggered on root paths (with optional locale prefix) to avoid recursion.
  const isRootPath = pathname === '/' || /^\/(fr|en|es|de|it)\/?$/.test(pathname);
  const cat = req.nextUrl.searchParams.get('categorie');
  const ville = req.nextUrl.searchParams.get('ville');
  if (isRootPath && (cat || ville)) {
    const localePrefix = getLocalePrefix(pathname);
    let newPath = '/';
    if (ville && cat) newPath = `${localePrefix}/${citySlug(ville)}/${cat}`;
    else if (ville) newPath = `${localePrefix}/${citySlug(ville)}`;
    else if (cat) newPath = `${localePrefix}/c/${cat}`;
    const url = req.nextUrl.clone();
    url.pathname = newPath;
    url.searchParams.delete('categorie');
    url.searchParams.delete('ville');
    const redirectResponse = NextResponse.redirect(url, 301);
    redirectResponse.headers.set('Content-Security-Policy', csp);
    return redirectResponse;
  }

  const ua = req.headers.get('user-agent') || '';
  const isSEBot = SE_BOTS.some((re) => re.test(ua));

  // Block known scraper bots (but never SE bots)
  if (!isSEBot && BLOCKED_BOTS.some((re) => re.test(ua))) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  // Rate limiting (skip for SE bots)
  if (!isSEBot) {
    const ip = getClientIP(req);
    const now = Date.now();
    const entry = rateMap.get(ip);

    if (entry && now < entry.reset) {
      entry.count++;
      if (entry.count > RATE_LIMIT) {
        return new NextResponse('Too Many Requests', {
          status: 429,
          headers: { 'Retry-After': '60' },
        });
      }
    } else {
      rateMap.set(ip, { count: 1, reset: now + WINDOW });
    }
  }

  // Cleanup old entries periodically
  if (Math.random() < 0.01) {
    const cleanupNow = Date.now();
    for (const [key, val] of rateMap) {
      if (cleanupNow > val.reset) rateMap.delete(key);
    }
  }

  // i18n routing — on délègue à next-intl puis on injecte la CSP + le nonce
  // sur la response retournée. Le nonce est propagé vers le server component
  // via le mécanisme `x-middleware-override-headers` interne de Next.js
  // (cf. injectRequestHeaderOverride ci-dessus pour la justification).
  const response = intlMiddleware(req);
  response.headers.set('Content-Security-Policy', csp);
  injectRequestHeaderOverride(response, 'x-nonce', nonce);

  return response;
}

export const config = {
  // Match everything except API routes, Next.js internals, and static files.
  // Required so the middleware sees the new path-based routes (/lyon/burger, etc.)
  // while still skipping noisy paths like /api/*, /_next/*, /img/*.
  matcher: ['/((?!api|_next|_vercel|img|js|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\.).*)' ],
};
