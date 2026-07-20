import { requireOwnedRestaurant, isPremium } from '@/lib/pro/data';
import { CopyButton } from './ShareControls';
import QrKit from './QrKit';
import { buildStyledQrSvg } from './qrSvg';

export const metadata = { title: 'Partage' };

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://dishrank.fr';
// Quiet zone = 4 modules (spec ISO 18004). Était à 1 → le PNG 512px cuisait une
// marge trop fine ; 4 fiabilise le scan, surtout imprimé.
const MARGIN = 4;
const QR_DARK = '#1A1832';

/**
 * Préfixe Storage public autorisé pour le logo. GARDE ANTI-SSRF : `logo_url`
 * (colonne, mig.124) est écrivable EN DIRECT par l'owner via PostgREST — la RLS
 * l'y autorise et aucun trigger ne valide le FORMAT de l'URL, seulement le tier
 * pour le thème. Sans ce contrôle, le serveur fetcherait une URL
 * arbitraire (métadonnées cloud, service interne…) et en ré-inlinerait la
 * réponse en base64 dans la page → SSRF avec exfiltration. Même esprit que le
 * garde `isBlockedHost` de osm/photos. L'UI valide déjà à l'écriture
 * (`ownerStorageUrl`) : ceci est la défense en profondeur À LA LECTURE.
 */
const STORAGE_LOGO_PREFIX = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/dish-photos/`
  : null;

function isStorageLogoUrl(url: string): boolean {
  return (
    !!STORAGE_LOGO_PREFIX &&
    url.startsWith(STORAGE_LOGO_PREFIX) &&
    url.length < 500 &&
    /\.webp(\?|$)/.test(url)
  );
}

/** Poids max inliné (le data:URI part dans le HTML de la page). */
const MAX_LOGO_BYTES = 2_000_000;

/**
 * Récupère le logo (URL Storage cross-origin, .webp) côté serveur et l'inline en
 * data:URI base64 → embarqué dans le SVG. Deux bénéfices : (1) l'export PNG
 * (canvas → toBlob dans ShareControls) NE se « taint » PAS (data:URI = même
 * origine) et ne casse pas ; (2) l'impression n'a aucun fetch réseau à faire.
 * N'accepte QUE le Storage public (cf. isStorageLogoUrl) et QUE du `image/*`.
 * Null-safe : tout échec retombe sur le QR nu.
 */
async function fetchLogoDataUri(url: string | null): Promise<string | null> {
  if (!url || !isStorageLogoUrl(url)) return null;
  try {
    const res = await fetch(url, { cache: 'force-cache' });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') ?? 'image/webp';
    // Ne jamais ré-inliner autre chose qu'une image (2ᵉ verrou anti-exfiltration).
    if (!type.startsWith('image/')) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_LOGO_BYTES) return null;
    return `data:${type};base64,${Buffer.from(buf).toString('base64')}`;
  } catch {
    return null;
  }
}

/**
 * Le logo n'est PAS injecté dans le SVG (une <image> imbriquée ne se rasterise
 * pas quand le SVG est dessiné sur un canvas en mode « image » — export PNG
 * cassé). Il est superposé en overlay `<img>` à l'écran/impression (DOM vivant,
 * OK) et redessiné séparément sur le canvas au téléchargement (cf. QrKit +
 * DownloadPngButton). Géométrie partagée : badge rond = 30% du côté (≈7% de
 * surface, bien sous les ~30% récupérables du niveau H), logo centré → ne touche
 * jamais les 3 « yeux ».
 */

/**
 * Onglet « Partage » (ex-page QR). Regroupe tout ce qui sert à diffuser
 * l'établissement : le lien du menu public à copier/partager, et le kit QR de
 * table (chevalet imprimable + QR téléchargeable). Le QR pointe vers
 * `dishrank.fr/menu/<id>?src=qr` (scan compté serveur, jamais intercepté par
 * l'app). QR stylisé (points arrondis + yeux arrondis, cf. buildStyledQrSvg) ;
 * le logo au centre (Premium) est purement déterministe (correction d'erreur H
 * + badge rond) — aucune IA.
 */
export default async function PartagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resto = await requireOwnedRestaurant(id);
  const menuLink = `${SITE}/menu/${id}`;
  const qrTarget = `${menuLink}?src=qr`;

  // Logo dans le QR = perk Premium : on réutilise le logo de la FICHE
  // (`restaurants.logo_url`, mig.124). Le logo lui-même est gratuit à définir,
  // c'est son insertion dans le QR qui est premium — gaté ici au rendu, donc
  // cohérent si l'abonnement a expiré.
  const premium = isPremium(resto);
  const logoUrl = premium ? resto.logo_url : null;
  const logoDataUri = await fetchLogoDataUri(logoUrl);

  // QR nu niveau M (toggle off / pas de logo) ; QR niveau H (~30% de récupération,
  // pour tolérer le logo au centre) généré seulement s'il y a un logo. Le logo
  // lui-même est superposé côté client, pas dans le SVG.
  const svgPlain = buildStyledQrSvg(qrTarget, { level: 'M', margin: MARGIN, dark: QR_DARK });
  const svgHigh = logoDataUri
    ? buildStyledQrSvg(qrTarget, { level: 'H', margin: MARGIN, dark: QR_DARK })
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
      {/* À l'impression : n'afficher QUE la grille de QR (plusieurs par feuille,
          moins de gaspillage). style-src autorise l'inline. */}
      <style>{`@page { margin: 8mm; }
      @media print {
        body * { visibility: hidden !important; }
        #qr-print-sheet, #qr-print-sheet * { visibility: visible !important; }
        #qr-print-sheet {
          position: absolute; inset: 0;
          -webkit-print-color-adjust: exact; print-color-adjust: exact;
        }
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
          premium={premium}
          premiumNoLogo={premium && !logoUrl}
          apparenceHref={`/pro/r/${id}/menu/apparence`}
          cockpitHref={`/pro/r/${id}`}
        />
      </section>
    </div>
  );
}
