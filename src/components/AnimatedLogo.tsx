'use client';

import { useCallback, useState } from 'react';

/**
 * Animated DishRank logo — the fork flies up from below, slams into the
 * crown, crown wobbles and damps out. Mirrors the Remotion `LogoIntro`
 * composition in [video-animations/src/LogoIntro.tsx], but implemented as
 * pure CSS keyframes so it runs anywhere in the Next.js site without a
 * render pipeline.
 *
 * Behavior:
 *   • Plays once automatically on mount (first page load = brand moment).
 *   • Hovering the logo replays the full animation (we bump a `key` to
 *     remount the <svg>, which restarts the CSS animations cleanly).
 *   • Respects `prefers-reduced-motion` via the rule in globals.css.
 *
 * Paths are taken verbatim from `communication/contenu/logo.svg` (potrace
 * export, 2048×2048 viewBox with a flip-and-offset outer transform).
 */

const CROWN_D =
  'M10100 20003 c-98 -16 -193 -65 -247 -128 -94 -105 -325 -524 -853 -1545 -882 -1704 -1073 -2048 -1220 -2204 -67 -71 -115 -95 -192 -96 -72 0 -135 23 -336 124 -287 144 -685 371 -1492 853 -1005 600 -1334 783 -1540 858 -184 66 -408 29 -501 -84 -68 -83 -102 -218 -80 -325 40 -202 332 -1153 623 -2036 500 -1514 735 -2185 874 -2495 67 -149 88 -180 198 -300 l89 -96 4381 4 c3110 3 4440 7 4586 15 403 23 577 48 679 99 101 50 127 104 318 648 244 696 798 2330 1015 2994 316 967 384 1277 314 1427 -29 61 -90 117 -176 157 -146 70 -329 29 -685 -153 -173 -89 -322 -175 -945 -545 -1087 -647 -1383 -817 -1695 -975 -257 -130 -363 -170 -455 -170 -73 0 -121 22 -172 78 -68 75 -258 416 -638 1142 -250 478 -339 645 -433 810 -33 58 -167 317 -299 575 -457 893 -622 1184 -724 1274 -88 77 -256 117 -394 94z';

const FORK_D =
  'M9144 11416 c-81 -19 -140 -50 -158 -84 -34 -66 -62 -305 -76 -632 -5 -135 -10 -895 -10 -1690 0 -802 -5 -1510 -10 -1590 -18 -276 -74 -408 -188 -440 -51 -14 -331 -13 -373 2 -64 21 -114 76 -137 148 -41 130 -52 510 -62 2275 -6 969 -13 1596 -20 1673 -15 163 -35 230 -80 260 -69 46 -130 57 -330 57 -163 0 -193 -3 -256 -22 -115 -37 -132 -61 -154 -233 -20 -146 -26 -1088 -19 -2620 4 -811 9 -1846 10 -2300 l3 -825 27 -120 c59 -261 193 -568 337 -775 126 -180 336 -403 507 -540 173 -137 326 -228 595 -350 450 -205 589 -302 666 -465 62 -131 64 -160 64 -812 0 -851 13 -1053 76 -1180 31 -64 73 -98 156 -126 58 -19 91 -21 406 -25 450 -5 554 9 635 86 107 102 126 268 127 1112 0 735 13 894 84 1045 77 163 216 260 666 465 356 162 544 287 784 519 334 325 535 674 620 1080 106 502 126 1091 126 3849 0 1869 -2 2002 -39 2122 -30 99 -107 130 -342 137 -122 4 -175 2 -240 -11 -108 -22 -207 -70 -232 -113 -58 -101 -67 -347 -77 -2188 -6 -911 -14 -1618 -20 -1685 -27 -307 -66 -417 -165 -461 -33 -15 -66 -19 -185 -19 -168 0 -208 9 -254 55 -62 62 -94 191 -116 460 -6 75 -14 812 -20 1745 -10 1809 -16 1990 -66 2095 -54 114 -481 152 -681 60 -65 -29 -86 -68 -103 -190 -16 -112 -28 -1229 -29 -2600 -1 -1095 -2 -1155 -20 -1252 -29 -152 -40 -178 -90 -231 -34 -36 -59 -52 -93 -60 -59 -15 -345 -16 -402 -1 -64 16 -114 62 -147 137 -64 143 -61 54 -70 1967 -5 957 -11 1774 -14 1815 -28 383 -42 422 -163 461 -86 28 -350 37 -448 15z';

type Props = {
  size?: number;
  className?: string;
};

export default function AnimatedLogo({ size = 32, className = '' }: Props) {
  // Bumping this key remounts the <svg>, which is the simplest way to
  // restart a CSS animation from frame 0 on hover.
  const [replayKey, setReplayKey] = useState(0);
  const replay = useCallback(() => setReplayKey((k) => k + 1), []);

  return (
    <span
      className={`inline-block align-middle ${className}`}
      style={{
        width: size,
        height: size,
        color: 'currentColor',
      }}
      onMouseEnter={replay}
    >
      <svg
        key={replayKey}
        viewBox="0 0 2048 2048"
        width={size}
        height={size}
        className="block"
        aria-hidden="true"
      >
        <g transform="translate(0 2048) scale(0.1 -0.1)" fill="currentColor">
          <g className="dr-logo-crown">
            <path d={CROWN_D} />
          </g>
          <g className="dr-logo-fork">
            <path d={FORK_D} />
          </g>
        </g>
      </svg>
    </span>
  );
}
