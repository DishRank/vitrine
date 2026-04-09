'use client';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';

// Decorative food emojis — hardcoded, no DB dependency
const FOOD_EMOJIS = [
  '🍔','🍕','🍣','🍝','🥗','🥩','🦐','🍜','🥪','🌮',
  '🌯','🥙','🍢','🍤','🍦','🍧','🍨','🍩','🍪','🎂',
  '🍰','🧁','🥧','🍫','🍬','🍭','🍯','🍿','🥯','🥐',
  '🥖','🫓','🧀','🍳','🥚','🧇','🥞','🥓','🥨','🧈',
  '🥒','🥬','🥦','🧄','🧅','🍄','🥜','🌰','🍞','🥕',
  '🫑','🌶️','🥔','🍠','🍇','🍉','🍊','🍋','🍌','🍍',
  '🥭','🍎','🍐','🍑','🍒','🍓','🫐','🥥','🥝','🍅',
  '🫒','🍵','🍶','🍷','🍹','🍺','🥂','🥃','🧋','🥟',
];

// Elliptical rings — wider than tall, well balanced around center
function computePositions(count: number, isMobile: boolean) {
  const positions: { x: string; y: string; ring: number }[] = [];
  // Ring config: [emojis per ring, horizontal radius %, vertical radius %]
  const rings = isMobile
    ? [[10, 28, 18], [14, 40, 30], [18, 50, 42]]
    : [[10, 22, 14], [14, 34, 24], [18, 44, 34], [16, 54, 44]];

  let idx = 0;
  for (let r = 0; r < rings.length && idx < count; r++) {
    const [perRing, rx, ry] = rings[r];
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
  if (w < 480) return 32;
  if (w < 768) return 42;
  if (w < 1024) return 52;
  return 58;
}

export default function ExploreCategories() {
  const t = useTranslations('explore');
  const sectionRef = useRef<HTMLDivElement>(null);
  const emojiRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [revealed, setRevealed] = useState(0);
  const [emojiCount, setEmojiCount] = useState(20);
  const [isMobile, setIsMobile] = useState(false);

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
  const speeds = useMemo(
    () => positions.map((p) => (p.ring === 0 ? 0.15 : p.ring === 1 ? 0.3 : 0.45)),
    [positions]
  );

  const onScroll = useCallback(() => {
    const section = sectionRef.current;
    if (!section) return;
    const rect = section.getBoundingClientRect();
    const viewH = window.innerHeight;

    const revealSpeed = window.innerWidth < 640 ? 0.25 : 0.5;
    const progress = Math.max(0, Math.min(1, (viewH - rect.top) / (viewH + rect.height * revealSpeed)));
    const target = Math.floor(progress * emojis.length);
    setRevealed((prev) => Math.max(prev, target));

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

  // Reset revealed when count changes (screen resize)
  useEffect(() => {
    setRevealed(0);
    emojiRefs.current = [];
  }, [emojiCount]);

  return (
    <section ref={sectionRef} className="relative max-w-[1200px] mx-auto px-4 py-12 sm:py-20 min-h-[350px] sm:min-h-[520px] flex items-center justify-center overflow-visible">
      <div className="relative z-10 text-center pointer-events-none">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black leading-tight mb-2">{t('title')}</h2>
        <p className="text-sm text-[var(--text2)]">{t('subtitle')}</p>
      </div>
      <div className="absolute inset-0 z-0" aria-hidden="true">
        {emojis.map((emoji, i) => (
          <span
            key={`${emojiCount}-${i}`}
            ref={(el) => { emojiRefs.current[i] = el; }}
            className="absolute text-2xl sm:text-3xl pointer-events-none will-change-transform"
            style={{
              left: `${positions[i].x}%`,
              top: `${positions[i].y}%`,
              transform: i < revealed ? 'scale(1)' : 'scale(0)',
              opacity: i < revealed ? '0.7' : '0',
              transition: i < revealed ? 'opacity 0.4s ease' : 'transform 0.5s ease, opacity 0.4s ease',
            }}
          >
            {emoji}
          </span>
        ))}
      </div>
    </section>
  );
}
