import { Metadata } from 'next';
import Image from 'next/image';
import { PLAY_STORE_URL } from '@/lib/downloadLinks';

export const metadata: Metadata = {
  title: 'DishRank — Voir ce plat',
  description: 'Découvrez les meilleurs plats notés par la communauté DishRank.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'DishRank — Découvrez ce plat',
    description: 'Notez les plats, pas les restos. Découvrez les avis de la communauté DishRank.',
    images: [{ url: 'https://dishrank.fr/img/play_store_feature_graphic.webp' }],
  },
};

// Page synchrone, sans `headers()` ni fetch dynamique → Next.js peut la
// pré-rendre au build et le CDN la sert depuis le cache. La CSP est
// définie dans le proxy avec `'unsafe-inline'` pour autoriser le
// script inline ci-dessous (cf. proxy.ts §dish).
export default function DishPage() {
  return (
    <html lang="fr">
      <head>
        <title>DishRank — Voir ce plat</title>
        <meta name="description" content="Découvrez les meilleurs plats notés par la communauté DishRank." />
        <meta name="robots" content="noindex, nofollow" />
        <meta property="og:title" content="DishRank — Découvrez ce plat" />
        <meta property="og:description" content="Notez les plats, pas les restos. Découvrez les avis de la communauté DishRank." />
        <meta property="og:image" content="https://dishrank.fr/img/play_store_feature_graphic.webp" />
        <link rel="icon" type="image/webp" href="/img/icon.webp" />
      </head>
      <body style={{ fontFamily: "'Outfit', -apple-system, sans-serif", background: '#0F0D1A', color: '#FFFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', textAlign: 'center', padding: 24, margin: 0 }}>
        <div style={{ maxWidth: 400 }}>
          <Image src="/img/icon.webp" alt="DishRank" width={64} height={64} style={{ borderRadius: 16, marginBottom: 16 }} />
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Voir ce plat sur DishRank</h1>
          <p style={{ color: '#9B97B0', fontSize: 15, marginBottom: 24, lineHeight: 1.5 }}>
            Installez DishRank pour decouvrir les avis de la communaute sur ce plat et des milliers d&apos;autres.
          </p>
          <a
            href={PLAY_STORE_URL}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#6C5CE7', color: '#fff', padding: '14px 28px', borderRadius: 14, fontSize: 16, fontWeight: 600, textDecoration: 'none' }}
          >
            Installer l&apos;app
          </a>
          <p style={{ color: '#9B97B0', fontSize: 13, marginTop: 16 }}>
            Ou visitez <a href="/" style={{ color: '#A29BFE', textDecoration: 'none' }}>dishrank.fr</a>
          </p>
        </div>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var p = new URLSearchParams(window.location.search);
                var r = p.get('r'), d = p.get('d');
                if (!r || !d) return;
                // One-shot guard: if the app isn't installed, the Android
                // intent fallback brings the user back to this same page,
                // which would re-fire the script forever. Mark that we
                // already tried in sessionStorage and skip on reload.
                try {
                  var key = 'dishrank-deeplink:' + r + ':' + d;
                  if (sessionStorage.getItem(key)) return;
                  sessionStorage.setItem(key, '1');
                } catch (e) {}
                var ua = navigator.userAgent || '';
                var isAndroid = /Android/i.test(ua);
                var isIOS = /iPhone|iPad|iPod/i.test(ua);
                var qs = 'r=' + encodeURIComponent(r) + '&d=' + encodeURIComponent(d);
                var here = window.location.href;
                if (isAndroid) {
                  // Intent URI without a package constraint — opens any app
                  // registered for the dishrank:// scheme (covers prod AND
                  // dev/staging builds with a different applicationId).
                  // Fallback URL = stay on this page so the install card
                  // remains visible if no handler is installed (instead of
                  // yanking the user to the Play Store).
                  window.location.href =
                    'intent://dish?' + qs +
                    '#Intent;scheme=dishrank;' +
                    'S.browser_fallback_url=' + encodeURIComponent(here) +
                    ';end';
                  return;
                }
                if (isIOS) {
                  // iOS: try the custom scheme. If the app is installed it
                  // takes over and Safari is hidden. If nothing happens,
                  // the install card stays — the user can tap the App
                  // Store CTA themselves rather than being yanked there.
                  window.location.href = 'dishrank://dish?' + qs;
                  return;
                }
                // Desktop: leave the install card visible, no redirect.
              })();
            `,
          }}
        />
      </body>
    </html>
  );
}
