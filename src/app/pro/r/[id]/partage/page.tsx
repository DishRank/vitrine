import QRCode from 'qrcode';
import { requireOwnedRestaurant } from '@/lib/pro/data';
import { CopyButton, PrintButton, DownloadPngButton } from './ShareControls';

export const metadata = { title: 'Partage' };

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://dishrank.fr';

/**
 * Onglet « Partage » (ex-page QR). Regroupe tout ce qui sert à diffuser
 * l'établissement : le lien du menu public à copier/partager, et le kit QR de
 * table (chevalet imprimable + QR téléchargeable). Le QR pointe vers
 * `dishrank.fr/menu/<id>?src=qr` (scan compté serveur, jamais intercepté par
 * l'app).
 */
export default async function PartagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resto = await requireOwnedRestaurant(id);
  const menuLink = `${SITE}/menu/${id}`;
  const qrTarget = `${menuLink}?src=qr`;

  const svg = await QRCode.toString(qrTarget, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 1,
    color: { dark: '#1A1832', light: '#FFFFFF' },
  });

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
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div>
            <h2 className="text-base font-extrabold">QR code de table</h2>
            <p className="mt-1 text-sm text-[var(--text2)]">
              Posez le chevalet sur vos tables. Vos clients scannent pour voir la carte — et
              découvrent DishRank pour noter vos plats.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <DownloadPngButton svg={svg} filename={`qr-${fileSlug || 'menu'}.png`} />
            <PrintButton />
          </div>
        </div>

        {/* Chevalet imprimable */}
        <div
          id="qr-chevalet"
          className="mx-auto mt-5 max-w-[380px] rounded-3xl border border-[var(--border2)] bg-white p-8 text-center text-[#1A1832] shadow-sm print:mt-0 print:border-0 print:shadow-none"
        >
          <p className="text-2xl font-extrabold tracking-tight">{resto.name}</p>
          <p className="mt-1 text-sm font-semibold uppercase tracking-widest text-[#6C5CE7]">Notre menu</p>
          {/* eslint-disable-next-line react/no-danger */}
          <div className="mx-auto mt-5 w-56" dangerouslySetInnerHTML={{ __html: svg }} />
          <p className="mt-5 text-sm font-bold">Scannez pour voir la carte</p>
          <p className="mt-4 text-[11px] font-semibold text-[#6C5CE7]">Propulsé par DishRank</p>
        </div>
      </section>
    </div>
  );
}
