/**
 * Referral landing page.
 *
 * Reached when someone shares their account from the app
 * (`hooks/useReferral.ts:shareReferralLink`) — the message contains
 * `https://dishrank.fr/join/<code>`.
 *
 * Behaviour:
 *  1. Server fetches the inviter's public profile (display_name + avatar)
 *     by referral_code. Falls back to a generic copy if the code is
 *     unknown or DB is unreachable, so the page never 500s.
 *  2. Client-side script attempts the deep link `dishrank://join/<code>`
 *     so a user with the app installed lands directly on the friend-add
 *     screen with the code pre-filled.
 *  3. Otherwise visitors see install buttons (App Store / Play Store).
 *
 * Lives outside `[locale]` so the URL stays clean (matches the existing
 * `/dish` and `/auth` deep-link bridges) — middleware whitelists the path.
 */
import { Metadata } from 'next';
import Image from 'next/image';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { APP_STORE_URL, PLAY_STORE_URL } from '@/lib/downloadLinks';

interface InviterProfile {
  display_name: string | null;
  avatar_url: string | null;
  referral_code: string;
}

// Server-side fetch with anon key — referral_code is public-safe and the
// only column we need beyond display_name + avatar_url, all of which are
// readable under the standard "Profiles visibles selon privacy" policy.
async function fetchInviter(code: string): Promise<InviterProfile | null> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  // Sanitise: referral codes are short alphanum/underscore/dash; reject
  // anything else so a hostile path can't bend the query.
  if (!/^[A-Za-z0-9_-]{3,32}$/.test(code)) return null;

  try {
    const supabase = createClient(url, key);
    const { data } = await supabase
      .from('profiles')
      .select('display_name, avatar_url, referral_code')
      .eq('referral_code', code)
      .maybeSingle();
    return (data as InviterProfile | null) ?? null;
  } catch {
    return null;
  }
}

interface PageProps {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code } = await params;
  const inviter = await fetchInviter(code);
  const inviterName = inviter?.display_name?.trim();
  const title = inviterName
    ? `${inviterName} t'invite sur DishRank`
    : 'Rejoins DishRank';
  const description = inviterName
    ? `${inviterName} partage ses meilleurs plats sur DishRank — installe l'app pour devenir ami.`
    : 'Note les plats, pas les restos. Découvre les meilleurs plats près de chez toi.';
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      images: [{ url: 'https://dishrank.fr/img/play_store_feature_graphic.webp' }],
    },
  };
}

export default async function JoinPage({ params }: PageProps) {
  const { code } = await params;

  // Reject malformed codes early (anything that wouldn't ever match a row).
  if (!/^[A-Za-z0-9_-]{3,32}$/.test(code)) notFound();

  const inviter = await fetchInviter(code);
  const inviterName = inviter?.display_name?.trim() || null;
  const avatarUrl = inviter?.avatar_url || null;

  // CSP nonce injected by middleware — applied to the inline script below
  // so it's allowed by the strict-dynamic CSP. Same pattern as /dish.
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
          <Image
            src="/img/icon.webp"
            alt="DishRank"
            width={64}
            height={64}
            style={{ borderRadius: 16, marginBottom: 20 }}
          />

          {inviterName ? (
            <>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 24,
                }}
              >
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt={inviterName}
                    width={88}
                    height={88}
                    style={{
                      borderRadius: 999,
                      border: '3px solid #6C5CE7',
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 88,
                      height: 88,
                      borderRadius: 999,
                      background: '#6C5CE7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 36,
                      fontWeight: 800,
                      color: '#fff',
                    }}
                  >
                    {inviterName.charAt(0).toUpperCase()}
                  </div>
                )}
                <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>
                  {inviterName} t&apos;invite sur DishRank
                </h1>
              </div>
              <p
                style={{
                  color: '#9B97B0',
                  fontSize: 15,
                  marginBottom: 28,
                  lineHeight: 1.5,
                }}
              >
                Installe l&apos;app, ouvre ce lien et ajoute {inviterName} en ami en un tap.
              </p>
            </>
          ) : (
            <>
              <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>
                Rejoins DishRank
              </h1>
              <p
                style={{
                  color: '#9B97B0',
                  fontSize: 15,
                  marginBottom: 28,
                  lineHeight: 1.5,
                }}
              >
                Note les plats, pas les restos. Installe l&apos;app pour découvrir
                les meilleurs plats près de chez toi.
              </p>
            </>
          )}

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              alignItems: 'center',
            }}
          >
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

        {/* Deep-link bridge. If the DishRank app is installed, the OS will
            intercept this navigation and open AddFriendSheet with the code
            already filled in. If not, the browser silently falls through
            and the user sees the install buttons above. */}
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                var code = ${JSON.stringify(code)};
                if (!code) return;
                var ua = navigator.userAgent || '';
                var isAndroid = /Android/i.test(ua);
                var isIOS = /iPhone|iPad|iPod/i.test(ua);
                var enc = encodeURIComponent(code);
                var here = window.location.href;
                if (isAndroid) {
                  // Intent URI without a package constraint — opens any app
                  // registered for dishrank:// (works across dev/staging/
                  // prod builds even when their applicationId differs).
                  // Fallback = current page so the install card stays
                  // visible if no handler is installed.
                  window.location.href =
                    'intent://join/' + enc +
                    '#Intent;scheme=dishrank;' +
                    'S.browser_fallback_url=' + encodeURIComponent(here) +
                    ';end';
                  return;
                }
                if (isIOS) {
                  // iOS: try the custom scheme; if the app is installed
                  // it takes over. If not, the install card stays put —
                  // the user can choose the App Store CTA on the page.
                  try { window.location.href = 'dishrank://join/' + enc; } catch (e) {}
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
