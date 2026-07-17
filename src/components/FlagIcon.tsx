import type { CSSProperties } from 'react';

/**
 * Drapeau en SVG inline (pas d'emoji). Les emoji-drapeaux « regional indicator »
 * ne sont PAS rendus sur Windows/Chrome (affichés « FR », « GB »…) — ce composant
 * garantit un vrai drapeau partout. Ratio 3:2, coins arrondis, fin liseré.
 */
const FLAGS: Record<string, string> = {
  // Bleu-blanc-rouge (bandes verticales)
  fr: '<rect width="3" height="2" fill="#fff"/><rect width="1" height="2" fill="#0055A4"/><rect x="2" width="1" height="2" fill="#EF4135"/>',
  // Union Jack (compact, viewBox 60x30 remis à l'échelle par preserveAspectRatio)
  en: '<rect width="3" height="2" fill="#012169"/><path d="M0,0 3,2 M3,0 0,2" stroke="#fff" stroke-width="0.5"/><path d="M1.5,0 V2 M0,1 H3" stroke="#fff" stroke-width="0.8"/><path d="M1.5,0 V2 M0,1 H3" stroke="#C8102E" stroke-width="0.45"/><path d="M0,0 3,2 M3,0 0,2" stroke="#C8102E" stroke-width="0.28"/>',
  // Rouge-jaune-rouge (bandes horizontales, simplifié)
  es: '<rect width="3" height="2" fill="#C60B1E"/><rect y="0.5" width="3" height="1" fill="#FFC400"/>',
  // Noir-rouge-or (bandes horizontales)
  de: '<rect width="3" height="2" fill="#000"/><rect y="0.667" width="3" height="0.667" fill="#DD0000"/><rect y="1.334" width="3" height="0.666" fill="#FFCE00"/>',
  // Vert-blanc-rouge (bandes verticales)
  it: '<rect width="3" height="2" fill="#fff"/><rect width="1" height="2" fill="#009246"/><rect x="2" width="1" height="2" fill="#CE2B37"/>',
};

export default function FlagIcon({
  code,
  size = 18,
  style,
}: {
  code: string;
  size?: number;
  style?: CSSProperties;
}) {
  const content = FLAGS[code];
  const h = Math.round((size * 2) / 3);
  if (!content) {
    return (
      <span aria-hidden style={{ fontSize: size, lineHeight: 1, ...style }}>
        🌐
      </span>
    );
  }
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block',
        width: size,
        height: h,
        borderRadius: 2,
        overflow: 'hidden',
        flexShrink: 0,
        boxShadow: '0 0 0 1px rgba(0,0,0,0.12)',
        ...style,
      }}
      dangerouslySetInnerHTML={{
        __html: `<svg viewBox="0 0 3 2" width="${size}" height="${h}" preserveAspectRatio="xMidYMid slice" style="display:block" xmlns="http://www.w3.org/2000/svg">${content}</svg>`,
      }}
    />
  );
}
