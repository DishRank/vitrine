import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
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
  // x-real-ip est posé par Vercel (fiable). À défaut, l'entrée la plus à
  // DROITE de x-forwarded-for : la gauche est fournie par le client et
  // spoofable → contournait le rate-limit avec une fausse IP par requête.
  const real = req.headers.get('x-real-ip');
  if (real) return real.trim();
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const parts = xff.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return 'unknown';
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
/**
 * CSP pour les pages **statiques prérendues + cachées par le CDN** (`/dish`,
 * `/auth/confirm`). Ces pages ont leur HTML figé au build : on ne peut pas y
 * injecter un nonce par requête. On N'UTILISE DONC PAS `'strict-dynamic'`
 * (qui invaliderait `'self'`/`'unsafe-inline'` et bloquerait les chunks
 * statiques `/_next/...` → page jamais hydratée). À la place, `'self'`
 * autorise les chunks même-origine et `'unsafe-inline'` les scripts inline
 * RSC (`self.__next_f.push(...)`). Surface XSS réduite par `object-src
 * 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`.
 */
// L'hôte Supabase autorisé en connect-src suit l'environnement (le client
// navigateur — notation sans compte — parle au projet de NEXT_PUBLIC_*) ;
// défaut = prod.
const SUPABASE_CONNECT =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yztbhdvrvgozhyaujtjz.supabase.co';

// En dev uniquement, tolère tous les projets Supabase : NEXT_PUBLIC_* est
// inliné dans le proxy à sa compilation, donc un .env.local modifié pendant
// que `next dev` tourne laisse le proxy sur l'ancien hôte alors que les
// bundles clients recompilés parlent déjà au nouveau → connect-src bloque
// tout jusqu'au restart. En prod l'hôte reste exact.
const supabaseConnect = (isDev: boolean) =>
  isDev ? `${SUPABASE_CONNECT} https://*.supabase.co` : SUPABASE_CONNECT;

