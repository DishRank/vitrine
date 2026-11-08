import crypto from 'node:crypto';
import { loadDevEnv } from '../env';

/** Données posées par le seed de l'appli (dishrank/e2e/maestro/setup/reset-e2e.sql). */
export const SEED = {
  password: 'Test123!Integration',
  alice: 'test-alice@dishrank-integration.test',
  pro: 'test-e2e-pro@dishrank-integration.test',
  proRestaurantId: 'e2e00000-0000-4000-8000-000000000005',
  proRestaurantName: 'Resto Pro Maestro',
  outingGroupId: 'e2e00000-0000-4000-8000-00000000000a',
  /** Invitation permanente au groupe « Lien Maestro » de Bob (seed, section 4). */
  groupInviteCode: 'DR-MAESTR',
  groupInviteName: 'Lien Maestro',
} as const;

const dev = loadDevEnv();

/** Connexion par mot de passe (API Auth) → jeton d'accès. */
export async function signIn(email: string): Promise<string> {
  const res = await fetch(`${dev.url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: dev.anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: SEED.password }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`connexion ${email} : ${res.status} ${JSON.stringify(body)}`);
  return body.access_token as string;
}

/** Appel RPC avec le jeton d'un compte. */
export async function rpc<T = unknown>(token: string, fn: string, args: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${dev.url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: dev.anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${fn} : ${res.status} ${text}`);
  return (text ? JSON.parse(text) : null) as T;
}

/** Lecture REST avec la clé service_role DEV (null si elle n'est pas fournie). */
export async function serviceSelect<T = unknown>(pathAndQuery: string): Promise<T | null> {
  if (!dev.serviceRoleKey) return null;
  const res = await fetch(`${dev.url}/rest/v1/${pathAndQuery}`, {
    // Clé secrète `sb_secret_…` : pas un JWT, seulement dans `apikey` ;
    // ancienne clé `service_role` (JWT) : aussi en `Authorization`.
    headers: dev.serviceRoleKey.startsWith('eyJ')
      ? { apikey: dev.serviceRoleKey, Authorization: `Bearer ${dev.serviceRoleKey}` }
      : { apikey: dev.serviceRoleKey },
  });
  if (!res.ok) throw new Error(`${pathAndQuery} : ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

export const hasServiceRoleKey = !!dev.serviceRoleKey;

function serviceHeaders(): Record<string, string> {
  const key = dev.serviceRoleKey!;
  return key.startsWith('eyJ')
    ? { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
    : { apikey: key, 'Content-Type': 'application/json' };
}

/** Écriture REST avec la clé secrète DEV (données de test créées puis effacées par un spec). */
export async function serviceWrite(method: 'POST' | 'PATCH' | 'DELETE', pathAndQuery: string, body?: unknown): Promise<void> {
  if (!dev.serviceRoleKey) throw new Error('clé secrète DEV absente');
  const res = await fetch(`${dev.url}/rest/v1/${pathAndQuery}`, {
    method,
    headers: { ...serviceHeaders(), Prefer: 'return=minimal' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${pathAndQuery} : ${res.status} ${await res.text()}`);
}

/** Appel RPC avec la clé secrète DEV. */
export async function serviceRpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T> {
  if (!dev.serviceRoleKey) throw new Error('clé secrète DEV absente');
  const res = await fetch(`${dev.url}/rest/v1/rpc/${fn}`, { method: 'POST', headers: serviceHeaders(), body: JSON.stringify(args) });
  const text = await res.text();
  if (!res.ok) throw new Error(`${fn} : ${res.status} ${text}`);
  return (text ? JSON.parse(text) : null) as T;
}

/** Lecture REST avec le jeton d'un compte (ses propres lignes, sous RLS). */
export async function userSelect<T = unknown>(token: string, pathAndQuery: string): Promise<T> {
  const res = await fetch(`${dev.url}/rest/v1/${pathAndQuery}`, {
    headers: { apikey: dev.anonKey, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`${pathAndQuery} : ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

/** Identifiant du compte porté par un jeton d'accès (claim `sub`). */
export function jwtSub(token: string): string {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')).sub as string;
}

/** Code TOTP (RFC 6238 : SHA-1, 6 chiffres, 30 s), comme une appli de codes. */
export function totp(secretBase32: string, nowMs = Date.now()): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of secretBase32.replace(/=+$/, '').replace(/\s/g, '').toUpperCase()) {
    bits += alphabet.indexOf(c).toString(2).padStart(5, '0');
  }
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map((b) => parseInt(b, 2)));
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(Math.floor(nowMs / 30_000)));
  const h = crypto.createHmac('sha1', key).update(msg).digest();
  const o = h[h.length - 1] & 0xf;
  return ((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).toString().padStart(6, '0');
}

/** Attend le début d'une période de 30 s si la courante finit dans moins de 5 s. */
export async function freshTotpWindow(): Promise<void> {
  const left = 30_000 - (Date.now() % 30_000);
  if (left < 5_000) await new Promise((r) => setTimeout(r, left + 200));
}
