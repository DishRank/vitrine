'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import AppFooter from '../../AppFooter';
import styles from '../../partage.module.css';
import { useIsIOS, useNow } from '../../useDeepLink';
import {
  fetchSharedOuting,
  getIdentity,
  joinOuting,
  setIdentity,
  subscribeIdentity,
  toggleApproval,
  type GuestIdentity,
} from '@/lib/outing/client';
import {
  ERROR_TEXT,
  appleMapsUrl,
  buildIcs,
  centerLabel,
  classifyError,
  cuisineLabels,
  dayLabel,
  deadlineLabel,
  distanceLabel,
  firstLetter,
  googleMapsUrl,
  namesSentence,
  placeWord,
  priceLabel,
  ratingLabel,
  remainingLabel,
  safeHttpUrl,
  telHref,
  timeLabel,
  whenSentence,
} from '@/lib/outing/format';
import type { Outing, OutingCandidate, OutingDish, OutingVoter } from '@/lib/outing/types';

const POLL_MS = 5_000;

type Toast = { text: string; retry?: () => void } | null;

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/* ── Icônes ─────────────────────────────────────────────────────────────── */

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 10.5l3.5 3.5 7.5-8" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg className={styles.chev} viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 7.5l5 5 5-5" />
    </svg>
  );
}

/* ── Petits morceaux ────────────────────────────────────────────────────── */

function Avatar({ name, url, guest, idle }: { name: string | null; url: string | null; guest?: boolean; idle?: boolean }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={cx(styles.avatar, idle && styles.avatarIdle)} src={url} alt="" width={30} height={30} loading="lazy" />;
  }
  return (
    <span className={cx(styles.avatar, guest && styles.avatarGuest, idle && styles.avatarIdle)} aria-hidden="true">
      {firstLetter(name)}
    </span>
  );
}

function AvatarStack({ people, max = 4 }: { people: { name: string | null; url: string | null; guest?: boolean; idle?: boolean }[]; max?: number }) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <span className={styles.stack} aria-hidden="true">
      {shown.map((p, i) => (
        <Avatar key={i} name={p.name} url={p.url} guest={p.guest} idle={p.idle} />
      ))}
      {rest > 0 && <span className={cx(styles.avatar, styles.avatarMore)}>+{rest}</span>}
    </span>
  );
}

function DishRow({ d }: { d: OutingDish }) {
  const price = priceLabel(d.price);
  const rating = ratingLabel(d.rating);
  return (
    <li className={styles.dish}>
      <span className={styles.dishName}>{d.name}</span>
      {price ? <span className={styles.dishPrice}>{price}</span> : <span />}
      <span className={styles.dishInfo}>
        {d.source === 'review' && rating ? (
          <>
            <span className={styles.star} aria-hidden="true">★</span> {rating}
            <span className={styles.srOnly}> sur 5</span> ({d.reviews} avis)
          </>
        ) : (
          'À la carte'
        )}
      </span>
    </li>
  );
}

/** Noms des partants, « Toi » en tête si la personne a coché. */
function approversText(c: OutingCandidate, myName: string | null): string {
  if (c.approvals === 0) return 'Personne pour l’instant';
  const names = c.approvers.map((a) => a.name ?? 'Quelqu’un');
  if (c.mine) {
    const i = myName ? c.approvers.map((a, k) => (a.kind === 'guest' && a.name === myName ? k : -1)).filter((k) => k >= 0).pop() : undefined;
    if (i !== undefined && i >= 0) names.splice(i, 1);
    names.unshift('Toi');
  }
  // Au-delà de deux, un seul prénom + le compte : la ligne reste lisible à côté du bouton.
  return namesSentence(names, names.length > 2 ? 1 : 2);
}

