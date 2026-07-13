'use client';

import { useActionState, useEffect, useState } from 'react';
import {
  upsertReplyAction,
  deleteReplyAction,
  togglePinAction,
  type ReplyActionState,
} from './replyActions';
import { FormError, inputCls } from '../../../_components/fields';

export interface ProReply {
  id: string;
  review_id: string;
  body: string;
  created_at: string;
  is_pinned: boolean;
}

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
}: {
  restaurantId: string;
  review: ProReview;
  canPin: boolean;
}) {
  const [editing, setEditing] = useState(false);
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

  // Après une mise à jour réussie, revalidatePath re-rend la carte avec la
  // nouvelle réponse ; on referme le mode édition (l'état local survivrait sinon).
  useEffect(() => {
    if (upsertState.ok) setEditing(false);
  }, [upsertState.ok]);

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
                onClick={() => setEditing(true)}
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
              <form action={del}>
                <input type="hidden" name="replyId" value={reply.id} />
                <button type="submit" className="text-xs font-semibold text-red-500 hover:underline">
                  Supprimer
                </button>
              </form>
            ) : null}
          </div>
          <FormError error={delState.error ?? pinState.error} />
        </div>
      ) : null}

      {/* Formulaire (nouvelle réponse ou édition) */}
      {showForm ? (
        <form action={upsert} className="mt-3 space-y-2">
          <input type="hidden" name="reviewId" value={review.id} />
          <textarea
            name="body" rows={3} maxLength={1000} required
            defaultValue={editing ? reply?.body : ''}
            placeholder="Merci pour votre visite ! …"
            className={inputCls}
          />
          <div className="flex items-center gap-2">
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
