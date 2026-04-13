'use client';
import { useEffect } from 'react';

const FONT_URL = 'https://cdn.jsdelivr.net/npm/country-flag-emoji-polyfill@0.1/dist/TwemojiCountryFlags.woff2';
const STYLE_ID = 'twemoji-country-flags-font';

export default function FlagPolyfill() {
  useEffect(() => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `@font-face {
      font-family: "Twemoji Country Flags";
      unicode-range: U+1F1E6-1F1FF, U+1F3F4, U+E0062-E0063, U+E0065, U+E0067, U+E006C, U+E006E, U+E0073-E0074, U+E0077, U+E007F;
      src: url('${FONT_URL}') format('woff2');
      font-display: swap;
    }`;
    document.head.appendChild(style);
  }, []);
  return null;
}