function PlaceCard({
  c,
  plannedAt,
  myName,
  compact,
  onToggle,
}: {
  c: OutingCandidate;
  plannedAt: string | null;
  myName: string | null;
  compact?: boolean;
  onToggle: (c: OutingCandidate) => void;
}) {
  const titleId = useId();
  const cuisines = cuisineLabels(c.cuisines);
  const dist = distanceLabel(c.distance_km);
  const median = priceLabel(c.price_median);
  const dishes = compact ? c.dishes.slice(0, 1) : c.dishes.slice(0, 3);
  const at = plannedAt ? timeLabel(plannedAt) : null;
  const photo = safeHttpUrl(c.photo_url);

  return (
    <li>
      <article className={cx(styles.card, c.mine && styles.cardOn)} aria-labelledby={titleId}>
        <div className={styles.cardHead}>
          <div>
            <h3 id={titleId} className={cx(styles.display, styles.cardTitle)}>
              {c.name}
            </h3>
            <ul className={styles.meta}>
              <li>{cuisines.length ? cuisines.join(', ') : placeWord(c.place_type)}</li>
              {dist && <li>{dist}</li>}
              {at && c.open_at_planned === true && (
                <li className={styles.open}>
                  <span className={styles.dot} aria-hidden="true" />
                  Ouvert à {at}
                </li>
              )}
              {at && c.open_at_planned === false && (
                <li className={styles.closed}>
                  <span className={styles.dot} aria-hidden="true" />
                  Fermé à {at}
                </li>
              )}
              {median && <li>Plats autour de {median}</li>}
            </ul>
            {c.added_by && <p className={styles.addedBy}>Ajouté par {c.added_by}</p>}
          </div>
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.thumb} src={photo} alt="" width={60} height={60} loading="lazy" />
          )}
        </div>

        {dishes.length > 0 ? (
          <ul className={styles.dishes} aria-label="Plats">
            {dishes.map((d, i) => (
              <DishRow key={`${d.name}-${i}`} d={d} />
            ))}
          </ul>
        ) : (
          <p className={styles.noDish}>Pas encore de plat noté ni de carte en ligne.</p>
        )}

        <div className={styles.cardFoot}>
          <div className={styles.approvals}>
            {c.approvals > 0 && (
              <AvatarStack people={c.approvers.map((a: OutingVoter) => ({ name: a.name, url: a.avatar_url, guest: a.kind === 'guest' }))} max={3} />
            )}
            <span className={styles.approvalsText}>{approversText(c, myName)}</span>
          </div>
          <button type="button" className={styles.toggle} aria-pressed={c.mine} onClick={() => onToggle(c)}>
            {c.mine && <CheckIcon />}
            Ça me va<span className={styles.srOnly}> pour {c.name}</span>
          </button>
        </div>
      </article>
    </li>
  );
}

/* ── Vue principale ─────────────────────────────────────────────────────── */

