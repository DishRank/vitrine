'use client';

import { useState, useTransition } from 'react';
import { translateMenuAction } from './menuActions';

/** Langues cibles (saisie en FR). Ordre = ordre d'affichage. */
const LANGS = [
  { code: 'en', label: 'Anglais', flag: '🇬🇧' },
  { code: 'es', label: 'Espagnol', flag: '🇪🇸' },
  { code: 'de', label: 'Allemand', flag: '🇩🇪' },
  { code: 'it', label: 'Italien', flag: '🇮🇹' },
];

/**
 * Panneau « Langues du menu ». La saisie se fait en français ; l'owner ajoute
 * les autres langues via la traduction automatique (edge fn menu-translate,
 * Premium). Chaque langue est prévisualisable (menu public ?lang=xx), avec un
 * statut « traduit / à traduire ».
 */
export default function LanguagePanel({
  restaurantId,
  translatedLocales,
  premium,
}: {
  restaurantId: string;
  translatedLocales: string[];
  premium: boolean;
}) {
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState('');
  const done = new Set(translatedLocales);

  const translate = () =>
    start(async () => {
      setNotice('');
      const r = await translateMenuAction(restaurantId);
      const msg = r.error === 'network' ? 'Service de traduction injoignable. Réessayez.' : r.error;
      setNotice(r.ok ? `Traduction mise à jour (${r.translated ?? 0} champs).` : msg || 'Une erreur est survenue.');
    });

  return (
    <section className="rounded-2xl border border-[var(--border2)] bg-[var(--surface)] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-extrabold">Langues du menu</h3>
          <p className="mt-0.5 text-sm text-[var(--text2)]">
            Vous saisissez en français. Ajoutez d&apos;autres langues pour vos clients étrangers.
          </p>
        </div>
        {premium ? (
          <button
            onClick={translate}
            disabled={pending}
            className="shrink-0 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
          >
            {pending ? 'Traduction…' : 'Traduire automatiquement'}
          </button>
        ) : (
          <span className="shrink-0 rounded-full bg-[var(--primary-container)] px-3 py-1.5 text-xs font-bold text-[var(--primary)]">
            Premium
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--primary)] bg-[var(--primary-container)] px-2.5 py-1.5 text-xs font-bold text-[var(--primary)]">
          🇫🇷 Français
          <span className="font-semibold opacity-70">· saisie</span>
        </span>
        {LANGS.map((l) => (
          <a
            key={l.code}
            href={`/menu/${restaurantId}?lang=${l.code}`}
            target="_blank"
            rel="noopener noreferrer"
            title={`Aperçu du menu en ${l.label.toLowerCase()}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border2)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text2)] transition-colors hover:border-[var(--primary)] hover:text-[var(--text)]"
          >
            <span aria-hidden>{l.flag}</span>
            {l.label}
            {done.has(l.code) ? (
              <span className="font-bold text-[var(--accent-success)]">✓</span>
            ) : (
              <span className="text-[var(--text3)]">· à traduire</span>
            )}
          </a>
        ))}
      </div>

      {!premium ? (
        <p className="mt-3 text-xs text-[var(--text3)]">
          La traduction automatique est réservée au Premium. Vous pouvez déjà prévisualiser chaque langue
          (elle retombe sur le français tant qu&apos;elle n&apos;est pas traduite).
        </p>
      ) : null}
      {notice ? (
        <p className="mt-3 rounded-lg border border-[var(--border2)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text2)]">{notice}</p>
      ) : null}
    </section>
  );
}
