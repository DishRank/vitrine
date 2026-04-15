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

  // Top-level deep-link landing pages (outside [locale]) — bypass intl rewrite,
  // otherwise next-intl rewrites /dish to /[locale]/dish which 404s.
  if (pathname === '/dish' || pathname.startsWith('/dish/') || pathname.startsWith('/auth/')) {
    return NextResponse.next();
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
    return NextResponse.redirect(url, 301);
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

  // i18n routing
  return intlMiddleware(req);
}

export const config = {
  // Match everything except API routes, Next.js internals, and static files.
  // Required so the middleware sees the new path-based routes (/lyon/burger, etc.)
  // while still skipping noisy paths like /api/*, /_next/*, /img/*.
  matcher: ['/((?!api|_next|_vercel|img|js|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\.).*)' ],
};
