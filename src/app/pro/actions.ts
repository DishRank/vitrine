'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSupabaseServer } from '@/lib/pro/supabaseServer';
import { mapAuthErrorFr, isPasswordValid } from '@/lib/pro/authErrors';
import { rateLimit } from '@/lib/pro/rateLimit';
import { logProEvent } from '@/lib/pro/instrument';

/**
 * Server Actions auth de l'espace pro — TOUTES les mutations passent par ici
 * (D4 du plan : les Server Actions vérifient l'Origin nativement = anti-CSRF ;
 * les cookies @supabase/ssr n'étant pas httpOnly, aucun Route Handler mutateur
 * ne doit accepter la session cookie sans cette protection).
 *
 * Chaque action est rate-limitée (lot 1.7) par IP et/ou par email, et passe le
 * token Turnstile à GoTrue quand le captcha est activé (dashboard Supabase →
 * Auth → Attack protection + NEXT_PUBLIC_TURNSTILE_SITE_KEY).
 */

export interface AuthActionState {
  error?: string;
  ok?: boolean;
  message?: string;
}

async function clientIp(): Promise<string> {
  const h = await headers();
  // x-real-ip est posé par Vercel (fiable) ; sinon l'entrée la plus à DROITE
  // de x-forwarded-for (celle ajoutée par notre edge — la gauche est fournie
  // par le client et spoofable, cf. audit M2).
  const real = h.get('x-real-ip');
  if (real) return real.trim();
  const xff = h.get('x-forwarded-for');
  if (xff) {
    const parts = xff.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return 'unknown';
}

/**
 * Origine CANONIQUE des liens envoyés par email. Épinglée sur
 * NEXT_PUBLIC_SITE_URL (audit M3 — ne jamais dériver un lien email des
 * en-têtes Origin/Host, contrôlables) ; fallback en-têtes pour le dev local.
 * Second garde-fou : l'allowlist « Redirect URLs » du dashboard Supabase.
 */
async function emailLinkOrigin(): Promise<string> {
  const pinned = process.env.NEXT_PUBLIC_SITE_URL;
  if (pinned) return pinned.replace(/\/$/, '');
  const h = await headers();
  const host = h.get('x-forwarded-host') || h.get('host') || 'dishrank.fr';
  const proto = h.get('x-forwarded-proto') || 'https';
  return `${proto}://${host}`;
}

/**
 * N'autorise que des chemins relatifs INTERNES (anti open-redirect).
 * Rejette aussi les backslashes : le parseur WHATWG normalise `\` en `/`,
 * donc `/\evil.com` redirigerait hors-domaine (audit M1).
 */
function safeNext(raw: FormDataEntryValue | null, fallback = '/pro'): string {
  const v = typeof raw === 'string' ? raw : '';
  return v.startsWith('/') && !v.startsWith('//') && !v.includes('\\') ? v : fallback;
}

function captchaToken(formData: FormData): string | undefined {
  const t = formData.get('cf-turnstile-response');
  return typeof t === 'string' && t ? t : undefined;
}

const RETRY_FR = (s: number) => `Trop de tentatives. Réessaie dans ${s} s.`;

// ─── Connexion ────────────────────────────────────────────────────────────────
export async function signInAction(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) return { error: 'Email et mot de passe requis.' };

  const ip = await clientIp();
  const [byIp, byEmail] = await Promise.all([
    rateLimit(`pro:login:ip:${ip}`, 10, 60_000),
    rateLimit(`pro:login:email:${email}`, 5, 60_000),
  ]);
  if (!byIp.ok || !byEmail.ok) return { error: RETRY_FR(Math.max(byIp.retryAfter, byEmail.retryAfter)) };

  const supabase = await getSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: { captchaToken: captchaToken(formData) },
  });
  if (error) return { error: mapAuthErrorFr(error) };

  await logProEvent(supabase, 'pro_login');
  redirect(safeNext(formData.get('next')));
}

