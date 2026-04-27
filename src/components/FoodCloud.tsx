'use client';
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';

/**
 * "FoodCloud" — nuage d'emojis décoratifs avec parallax et scroll-reveal.
 *
 * Reprend la mécanique d'animation de l'ancien `<ExploreCategories />` :
 *   • Reveal progressif : les emojis apparaissent un à un quand la section
 *     entre dans le viewport (scale 0 → 1, opacity 0 → 0.85)
 *   • Parallax léger : chaque emoji bouge un peu selon la position de scroll,
 *     avec une vitesse différente par "ring" (effet de profondeur)
 *
 * Layout : ellipses concentriques avec un GROS trou central pour laisser
 * respirer le titre. Plus de remplissage proche du centre.
 *
 * Positions calculées en % (responsive) → sin/cos sur des angles répartis
 * uniformément sur chaque anneau, avec un stagger d'1 demi-pas pour l'anneau
 * pair (évite l'effet "grille rigide").
 */

const FOOD_EMOJIS = [
  '🍔','🍕','🍣','🍝','🥗','🥩','🦐','🍜','🥪','🌮',
  '🌯','🥙','🍢','🍤','🍦','🍧','🍨','🍩','🍪','🎂',
  '🍰','🧁','🥧','🍫','🍬','🍭','🍯','🍿','🥯','🥐',
  '🥖','🫓','🧀','🍳','🥚','🧇','🥞','🥓','🥨','🧈',
  '🥒','🥬','🥦','🧄','🧅','🍄','🥜','🌰','🍞','🥕',
  '🫑','🌶️','🥔','🍠','🍇','🍉','🍊','🍋','🍌','🍍',
];

interface RingConfig {
  perRing: number;
  rx: number; // horizontal radius in %
  ry: number; // vertical radius in %
}

/**
 * Anneaux ELLIPTIQUES dont le rayon minimum est grand : ça crée un trou
 * central libre pour le texte. Plus large que haut → ressemble à la zone
 * lisible du viewport (16:9).
 */
function getRings(isMobile: boolean): RingConfig[] {
  return isMobile
    ? [
        { perRing: 10, rx: 38, ry: 22 }, // ring 0 — closest to text
        { perRing: 14, rx: 50, ry: 36 }, // ring 1 — far edges
      ]
    : [
        { perRing: 12, rx: 36, ry: 22 }, // ring 0
        { perRing: 16, rx: 48, ry: 32 }, // ring 1
        { perRing: 18, rx: 60, ry: 42 }, // ring 2 (extends near corners)
      ];
}

function computePositions(count: number, isMobile: boolean) {
  const rings = getRings(isMobile);
  const positions: { x: string; y: string; ring: number }[] = [];
  let idx = 0;
  for (let r = 0; r < rings.length && idx < count; r++) {
    const { perRing, rx, ry } = rings[r];
    const n = Math.min(perRing, count - idx);
    const stagger = r % 2 === 1 ? Math.PI / perRing : 0;
    for (let j = 0; j < n; j++, idx++) {
      const angle = (j / perRing) * Math.PI * 2 - Math.PI / 2 + stagger;
      positions.push({
        x: (50 + Math.cos(angle) * rx).toFixed(2),
        y: (50 + Math.sin(angle) * ry).toFixed(2),
        ring: r,
      });
    }
  }
  return positions;
}

function getCountForWidth(w: number): number {
  if (w < 480) return 24;
  if (w < 768) return 30;
  if (w < 1024) return 38;
  return 46;
}

