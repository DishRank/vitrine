'use client';

import { useEffect, useRef } from 'react';
import { trackSectionView } from '@/lib/analytics';

interface Props {
  section: string;
  /** Threshold de visibilité (0..1) qui déclenche l'event. Défaut 0.5. */
  threshold?: number;
  children: React.ReactNode;
}

/**
 * Wrapper qui envoie un event `section_view` à GA quand son contenu
 * devient visible (>= 50% du viewport par défaut). One-shot : se
 * désabonne après le premier déclenchement pour ne pas re-fire à
 * chaque scroll up/down.
 *
 * Usage :
 *   <TrackInView section="social_features"><SocialFeatures /></TrackInView>
 */
export default function TrackInView({ section, threshold = 0.5, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            trackSectionView(section);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [section, threshold]);

  // Wrapper minimaliste — l'IntersectionObserver observe la bounding box
  // de cette div. On ne peut PAS utiliser `display: contents` ici car le
  // navigateur retire la box → l'observer ne se déclenche jamais.
  // Comme les sections du site sont déjà des `<section>` block, ajouter
  // un div block parent est neutre côté layout.
  return (
    <div ref={ref}>
      {children}
    </div>
  );
}
