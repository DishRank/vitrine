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
 * (DownloadPngButton). Géométrie partagée avec le canvas : badge rond = 30% du
 * côté, anneau à 86% du badge, logo ≈ 62% du badge. Les textes restent toujours
 * affichés.
 */
export default function QrKit({
  name,
  svgPlain,
  svgHigh,
  logo,
  fileSlug,
  premium,
  premiumNoLogo,
  apparenceHref,
  cockpitHref,
}: {
  name: string;
  svgPlain: string;
  svgHigh: string | null;
  logo: string | null;
  fileSlug: string;
  premium: boolean;
  premiumNoLogo: boolean;
  apparenceHref: string;
  cockpitHref: string;
}) {
  const hasLogo = !!logo && !!svgHigh;
  const [showLogo, setShowLogo] = useState(hasLogo);
  const withLogo = hasLogo && showLogo;
  const svg = withLogo ? (svgHigh as string) : svgPlain;

  // Nombre de QR par feuille A4 à l'impression (grille 2 colonnes) — 6 tiennent
  // proprement sur une page (2 × 3) sans déborder. Évite de gâcher une feuille
  // entière pour un seul QR.
  const PRINT_COPIES = 6;

  /** Carte QR (nom + code + logo optionnel + libellés). `compact` = version dense
   *  de la feuille d'impression ; sinon l'aperçu écran plein format. Géométrie du
   *  badge logo identique (pastille ronde 30% + anneau + ombre). */
  const renderCard = (compact: boolean, key?: number) => (
    <div
      key={key}
      className={
        compact
          ? 'flex break-inside-avoid flex-col items-center rounded-xl border border-dashed border-[#C9C4D8] bg-white p-4 text-center text-[#1A1832]'
          : 'mx-auto max-w-[380px] rounded-3xl border border-[var(--border2)] bg-white p-8 text-center text-[#1A1832] shadow-sm'
      }
    >
      <p className={compact ? 'text-lg font-extrabold leading-tight tracking-tight' : 'text-2xl font-extrabold tracking-tight'}>{name}</p>
      <p className={compact ? 'mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-[#6C5CE7]' : 'mt-1 text-sm font-semibold uppercase tracking-widest text-[#6C5CE7]'}>Notre menu</p>
      <div className={`relative mx-auto ${compact ? 'mt-3 w-[150px]' : 'mt-5 w-56'}`}>
        <div dangerouslySetInnerHTML={{ __html: svg }} />
        {withLogo ? (
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white"
            style={{ width: '30%', height: '30%', boxShadow: '0 1px 6px rgba(26,24,50,0.28)' }}
          >
            <div
              className="flex h-[86%] w-[86%] items-center justify-center rounded-full"
              style={{ border: '1.5px solid #6C5CE7', padding: '10%' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo as string} alt="" className="h-full w-full object-contain" />
            </div>
          </div>
        ) : null}
      </div>
      <p className={compact ? 'mt-3 text-xs font-bold' : 'mt-5 text-sm font-bold'}>Scannez pour voir la carte</p>
      <p className={compact ? 'mt-2 text-[9px] font-semibold text-[#6C5CE7]' : 'mt-4 text-[11px] font-semibold text-[#6C5CE7]'}>Propulsé par DishRank</p>
    </div>
  );

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
        {/* `flex-wrap` indispensable : les 3 contrôles (case logo + 2 boutons)
            font ~520 px côte à côte et débordaient sous 640 px. Le parent
            enveloppe déjà, mais ça ne suffit pas — c'est CETTE rangée qui doit
            casser. */}
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
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
          ) : !premium ? (
            <div
              className="flex cursor-not-allowed items-center gap-2 rounded-lg border border-[var(--border2)] px-3 py-2 text-sm font-semibold text-[var(--text3)] opacity-70"
              title="Réservé au Premium"
            >
              <input type="checkbox" disabled className="h-4 w-4 accent-[var(--primary)]" />
              Insérer mon logo
              <span className="text-[11px] font-bold">🔒 Premium</span>
            </div>
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
      ) : !premium ? (
        <p className="mt-2 text-xs text-[var(--text3)] print:hidden">
          Afficher votre logo au centre du QR code est{' '}
          <a href={cockpitHref} className="font-semibold text-[var(--primary)] hover:underline">
            réservé au Premium
          </a>
          .
        </p>
      ) : null}

      {/* Aperçu écran : une seule carte pleine taille. */}
      <div className="mt-5 print:hidden">{renderCard(false)}</div>

      {/* Feuille d'impression : le maximum de QR identiques à découper (grille
          2 colonnes). Seul ce bloc est visible à l'impression (cf. @media print
          dans page.tsx). Bordure pointillée = repère de découpe. */}
      <div id="qr-print-sheet" className="hidden grid-cols-2 gap-3 print:grid">
        {Array.from({ length: PRINT_COPIES }).map((_, i) => renderCard(true, i))}
      </div>
    </>
  );
}
