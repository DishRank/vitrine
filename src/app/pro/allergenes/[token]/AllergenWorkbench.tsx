'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import ConfirmDialog from '../../_components/ConfirmDialog';
import {
  ALLERGEN_KEYS,
  ALLERGEN_SHORT,
  type AllergenKey,
  type InviteItem,
  type InvitePayload,
} from '@/lib/pro/invite';
import { publishAllergens, removeMenu, saveDishAllergens, stopContact, trackInviteEvent } from './actions';

type Filter = 'todo' | 'done' | 'all';

interface DishState {
  /** Sélection en cours (ce que montrent les cases). */
  selected: AllergenKey[];
  /** Dernière version VÉRIFIÉE et enregistrée (celle qui part à l'impression). */
  saved: AllergenKey[] | null;
  /** Ligne relevée qui n'est pas un plat : hors tableau. */
  excluded: boolean;
  /** Écartée d'office (titre, phrase du site…), pas par le restaurateur. */
  auto?: boolean;
  saving: boolean;
  error?: string;
}

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((x) => b.includes(x));

const sortKeys = (keys: AllergenKey[]) => ALLERGEN_KEYS.filter((k) => keys.includes(k));

function initialState(item: InviteItem): DishState {
  if (item.draft) {
    const keys = sortKeys(item.draft.allergens);
    return {
      selected: keys,
      saved: item.draft.confirmed && !item.draft.excluded ? keys : null,
      excluded: !!item.draft.excluded,
      saving: false,
    };
  }
  // Carte déjà renseignée par l'établissement → on part de ses allergènes ;
  // sinon des suggestions.
  const base = item.published.length ? item.published : item.suggested.map((s) => s.allergen);
  // Titre de rubrique ou phrase du site relevés comme des plats : écartés d'office,
  // rétablissables en un clic.
  if (item.suspect) return { selected: sortKeys(base), saved: null, excluded: true, auto: true, saving: false };
  return { selected: sortKeys(base), saved: null, excluded: false, saving: false };
}

function formatPrice(p: number | null) {
  if (p == null) return '';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(p);
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return null;
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
}

const card = 'rounded-2xl border border-[var(--border2)] bg-[var(--surface)] p-5';
const btn =
  'rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40';

