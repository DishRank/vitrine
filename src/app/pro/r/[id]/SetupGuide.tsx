'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

/**
 * Guide de démarrage — 3 états déterministes :
 *  A) setup incomplet (fiche OU menu manquant) : guide à étapes, barre de
 *     progression, UNE seule étape active mise en avant, les suivantes atténuées
 *     (mais cliquables — pas de verrou dur).
 *  B) fiche + menu OK mais aucun scan reçu : nudge compact « posez votre QR ».
 *  C) fiche + menu + 1er scan : carte de félicitations (masquable une fois, flag
 *     localStorage) → puis disparaît.
 * L'étape 3 réelle = « recevoir un premier scan » (fini le done:false en dur qui
 * empêchait d'atteindre 3/3).
 */
export default function SetupGuide({
  id,
  hasDescription,
  hasCover,
  hasMenu,
  hasFirstScan,
}: {
  id: string;
  hasDescription: boolean;
  hasCover: boolean;
  hasMenu: boolean;
  hasFirstScan: boolean;
}) {
  const base = `/pro/r/${id}`;
  // La fiche n'est « complète » qu'avec une description ET une photo de
  // couverture (gratuite) — l'image vitrine rend la fiche vivante.
  const ficheDone = hasDescription && hasCover;
  const setupDone = ficheDone && hasMenu;

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // ── C) tout est fait → félicitations (une seule fois) ──────────────────────
  if (setupDone && hasFirstScan) {
    if (!mounted) return null; // évite le flash d'une carte déjà masquée
    let seen = false;
    try {
      seen = localStorage.getItem('dr-pro-setup-' + id) === 'ok';
    } catch {
      /* stockage indispo */
    }
    if (seen) return null;
    return <Celebration id={id} />;
  }

  // ── B) config OK, en attente du premier scan → nudge QR compact ────────────
  if (setupDone && !hasFirstScan) {
    return (
      <section className="mb-6 rounded-2xl border border-[var(--primary)]/25 bg-[var(--primary-container)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base font-extrabold text-[var(--primary)]">Dernière étape : posez votre QR sur les tables</p>
            <p className="mt-0.5 text-sm text-[var(--text2)]">Au premier scan, vos clients voient la carte et notent vos plats.</p>
          </div>
          <Link href={`${base}/partage`} className="shrink-0 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-bold text-white hover:opacity-90">
            Obtenir mon QR
          </Link>
        </div>
      </section>
    );
  }

  // ── A) setup incomplet → guide à étapes ────────────────────────────────────
  const steps = [
    {
      done: ficheDone,
      label: 'Complétez votre fiche',
      hint: "Description, types de cuisine, contact et une photo de couverture — pas besoin d'être parfait, vous compléterez plus tard.",
      href: `${base}/fiche`,
      cta: 'Compléter ma fiche',
    },
    {
      done: hasMenu,
      label: 'Créez votre carte',
      hint: "Vos plats s'affichent gratuitement dès qu'un client scanne le QR de table.",
      href: `${base}/menu`,
      cta: 'Ajouter mes plats',
    },
    {
      done: hasFirstScan,
      label: 'Recevez votre premier scan',
      hint: 'Posez le QR sur vos tables : vos clients découvrent la carte et notent vos plats.',
      href: `${base}/partage`,
      cta: 'Obtenir mon QR',
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const activeIndex = steps.findIndex((s) => !s.done);
  const pct = Math.round((doneCount / 3) * 100);
  const encourage = ['C’est parti, on commence en douceur.', 'Déjà une étape de faite, bien joué !', 'Presque terminé, plus qu’une étape !'][doneCount] ?? '';

  return (
    <section className="mb-6 rounded-2xl border border-[var(--primary)]/25 bg-[var(--primary-container)] p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-extrabold text-[var(--primary)]">Bien démarrer</h2>
        <span className="text-xs font-bold text-[var(--primary)]">Étape {Math.min(doneCount + 1, 3)} sur 3</span>
      </div>
      <p className="mt-0.5 text-xs text-[var(--text2)]">3 étapes, environ 5 minutes. On vous guide — {encourage}</p>

      <div
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[var(--surface)]"
        role="progressbar"
        aria-valuenow={doneCount}
        aria-valuemin={0}
        aria-valuemax={3}
        aria-label={`Progression : ${doneCount} sur 3`}
      >
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: 'var(--primary)' }} />
      </div>

      <ol className="mt-4 space-y-2">
        {steps.map((s, i) => {
          if (s.done) {
            return (
              <li key={i} className="flex items-center gap-3 px-3 py-1.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-success)] text-xs font-bold text-white">✓</span>
                <p className="text-sm font-semibold text-[var(--text3)] line-through">{s.label}</p>
                <span className="sr-only">terminé</span>
              </li>
            );
          }
          const active = i === activeIndex;
          return (
            <li key={i} className={`flex items-center gap-3 rounded-xl p-3 ${active ? 'bg-[var(--surface)]' : 'opacity-60'}`}>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-[var(--primary)] text-xs font-bold text-[var(--primary)]">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[var(--text)]">{s.label}</p>
                {active ? <p className="text-xs text-[var(--text2)]">{s.hint}</p> : null}
              </div>
              <Link
                href={s.href}
                className={
                  active
                    ? 'shrink-0 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-bold text-white hover:opacity-90'
                    : 'shrink-0 text-xs font-semibold text-[var(--primary)] hover:underline'
                }
              >
                {s.cta}
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Celebration({ id }: { id: string }) {
  const [gone, setGone] = useState(false);
  if (gone) return null;
  return (
    <section className="pro-swap mb-6 rounded-2xl border border-[var(--accent-success)]/40 bg-[var(--accent-success)]/10 p-5">
      <p className="text-base font-extrabold text-[var(--text)]">🎉 Bravo, votre restaurant est en ligne !</p>
      <p className="mt-1 text-sm text-[var(--text2)]">
        Votre carte est visible et vos clients peuvent déjà scanner et noter vos plats.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={`/menu/${id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-bold text-white hover:opacity-90"
        >
          Voir mon menu public ↗
        </a>
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.setItem('dr-pro-setup-' + id, 'ok');
            } catch {
              /* stockage indispo */
            }
            setGone(true);
          }}
          className="rounded-lg border border-[var(--border2)] px-3 py-2 text-sm font-semibold text-[var(--text2)] hover:text-[var(--text)]"
        >
          J&apos;ai compris
        </button>
      </div>
    </section>
  );
}
