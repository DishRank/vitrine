import Link from 'next/link';

/**
 * Guide de démarrage affiché EN HAUT de la fiche tant que l'établissement n'est
 * pas prêt (fiche incomplète ou menu vide). Se masque tout seul une fois la
 * fiche remplie ET le menu créé → aucun encombrement pour les owners établis.
 */
export default function SetupGuide({
  id,
  hasDescription,
  hasMenu,
}: {
  id: string;
  hasDescription: boolean;
  hasMenu: boolean;
}) {
  if (hasDescription && hasMenu) return null;

  const steps: { done: boolean; label: string; hint: string; href: string | null; cta: string }[] = [
    {
      done: hasDescription,
      label: 'Complétez votre fiche',
      hint: 'Description, types de cuisine, contact',
      href: `/pro/r/${id}/fiche`,
      cta: 'Compléter',
    },
    {
      done: hasMenu,
      label: 'Créez votre menu',
      hint: 'Vos plats, visibles gratuitement via le QR de table',
      href: `/pro/r/${id}/menu`,
      cta: 'Créer le menu',
    },
    {
      done: false,
      label: 'Partagez votre QR de table',
      hint: 'Vos clients scannent, consultent la carte et notent vos plats',
      href: `/pro/r/${id}/partage`,
      cta: 'Voir le QR',
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;

  return (
    <section className="mb-6 rounded-2xl border border-[var(--primary)]/25 bg-[var(--primary-container)] p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-extrabold text-[var(--primary)]">Bien démarrer</h2>
        <span className="text-xs font-bold text-[var(--primary)]">{doneCount}/3</span>
      </div>
      <ol className="mt-3 space-y-2">
        {steps.map((s, i) => (
          <li
            key={i}
            className="flex items-center gap-3 rounded-xl bg-[var(--surface)] p-3"
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                s.done ? 'bg-[var(--accent-success)] text-white' : 'border-2 border-[var(--primary)] text-[var(--primary)]'
              }`}
            >
              {s.done ? '✓' : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-bold ${s.done ? 'text-[var(--text3)] line-through' : 'text-[var(--text)]'}`}>{s.label}</p>
              <p className="text-xs text-[var(--text2)]">{s.hint}</p>
            </div>
            {s.done ? null : s.href ? (
              <Link
                href={s.href}
                className="shrink-0 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-bold text-white hover:opacity-90"
              >
                {s.cta}
              </Link>
            ) : (
              <span className="shrink-0 text-xs font-semibold text-[var(--text3)]">{s.cta}</span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
