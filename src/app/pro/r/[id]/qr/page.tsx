import Link from 'next/link';
import QRCode from 'qrcode';
import { requireOwnedRestaurant } from '@/lib/pro/data';
import PrintButton from './PrintButton';

export const metadata = { title: 'QR code' };

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://dishrank.fr';

/**
 * Kit QR (lot 3.5). Génère le SVG QR SERVEUR (CSP-safe, aucun script) pointant
 * vers `dishrank.fr/menu/<id>?src=qr` — le scan est compté côté serveur par la
 * page menu (log_qr_scan), et /menu/* n'est jamais intercepté par l'app.
 * Chevalet de table imprimable (print CSS).
 */
export default async function QrKitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resto = await requireOwnedRestaurant(id);
  const menuUrl = `${SITE}/menu/${id}?src=qr`;

  const svg = await QRCode.toString(menuUrl, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 1,
    color: { dark: '#1A1832', light: '#FFFFFF' },
  });

  return (
    <div>
      {/* À l'impression : n'afficher QUE le chevalet (le reste — chrome du
          workspace, en-tête — est masqué). style-src autorise l'inline. */}
      <style>{`@media print {
        body * { visibility: hidden !important; }
        #qr-chevalet, #qr-chevalet * { visibility: visible !important; }
        #qr-chevalet { position: absolute; inset: 0; margin: auto; }
      }`}</style>
      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <Link href={`/pro/r/${id}/menu`} className="text-xs font-semibold text-[var(--text3)] hover:text-[var(--text2)]">
          ← Retour au menu
        </Link>
        <PrintButton />
      </div>

      <p className="mb-4 text-sm text-[var(--text2)] print:hidden">
        Imprimez ce chevalet et posez-le sur vos tables. Vos clients scannent pour consulter votre
        menu — et découvrent DishRank pour noter vos plats.
      </p>

      {/* Chevalet imprimable */}
      <div id="qr-chevalet" className="mx-auto max-w-[380px] rounded-3xl border border-[var(--border2)] bg-white p-8 text-center text-[#1A1832] shadow-sm print:border-0 print:shadow-none">
        <p className="text-2xl font-extrabold tracking-tight">{resto.name}</p>
        <p className="mt-1 text-sm font-semibold uppercase tracking-widest text-[#6C5CE7]">Notre menu</p>
        {/* eslint-disable-next-line react/no-danger */}
        <div className="mx-auto mt-5 w-56" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="mt-5 text-sm font-bold">Scannez pour voir la carte</p>
        <p className="mt-1 text-xs text-[#8C8478]">Pas d&apos;appli à installer</p>
        <p className="mt-4 text-[11px] font-semibold text-[#6C5CE7]">Propulsé par DishRank</p>
      </div>

      <p className="mt-4 break-all text-center text-xs text-[var(--text3)] print:hidden">{menuUrl}</p>
    </div>
  );
}