export default function OutingGuestView({ token, initial }: { token: string; initial: Outing }) {
  const [outing, setOuting] = useState<Outing>(initial);
  // Identité d'invité (localStorage) : null au rendu serveur, lue à l'hydratation.
  const identity = useSyncExternalStore(subscribeIdentity, () => getIdentity(token), () => null);
  const now = useNow();
  const isIOS = useIsIOS();
  const [toast, setToast] = useState<Toast>(null);
  const [saving, setSaving] = useState(0);

  // Feuille « prénom »
  const sheetRef = useRef<HTMLDialogElement>(null);
  const [pendingPick, setPendingPick] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  // Votes en vol : on n'écrase pas l'état optimiste avec une réponse plus vieille.
  const inFlight = useRef(0);
  const version = useRef(0);

  const showToast = useCallback((t: Toast) => setToast(t), []);
  useEffect(() => {
    if (!toast || toast.retry) return;
    const id = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(id);
  }, [toast]);

  const refresh = useCallback(async () => {
    const v = version.current;
    try {
      const id = getIdentity(token);
      const data = await fetchSharedOuting(token, id);
      if (!data || inFlight.current > 0 || version.current !== v) return;
      // Secret refusé par la base (appareil réinitialisé, invité supprimé) :
      // on oublie l'identité, le prochain « Ça me va » redemandera le prénom.
      if (id && getIdentity(token) === id && !data.guests.some((g) => g.is_me)) setIdentity(token, null);
      setOuting(data);
    } catch {
      /* hors ligne : on garde l'affichage, le prochain tour réessaie */
    }
  }, [token]);

  // Une identité enregistrée sur cet appareil : on recharge pour afficher ses
  // propres choix (le rendu serveur ne la connaît pas).
  const hasIdentity = !!identity;
  useEffect(() => {
    // refresh ne pose l'état qu'après l'appel réseau (asynchrone) : pas de rendu en cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (hasIdentity) void refresh();
  }, [hasIdentity, refresh]);

  // Rafraîchissement en direct tant que le vote est ouvert et la page visible.
  const active = outing.status === 'active';
  useEffect(() => {
    if (!active) return;
    const poll = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const timer = window.setInterval(poll, POLL_MS);
    document.addEventListener('visibilitychange', poll);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', poll);
    };
  }, [active, refresh]);

  const flip = (rid: string, who: string) => {
    setOuting((o) => {
      const candidates = o.candidates.map((c) => {
        if (c.id !== rid) return c;
        if (c.mine) {
          const idx = c.approvers.map((a, k) => (a.kind === 'guest' && a.name === who ? k : -1)).filter((k) => k >= 0).pop();
          const approvers = idx === undefined ? c.approvers : c.approvers.filter((_, k) => k !== idx);
          return { ...c, mine: false, approvals: Math.max(0, c.approvals - 1), approvers };
        }
        return {
          ...c,
          mine: true,
          approvals: c.approvals + 1,
          approvers: [...c.approvers, { name: who, avatar_url: null, kind: 'guest' as const }],
        };
      });
      const votedNow = candidates.some((c) => c.mine);
      return { ...o, candidates, guests: o.guests.map((g) => (g.is_me ? { ...g, voted: votedNow } : g)) };
    });
  };

  const openSheet = useCallback((message?: string) => {
    setNameError(message ?? null);
    const d = sheetRef.current;
    if (d && !d.open) d.showModal();
  }, []);


  const doToggle = async (rid: string, id: GuestIdentity): Promise<void> => {
      version.current += 1;
      inFlight.current += 1;
      setSaving((n) => n + 1);
      flip(rid, id.name);
      try {
        const data = await toggleApproval(token, id, rid);
        inFlight.current -= 1;
        if (inFlight.current === 0) setOuting(data);
      } catch (err) {
        inFlight.current -= 1;
        flip(rid, id.name);
        const kind = classifyError(err);
        if (kind === 'identity') {
          setIdentity(token, null);
          setName(id.name);
          setPendingPick(rid);
          openSheet(ERROR_TEXT.identity);
        } else {
          const retryable = kind === 'network' || kind === 'unknown';
          showToast({ text: ERROR_TEXT[kind], retry: retryable ? () => { setToast(null); void doToggle(rid, id); } : undefined });
        }
        if (inFlight.current === 0) void refresh();
      } finally {
        setSaving((n) => n - 1);
      }
  };

  const onToggle = (c: OutingCandidate) => {
    const id = getIdentity(token);
    if (!id) {
      setPendingPick(c.id);
      openSheet();
      return;
    }
    void doToggle(c.id, id);
  };

  const onJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = name.trim().replace(/\s+/g, ' ');
    if (!clean) {
      setNameError(ERROR_TEXT.name);
      return;
    }
    setJoining(true);
    setNameError(null);
    try {
      const s = await joinOuting(token, clean);
      const id: GuestIdentity = { guest_id: s.guest_id, guest_secret: s.guest_secret, name: clean.slice(0, 40) };
      setOuting(s.outing);
      setIdentity(token, id);
      sheetRef.current?.close();
      const pick = pendingPick;
      setPendingPick(null);
      if (pick && s.outing.candidates.some((c) => c.id === pick && !c.mine)) void doToggle(pick, id);
    } catch (err) {
      const kind = classifyError(err);
      if (kind === 'closed') {
        sheetRef.current?.close();
        showToast({ text: 'Le vote vient de se terminer.' });
        void refresh();
      } else if (kind === 'network' || kind === 'unknown') {
        setNameError('Impossible de rejoindre le vote pour l’instant. Vérifie ta connexion et réessaie.');
      } else {
        setNameError(ERROR_TEXT[kind]);
      }
    } finally {
      setJoining(false);
    }
  };

  /* ── Données dérivées ─────────────────────────────────────────────────── */

  const o = outing;
  const myName = identity?.name || o.guests.find((g) => g.is_me)?.name || null;
  const top = o.candidates.filter((c) => c.section === 'top');
  const added = o.candidates.filter((c) => c.section === 'added');
  const more = o.candidates.filter((c) => c.section === 'more');
  const people = [
    ...o.members.map((m) => ({ name: m.name, url: m.avatar_url, voted: m.voted, guest: false, me: m.is_me })),
    ...o.guests.map((g) => ({ name: g.name, url: null, voted: g.voted, guest: true, me: g.is_me })),
  ];
  const votedCount = people.filter((p) => p.voted).length;
  const myPicks = o.candidates.filter((c) => c.mine).length;
  const remaining = o.vote_deadline && now != null ? remainingLabel(o.vote_deadline, now) : null;
  const deadlinePassed = o.vote_deadline && now != null && remaining == null;
  const where = centerLabel(o);
  const groupLine = `${o.group.emoji ? `${o.group.emoji} ` : ''}${o.group.name}`;
  const organizer = o.initiator_name || 'Quelqu’un du groupe';

  const card = (c: OutingCandidate, compact?: boolean) => (
    <PlaceCard key={c.id} c={c} plannedAt={o.planned_at} myName={myName} compact={compact} onToggle={onToggle} />
  );

  /* ── Rendu ────────────────────────────────────────────────────────────── */

  const hero = (
    <>
      <p className={styles.group}>{groupLine}</p>
      <h1 className={cx(styles.display, styles.when)}>
        {o.planned_at ? (
          <>
            {dayLabel(o.planned_at)}
            <span className={styles.whenTime}>{timeLabel(o.planned_at)}</span>
          </>
        ) : (
          'Date à définir'
        )}
      </h1>
      {where && <p className={styles.where}>{where}</p>}
    </>
  );

  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        <Link href="/" className={styles.brand}>
          <Image src="/img/icon-v2.webp" alt="" width={28} height={28} />
          DishRank
        </Link>

        {o.status === 'decided' && o.winner ? (
          <Decided outing={o} isIOS={isIOS} groupLine={groupLine} token={token} />
        ) : (
          hero
        )}

        {o.status === 'active' && (
          <>
            <p className={styles.lede}>
              {organizer} propose une sortie au groupe. Coche tous les lieux qui te vont : celui qui en réunit le
              plus l’emporte.
              {myName && identity ? ` Tu votes en tant que ${myName}.` : ''}
            </p>

            {o.vote_deadline && (
              <div className={styles.deadline}>
                <span>
                  {deadlinePassed ? (
                    <strong>Vote terminé, résultat dans quelques minutes</strong>
                  ) : (
                    <>
                      Vote ouvert <strong>{deadlineLabel(o.vote_deadline, o.planned_at)}</strong>
                    </>
                  )}
                </span>
                {remaining && <span className={styles.deadlineLeft}>{remaining}</span>}
              </div>
            )}

            {people.length > 0 && (
              <details className={styles.voters}>
                <summary>
                  <AvatarStack people={people.map((p) => ({ name: p.name, url: p.url, guest: p.guest, idle: !p.voted }))} max={6} />
                  <span className={styles.votersCount}>
                    {votedCount} sur {people.length} {votedCount > 1 ? 'ont' : 'a'} voté, <u>voir qui</u>
                  </span>
                </summary>
                <ul className={styles.voterList}>
                  {people.map((p, i) => (
                    <li key={i}>
                      <Avatar name={p.name} url={p.url} guest={p.guest} />
                      <span>
                        {p.name ?? 'Membre'}
                        {p.me ? ' (toi)' : ''}
                      </span>
                      <span className={cx(styles.voterState, p.voted && styles.voterStateDone)}>
                        {p.voted ? 'a voté' : 'pas encore'}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <h2 className={cx(styles.display, styles.sectionTitle)}>Les propositions</h2>
            <p className={styles.sectionHint}>Choisies d’après les plats notés et les cartes des lieux proches.</p>
            <ul className={styles.list}>{top.map((c) => card(c))}</ul>

            {added.length > 0 && (
              <>
                <h2 className={cx(styles.display, styles.sectionTitle)}>Ajoutés par le groupe</h2>
                <p className={styles.sectionHint}>Des lieux que des membres ont proposés en plus.</p>
                <ul className={styles.list}>{added.map((c) => card(c))}</ul>
              </>
            )}

            {more.length > 0 && (
              <details className={styles.more}>
                <summary>
                  Autres idées ({more.length})
                  <ChevronIcon />
                </summary>
                <ul className={styles.list}>{more.map((c) => card(c, true))}</ul>
              </details>
            )}
          </>
        )}

        {o.status === 'expired' && (
          <section className={styles.closedState}>
            <h2 className={styles.display}>Personne n’a voté à temps</h2>
            <p>La sortie s’est fermée sans choix. {organizer} peut la relancer depuis l’app DishRank.</p>
          </section>
        )}

        {o.status === 'abandoned' && (
          <section className={styles.closedState}>
            <h2 className={styles.display}>Sortie annulée</h2>
            <p>{organizer} a annulé cette sortie.</p>
          </section>
        )}

        {o.status === 'waiting' && (
          <section className={styles.closedState}>
            <h2 className={styles.display}>Le vote n’a pas commencé</h2>
            <p>Reviens un peu plus tard : les propositions arrivent.</p>
          </section>
        )}

        <AppFooter deepLinkPath={`s/${token}`} />
      </div>

      {active && identity && (
        <div className={styles.bar} role="status">
          <div className={styles.barInner}>
            <span>
              {myPicks === 0 ? (
                'Aucun lieu coché pour l’instant'
              ) : (
                <>
                  <strong>{myPicks}</strong> {myPicks > 1 ? 'lieux cochés' : 'lieu coché'}
                </>
              )}
            </span>
            <span className={styles.saved}>{saving > 0 ? 'Enregistrement…' : 'Enregistré'}</span>
          </div>
        </div>
      )}

      {toast && (
        <div className={styles.toast} role="alert">
          <span>{toast.text}</span>
          {toast.retry ? (
            <button type="button" onClick={toast.retry}>
              Réessayer
            </button>
          ) : (
            <button type="button" onClick={() => setToast(null)} aria-label="Fermer le message">
              OK
            </button>
          )}
        </div>
      )}

      <dialog
        ref={sheetRef}
        className={styles.sheet}
        aria-labelledby="name-title"
        onClose={() => {
          if (getIdentity(token)) setPendingPick(null);
        }}
      >
        <form className={styles.sheetBody} onSubmit={onJoin} noValidate>
          <h2 id="name-title" className={cx(styles.display, styles.sheetTitle)}>
            Ton prénom
          </h2>
          <p className={styles.sheetText}>
            Il s’affiche à côté de tes choix, pour que le groupe sache qui vote. Pas de compte à créer.
          </p>
          <label className={styles.label} htmlFor="guest-name">
            Prénom
          </label>
          <input
            id="guest-name"
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            autoComplete="given-name"
            autoCapitalize="words"
            enterKeyHint="done"
            required
            aria-invalid={!!nameError}
            aria-describedby={nameError ? 'guest-name-error' : undefined}
          />
          {nameError && (
            <p id="guest-name-error" className={styles.fieldError} role="alert">
              {nameError}
            </p>
          )}
          <div className={styles.sheetActions}>
            <button type="button" className={cx(styles.btn, styles.btnGhost)} onClick={() => sheetRef.current?.close()}>
              Annuler
            </button>
            <button type="submit" className={cx(styles.btn, styles.btnPrimary)} disabled={joining}>
              {joining ? 'Un instant…' : 'Voter'}
            </button>
          </div>
        </form>
      </dialog>
    </main>
  );
}

/* ── Sortie décidée ─────────────────────────────────────────────────────── */

function Decided({ outing: o, isIOS, groupLine, token }: { outing: Outing; isIOS: boolean; groupLine: string; token: string }) {
  const w = o.winner!;
  const address = [w.address, w.city].filter(Boolean).join(', ');
  const maps = isIOS ? appleMapsUrl(w) : googleMapsUrl(w);
  const tel = telHref(w.phone);
  const site = safeHttpUrl(w.website);
  const carte = safeHttpUrl(w.menu_url);
  const booking = safeHttpUrl(w.reservation_url);
  const photo = safeHttpUrl(w.photo_url);
  const ext = { target: '_blank', rel: 'noopener noreferrer' } as const;

  const addToCalendar = () => {
    const ics = buildIcs(o, w, `https://dishrank.fr/s/${token}`);
    if (!ics) return;
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sortie-dishrank.ics';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  return (
    <section className={styles.result}>
      <p className={styles.group}>{groupLine}</p>
      <p className={styles.resultKicker}>C’est décidé</p>
      <h1 className={cx(styles.display, styles.resultName)}>{w.name}</h1>
      {o.planned_at && <p className={styles.resultWhen}>{capFirst(whenSentence(o.planned_at))}</p>}
      {address && <p className={styles.resultAddress}>{address}</p>}
      {w.approvals > 0 && (
        <p className={styles.resultVotes}>
          Choisi par {w.approvals} {w.approvals > 1 ? 'personnes' : 'personne'}
        </p>
      )}
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className={styles.resultPhoto} src={photo} alt="" loading="lazy" />
      )}
      <div className={styles.btnRow}>
        <a className={cx(styles.btn, styles.btnPrimary, styles.btnWide)} href={maps} {...ext}>
          Itinéraire
        </a>
        {o.planned_at && (
          <button type="button" className={cx(styles.btn, styles.btnGhost, styles.btnWide)} onClick={addToCalendar}>
            Ajouter au calendrier
          </button>
        )}
        {tel && (
          <a className={cx(styles.btn, styles.btnGhost)} href={tel}>
            Appeler
          </a>
        )}
        {booking && (
          <a className={cx(styles.btn, styles.btnGhost)} href={booking} {...ext}>
            Réserver
          </a>
        )}
        {carte && (
          <a className={cx(styles.btn, styles.btnGhost)} href={carte} {...ext}>
            Voir la carte
          </a>
        )}
        {site && (
          <a className={cx(styles.btn, styles.btnGhost)} href={site} {...ext}>
            Site web
          </a>
        )}
      </div>
      {w.dishes.length > 0 && (
        <>
          <h2 className={cx(styles.display, styles.tasteTitle)}>À goûter là-bas</h2>
          <ul className={styles.dishes}>
            {w.dishes.map((d, i) => (
              <DishRow key={`${d.name}-${i}`} d={d} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

const capFirst = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
