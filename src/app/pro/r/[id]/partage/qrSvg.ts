import QRCode from 'qrcode';

/**
 * Génère le SVG d'un QR code STYLISÉ (modules en points arrondis + yeux
 * arrondis) côté serveur, sans dépendance de rendu supplémentaire : on lit la
 * matrice via `QRCode.create` (le moteur `qrcode` ne sait dessiner que des
 * carrés) et on émet nous-mêmes les formes.
 *
 * Choix de robustesse au scan : les 3 « yeux » (finder patterns) gardent leur
 * géométrie 7/5/3 avec un simple arrondi (les scanners les détectent par
 * proportion, pas par angle vif) ; les modules de données deviennent des points
 * de Ø 0.9 module (assez gros pour rester lisibles à l'impression). Le niveau de
 * correction d'erreur (`level`) est passé par l'appelant : 'H' quand un logo est
 * superposé au centre (~30% récupérable), 'M' sinon.
 *
 * Mêmes conventions que l'ancien `QRCode.toString` : unité = 1 module,
 * `viewBox="0 0 S S"` (S = N + 2·marge), PAS de width/height intrinsèque (le SVG
 * s'adapte au conteneur à l'écran et se rastérise à 512px au téléchargement). Le
 * logo n'est JAMAIS dans le SVG (une <image> imbriquée ne se rasterise pas à
 * l'export canvas) — il reste un overlay/redraw (cf. QrKit + DownloadPngButton).
 */
export interface StyledQrOptions {
  level: 'M' | 'H';
  dark?: string;
  light?: string;
  margin?: number;
}

export function buildStyledQrSvg(
  text: string,
  { level, dark = '#1A1832', light = '#FFFFFF', margin = 4 }: StyledQrOptions
): string {
  const qr = QRCode.create(text, { errorCorrectionLevel: level });
  const N = qr.modules.size;
  const data = qr.modules.data;
  const bit = (r: number, c: number) => (r < 0 || c < 0 || r >= N || c >= N ? 0 : data[r * N + c]);
  const S = N + margin * 2;
  const off = margin;

  const EYES: ReadonlyArray<readonly [number, number]> = [
    [0, 0],
    [0, N - 7],
    [N - 7, 0],
  ];
  const inFinder = (r: number, c: number) =>
    EYES.some(([fr, fc]) => r >= fr && r < fr + 7 && c >= fc && c < fc + 7);

  const n = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(3).replace(/0+$/, '').replace(/\.$/, ''));

  // Modules de données → points. Un point = deux arcs de demi-cercle (une seule
  // sous-commande de path, toutes concaténées dans un unique <path>).
  const rad = 0.45;
  let dots = '';
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (!bit(r, c) || inFinder(r, c)) continue;
      const cx = c + off + 0.5;
      const cy = r + off + 0.5;
      dots += `M${n(cx - rad)} ${n(cy)}a${rad} ${rad} 0 1 0 ${rad * 2} 0a${rad} ${rad} 0 1 0 ${-rad * 2} 0z`;
    }
  }

  // Yeux arrondis : carré 7 (foncé, rx 2) → carré 5 (clair, rx 1.4) → pastille 3
  // centrale (foncée, rx 0.9).
  let eyes = '';
  for (const [fr, fc] of EYES) {
    const x = fc + off;
    const y = fr + off;
    eyes +=
      `<rect x="${x}" y="${y}" width="7" height="7" rx="2" fill="${dark}"/>` +
      `<rect x="${x + 1}" y="${y + 1}" width="5" height="5" rx="1.4" fill="${light}"/>` +
      `<rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx="0.9" fill="${dark}"/>`;
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}">` +
    `<rect width="${S}" height="${S}" fill="${light}"/>` +
    `<path d="${dots}" fill="${dark}"/>${eyes}</svg>`
  );
}
