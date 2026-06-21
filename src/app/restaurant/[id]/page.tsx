/**
 * Restaurant deep-link bridge / QR landing.
 *
 * Reached when someone scans a venue's QR kit table-tent (printed from the
 * owner cockpit) — the QR encodes `https://dishrank.fr/restaurant/<id>?src=qr`.
 *
 * Behaviour:
 *  1. If the DishRank app is installed AND App Links are verified, the OS
 *     intercepts the universal link BEFORE this page loads and opens the
 *     venue fiche in-app (which logs the anonymous scan via `log_qr_scan`).
 *  2. Otherwise the browser loads this page. A client script then tries the
 *     custom scheme `dishrank://restaurant/<id>?src=qr` — this opens the app
 *     even when App Links verification is flaky (e.g. signing-key mismatch),
 *     which is the common failure mode for QR-scanned universal links.
 *  3. Visitors without the app see the venue name + install buttons.
 *
 * Lives outside `[locale]` so the QR URL stays clean (matches the existing
 * `/join` and `/dish` deep-link bridges) — `proxy.ts` whitelists the path and
 * propagates the CSP nonce for the inline script below.
 */
import { Metadata } from 'next';
import Image from 'next/image';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { APP_STORE_URL, PLAY_STORE_URL } from '@/lib/downloadLinks';

interface VenueInfo {
  name: string;
  city: string | null;
  description: string | null;
  photo_url: string | null;
}

// Restaurant ids are UUIDs. Reject anything else so a hostile path can't bend
// the query (and so we 404 fast on garbage instead of hitting the DB).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Server-side fetch with the service-role key (never shipped to the client).
// We only read public-safe display columns of the venue's listing.
async function fetchVenue(id: string): Promise<VenueInfo | null> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!UUID_RE.test(id)) return null;

  try {
    const supabase = createClient(url, key);
    const { data } = await supabase
      .from('restaurants')
      .select('name, city, description, photo_url')
      .eq('id', id)
      .maybeSingle();
    return (data as VenueInfo | null) ?? null;
  } catch {
    return null;
  }
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const venue = await fetchVenue(id);
  const name = venue?.name?.trim();
  const title = name ? `${name} sur DishRank` : 'Découvrir sur DishRank';
  const description = name
    ? `Découvre les plats notés de ${name}${venue?.city ? ` à ${venue.city}` : ''} sur DishRank — note les plats, pas les restos.`
    : 'Note les plats, pas les restos. Découvre les meilleurs plats près de chez toi.';
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      images: [
        { url: venue?.photo_url || 'https://dishrank.fr/img/play_store_feature_graphic.webp' },
      ],
    },
  };
}

export default async function RestaurantBridgePage({ params }: PageProps) {
  const { id } = await params;

  // Reject malformed ids early (anything that wouldn't ever match a row).
  if (!UUID_RE.test(id)) notFound();

  const venue = await fetchVenue(id);
  const name = venue?.name?.trim() || null;
  const city = venue?.city?.trim() || null;
  const description = venue?.description?.trim() || null;
  const cover = venue?.photo_url || null;

  // CSP nonce injected by proxy.ts — applied to the inline script below so it's
  // allowed by the strict CSP. Same pattern as /join.
  const nonce = (await headers()).get('x-nonce') || undefined;

  return (
    <html lang="fr">
      <head>
        <link rel="icon" type="image/webp" href="/img/icon.webp" />
      </head>
      <body
        style={{
          fontFamily: "'Outfit', -apple-system, sans-serif",
          background: '#0F0D1A',
          color: '#FFFDF5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          textAlign: 'center',
          padding: 24,
          margin: 0,
        }}
      >
        <div style={{ maxWidth: 420, width: '100%' }}>
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover}
              alt={name || 'DishRank'}
              style={{
                width: '100%',
                maxWidth: 320,
                height: 180,
                objectFit: 'cover',
                borderRadius: 18,
                marginBottom: 20,
              }}
            />
          ) : (
            <Image
              src="/img/icon.webp"
              alt="DishRank"
              width={64}
              height={64}
              style={{ borderRadius: 16, marginBottom: 20 }}
            />
          )}

          {name ? (
            <>
              <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 6px' }}>{name}</h1>
              {city ? (
                <p style={{ color: '#A29BFE', fontSize: 14, fontWeight: 700, margin: '0 0 14px' }}>
                  {city}
                </p>
              ) : null}
              <p style={{ color: '#9B97B0', fontSize: 15, marginBottom: 28, lineHeight: 1.5 }}>
                {description ||
                  `Découvre les plats notés${city ? ` à ${city}` : ''} et donne ton avis sur DishRank.`}
              </p>
            </>
          ) : (
            <>
              <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>
                Découvre ce lieu sur DishRank
              </h1>
              <p style={{ color: '#9B97B0', fontSize: 15, marginBottom: 28, lineHeight: 1.5 }}>
                Note les plats, pas les restos. Installe l&apos;app pour découvrir les meilleurs
                plats près de chez toi.
              </p>
            </>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
            <a
              href={APP_STORE_URL}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                background: '#fff',
                color: '#0F0D1A',
                padding: '14px 28px',
                borderRadius: 14,
                fontSize: 15,
                fontWeight: 700,
                textDecoration: 'none',
                width: '100%',
                maxWidth: 280,
              }}
            >
              Télécharger sur l&apos;App Store
            </a>
            <a
              href={PLAY_STORE_URL}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                background: '#6C5CE7',
                color: '#fff',
                padding: '14px 28px',
                borderRadius: 14,
                fontSize: 15,
                fontWeight: 700,
                textDecoration: 'none',
                width: '100%',
                maxWidth: 280,
              }}
            >
              Télécharger sur Google Play
            </a>
          </div>

          <p style={{ color: '#9B97B0', fontSize: 13, marginTop: 20 }}>
            Ou visite{' '}
            <a href="/" style={{ color: '#A29BFE', textDecoration: 'none' }}>
              dishrank.fr
            </a>
          </p>
        </div>

        {/* Deep-link bridge. If the app is installed, the custom scheme opens it
            on the venue fiche (preserving ?src=qr so the scan is logged) — this
            works even when App Links verification is flaky. If not installed,
            the browser falls through and the install buttons above stay. */}
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                var id = ${JSON.stringify(id)};
                if (!id) return;
                // One-shot guard: the Android intent fallback URL points back
                // to this same page, which would re-fire the script in a loop
                // if the app isn't installed. Mark sessionStorage and skip.
                try {
                  var key = 'dishrank-deeplink:restaurant:' + id;
                  if (sessionStorage.getItem(key)) return;
                  sessionStorage.setItem(key, '1');
                } catch (e) {}
                var ua = navigator.userAgent || '';
                var isAndroid = /Android/i.test(ua);
                var isIOS = /iPhone|iPad|iPod/i.test(ua);
                // Preserve the incoming query (notably ?src=qr) so the in-app
                // route logs the anonymous scan.
                var search = window.location.search || '';
                var here = window.location.href;
                if (isAndroid) {
                  window.location.href =
                    'intent://restaurant/' + encodeURIComponent(id) + search +
                    '#Intent;scheme=dishrank;' +
                    'S.browser_fallback_url=' + encodeURIComponent(here) +
                    ';end';
                  return;
                }
                if (isIOS) {
                  try { window.location.href = 'dishrank://restaurant/' + encodeURIComponent(id) + search; } catch (e) {}
                  return;
                }
                // Desktop stays on the install card.
              })();
            `,
          }}
        />
      </body>
    </html>
  );
}
