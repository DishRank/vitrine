import fs from 'node:fs';
import path from 'node:path';

/**
 * Configuration DEV des tests e2e du site.
 *
 * Source : le dépôt de l'appli (../dishrank, ou DISHRANK_APP_DIR), qui porte
 * déjà la config DEV (.env.development) et le seed de la base. Un fichier
 * local .env.test.local (ignoré par git) peut ajouter :
 *   SUPABASE_SERVICE_ROLE_KEY_DEV=…   clé secrète du projet DEV : `sb_secret_…`
 *                                     (ou l'ancienne `service_role`). Sert au
 *                                     serveur (note sans compte, invitations de
 *                                     groupe) et aux vérifications en base.
 * La clé publishable (`sb_publishable_…`) est publique et soumise aux règles
 * d'accès : elle ne convient pas, et elle est ignorée (avec un avertissement).
 */
const PROD_REF = 'yztbhdvrvgozhyaujtjz';

export const APP_DIR = process.env.DISHRANK_APP_DIR ?? path.resolve(__dirname, '..', '..', 'dishrank');

function readEnvFile(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!fs.existsSync(file)) return out;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq > 0) out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return out;
}

export type DevEnv = { url: string; anonKey: string; serviceRoleKey: string | null };

let warned = false;

export function loadDevEnv(): DevEnv {
  const app = readEnvFile(path.join(APP_DIR, '.env.development'));
  const local = readEnvFile(path.resolve(__dirname, '..', '.env.test.local'));
  const url = process.env.E2E_SUPABASE_URL ?? app.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.E2E_SUPABASE_ANON_KEY ?? app.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const rawServiceKey =
    process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ?? local.SUPABASE_SERVICE_ROLE_KEY_DEV ?? null;
  if (rawServiceKey?.startsWith('sb_publishable_') && !warned) {
    warned = true;
    console.warn(
      '[e2e] SUPABASE_SERVICE_ROLE_KEY_DEV contient la clé publishable : il faut la clé secrète (sb_secret_…). Tests qui en dépendent sautés.'
    );
  }
  const serviceRoleKey = rawServiceKey && !rawServiceKey.startsWith('sb_publishable_') ? rawServiceKey : null;
  if (!url || !anonKey) {
    throw new Error(
      `Config DEV introuvable : ${path.join(APP_DIR, '.env.development')} (EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY). ` +
        'Indique le dépôt de l’appli avec DISHRANK_APP_DIR.'
    );
  }
  if (url.includes(PROD_REF)) throw new Error('Refus : les tests e2e du site ne tournent que contre la base DEV.');
  return { url, anonKey, serviceRoleKey };
}

/** Secret TOTP du compte pro de test, recréé par `npm run e2e:seed` (dépôt dishrank). */
export function proMfaSecret(): string | null {
  const file = path.join(APP_DIR, 'e2e', 'maestro', 'setup', '.pro-mfa-secret');
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim() : null;
}
