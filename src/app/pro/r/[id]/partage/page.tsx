import QRCode from 'qrcode';
import { requireOwnedRestaurant, isPremium } from '@/lib/pro/data';
import { normalizeMenuTheme } from '../menu/themeConstants';
import { CopyButton } from './ShareControls';
import QrKit from './QrKit';

export const metadata = { title: 'Partage' };

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://dishrank.fr';
// Quiet zone = 4 modules (spec ISO 18004). Était à 1 → le PNG 512px cuisait une
// marge trop fine ; 4 fiabilise le scan, surtout imprimé.
const MARGIN = 4;

/**
 * Récupère le logo (URL Storage cross-origin, .webp) côté serveur et l'inline en
 * data:URI base64 → embarqué dans le SVG. Deux bénéfices : (1) l'export PNG
 * (canvas → toBlob dans ShareControls) NE se « taint » PAS (data:URI = même
 * origine) et ne casse pas ; (2) l'impression n'a aucun fetch réseau à faire.
 * Null-safe : tout échec retombe sur le QR nu.
 */
async function fetchLogoDataUri(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: 'force-cache' });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') ?? 'image/webp';
    const b64 = Buffer.from(await res.arrayBuffer()).toString('base64');
    return `data:${type};base64,${b64}`;
  } catch {
    return null;
  }
}

/**
 * Le logo n'est PAS injecté dans le SVG (une <image> imbriquée ne se rasterise
 * pas quand le SVG est dessiné sur un canvas en mode « image » — export PNG
 * cassé). Il est superposé en overlay `<img>` à l'écran/impression (DOM vivant,
 * OK) et redessiné séparément sur le canvas au téléchargement (cf. QrKit +
 * DownloadPngButton). Géométrie partagée : pastille blanche = 28% du côté (≈8%
 * de surface, bien sous les ~30% récupérables du niveau H), logo ≈ 76% de la
 * pastille, centré → ne touche jamais les 3 « yeux ».
 */
const QR_OPTS = {
  type: 'svg' as const,
  margin: MARGIN,
  color: { dark: '#1A1832', light: '#FFFFFF' },
};

/**
 * Onglet « Partage » (ex-page QR). Regroupe tout ce qui sert à diffuser
 * l'établissement : le lien du menu public à copier/partager, et le kit QR de
 * table (chevalet imprimable + QR téléchargeable). Le QR pointe vers
 * `dishrank.fr/menu/<id>?src=qr` (scan compté serveur, jamais intercepté par
 * l'app). Le logo au centre (Premium) est purement déterministe (correction
 * d'erreur H + pastille) — aucune IA.
 */
export default async function PartagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resto = await requireOwnedRestaurant(id);
  const menuLink = `${SITE}/menu/${id}`;
  const qrTarget = `${menuLink}?src=qr`;

  // Logo dans le QR = perk Premium : on réutilise le logo d'Apparence
  // (menu_theme.logo_url, gaté trigger 101). Gaté aussi au rendu (isPremium)
  // pour rester cohérent si l'abonnement a expiré.
  const premium = isPremium(resto);
  const logoUrl = premium ? normalizeMenuTheme(resto.menu_theme).logo_url : null;
  const logoDataUri = await fetchLogoDataUri(logoUrl);

  // QR nu niveau M (toggle off / pas de logo) ; QR niveau H (~30% de récupération,
  // pour tolérer le logo au centre) généré seulement s'il y a un logo. Le logo
  // lui-même est superposé côté client, pas dans le SVG.
  const svgPlain = await QRCode.toString(qrTarget, { ...QR_OPTS, errorCorrectionLevel: 'M' });
  const svgHigh = logoDataUri
    ? await QRCode.toString(qrTarget, { ...QR_OPTS, errorCorrectionLevel: 'H' })
    : null;

  const fileSlug = (resto.name || 'menu')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

  return (
    <div className="space-y-6">
      {/* À l'impression : n'afficher QUE le chevalet. style-src autorise l'inline. */}
      <style>{`@media print {
        body * { visibility: hidden !important; }
        #qr-chevalet, #qr-chevalet * { visibility: visible !important; }
        #qr-chevalet { position: absolute; inset: 0; margin: auto; }
      }`}</style>

      {/* Lien à partager */}
      <section className="rounded-2xl border border-[var(--border2)] bg-[var(--surface)] p-5 sm:p-6 print:hidden">
        <h2 className="text-base font-extrabold">Lien de votre menu</h2>
        <p className="mt-1 text-sm text-[var(--text2)]">
          Partagez-le sur vos réseaux, votre site ou en message — vos clients voient votre carte,
          sans appli à installer.
        </p>
        <div className="mt-4 flex items-center gap-2">
          <input
            readOnly
            value={menuLink}
            className="w-full truncate rounded-xl border border-[var(--border2)] bg-[var(--bg)] px-4 py-3 text-[15px] text-[var(--text)] outline-none"
          />
          <CopyButton value={menuLink} />
          <a
            href={menuLink}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-lg border border-[var(--border2)] px-3 py-2 text-sm font-semibold text-[var(--text2)] transition-colors hover:border-[var(--primary)] hover:text-[var(--text)]"
          >
            Ouvrir ↗
          </a>
        </div>
      </section>

      {/* Kit QR de table */}
      <section className="rounded-2xl border border-[var(--border2)] bg-[var(--surface)] p-5 sm:p-6">
        <QrKit
          name={resto.name || 'Notre menu'}
          svgPlain={svgPlain}
          svgHigh={svgHigh}
          logo={logoDataUri}
          fileSlug={fileSlug || 'menu'}
          premiumNoLogo={premium && !logoUrl}
          apparenceHref={`/pro/r/${id}/menu/apparence`}
        />
      </section>
    </div>
  );
}
