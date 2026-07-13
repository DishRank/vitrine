'use client';

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-bold text-white hover:opacity-90"
    >
      Imprimer
    </button>
  );
}
