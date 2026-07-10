// Regenerate the vitrine's static logo assets from the brand vector (crown +
// long-handle fork). Mirrors dishrank/scripts/gen-app-logos.mjs. Run from the
// vitrine root: `node scripts/gen-logos.mjs`
//
//   public/img/icon.webp                  512²  brand mark #6C5CE7, transparent (light favicon + JSON-LD logo)
//   public/img/icon-192.webp              192²  brand mark #6C5CE7, transparent (manifest)
//   public/img/icon-512.webp              512²  brand mark #6C5CE7, transparent (manifest)
//   public/img/logo-light.webp            512²  white mark, transparent         (favicon dark scheme)
//   public/img/logo-white.png            2048²  white mark, transparent         (brand kit / external)
//   public/img/apple-touch-icon.png       180²  brand mark #6C5CE7, transparent
//   public/apple-touch-icon.png           180²  idem (racine, requêtée par iOS)
//   public/apple-touch-icon-precomposed.png     idem
//   public/favicon.png                    180²  brand mark #6C5CE7, transparent
//   public/favicon.ico                    180²  webp renommé .ico (les navigateurs sniffent le contenu)
import sharp from 'sharp';
import fs from 'node:fs';

const LOGO_SVG = 'D:/dev/dishrank/communication/contenu/logo.svg';
const BRAND = '#6C5CE7';
const WHITE = '#FFFFFF';

const svg = fs.readFileSync(LOGO_SVG, 'utf8');
const paths = [...svg.matchAll(/<path\b[^>]*\bd="([^"]*)"/g)].map((m) => m[1].replace(/\s+/g, ' ').trim());
const [CROWN, FORK] = paths[0].split(/(?=M )/).filter(Boolean).map((s) => s.trim());
const HANDLE = paths[1];

// The whole mark (crown + fork + lengthened handle) in one recolourable SVG.
const markSvg = (color) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2140">` +
  `<path d="${CROWN}" fill="${color}" fill-rule="evenodd"/>` +
  `<path d="${FORK}" fill="${color}" fill-rule="evenodd"/>` +
  `<path d="${HANDLE}" fill="${color}"/>` +
  `</svg>`;

// Cache a high-res trimmed render per colour; downscale per asset from that.
const hi = {};
async function mark(color, heightPx) {
  if (!hi[color]) {
    const raster = await sharp(Buffer.from(markSvg(color))).resize({ height: 2200 }).png().toBuffer();
    hi[color] = await sharp(raster).trim().png().toBuffer();
  }
  return sharp(hi[color]).resize({ height: Math.round(heightPx) }).png().toBuffer();
}

// Mark centred on a transparent square — ~93 % of the canvas height, same
// ratio as the previous assets (476/512, 168/180, 1901/2048).
async function onTransparent(size, color, heightPx, out, format) {
  const canvas = sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite([{ input: await mark(color, heightPx), gravity: 'center' }]);
  if (format === 'webp') await canvas.webp({ lossless: true }).toFile(out);
  else await canvas.png().toFile(out);
  console.log(`✓ ${out} ${size}² — mark ${color} @ ${Math.round(heightPx)}px, transparent`);
}

await onTransparent(512, BRAND, 476, 'public/img/icon.webp', 'webp');
await onTransparent(192, BRAND, 179, 'public/img/icon-192.webp', 'webp');
await onTransparent(512, BRAND, 476, 'public/img/icon-512.webp', 'webp');
await onTransparent(512, WHITE, 476, 'public/img/logo-light.webp', 'webp');
await onTransparent(2048, WHITE, 1901, 'public/img/logo-white.png', 'png');
await onTransparent(180, BRAND, 168, 'public/img/apple-touch-icon.png', 'png');
await onTransparent(180, BRAND, 168, 'public/favicon.png', 'png');
fs.copyFileSync('public/img/apple-touch-icon.png', 'public/apple-touch-icon.png');
fs.copyFileSync('public/img/apple-touch-icon.png', 'public/apple-touch-icon-precomposed.png');
console.log('✓ apple-touch-icon copié à la racine (+ variante precomposed)');

// favicon.ico — comme avant : un webp renommé .ico (contenu sniffé par les
// navigateurs modernes, servi par next depuis public/).
const icoBuf = await sharp({
  create: { width: 180, height: 180, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite([{ input: await mark(BRAND, 168), gravity: 'center' }])
  .webp({ lossless: true })
  .toBuffer();
fs.writeFileSync('public/favicon.ico', icoBuf);
console.log('✓ public/favicon.ico 180² — webp renommé');

console.log('✓ vitrine logos regenerated from', LOGO_SVG);
