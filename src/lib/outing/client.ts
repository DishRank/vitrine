'use client';
import { getSupabaseBrowser } from '@/lib/supabaseBrowser';
// Démo (dev uniquement) : branches éliminées du bundle de production.
import { demoJoin, demoOuting, demoToggle, isDemoToken } from './fixtures';
import type { Outing, OutingGuestSession } from './types';

/**
 * Appels navigateur de la page invité /s/<jeton>.
 *
 * Directement vers les RPC anon de la migration 202 (pas de route serveur
 * intermédiaire) : l'accès est porté par le jeton du lien (128 bits, non
 * devinable) et, pour voter, par le secret d'invité (haché en base). La base
 * plafonne à 30 invités par sortie et n'accepte que des lieux de la liste.
 * Aucune donnée n'est écrite hors des votes de cet invité.
 */

export type GuestIdentity = { guest_id: string; guest_secret: string; name: string };

const storageKey = (token: string) => `dishrank:outing:${token}`;

function readStored(token: string): GuestIdentity | null {
  try {
    const raw = window.localStorage.getItem(storageKey(token));
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<GuestIdentity>;
    return typeof v.guest_id === 'string' && typeof v.guest_secret === 'string'
      ? { guest_id: v.guest_id, guest_secret: v.guest_secret, name: typeof v.name === 'string' ? v.name : '' }
      : null;
  } catch {
    return null;
  }
}

/*
 * Identité d'invité = petit magasin externe (useSyncExternalStore) adossé au
 * localStorage. Le cache mémoire garde l'identité pour la visite même quand le
 * stockage est bloqué (navigation privée stricte) ; l'événement `storage`
 * synchronise les onglets ouverts sur le même lien.
 */
const cache = new Map<string, GuestIdentity | null>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function subscribeIdentity(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (!e.key?.startsWith('dishrank:outing:')) return;
    cache.delete(e.key.slice('dishrank:outing:'.length));
    listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function getIdentity(token: string): GuestIdentity | null {
  if (!cache.has(token)) cache.set(token, readStored(token));
  return cache.get(token) ?? null;
}

export function setIdentity(token: string, id: GuestIdentity | null) {
  cache.set(token, id);
  try {
    if (id) window.localStorage.setItem(storageKey(token), JSON.stringify(id));
    else window.localStorage.removeItem(storageKey(token));
  } catch {
    /* stockage bloqué : le cache mémoire suffit pour cette visite */
  }
  notify();
}

function client() {
  const sb = getSupabaseBrowser();
  if (!sb) throw new Error('unavailable');
  return sb;
}

async function call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await client().rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export async function fetchSharedOuting(token: string, id: GuestIdentity | null): Promise<Outing | null> {
  if (process.env.NODE_ENV !== 'production' && isDemoToken(token)) return demoOuting(token, id?.guest_id, id?.guest_secret);
  return call<Outing | null>('get_shared_outing', {
    p_token: token,
    p_guest_id: id?.guest_id ?? null,
    p_guest_secret: id?.guest_secret ?? null,
  });
}

export async function joinOuting(token: string, name: string): Promise<OutingGuestSession> {
  if (process.env.NODE_ENV !== 'production' && isDemoToken(token)) return demoJoin(token, name);
  return call<OutingGuestSession>('outing_guest_join', { p_token: token, p_name: name });
}

export async function toggleApproval(token: string, id: GuestIdentity, restaurantId: string): Promise<Outing> {
  if (process.env.NODE_ENV !== 'production' && isDemoToken(token)) return demoToggle(token, id.guest_id, id.guest_secret, restaurantId);
  return call<Outing>('outing_guest_toggle', {
    p_token: token,
    p_guest_id: id.guest_id,
    p_guest_secret: id.guest_secret,
    p_restaurant_id: restaurantId,
  });
}