function buildStaticCsp(isDev: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net",
    "img-src 'self' https: data:",
    `connect-src 'self' ${supabaseConnect(isDev)}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
}

function buildCsp(
  nonce: string,
  isDev: boolean,
  opts?: { frameSrc?: string; extraConnect?: string }
): string {
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
    `connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com ${supabaseConnect(isDev)}${opts?.extraConnect ? ` ${opts.extraConnect}` : ''}`,
    ...(opts?.frameSrc ? [`frame-src ${opts.frameSrc}`] : []),
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    // Remontée des violations CSP réelles → /api/csp-report (cf. cette
    // route). report-uri est CSP2 (déprécié mais encore très utilisé) ;
    // report-to est CSP3. On envoie les deux pour couvrir tous les
    // browsers — ceux qui supportent report-to ignorent report-uri.
    "report-uri /api/csp-report",
  ].join('; ');
}

// ─── Zone /pro (espace restaurateur, lot 1 espace-pro-web) ───────────────────
// Session Supabase en cookies (@supabase/ssr) : le middleware la RAFRAÎCHIT à
// chaque requête (sinon les Server Components lisent un token expiré) et garde
// l'accès au edge. Pages auth publiques ; tout le reste exige une session.
const PRO_PUBLIC_PATHS = new Set(['/pro/login', '/pro/signup', '/pro/reset', '/pro/callback']);

// CSP /pro : la base stricte + Turnstile (iframe + télémétrie) quand le
// captcha est configuré (NEXT_PUBLIC_* inliné au build, comme SUPABASE_CONNECT).
const TURNSTILE_ENABLED = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const buildProCsp = (nonce: string, isDev: boolean) =>
  buildCsp(
    nonce,
    isDev,
    TURNSTILE_ENABLED
      ? {
          frameSrc: "'self' https://challenges.cloudflare.com",
          extraConnect: 'https://challenges.cloudflare.com',
        }
      : undefined
  );

async function handleProZone(req: NextRequest, nonce: string, isDev: boolean) {
  const { pathname } = req.nextUrl;
  const csp = buildProCsp(nonce, isDev);
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);

  // Pattern canonique @supabase/ssr en middleware : les cookies rafraîchis
  // doivent être posés sur la REQUEST (pour les Server Components de cette
  // même requête) ET sur la RESPONSE (pour le navigateur).
  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let authenticated = false;

  if (url && key) {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          // Headers RE-COPIÉS APRÈS la mutation de req.cookies : un snapshot
          // pris avant enverrait l'ancien token expiré aux Server Components
          // de cette même requête → second refresh avec un refresh token déjà
          // rotaté (ne survit que grâce à la fenêtre de réutilisation GoTrue).
          const freshHeaders = new Headers(req.headers);
          freshHeaders.set('x-nonce', nonce);
          response = NextResponse.next({ request: { headers: freshHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });
    // getClaims (au lieu de getUser) : les projets utilisent des clés JWT
    // asymétriques (ES256) → la validation du token est LOCALE (vérif de
    // signature via JWKS caché), sans appel réseau à GoTrue à chaque
    // navigation /pro. Le refresh de session (rotation du token) reste géré par
    // le mécanisme cookies @supabase/ssr (getClaims passe par getSession).
    const { data } = await supabase.auth.getClaims();
    authenticated = !!data?.claims;
  }

  const finalize = (r: NextResponse) => {
    r.headers.set('Content-Security-Policy', csp);
    // Zone jamais indexée (D1) — le sitemap ne la liste pas non plus.
    r.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return r;
  };

  const redirectPreservingSession = (to: URL) => {
    const r = NextResponse.redirect(to);
    // Ne pas perdre un éventuel refresh de token fait ci-dessus — en copiant
    // l'objet cookie ENTIER (avec ses options maxAge/sameSite/secure/path),
    // pas juste name+value, sinon le cookie serait re-posé avec des attributs
    // par défaut affaiblis (audit B4).
    response.cookies.getAll().forEach((c) => r.cookies.set(c));
    return finalize(r);
  };

  if (!authenticated && !PRO_PUBLIC_PATHS.has(pathname)) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/pro/login';
    // On conserve la QUERY dans `next` : un deep-link partagé (ex.
    // `…/avis?avis=negatifs`) ouvert déconnecté doit rouvrir SUR le filtre après
    // login, pas sur la page nue. Reste un chemin relatif interne (commence
    // toujours par `/pro`), donc `safeNext`/le callback le valident sans risque
    // d'open-redirect.
    const nextTarget = `${pathname}${req.nextUrl.search}`;
    loginUrl.search = pathname === '/pro' ? '' : `?next=${encodeURIComponent(nextTarget)}`;
    return redirectPreservingSession(loginUrl);
  }

  // Déjà connecté sur login/signup → direction le dashboard.
  if (authenticated && (pathname === '/pro/login' || pathname === '/pro/signup')) {
    return redirectPreservingSession(new URL('/pro', req.url));
  }

  return finalize(response);
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

export default async function proxy(req: NextRequest) {
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

  // /dish — page de redirect deeplink, pure static (pas de DB, pas de
  // données dynamiques). On envoie une CSP avec `'unsafe-inline'` pour
  // autoriser le script inline trivial qu'on ship (geo redirect vers le
  // schéma `dishrank://`), SANS propager x-nonce → la page peut être
  // pré-rendue au build et cachée par le CDN. Le script est noindex,
  // bien connu, et n'utilise que `encodeURIComponent` sur les query
  // params → surface XSS minimale.
  if (pathname === '/dish' || pathname.startsWith('/dish/')) {
    const response = NextResponse.next();
    response.headers.set('Content-Security-Policy', buildStaticCsp(isDev));
    return response;
  }

  // /auth/confirm — page CLIENT ('use client') sans données serveur, donc
  // **prérendue en statique** par Next + cachée CDN. Comme /dish, son HTML est
  // figé : un nonce par requête ne matcherait pas ses <script> → strict-dynamic
  // bloquerait les chunks → React ne s'hydraterait jamais (spinner infini de
  // "Vérification en cours"). On lui sert donc la CSP statique sans nonce.
  if (pathname === '/auth/confirm') {
    const response = NextResponse.next();
    response.headers.set('Content-Security-Policy', buildStaticCsp(isDev));
    return response;
  }

  // /pro — espace restaurateur (hors [locale], jamais indexé). Session
  // Supabase rafraîchie + garde auth au edge, CSP stricte avec nonce.
  if (pathname === '/pro' || pathname.startsWith('/pro/')) {
    return handleProZone(req, nonce, isDev);
  }

  // Autres /auth/*, /join/*, /restaurant/* et /menu/* — pages dynamiques hors
  // [locale] (bridge deep-link / menu numérique). Nonce CSP propagé pour
  // autoriser leur script inline tout en restant strict, et court-circuit du
  // routage next-intl (ces chemins ne sont pas localisés).
  // /restaurant/<id> = landing des partages + anciens QR ; /menu/<id> = QR de
  // table actuel (jamais intercepté par l'app → toujours le menu web).
  if (
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/join/') ||
    pathname.startsWith('/restaurant/') ||
    pathname.startsWith('/menu/')
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
