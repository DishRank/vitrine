'use client';

import { usePathname } from 'next/navigation';

/**
 * Enveloppe le contenu du workspace resto et rejoue une animation d'entrée à
 * chaque changement d'URL (changement de resto via le carrousel OU d'onglet).
 * Le carrousel + l'en-tête vivent DANS le layout parent (/pro/r) qui, lui, reste
 * monté — seul ce bloc se re-keye, d'où le ressenti « le dessous change ».
 */
export default function AnimatedOutlet({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="pro-swap">
      {children}
    </div>
  );
}
