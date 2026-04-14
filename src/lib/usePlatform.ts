'use client';
import { useEffect, useState } from 'react';
import { detectPlatform, type Platform } from './downloadLinks';

/**
 * Hook qui detecte la plateforme cote client.
 * Retourne `mounted = false` lors du premier render (SSR) pour eviter
 * un mismatch d'hydratation. Les composants qui veulent un rendu conditionnel
 * doivent afficher les deux options jusqu'au mount.
 */
export function usePlatform(): { platform: Platform; mounted: boolean } {
  const [platform, setPlatform] = useState<Platform>('desktop');
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setPlatform(detectPlatform());
    setMounted(true);
  }, []);
  return { platform, mounted };
}
