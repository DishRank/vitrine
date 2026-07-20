'use client';

import { useRef, useState, useTransition } from 'react';
import { getThumbnailUrl } from '@/lib/thumb';
import { setListingCoverAction, setListingLogoAction } from './listingMedia';
import ImageCropper from './ImageCropper';
import Modal from '../../_components/Modal';
import ConfirmDialog from '../../_components/ConfirmDialog';

export interface ReviewPhoto {
  id: string;
  photo_url: string;
}

interface CropRequest {
  file: File;
  aspect: number;
  outputWidth: number;
  quality: number;
  kind: 'cover' | 'logo';
  title: string;
  fit: 'cover' | 'contain';
}

/**
 * Section « Photos » de la fiche : image vitrine (couverture 16:9) + logo unique
 * (1:1). Les envois passent par un recadreur (images uniformes, poids minimal,
 * centrage par l'utilisateur) ; l'image vitrine peut aussi être choisie parmi
 * les photos des avis (référencée telle quelle, comme l'app). État local
 * optimiste → l'aperçu se met à jour tout de suite ; persistance via actions.
 */
export default function ListingImages({
  restaurantId,
  initialPhotoUrl,
  initialLogoUrl,
  reviewPhotos,
}: {
  restaurantId: string;
  initialPhotoUrl: string | null;
  initialLogoUrl: string | null;
  reviewPhotos: ReviewPhoto[];
}) {
  const [photoUrl, setPhotoUrl] = useState(initialPhotoUrl);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [crop, setCrop] = useState<CropRequest | null>(null);
  const [askRemove, setAskRemove] = useState<'cover' | 'logo' | null>(null);
  const [err, setErr] = useState('');
  const [, start] = useTransition();

  const coverFileRef = useRef<HTMLInputElement>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);

  const persistCover = (next: string | null) =>
    start(async () => {
      const prev = photoUrl;
      setPhotoUrl(next);
      const r = await setListingCoverAction(restaurantId, next);
      if (r.error) {
        setErr(r.error);
        setPhotoUrl(prev);
      }
    });

  const persistLogo = (next: string | null) =>
    start(async () => {
      const prev = logoUrl;
      setLogoUrl(next);
      const r = await setListingLogoAction(restaurantId, next);
      if (r.error) {
        setErr(r.error);
        setLogoUrl(prev);
      }
    });

  const onCropped = (url: string) => {
    const kind = crop?.kind;
    setCrop(null);
    if (kind === 'cover') persistCover(url);
    else if (kind === 'logo') persistLogo(url);
  };

  return (
    <section className="rounded-2xl border border-[var(--border2)] bg-[var(--surface)] p-5 sm:p-6 space-y-6">
      <h2 className="text-base font-extrabold">Photos</h2>

      {/* ── Image vitrine ─────────────────────────────────────────────────── */}
      <div>
        <p className="mb-2 text-[13px] font-semibold text-[var(--text2)]">Image vitrine</p>
        <div className="overflow-hidden rounded-xl border border-[var(--border2)] bg-[var(--surface-var)]">
          <div className="relative aspect-video w-full">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-3xl text-[var(--text3)]">🏝️</div>
            )}
          </div>
        </div>
        <input ref={coverFileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) setCrop({ file: f, aspect: 16 / 9, outputWidth: 1280, quality: 0.82, kind: 'cover', title: 'Recadrer l’image vitrine', fit: 'cover' }); e.target.value = ''; }} />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => coverFileRef.current?.click()}
            className="rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90"
          >
            {photoUrl ? 'Changer la photo' : 'Ajouter une photo'}
          </button>
          {reviewPhotos.length > 0 ? (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="rounded-lg border border-[var(--border2)] px-3 py-2 text-sm font-semibold text-[var(--text2)] transition-colors hover:border-[var(--primary)] hover:text-[var(--text)]"
            >
              Choisir une photo d’avis
            </button>
          ) : null}
          {photoUrl ? (
            <button
              type="button"
              onClick={() => setAskRemove('cover')}
              className="text-sm font-semibold text-red-500 hover:underline"
            >
              Retirer
            </button>
          ) : null}
        </div>
        <p className="mt-1.5 text-xs text-[var(--text3)]">
          La photo de couverture de votre établissement, recadrée en 16:9.
        </p>
      </div>

      {/* ── Logo ──────────────────────────────────────────────────────────── */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <p className="text-[13px] font-semibold text-[var(--text2)]">Logo</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--border2)] bg-[var(--surface-var)]">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={getThumbnailUrl(logoUrl)} alt="" className="h-full w-full object-contain" />
            ) : (
              <span className="text-xl text-[var(--text3)]">★</span>
            )}
          </div>
          <input ref={logoFileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) setCrop({ file: f, aspect: 1, outputWidth: 512, quality: 0.9, kind: 'logo', title: 'Recadrer le logo', fit: 'contain' }); e.target.value = ''; }} />
          <div className="flex flex-col items-start gap-1">
            <button
              type="button"
              onClick={() => logoFileRef.current?.click()}
              className="rounded-lg border border-[var(--border2)] px-3 py-2 text-sm font-semibold transition-colors hover:border-[var(--primary)]"
            >
              {logoUrl ? 'Changer le logo' : 'Ajouter un logo'}
            </button>
            {logoUrl ? (
              <button type="button" onClick={() => setAskRemove('logo')} className="text-xs font-semibold text-red-500 hover:underline">
                Retirer
              </button>
            ) : null}
          </div>
        </div>
        <p className="mt-1.5 text-xs text-[var(--text3)]">Votre logo apparaît aussi en tête de votre menu numérique.</p>
      </div>

      {err ? <p className="text-[13px] font-medium text-red-500">{err}</p> : null}

      {/* Confirmation de retrait (image vitrine / logo) */}
      <ConfirmDialog
        open={askRemove !== null}
        title={askRemove === 'logo' ? 'Retirer le logo' : 'Retirer l’image vitrine'}
        message={
          askRemove === 'logo'
            ? 'Le logo sera retiré de votre fiche et de votre menu.'
            : 'L’image vitrine sera retirée de votre fiche.'
        }
        confirmLabel="Retirer"
        onConfirm={() => {
          if (askRemove === 'logo') persistLogo(null);
          else if (askRemove === 'cover') persistCover(null);
        }}
        onClose={() => setAskRemove(null)}
      />

      {/* Recadreur (couverture / logo) */}
      {crop ? (
        <ImageCropper
          file={crop.file}
          aspect={crop.aspect}
          outputWidth={crop.outputWidth}
          quality={crop.quality}
          title={crop.title}
          fit={crop.fit}
          onDone={onCropped}
          onCancel={() => setCrop(null)}
        />
      ) : null}

      {/* Choisir une photo d'avis (référencée telle quelle) */}
      <Modal open={pickerOpen} onClose={() => setPickerOpen(false)} title="Choisir une photo d’avis" maxWidth="max-w-2xl">
        <p className="mb-3 text-sm text-[var(--text2)]">Réutilisez une photo prise par vos clients comme image vitrine.</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {reviewPhotos.map((p) => {
            const selected = p.photo_url === photoUrl;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  persistCover(p.photo_url);
                  setPickerOpen(false);
                }}
                className={`relative aspect-square overflow-hidden rounded-lg border-2 transition-colors ${
                  selected ? 'border-[var(--primary)]' : 'border-transparent hover:border-[var(--primary)]'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={getThumbnailUrl(p.photo_url)} alt="" className="h-full w-full object-cover" />
              </button>
            );
          })}
        </div>
      </Modal>
    </section>
  );
}
