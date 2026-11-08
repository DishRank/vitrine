import type { Metadata } from 'next';

/**
 * /auth/confirm (lien de confirmation d'email de l'appli) : la page est un
 * composant client sans <html> ni métadonnées. Ce layout lui donne un titre
 * d'onglet, la garde hors des moteurs de recherche (le jeton est dans l'URL)
 * et ne transmet pas l'adresse en Referer.
 */
export const metadata: Metadata = {
  title: 'Confirmation de ton email — DishRank',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function ConfirmLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}