export default function AllergenWorkbench({ token, payload }: { token: string; payload: InvitePayload }) {
  const { restaurant, menu, items } = payload;
  const [dishes, setDishes] = useState<Record<string, DishState>>(() =>
    Object.fromEntries(items.map((it) => [it.id, initialState(it)]))
  );
  const [filter, setFilter] = useState<Filter>('todo');
  const [removed, setRemoved] = useState(payload.menu_removed);
  const [optedOut, setOptedOut] = useState(payload.contact_opt_out);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [publishMsg, setPublishMsg] = useState<string | null>(payload.applied_at ? 'Déjà publié sur votre carte.' : null);
  const [pending, start] = useTransition();
  const opened = useRef(false);

  // Une ouverture comptée par affichage, côté navigateur : les robots des
  // messageries qui pré-ouvrent les liens n'exécutent pas ce code.
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    void trackInviteEvent(token, 'open');
  }, [token]);

  const verifiedCount = items.filter((it) => dishes[it.id]?.saved).length;
  const excludedCount = items.filter((it) => dishes[it.id]?.excluded).length;
  const autoCount = items.filter((it) => dishes[it.id]?.excluded && dishes[it.id]?.auto).length;
  const dishCount = items.length - excludedCount;
  // Lignes relevées qui sont vraiment des plats (hors titres et phrases du site).
  const realCount = items.filter((it) => !it.suspect).length;
  const todoCount = dishCount - verifiedCount;

  const visible = items.filter((it) => {
    const st = dishes[it.id];
    if (filter === 'all') return true;
    if (filter === 'done') return !!st?.saved;
    return !st?.saved && !st?.excluded;
  });

  // Regroupement par section, dans l'ordre de la carte.
  const groups = useMemo(() => {
    const out: { section: string; items: InviteItem[] }[] = [];
    for (const it of visible) {
      const s = it.section?.trim() || 'Carte';
      const last = out[out.length - 1];
      if (last && last.section === s) last.items.push(it);
      else out.push({ section: s, items: [it] });
    }
    return out;
  }, [visible]);

  const patch = (id: string, p: Partial<DishState>) =>
    setDishes((d) => ({ ...d, [id]: { ...d[id], ...p } }));

  const toggle = (id: string, key: AllergenKey) => {
    if (removed) return;
    const cur = dishes[id].selected;
    patch(id, { selected: sortKeys(cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]), error: undefined });
  };

  const verify = async (id: string) => {
    const sel = dishes[id].selected;
    patch(id, { saving: true, error: undefined });
    const res = await saveDishAllergens(token, id, sel, true);
    if (res.ok) patch(id, { saving: false, saved: sel, excluded: false });
    else patch(id, { saving: false, error: res.error });
  };

  // « Ce n'est pas un plat » : ligne relevée par erreur (formule, phrase de la carte…).
  const setExcluded = async (id: string, excluded: boolean) => {
    const sel = dishes[id].selected;
    patch(id, { saving: true, error: undefined });
    const res = await saveDishAllergens(token, id, sel, false, excluded);
    if (res.ok) patch(id, { saving: false, saved: null, excluded, auto: false });
    else patch(id, { saving: false, error: res.error });
  };

  const print = () => {
    void trackInviteEvent(token, 'print');
    window.print();
  };

  const publish = () =>
    start(async () => {
      const res = await publishAllergens(token);
      setPublishMsg(
        res.ok
          ? `${res.count} plat${(res.count ?? 0) > 1 ? 's' : ''} publié${(res.count ?? 0) > 1 ? 's' : ''} sur votre carte en ligne.`
          : res.error ?? 'Erreur.'
      );
    });

  const doRemove = () =>
    start(async () => {
      const res = await removeMenu(token);
      if (res.ok) {
        setRemoved(true);
        setOptedOut(true);
        setNotice('Votre carte a été retirée de DishRank et ne sera plus reprise depuis votre site. Nous ne vous écrirons plus.');
      } else setNotice(res.error ?? 'Erreur.');
    });

  const doStop = () =>
    start(async () => {
      const res = await stopContact(token);
      if (res.ok) {
        setOptedOut(true);
        setNotice('C’est noté : nous ne vous écrirons plus. Ce lien reste utilisable.');
      } else setNotice(res.error ?? 'Erreur.');
    });

  const back = `/pro/allergenes/${token}`;
  const claimPath = `/pro/claim?r=${restaurant.id}&retour=${encodeURIComponent(back)}`;
  const capturedOn = formatDate(menu?.captured_at);
  const today = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  const place = [restaurant.address, restaurant.city].filter(Boolean).join(', ');

  return (
    <>
      {/* ── Écran ─────────────────────────────────────────────────────────── */}
      <div className="space-y-5 print:hidden">
        <section>
          <p className="text-sm font-semibold text-[var(--primary)]">Offert, sans compte ni engagement</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Le tableau des allergènes de {restaurant.name}
          </h1>
          {place ? <p className="mt-1 text-sm text-[var(--text2)]">{place}</p> : null}
        </section>

        {notice ? (
          <div className="rounded-xl border border-[var(--primary)]/30 bg-[var(--primary-container)] p-4 text-sm">{notice}</div>
        ) : null}

        {removed ? null : (
          <section className={card}>
            <h2 className="text-base font-extrabold">Comment ça marche</h2>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-[var(--text2)]">
              <li>
                Nous avons repris les <strong>{realCount} plats</strong> de la carte publiée sur votre site
                {capturedOn ? <> (relevée le {capturedOn})</> : null}, et pré-coché les allergènes que leur nom laisse deviner.
              </li>
              <li>
                Corrigez chaque plat : ajoutez ce que contiennent vos sauces, fonds et garnitures, décochez le reste,
                puis cliquez <strong>« C’est vérifié »</strong>.
              </li>
              <li>
                Imprimez : seuls les plats vérifiés figurent sur le tableau. Votre progression est enregistrée, vous
                pouvez revenir plus tard avec le même lien.
              </li>
            </ol>
            <p className="mt-3 rounded-lg bg-[var(--surface-var)] p-3 text-[13px] text-[var(--text2)]">
              ⚠️ Nos suggestions ne connaissent que le <strong>nom</strong> du plat, pas votre recette. L’information
              donnée aux clients reste sous votre responsabilité : la loi impose qu’elle soit disponible par écrit,
              sans que le client ait à la demander (décret n° 2015-447).
            </p>
          </section>
        )}

        {items.length === 0 && !removed ? (
          <div className={card}>
            <p className="text-sm text-[var(--text2)]">
              Nous n’avons pas de plats pour votre établissement. Écrivez-nous à contact@dishrank.fr avec votre carte
              (une photo suffit) : nous vous préparons le tableau.
            </p>
          </div>
        ) : null}

        {!removed && items.length > 0 ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  ['todo', `À vérifier (${todoCount})`],
                  ['done', `Vérifiés (${verifiedCount})`],
                  ['all', `Toute la carte (${items.length})`],
                ] as [Filter, string][]
              ).map(([f, label]) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                    filter === f
                      ? 'bg-[var(--primary)] text-white'
                      : 'border border-[var(--border2)] text-[var(--text2)] hover:text-[var(--text)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {autoCount > 0 && filter !== 'all' ? (
              <p className="text-sm text-[var(--text2)]">
                {autoCount === 1
                  ? 'Une ligne relevée sur votre site ne ressemble pas à un plat : nous l’avons écartée.'
                  : `${autoCount} lignes relevées sur votre site ne ressemblent pas à des plats : nous les avons écartées.`}{' '}
                <button type="button" onClick={() => setFilter('all')} className="font-semibold text-[var(--primary)] hover:underline">
                  Les voir
                </button>
              </p>
            ) : null}

            {groups.length === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--text2)]">
                {filter === 'todo' ? 'Tous les plats sont vérifiés. Il ne reste qu’à imprimer.' : 'Aucun plat vérifié pour l’instant.'}
              </p>
            ) : null}

            {groups.map((g) => (
              <section key={g.section} className="space-y-3">
                <h2 className="pt-2 text-xs font-extrabold uppercase tracking-wider text-[var(--text3)]">{g.section}</h2>
                {g.items.map((it) => {
                  const st = dishes[it.id];
                  const verified = !!st.saved;
                  const dirty = verified && !sameSet(st.selected, st.saved ?? []);
                  const suggestedKeys = it.suggested.map((s) => s.allergen);
                  if (st.excluded) {
                    return (
                      <article key={it.id} className={`${card} flex items-center justify-between gap-3 opacity-60`}>
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-[var(--text2)] line-through">{it.name}</span>
                          {st.auto ? (
                            <span className="block text-xs text-[var(--text3)]">
                              Écarté d’office : ressemble à un titre ou à une phrase de votre site.
                            </span>
                          ) : null}
                        </span>
                        <button
                          type="button"
                          onClick={() => setExcluded(it.id, false)}
                          disabled={st.saving}
                          className="shrink-0 text-sm font-semibold text-[var(--primary)] hover:underline"
                        >
                          Rétablir
                        </button>
                      </article>
                    );
                  }
                  return (
                    <article key={it.id} className={`${card} ${verified && !dirty ? 'border-[var(--accent-success)]/60' : ''}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-bold leading-snug">{it.name}</h3>
                          {it.description ? (
                            <p className="mt-0.5 line-clamp-2 text-[13px] text-[var(--text2)]">{it.description}</p>
                          ) : null}
                        </div>
                        {it.price != null ? (
                          <span className="shrink-0 text-sm font-semibold text-[var(--text2)]">{formatPrice(it.price)}</span>
                        ) : null}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {ALLERGEN_KEYS.map((k) => {
                          const on = st.selected.includes(k);
                          const suggested = suggestedKeys.includes(k);
                          return (
                            <button
                              key={k}
                              type="button"
                              aria-pressed={on}
                              onClick={() => toggle(it.id, k)}
                              className={`rounded-full px-2.5 py-1 text-[12.5px] font-semibold transition-colors ${
                                on
                                  ? 'bg-[var(--primary)] text-white'
                                  : suggested
                                    ? 'border border-dashed border-[var(--primary)] text-[var(--primary)]'
                                    : 'border border-[var(--border2)] text-[var(--text2)] hover:text-[var(--text)]'
                              }`}
                            >
                              {on ? '✓ ' : ''}
                              {ALLERGEN_SHORT[k]}
                            </button>
                          );
                        })}
                      </div>

                      {it.suggested.length ? (
                        <p className="mt-2 text-[12px] text-[var(--text3)]">
                          Suggéré d’après :{' '}
                          {it.suggested
                            .map((s) => `${ALLERGEN_SHORT[s.allergen].toLowerCase()} (« ${s.reasons.join(' », « ')} »)`)
                            .join(' · ')}
                        </p>
                      ) : (
                        <p className="mt-2 text-[12px] text-[var(--text3)]">
                          Rien de détecté dans le nom : vérifiez la recette.
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {verified && !dirty ? (
                          <span className="text-sm font-bold text-[var(--accent-success)]">✓ Vérifié</span>
                        ) : (
                          <button type="button" onClick={() => verify(it.id)} disabled={st.saving} className={btn}>
                            {st.saving
                              ? 'Enregistrement…'
                              : st.selected.length === 0
                                ? 'C’est vérifié : aucun allergène'
                                : dirty
                                  ? 'Enregistrer la correction'
                                  : 'C’est vérifié'}
                          </button>
                        )}
                        {!verified ? (
                          <button
                            type="button"
                            onClick={() => setExcluded(it.id, true)}
                            disabled={st.saving}
                            className="text-[13px] font-semibold text-[var(--text3)] hover:text-[var(--text2)]"
                          >
                            Ce n’est pas un plat
                          </button>
                        ) : null}
                        {st.error ? <span className="text-[13px] font-medium text-red-500">{st.error}</span> : null}
                      </div>
                    </article>
                  );
                })}
              </section>
            ))}
          </>
        ) : null}

        {/* ── Publication sur la carte en ligne ────────────────────────────── */}
        {!removed ? (
          <section className={card}>
            <h2 className="text-base font-extrabold">Afficher ces allergènes sur votre carte en ligne</h2>
            {restaurant.is_owner ? (
              <>
                <p className="mt-1 text-sm text-[var(--text2)]">
                  Les plats vérifiés s’affichent avec leurs allergènes sur votre carte DishRank, et vos clients peuvent
                  filtrer « sans gluten », « sans lait »…
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button type="button" onClick={publish} disabled={pending || verifiedCount === 0} className={btn}>
                    Publier {verifiedCount} plat{verifiedCount > 1 ? 's' : ''} vérifié{verifiedCount > 1 ? 's' : ''}
                  </button>
                  <Link href={`/pro/r/${restaurant.id}/menu`} className="text-sm font-semibold text-[var(--primary)] hover:underline">
                    Gérer ma carte →
                  </Link>
                </div>
                {publishMsg ? <p className="mt-2 text-sm text-[var(--text2)]">{publishMsg}</p> : null}
              </>
            ) : restaurant.claimed ? (
              <p className="mt-1 text-sm text-[var(--text2)]">
                Cette fiche est gérée par un compte DishRank.{' '}
                <Link href={`/pro/login?next=${encodeURIComponent(back)}`} className="font-semibold text-[var(--primary)] hover:underline">
                  Connectez-vous avec ce compte
                </Link>{' '}
                pour publier.
              </p>
            ) : (
              <>
                <p className="mt-1 text-sm text-[var(--text2)]">
                  Votre carte est déjà consultable sur DishRank. Revendiquez votre fiche (gratuit, 2 minutes) pour
                  publier ces allergènes, corriger la carte et répondre aux avis de vos clients. Le tableau imprimé,
                  lui, est à vous, sans compte.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Link
                    href={`/pro/signup?next=${encodeURIComponent(claimPath)}`}
                    onClick={() => void trackInviteEvent(token, 'claim_click')}
                    className={btn}
                  >
                    Revendiquer ma fiche
                  </Link>
                  <Link
                    href={`/pro/login?next=${encodeURIComponent(claimPath)}`}
                    onClick={() => void trackInviteEvent(token, 'claim_click')}
                    className="text-sm font-semibold text-[var(--primary)] hover:underline"
                  >
                    J’ai déjà un compte
                  </Link>
                </div>
              </>
            )}
          </section>
        ) : null}

        <section className="space-y-2 pt-2 text-[13px] text-[var(--text3)]">
          <p>
            DishRank est une application lyonnaise où les clients notent les plats, pas les restaurants. Aucune
            mise en avant n’y est payante.
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {!removed && !restaurant.claimed ? (
              <button type="button" onClick={() => setConfirmRemove(true)} disabled={pending} className="underline hover:text-[var(--text2)]">
                Retirer ma carte de DishRank
              </button>
            ) : null}
            {!optedOut ? (
              <button type="button" onClick={doStop} disabled={pending} className="underline hover:text-[var(--text2)]">
                Ne plus recevoir de message
              </button>
            ) : (
              <span>Vous ne recevrez plus de message de DishRank.</span>
            )}
          </div>
        </section>
      </div>

      {/* ── Barre d'action (écran) ─────────────────────────────────────────── */}
      {!removed && items.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--border2)] bg-[var(--surface)]/95 backdrop-blur print:hidden">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-bold">
                {verifiedCount} / {dishCount} plats vérifiés
              </p>
              <div className="mt-1 h-1.5 w-40 overflow-hidden rounded-full bg-[var(--surface-var)] sm:w-56">
                <div
                  className="h-full rounded-full bg-[var(--accent-success)] transition-all"
                  style={{ width: `${dishCount ? Math.round((verifiedCount / dishCount) * 100) : 0}%` }}
                />
              </div>
            </div>
            <button type="button" onClick={print} disabled={verifiedCount === 0} className={btn}>
              Imprimer le tableau
            </button>
          </div>
        </div>
      ) : null}

      {/* ── Impression : A4 paysage, plats vérifiés uniquement ─────────────── */}
      <style>{'@media print { @page { size: A4 landscape; margin: 10mm; } }'}</style>
      <div className="hidden print:block text-black">
        <h1 className="text-xl font-extrabold">Allergènes — {restaurant.name}</h1>
        <p className="mb-3 text-[11px]">
          Présence des 14 allergènes réglementaires (règlement UE n° 1169/2011, décret n° 2015-447) dans nos plats.
          Informations établies par l’établissement le {today}.
        </p>
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr>
              <th className="border border-black px-1.5 py-1 text-left">Plat</th>
              {ALLERGEN_KEYS.map((k) => (
                <th key={k} className="border border-black px-0.5 py-1 text-center font-bold leading-tight">
                  {ALLERGEN_SHORT[k]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items
              .filter((it) => dishes[it.id]?.saved)
              .map((it) => {
                const saved = dishes[it.id].saved ?? [];
                return (
                  <tr key={it.id} className="break-inside-avoid">
                    <td className="border border-black px-1.5 py-0.5">{it.name}</td>
                    {ALLERGEN_KEYS.map((k) => (
                      <td key={k} className="border border-black text-center font-bold">
                        {saved.includes(k) ? '●' : ''}
                      </td>
                    ))}
                  </tr>
                );
              })}
          </tbody>
        </table>
        <p className="mt-2 text-[10px]">
          ● = le plat contient cet allergène.
          {todoCount > 0
            ? ' Pour un plat absent de ce tableau, ou pour toute question sur la composition d’un plat, adressez-vous à notre équipe.'
            : ' Pour toute question sur la composition d’un plat, adressez-vous à notre équipe.'}
        </p>
        <p className="mt-1 text-[9px] text-gray-500">Tableau réalisé avec DishRank — dishrank.fr</p>
      </div>

      <ConfirmDialog
        open={confirmRemove}
        title="Retirer votre carte ?"
        message="La carte relevée sur votre site ne sera plus affichée sur DishRank et ne sera plus jamais reprise. Les avis déjà laissés par des clients restent visibles. Nous ne vous écrirons plus."
        confirmLabel="Retirer ma carte"
        onConfirm={doRemove}
        onClose={() => setConfirmRemove(false)}
      />
    </>
  );
}
