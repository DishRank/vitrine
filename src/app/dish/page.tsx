import { Metadata } from 'next';
import Image from 'next/image';

export const metadata: Metadata = {
  title: 'DishRank — Voir ce plat',
  description: 'Decouvrez les meilleurs plats notes par la communaute DishRank.',
  openGraph: {
    title: 'DishRank — Decouvrez ce plat',
    description: 'Notez les plats, pas les restos. Decouvrez les avis de la communaute DishRank.',
    images: [{ url: 'https://dishrank.fr/img/play_store_feature_graphic.png' }],
  },
};

export default function DishPage() {
  return (
    <html lang="fr">
      <body style={{ fontFamily: "'Outfit', -apple-system, sans-serif", background: '#0F0D1A', color: '#FFFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', textAlign: 'center', padding: 24, margin: 0 }}>
        <div style={{ maxWidth: 400 }}>
          <Image src="/img/icon.png" alt="DishRank" width={64} height={64} style={{ borderRadius: 16, marginBottom: 16 }} />
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Voir ce plat sur DishRank</h1>
          <p style={{ color: '#9B97B0', fontSize: 15, marginBottom: 24, lineHeight: 1.5 }}>
            Installez DishRank pour decouvrir les avis de la communaute sur ce plat et des milliers d&apos;autres.
          </p>
          <a
            href="https://play.google.com/store/apps/details?id=com.dishrank.app"
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
              var p = new URLSearchParams(window.location.search);
              var r = p.get('r'), d = p.get('d');
              if (r && d) { window.location.href = 'dishrank://dish?r=' + encodeURIComponent(r) + '&d=' + encodeURIComponent(d); }
            `,
          }}
        />
      </body>
    </html>
  );
}
