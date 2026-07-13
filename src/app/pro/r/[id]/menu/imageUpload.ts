'use client';

import { getSupabaseBrowserPro } from '@/lib/pro/supabaseBrowser';

/**
 * Upload d'image côté navigateur, convention IDENTIQUE à l'app
 * (lib/storage.ts uploadDishPhoto) pour que le rendu in-app reste correct :
 *  - bucket `dish-photos`, chemin `<uid>/<uniqueId>.webp` (RLS : folder[1]=uid) ;
 *  - un `_thumb.webp` frère (getThumbnailUrl le dérive côté app — sans lui,
 *    l'app retombe sur une transformation facturée) ;
 *  - photo_url = URL publique du full + `?v=timestamp` (bust cache).
 *
 * Redimensionnement via <canvas> → webp (pas d'expo-image-manipulator ici).
 * Le client navigateur porte la session (cookies) → l'upload passe la RLS.
 */

const FULL_WIDTH = 1280;
const THUMB_WIDTH = 320;
const FULL_Q = 0.82;
const THUMB_Q = 0.7;

async function resizeToWebp(file: File, maxWidth: number, quality: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas indisponible');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/webp', quality));
  if (!blob) throw new Error('conversion webp échouée');
  return blob;
}

export interface UploadResult {
  ok: boolean;
  url?: string;
  error?: string;
}

/** Upload full + thumb ; renvoie l'URL publique du full (à persister via une
 *  Server Action). L'appelant a déjà validé le type/poids côté input. */
export async function uploadMenuImage(file: File): Promise<UploadResult> {
  const supabase = getSupabaseBrowserPro();
  if (!supabase) return { ok: false, error: 'Configuration manquante.' };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Session expirée — reconnecte-toi.' };

  if (!/^image\//.test(file.type)) return { ok: false, error: 'Fichier image requis.' };
  if (file.size > 12 * 1024 * 1024) return { ok: false, error: 'Image trop lourde (12 Mo max).' };

  let full: Blob, thumb: Blob;
  try {
    [full, thumb] = await Promise.all([
      resizeToWebp(file, FULL_WIDTH, FULL_Q),
      resizeToWebp(file, THUMB_WIDTH, THUMB_Q),
    ]);
  } catch {
    return { ok: false, error: "Impossible de traiter l'image." };
  }

  const uniqueId = `${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  const base = `${user.id}/${uniqueId}`;

  const [fullRes] = await Promise.all([
    supabase.storage.from('dish-photos').upload(`${base}.webp`, full, { contentType: 'image/webp', upsert: true }),
    supabase.storage.from('dish-photos').upload(`${base}_thumb.webp`, thumb, { contentType: 'image/webp', upsert: true }).catch(() => {}),
  ]);
  if (fullRes.error) return { ok: false, error: "L'envoi a échoué. Réessaie." };

  const { data } = supabase.storage.from('dish-photos').getPublicUrl(`${base}.webp`);
  return { ok: true, url: `${data.publicUrl}?v=${Date.now()}` };
}