// ─── Inscription ──────────────────────────────────────────────────────────────
export async function signUpAction(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const displayName = String(formData.get('displayName') ?? '').trim();

  if (!email || !password) return { error: 'Email et mot de passe requis.' };
  if (!isPasswordValid(password)) {
    return { error: 'Mot de passe trop faible (8 caractères min., minuscule, majuscule, chiffre et symbole).' };
  }

  const ip = await clientIp();
  const [byIp, byEmail] = await Promise.all([
    rateLimit(`pro:signup:ip:${ip}`, 5, 3_600_000),
    // Limite PAR EMAIL aussi (audit M2) : l'IP est contournable, pas la cible
    // — bloque l'email-bombing d'une victime via le formulaire d'inscription.
    rateLimit(`pro:signup:email:${email}`, 3, 3_600_000),
  ]);
  if (!byIp.ok || !byEmail.ok) return { error: RETRY_FR(Math.max(byIp.retryAfter, byEmail.retryAfter)) };

  const origin = await emailLinkOrigin();
  const supabase = await getSupabaseServer();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // display_name : consommé par handle_new_user (même contrat que l'app).
      // Sans nom fourni, le profil reste display_name NULL — l'app y verrait
      // un onboarding en cours, l'espace pro s'en accommode (compte unique D3).
      data: displayName ? { display_name: displayName } : undefined,
      emailRedirectTo: `${origin}/pro/callback?next=${encodeURIComponent('/pro')}`,
      captchaToken: captchaToken(formData),
    },
  });
  // Anti-énumération (audit B1) : « compte déjà existant » reçoit exactement
  // la même réponse qu'une inscription réussie — le formulaire ne doit pas
  // servir d'oracle d'existence de compte.
  if (error && !/already (?:been )?registered|already exists/i.test(error.message ?? '')) {
    return { error: mapAuthErrorFr(error) };
  }

  return {
    ok: true,
    message: 'Compte créé ! Vérifie ta boîte mail pour confirmer ton adresse, puis connecte-toi.',
  };
}

// ─── Mot de passe oublié (demande d'email) ────────────────────────────────────
export async function requestPasswordResetAction(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!email) return { error: 'Email requis.' };

  const ip = await clientIp();
  const [byIp, byEmail] = await Promise.all([
    rateLimit(`pro:reset:ip:${ip}`, 5, 3_600_000),
    rateLimit(`pro:reset:email:${email}`, 3, 3_600_000),
  ]);
  if (!byIp.ok || !byEmail.ok) return { error: RETRY_FR(Math.max(byIp.retryAfter, byEmail.retryAfter)) };

  const origin = await emailLinkOrigin();
  const supabase = await getSupabaseServer();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/pro/callback?next=${encodeURIComponent('/pro/reset/update')}`,
    captchaToken: captchaToken(formData),
  });
  // Anti-énumération : même réponse que l'email existe ou non (GoTrue ne
  // divulgue rien non plus) — on n'expose que les erreurs techniques (429…).
  if (error && !/user not found/i.test(error.message ?? '')) {
    return { error: mapAuthErrorFr(error) };
  }
  return {
    ok: true,
    message: 'Si un compte existe avec cet email, tu recevras un lien de réinitialisation dans quelques instants.',
  };
}

// ─── Nouveau mot de passe (session recovery ouverte via /pro/callback) ────────
export async function updatePasswordAction(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  if (password !== confirm) return { error: 'Les deux mots de passe ne correspondent pas.' };
  if (!isPasswordValid(password)) {
    return { error: 'Mot de passe trop faible (8 caractères min., minuscule, majuscule, chiffre et symbole).' };
  }

  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Session expirée — redemande un lien de réinitialisation.' };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: mapAuthErrorFr(error) };

  redirect('/pro?pwd=updated');
}

// ─── Déconnexion ──────────────────────────────────────────────────────────────
export async function signOutAction(): Promise<void> {
  const supabase = await getSupabaseServer();
  // scope local : ne révoque que cette session navigateur, pas celle de l'app.
  await supabase.auth.signOut({ scope: 'local' });
  redirect('/pro/login');
}
