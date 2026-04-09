'use client';
import { useEffect } from 'react';
import { polyfillCountryFlagEmojis } from 'country-flag-emoji-polyfill';

/**
 * Injects a Twemoji webfont for country flag emojis on platforms that don't
 * render them natively (Windows). No-op on Mac/iOS/Android.
 */
export default function FlagPolyfill() {
  useEffect(() => {
    polyfillCountryFlagEmojis();
  }, []);
  return null;
}