export default function FoodCloud() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const emojiRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [revealed, setRevealed] = useState(0);
  const [emojiCount, setEmojiCount] = useState(30);
  const [isMobile, setIsMobile] = useState(false);

  // Detect viewport width and recompute counts on resize
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      setEmojiCount(getCountForWidth(w));
      setIsMobile(w < 640);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const emojis = useMemo(
    () => FOOD_EMOJIS.slice(0, emojiCount),
    [emojiCount]
  );
  const positions = useMemo(
    () => computePositions(emojis.length, isMobile),
    [emojis.length, isMobile]
  );
  // Vitesse de parallax par anneau (plus on est loin du centre, plus on bouge)
  const speeds = useMemo(
    () => positions.map((p) => 0.15 + p.ring * 0.18),
    [positions]
  );

  /**
   * Scroll handler : combine reveal progressif et parallax. Calculé sur la
   * position relative de la section dans le viewport.
   */
  const onScroll = useCallback(() => {
    const section = sectionRef.current;
    if (!section) return;
    const rect = section.getBoundingClientRect();
    const viewH = window.innerHeight;

    // Reveal : 0 quand section juste sous viewport, 1 quand bien dans le cadre
    const revealSpeed = window.innerWidth < 640 ? 0.25 : 0.5;
    const progress = Math.max(0, Math.min(1, (viewH - rect.top) / (viewH + rect.height * revealSpeed)));
    const target = Math.floor(progress * emojis.length);
    setRevealed((prev) => Math.max(prev, target));

    // Parallax : -0.5 (section en bas du viewport) → 0.5 (section en haut)
    const sectionCenter = rect.top + rect.height / 2;
    const offset = (viewH / 2 - sectionCenter) / viewH;

    emojiRefs.current.forEach((el, i) => {
      if (!el || i >= emojis.length) return;
      if (i >= target && i >= revealed) return;
      const speed = speeds[i] || 0.2;
      const ty = offset * speed * 100;
      const tx = offset * speed * 25 * (i % 2 === 0 ? 1 : -1);
      el.style.transform = `scale(1) translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px)`;
    });
  }, [emojis.length, revealed, speeds]);

  useEffect(() => {
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [onScroll]);

  // Reset reveal state when emoji count changes (resize crosses a breakpoint)
  useEffect(() => {
    setRevealed(0);
    emojiRefs.current = [];
  }, [emojiCount]);

  return (
    <section
      ref={sectionRef}
      // overflow-visible : laisse les emojis dépasser quand ils sont en
      // périphérie et que le parallax les pousse au-delà des bords.
      className="relative max-w-[1280px] mx-auto px-4 py-16 sm:py-24 lg:py-32 min-h-[400px] sm:min-h-[500px] lg:min-h-[560px] flex items-center justify-center overflow-visible"
    >
      {/* Decorative emoji cloud (background, ignored by screen readers).
          Two-level transform pour combiner parallax + float-slow :
            • Outer span : reçoit la position absolue + le transform de
              parallax (mis à jour en JS au scroll).
            • Inner span : porte l'animation `float-slow` (CSS, bobbing
              vertical permanent même quand le scroll est immobile). Durée
              et délai sont varies par index pour casser le sync uniforme. */}
      <div className="absolute inset-0 z-0" aria-hidden="true">
        {emojis.map((emoji, i) => (
          <span
            key={`${emojiCount}-${i}`}
            ref={(el) => { emojiRefs.current[i] = el; }}
            className="absolute pointer-events-none will-change-transform"
            style={{
              left: `${positions[i].x}%`,
              top: `${positions[i].y}%`,
              transform: i < revealed ? 'scale(1)' : 'scale(0)',
              opacity: i < revealed ? 0.85 : 0,
              transition: i < revealed ? 'opacity 0.4s ease' : 'transform 0.5s ease, opacity 0.4s ease',
            }}
          >
            <span
              className="block float-slow text-xl sm:text-2xl lg:text-3xl"
              style={{
                // Vary timing per emoji so the cloud doesn't bob in unison
                animationDuration: `${4 + (i % 5)}s`,
                animationDelay: `${(i * 0.27) % 3}s`,
                filter: 'drop-shadow(0 3px 8px rgba(0,0,0,0.25))',
              }}
            >
              {emoji}
            </span>
          </span>
        ))}
      </div>

      {/* Centered text block on top of emoji cloud — sized down to breathe
          better with the smaller surrounding emojis. */}
      <div className="relative z-10 text-center px-4 max-w-2xl mx-auto pointer-events-none">
        <h2
          className="font-black tracking-[-0.025em] leading-[1.05] mb-4 text-[var(--text)]"
          style={{ fontSize: 'clamp(1.875rem, 5.5vw, 3.5rem)' }}
        >
          Tout ce que tu aimes manger.
        </h2>
        <p className="text-sm sm:text-base lg:text-lg text-[var(--text2)] leading-relaxed mb-1.5">
          200+ catégories. De la street food à la haute gastronomie.
        </p>
        <p className="text-sm sm:text-base text-[var(--text3)] font-semibold">
          Chaque plat a sa note.
        </p>
      </div>
    </section>
  );
}
