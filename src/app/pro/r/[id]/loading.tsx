/**
 * Skeleton du workspace resto — affiché INSTANTANÉMENT pendant que le contenu
 * dynamique (fiche/menu/avis/stats) se rend côté serveur. Supprime le ressenti
 * « rien ne se passe » au clic. Le carrousel + l'en-tête restent visibles
 * (layout parent), seul ce bloc est remplacé.
 */
export default function WorkspaceLoading() {
  return (
    <div className="pro-swap">
      <div className="mt-6 h-8 w-56 rounded-lg bg-[var(--surface-var)]" />
      <div className="mt-2 h-4 w-40 rounded bg-[var(--surface-var)]" />

      <div className="mt-5 flex gap-1 border-b border-[var(--border2)]">
        {['Fiche', 'Menu', 'Avis', 'Stats'].map((t) => (
          <div key={t} className="px-4 py-2.5 text-sm font-bold text-[var(--text3)]">
            {t}
          </div>
        ))}
      </div>

      <div className="mt-6 space-y-4">
        <div className="h-32 rounded-2xl border border-[var(--border2)] bg-[var(--surface)]" />
        <div className="h-48 rounded-2xl border border-[var(--border2)] bg-[var(--surface)]" />
      </div>
    </div>
  );
}
