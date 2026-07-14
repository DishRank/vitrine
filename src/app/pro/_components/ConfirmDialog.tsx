'use client';

import Modal from './Modal';

/**
 * Confirmation propre (au lieu du `confirm()` natif du navigateur) : modale
 * centrée, scroll du fond verrouillé, cohérente avec le reste de l'espace pro.
 * Par défaut orientée « suppression » (bouton rouge). `onConfirm` est déclenché
 * puis la modale se ferme.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Supprimer',
  cancelLabel = 'Annuler',
  danger = true,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="max-w-sm">
      <p className="text-sm text-[var(--text2)]">{message}</p>
      <div className="mt-6 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-[var(--border2)] px-4 py-2 text-sm font-semibold text-[var(--text2)] transition-colors hover:border-[var(--primary)] hover:text-[var(--text)]"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className={`rounded-lg px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 ${danger ? 'bg-red-500' : 'bg-[var(--primary)]'}`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
