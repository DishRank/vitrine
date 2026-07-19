'use client';

import { useRef, useState, useTransition } from 'react';
import { uploadMenuImage } from './imageUpload';
import { setItemPhotoAction } from './mediaActions';
import { getThumbnailUrl } from './thumb';

/** Ajout / changement / retrait de la photo d'un plat. Upload navigateur
 *  (full + _thumb) puis persistance de photo_url via Server Action. (L'option
 *  « afficher ma photo en premier dans l'app » vit dans le FORMULAIRE du plat —
 *  ItemForm — pas ici.) */
export default function PhotoControl({
  restaurantId,
  itemId,
  photoUrl,
}: {
  restaurantId: string;
  itemId: string;
  photoUrl: string | null;
}) {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (file: File) => {
    setErr('');
    setBusy(true);
    const up = await uploadMenuImage(file);
    setBusy(false);
    if (!up.ok || !up.url) {
      setErr(up.error || "Échec de l'envoi.");
      return;
    }
    start(async () => {
      const r = await setItemPhotoAction(restaurantId, itemId, up.url!);
      if (r.error) setErr(r.error);
    });
  };

  const remove = () =>
    start(async () => {
      setErr('');
      const r = await setItemPhotoAction(restaurantId, itemId, null);
      if (r.error) setErr(r.error);
    });

  const loading = busy || pending;

  return (
    <div className="flex items-center gap-2">
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={getThumbnailUrl(photoUrl)} alt="" className="h-12 w-12 rounded-lg object-cover bg-[var(--surface-var)]" />
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--surface-var)] text-lg">🍽️</div>
      )}
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
      <div className="flex flex-col items-start gap-0.5">
        <button onClick={() => fileRef.current?.click()} disabled={loading} className="text-xs font-semibold text-[var(--primary)] hover:underline disabled:opacity-50">
          {loading ? 'Envoi…' : photoUrl ? 'Changer la photo' : 'Ajouter une photo'}
        </button>
        {photoUrl ? <button onClick={remove} disabled={loading} className="text-xs font-semibold text-red-500 hover:underline disabled:opacity-50">Retirer</button> : null}
        {err ? <span className="text-xs text-red-500">{err}</span> : null}
      </div>
    </div>
  );
}
