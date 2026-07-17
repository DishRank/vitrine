'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { translateMenuAction, setMenuLanguagesAction } from './menuActions';
import FlagIcon from '@/components/FlagIcon';

/** Langues cibles disponibles (source = français). */
const LANGS = [
  { code: 'en', label: 'Anglais' },
  { code: 'es', label: 'Espagnol' },
  { code: 'de', label: 'Allemand' },
  { code: 'it', label: 'Italien' },
];
const BY_CODE = new Map(LANGS.map((l) => [l.code, l]));

/**
 * Panneau « Langues du menu ». Saisie en français (source, toujours affichée).
 * L'owner AJOUTE les langues qu'il veut proposer via un autocomplete (défaut :
 * français seul). Chaque langue ajoutée est prévisualisable ; la TRADUCTION
 * AUTOMATIQUE (edge menu-translate, DeepL) est une fonction PREMIUM, mise en
 * avant. Sans premium : la langue s'affiche mais retombe sur le français.
 */
export default function LanguagePanel({
  restaurantId,
  translatedLocales,
  menuLanguages,
  premium,
}: {
  restaurantId: string;
  translatedLocales: string[];
  menuLanguages: string[];
  premium: boolean;
}) {
  const [enabled, setEnabled] = useState<string[]>(() => menuLanguages.filter((l) => BY_CODE.has(l)));
  const [pending, start] = useTransition();
  const [, startSave] = useTransition();
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const done = new Set(translatedLocales);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return LANGS.filter(
      (l) => !enabled.includes(l.code) && (!q || l.label.toLowerCase().includes(q) || l.code.includes(q))
    );
  }, [query, enabled]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const persist = (next: string[]) => {
    setEnabled(next);
    startSave(async () => {
      await setMenuLanguagesAction(restaurantId, next);
    });
  };
  const add = (code: string) => {
    if (!enabled.includes(code)) persist([...enabled, code]);
    setQuery('');
    setOpen(false);
  };
  const remove = (code: string) => persist(enabled.filter((c) => c !== code));
  // Frontière langues : fr + en gratuits ; es/de/it = Premium.
  const canAdd = (code: string) => premium || code === 'en';

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
            Vous saisissez en français. Ajoutez les langues à proposer à vos clients étrangers.
          </p>
        </div>
        {enabled.length > 0 && premium ? (
          <button
            onClick={translate}
            disabled={pending}
            className="shrink-0 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
          >
            {pending ? 'Traduction…' : 'Traduire automatiquement'}
          </button>
        ) : null}
      </div>

      {/* Chips : français (source) + langues activées + autocomplete d'ajout */}
      <div ref={boxRef} className="mt-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--primary)] bg-[var(--primary-container)] px-2.5 py-1.5 text-xs font-bold text-[var(--primary)]">
          <FlagIcon code="fr" size={16} /> Français
          <span className="font-semibold opacity-70">· saisie</span>
        </span>

        {enabled.map((code) => {
          const l = BY_CODE.get(code)!;
          return (
            <span
              key={code}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border2)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text2)]"
            >
              <FlagIcon code={code} size={16} />
              <a
                href={`/menu/${restaurantId}?lang=${code}`}
                target="_blank"
                rel="noopener noreferrer"
                title={`Aperçu du menu en ${l.label.toLowerCase()}`}
                className="hover:text-[var(--text)]"
              >
                {l.label}
              </a>
              {done.has(code) ? (
                <span className="font-bold text-[var(--accent-success)]">✓</span>
              ) : (
                <span className="text-[var(--text3)]">· à traduire</span>
              )}
              <button
                type="button"
                onClick={() => remove(code)}
                aria-label={`Retirer ${l.label}`}
                className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full hover:bg-[var(--text3)]/20"
              >
                ×
              </button>
            </span>
          );
        })}

        {results.length > 0 ? (
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              placeholder="+ Ajouter une langue"
              className="w-40 rounded-lg border border-dashed border-[var(--border2)] bg-transparent px-2.5 py-1.5 text-xs text-[var(--text)] placeholder-[var(--text3)] outline-none focus:border-[var(--primary)]"
            />
            {open ? (
              <ul className="absolute z-20 mt-1 w-44 overflow-hidden rounded-xl border border-[var(--border2)] bg-[var(--surface)] py-1 shadow-lg">
                {results.map((l) => {
                  const locked = !canAdd(l.code);
                  return (
                    <li key={l.code}>
                      <button
                        type="button"
                        disabled={locked}
                        onClick={() => add(l.code)}
                        title={locked ? 'Réservé au Premium' : undefined}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                          locked
                            ? 'cursor-not-allowed text-[var(--text3)] opacity-60'
                            : 'text-[var(--text)] hover:bg-[var(--primary-container)] hover:text-[var(--primary)]'
                        }`}
                      >
                        <FlagIcon code={l.code} size={16} />
                        {l.label}
                        {locked ? (
                          <span className="ml-auto text-[11px] font-bold text-[var(--text3)]">🔒 Premium</span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Mise en avant Premium de la traduction automatique */}
      {!premium ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--primary)]/40 bg-[var(--primary-container)] px-3.5 py-2.5">
          <p className="text-sm font-semibold text-[var(--primary)]">
            ✨ Traduction automatique de tout le menu —{' '}
            <span className="font-extrabold">Premium</span>
            <span className="block text-xs font-medium text-[var(--text2)]">
              <FlagIcon code="en" size={13} style={{ verticalAlign: '-1px', marginRight: 3 }} />
              L&apos;anglais est gratuit : traduisez chaque plat à la main via les onglets de langue.
              Espagnol, allemand, italien et la traduction automatique = Premium.
            </span>
          </p>
          <span className="shrink-0 rounded-full bg-[var(--primary)] px-3 py-1.5 text-xs font-bold text-white">
            Premium
          </span>
        </div>
      ) : enabled.length === 0 ? (
        <p className="mt-3 text-xs text-[var(--text3)]">
          Ajoutez une langue pour activer la traduction automatique.
        </p>
      ) : null}

      {notice ? (
        <p className="mt-3 rounded-lg border border-[var(--border2)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text2)]">
          {notice}
        </p>
      ) : null}
    </section>
  );
}
