'use client';

import { useState } from 'react';
import Modal from '@/app/pro/_components/Modal';
import ThemeEditor from './ThemeEditor';
import type { MenuThemeConfig } from '../themeConstants';

/**
 * Ouvre l'éditeur d'apparence en modale (ouverture instantanée, aucune
 * navigation) depuis l'en-tête du menu. Réutilise ThemeEditor tel quel — donc
 * l'auto-save en arrière-plan et le statut « Enregistré ✓ » dans l'en-tête
 * fonctionnent aussi ici. La page /menu/apparence reste dispo en accès direct.
 */
export default function AppearanceButton({
  restaurantId,
  initialTheme,
  premium,
  logoUrl,
}: {
  restaurantId: string;
  initialTheme: MenuThemeConfig;
  premium: boolean;
  logoUrl: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-[var(--border2)] px-3 py-2 text-sm font-semibold text-[var(--text2)] hover:border-[var(--primary)] hover:text-[var(--text)]"
      >
        Apparence
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Apparence du menu"
        subtitle="Ambiance, couleur, police et logo. Les changements sont enregistrés automatiquement."
        maxWidth="max-w-4xl"
      >
        <ThemeEditor restaurantId={restaurantId} initial={initialTheme} premium={premium} logoUrl={logoUrl} />
      </Modal>
    </>
  );
}
