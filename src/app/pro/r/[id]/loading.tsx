/**
 * Skeleton du workspace resto — affiché INSTANTANÉMENT pendant que le contenu
 * dynamique (fiche/menu/avis/stats) se rend côté serveur. Supprime le ressenti
 * « rien ne se passe » au clic. La sidebar + la topbar restent visibles
 * (layout parent), seul ce bloc est remplacé.
 */
export default function WorkspaceLoading() {
  return (
    <div className="pro-swap">
      <div className="h-8 w-56 rounded-lg bg-[var(--surface-var)]" />
      <div className="mt-2 h-4 w-40 rounded bg-[var(--surface-var)]" />

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-2xl border border-[var(--border2)] bg-[var(--surface)]" />
        ))}
      </div>

      <div className="mt-4 space-y-4">
        <div className="h-40 rounded-2xl border border-[var(--border2)] bg-[var(--surface)]" />
        <div className="h-48 rounded-2xl border border-[var(--border2)] bg-[var(--surface)]" />
      </div>
    </div>
  );
}
