'use client';

import { useState } from 'react';
import { DownloadPngButton, PrintButton } from './ShareControls';

/**
 * Kit QR de table (client). Le toggle « Insérer mon logo » choisit le QR de base
 * (nu niveau M, ou niveau H quand on affiche le logo) et superpose le logo en
 * overlay `<img>` centré sur une pastille blanche (knockout). L'état pilote À LA
 * FOIS l'aperçu, l'impression et le téléchargement PNG → toujours cohérents.
 *
 * Le logo est un overlay DOM (pas injecté dans le SVG) : une <image> imbriquée
 * ne se rasterise pas à l'export canvas. Le PNG le redessine séparément
 * (DownloadPngButton). Géométrie partagée avec le canvas : pastille = 28% du
 * côté, logo ≈ 76% de la pastille. Les textes restent toujours affichés.
 */
export default function QrKit({
  name,
  svgPlain,
  svgHigh,
  logo,
  fileSlug,
  premiumNoLogo,
  apparenceHref,
}: {
  name: string;
  svgPlain: string;
  svgHigh: string | null;
  logo: string | null;
  fileSlug: string;
  premiumNoLogo: boolean;
  apparenceHref: string;
}) {
  const hasLogo = !!logo && !!svgHigh;
  const [showLogo, setShowLogo] = useState(hasLogo);
  const withLogo = hasLogo && showLogo;
  const svg = withLogo ? (svgHigh as string) : svgPlain;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h2 className="text-base font-extrabold">QR code de table</h2>
          <p className="mt-1 text-sm text-[var(--text2)]">
            Posez le chevalet sur vos tables. Vos clients scannent pour voir la carte — et
            découvrent DishRank pour noter vos plats.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasLogo ? (
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--border2)] px-3 py-2 text-sm font-semibold text-[var(--text2)]">
              <input
                type="checkbox"
                checked={showLogo}
                onChange={(e) => setShowLogo(e.target.checked)}
                className="h-4 w-4 accent-[var(--primary)]"
              />
              Insérer mon logo
            </label>
          ) : null}
          <DownloadPngButton
            svg={svg}
            logo={withLogo ? logo : null}
            filename={`qr-${fileSlug}${withLogo ? '-logo' : ''}.png`}
          />
          <PrintButton />
        </div>
      </div>

      {premiumNoLogo ? (
        <p className="mt-2 text-xs text-[var(--text3)] print:hidden">
          Ajoutez un logo dans{' '}
          <a href={apparenceHref} className="font-semibold text-[var(--primary)] hover:underline">
            Apparence
          </a>{' '}
          pour l&apos;afficher au centre du QR code.
        </p>
      ) : null}

      {/* Chevalet imprimable */}
      <div
        id="qr-chevalet"
        className="mx-auto mt-5 max-w-[380px] rounded-3xl border border-[var(--border2)] bg-white p-8 text-center text-[#1A1832] shadow-sm print:mt-0 print:border-0 print:shadow-none"
      >
        <p className="text-2xl font-extrabold tracking-tight">{name}</p>
        <p className="mt-1 text-sm font-semibold uppercase tracking-widest text-[#6C5CE7]">Notre menu</p>
        <div className="relative mx-auto mt-5 w-56">
          {/* eslint-disable-next-line react/no-danger */}
          <div dangerouslySetInnerHTML={{ __html: svg }} />
          {withLogo ? (
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[16%] bg-white"
              style={{ width: '28%', height: '28%', padding: '3.36%' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo as string} alt="" className="h-full w-full object-contain" />
            </div>
          ) : null}
        </div>
        <p className="mt-5 text-sm font-bold">Scannez pour voir la carte</p>
        <p className="mt-4 text-[11px] font-semibold text-[#6C5CE7]">Propulsé par DishRank</p>
      </div>
    </>
  );
}
