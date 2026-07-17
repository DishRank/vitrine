'use client';

import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  upsertReplyAction,
  deleteReplyAction,
  togglePinAction,
  type ReplyActionState,
} from './replyActions';
import {
  linkReviewAction,
  createDishFromReviewAction,
  type LinkActionState,
} from './linkActions';
import DishSelect from './DishSelect';
import { FormError, inputCls } from '../../../_components/fields';
import ConfirmDialog from '../../../_components/ConfirmDialog';

export interface ProReply {
  id: string;
  review_id: string;
  body: string;
  created_at: string;
  is_pinned: boolean;
}

/** Plat visible du menu = cible d'association (groupé par catégorie). */
export interface MenuItemRef {
  id: string;
  name: string;
  section: string;
}

/** État d'association d'un avis à un plat de la carte. */
export type ReviewAssoc =
  | { state: 'linked'; linkedName: string }
  | { state: 'matched' }
  | { state: 'orphan' };

export interface ProReview {
  id: string;
  dishName: string | null;
  comment: string | null;
  rating: number | null;
  verdict: string | null;
  photoUrl: string | null;
  createdAt: string;
  authorName: string;
  reply: ProReply | null;
  menuItemId: string | null;
  assoc: ReviewAssoc;
}

const VERDICT: Record<string, { label: string; cls: string }> = {
  must_return: { label: '⭐ À refaire', cls: 'text-[var(--accent-success)]' },
  disappointing: { label: '👎 Déçu', cls: 'text-red-500' },
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** 48 h après création, la réponse n'est plus modifiable/supprimable (serveur). */
function isLocked(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() > 48 * 3600 * 1000;
}

export default function ReviewCard({
  restaurantId,
  review,
  canPin,
  thankTemplate,
  menuItems,
}: {
  restaurantId: string;
  review: ProReview;
  canPin: boolean;
  thankTemplate: string;
  menuItems: MenuItemRef[];
}) {
  const [editing, setEditing] = useState(false);
  const [askDeleteReply, setAskDeleteReply] = useState(false);
  const delFormRef = useRef<HTMLFormElement>(null);
  const [body, setBody] = useState('');
  const [upsertState, upsert] = useActionState<ReplyActionState, FormData>(
    upsertReplyAction.bind(null, restaurantId),
    {}
  );
  const [delState, del] = useActionState<ReplyActionState, FormData>(
    deleteReplyAction.bind(null, restaurantId),
    {}
  );
  const [pinState, pin] = useActionState<ReplyActionState, FormData>(
    togglePinAction.bind(null, restaurantId),
    {}
  );
  const [linkState, link] = useActionState<LinkActionState, FormData>(
    linkReviewAction.bind(null, restaurantId),
    {}
  );
  const [createState, create] = useActionState<LinkActionState, FormData>(
    createDishFromReviewAction.bind(null, restaurantId),
    {}
  );

  // Plats visibles groupés par catégorie (pour le <select> d'association).
  const menuGroups = useMemo(() => {
    const m = new Map<string, MenuItemRef[]>();
    for (const it of menuItems) {
      const arr = m.get(it.section);
      if (arr) arr.push(it);
      else m.set(it.section, [it]);
    }
    return [...m.entries()];
  }, [menuItems]);

  // Après une mise à jour réussie, revalidatePath re-rend la carte avec la
  // nouvelle réponse ; on referme le mode édition (l'état local survivrait sinon).
  useEffect(() => {
    if (upsertState.ok) {
      setEditing(false);
      setBody('');
    }
  }, [upsertState.ok]);

  // « Créer ce plat » → on file sur l'onglet menu, éditeur ouvert sur le nouveau
  // plat (pour renseigner prix / description / catégories tout de suite).
  const router = useRouter();
  useEffect(() => {
    if (createState.ok && createState.itemId) {
      router.push(`/pro/r/${restaurantId}/menu?edit=${createState.itemId}`);
    }
  }, [createState.ok, createState.itemId, restaurantId, router]);

  const reply = review.reply;
  const showForm = editing || !reply;
  const locked = reply ? isLocked(reply.created_at) : false;
  const verdict = review.verdict ? VERDICT[review.verdict] : null;

  return (
    <div className="rounded-2xl border border-[var(--border2)] bg-[var(--surface)] p-4">
      {/* Avis */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {review.dishName ? <span className="font-bold truncate">{review.dishName}</span> : null}
            {review.rating != null ? (
              <span className="shrink-0 rounded-md bg-[var(--surface-var)] px-1.5 py-0.5 text-xs font-bold text-[var(--text)]">
                ★ {review.rating.toFixed(1)}
              </span>
            ) : null}
            {verdict ? <span className={`text-xs font-bold ${verdict.cls}`}>{verdict.label}</span> : null}
          </div>
          <p className="mt-0.5 text-xs text-[var(--text3)]">
            {review.authorName} · {fmtDate(review.createdAt)}
          </p>
        </div>
        {review.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={review.photoUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
        ) : null}
      </div>
      {review.comment ? (
        <p className="mt-2 text-sm text-[var(--text)] whitespace-pre-line">{review.comment}</p>
      ) : null}

      {/* Association au plat du menu (mig 112) — le nom du client reste intact. */}
      {review.assoc.state === 'linked' ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-[var(--surface-var)] px-3 py-2">
          <span className="text-xs text-[var(--text2)]">
            🔗 Rattaché à <b className="text-[var(--text)]">{review.assoc.linkedName}</b>
          </span>
          <form action={link}>
            <input type="hidden" name="reviewId" value={review.id} />
            <input type="hidden" name="menuItemId" value="" />
            <button type="submit" className="text-xs font-semibold text-[var(--text3)] hover:text-red-500">
              Dissocier
            </button>
          </form>
          <FormError error={linkState.error} />
        </div>
      ) : review.assoc.state === 'orphan' ? (
        <div className="mt-3 rounded-xl border border-dashed border-[var(--border2)] px-3 py-2.5">
          <p className="text-xs text-[var(--text2)]">
            « <b className="text-[var(--text)]">{review.dishName}</b> » n’est pas dans votre carte.
            Rattachez cet avis à un plat pour qu’il compte dans sa note.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {menuGroups.length > 0 ? (
              <form action={link} className="flex items-center gap-2">
                <input type="hidden" name="reviewId" value={review.id} />
                <DishSelect groups={menuGroups} />
                <button
                  type="submit"
                  className="shrink-0 rounded-lg bg-[var(--primary)] px-3.5 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90"
                >
                  Rattacher
                </button>
              </form>
            ) : null}
            {review.dishName ? (
              <form action={create}>
                <input type="hidden" name="dishName" value={review.dishName} />
                <button
                  type="submit"
                  className="rounded-lg border border-[var(--primary)] px-3.5 py-2 text-sm font-bold text-[var(--primary)] transition-colors hover:bg-[var(--primary-container)]"
                >
                  {menuGroups.length > 0 ? '+ Créer ce plat' : '+ Créer ce plat dans ma carte'}
                </button>
              </form>
            ) : null}
          </div>
          <FormError error={linkState.error ?? createState.error} />
        </div>
      ) : null}

      {/* Réponse existante */}
      {reply && !editing ? (
        <div className="mt-3 rounded-xl border-l-2 border-[var(--primary)] bg-[var(--primary-container)] px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-[var(--primary)]">
              Votre réponse{reply.is_pinned ? ' · 📌 épinglée' : ''}
            </span>
            <span className="text-xs text-[var(--text3)]">{fmtDate(reply.created_at)}</span>
          </div>
          <p className="mt-1 text-sm text-[var(--text)] whitespace-pre-line">{reply.body}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {!locked ? (
              <button
                type="button"
                onClick={() => {
                  setBody(reply?.body ?? '');
                  setEditing(true);
                }}
                className="text-xs font-semibold text-[var(--primary)] hover:underline"
              >
                Modifier
              </button>
            ) : (
              <span className="text-xs text-[var(--text3)]">Verrouillée (48 h)</span>
            )}
            {canPin ? (
              <form action={pin}>
                <input type="hidden" name="replyId" value={reply.id} />
                <input type="hidden" name="pinned" value={String(!reply.is_pinned)} />
                <button type="submit" className="text-xs font-semibold text-[var(--text2)] hover:text-[var(--primary)]">
                  {reply.is_pinned ? 'Désépingler' : '📌 Épingler'}
                </button>
              </form>
            ) : null}
            {!locked ? (
              <form action={del} ref={delFormRef}>
                <input type="hidden" name="replyId" value={reply.id} />
                <button
                  type="button"
                  onClick={() => setAskDeleteReply(true)}
                  className="text-xs font-semibold text-red-500 hover:underline"
                >
                  Supprimer
                </button>
              </form>
            ) : null}
          </div>
          <FormError error={delState.error ?? pinState.error} />
          <ConfirmDialog
            open={askDeleteReply}
            title="Supprimer la réponse"
            message="Votre réponse publique à cet avis sera définitivement supprimée."
            confirmLabel="Supprimer"
            onConfirm={() => delFormRef.current?.requestSubmit()}
            onClose={() => setAskDeleteReply(false)}
          />
        </div>
      ) : null}

      {/* Formulaire (nouvelle réponse ou édition) */}
      {showForm ? (
        <form action={upsert} className="mt-3 space-y-2">
          <input type="hidden" name="reviewId" value={review.id} />
          <textarea
            name="body" rows={3} maxLength={1000} required
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={thankTemplate}
            className={inputCls}
          />
          <div className="flex flex-wrap items-center gap-2">
            {!reply ? (
              <button
                type="button"
                onClick={() => setBody(thankTemplate)}
                title="Pré-remplir avec votre message de remerciement (modifiable)"
                className="rounded-lg border border-[var(--primary)] px-3 py-2 text-sm font-bold text-[var(--primary)] hover:bg-[var(--primary-container)]"
              >
                💬 Remercier
              </button>
            ) : null}
            <button
              type="submit"
              className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-bold text-white hover:opacity-90"
            >
              {reply ? 'Mettre à jour' : 'Répondre'}
            </button>
            {editing ? (
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-[var(--text2)] hover:text-[var(--text)]"
              >
                Annuler
              </button>
            ) : null}
            <FormError error={upsertState.error} />
          </div>
        </form>
      ) : null}
    </div>
  );
}
