'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSupabaseServer } from '@/lib/pro/supabaseServer';
import { mapAuthErrorFr, isPasswordValid } from '@/lib/pro/authErrors';
import { rateLimit } from '@/lib/pro/rateLimit';
import { logProEvent } from '@/lib/pro/instrument';
import { safeNextPath } from '@/lib/pro/safeNext';

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

/** N'autorise que des chemins relatifs INTERNES (anti open-redirect, cf. safeNextPath). */
function safeNext(raw: FormDataEntryValue | null, fallback = '/pro/espace'): string {
  return safeNextPath(raw, fallback);
}

function captchaToken(formData: FormData): string | undefined {
  const t = formData.get('cf-turnstile-response');
  return typeof t === 'string' && t ? t : undefined;
}

const RETRY_FR = (s: number) => `Trop de tentatives. Réessayez dans ${s} s.`;

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
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: { captchaToken: captchaToken(formData) },
  });
  if (error) return { error: mapAuthErrorFr(error) };

  const next = safeNext(formData.get('next'));
  // Compte avec un appareil de double authentification : direction la saisie
  // du code. Sans ce détour, la redirection de l'action vers la destination
  // était renvoyée sur /pro/mfa par le proxy pendant la requête RSC : la page
  // du code s'affichait, mais l'adresse restait celle de la destination (vu
  // par les tests Playwright, e2e/pro.spec.ts).
  // La connexion n'est journalisée qu'une fois complète : pour un compte 2FA,
  // par verifyMfaAction après le code (en aal1, la base refuse l'écriture et
  // l'événement était perdu).
  if (data.user?.factors?.some((f) => f.status === 'verified')) {
    redirect(`/pro/mfa?next=${encodeURIComponent(next)}`);
  }
  await logProEvent(supabase, 'pro_login');
  redirect(next);
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
      // Retour après confirmation : /pro/espace par défaut, ou le parcours en
      // cours (ex. revendication depuis le tableau des allergènes).
      emailRedirectTo: `${origin}/pro/callback?next=${encodeURIComponent(safeNext(formData.get('next')))}`,
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
    message: 'Compte créé ! Vérifiez votre boîte mail pour confirmer votre adresse, puis connectez-vous.',
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
    message: 'Si un compte existe avec cet email, vous recevrez un lien de réinitialisation dans quelques instants.',
  };
}

// ─── Connexion par lien magique (passwordless) ────────────────────────────────
export async function sendMagicLinkAction(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!email) return { error: 'Email requis.' };
  const next = safeNext(formData.get('next'));

  const ip = await clientIp();
  const [byIp, byEmail] = await Promise.all([
    rateLimit(`pro:magic:ip:${ip}`, 5, 3_600_000),
    rateLimit(`pro:magic:email:${email}`, 3, 3_600_000),
  ]);
  if (!byIp.ok || !byEmail.ok) return { error: RETRY_FR(Math.max(byIp.retryAfter, byEmail.retryAfter)) };

  const origin = await emailLinkOrigin();
  const supabase = await getSupabaseServer();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // Connexion uniquement : ne crée PAS de compte pour un email inconnu
      // (l'inscription a sa propre page). GoTrue renvoie alors une erreur
      // « signups not allowed » qu'on masque (anti-énumération).
      shouldCreateUser: false,
      emailRedirectTo: `${origin}/pro/callback?next=${encodeURIComponent(next)}`,
      captchaToken: captchaToken(formData),
    },
  });
  // Anti-énumération : succès identique que l'email existe ou non ; on ne
  // remonte que les erreurs techniques (429, captcha…).
  if (error && !/not allowed|not found|signup|otp_disabled/i.test(error.message ?? '')) {
    return { error: mapAuthErrorFr(error) };
  }
  return {
    ok: true,
    message: 'Si un compte existe avec cet email, vous recevrez un lien de connexion dans quelques instants.',
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
  if (!user) return { error: 'Session expirée — demandez un nouveau lien de réinitialisation.' };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: mapAuthErrorFr(error) };

  redirect('/pro/espace?pwd=updated');
}

// ─── Double authentification (session ouverte, en attente du code) ───────────
// Le proxy envoie sur /pro/mfa toute session `aal1` d'un compte qui a inscrit
// une appli de codes dans l'app mobile (la base refuse ses requêtes, mig. 211).
// Ici on ne fait que VÉRIFIER : l'inscription et les codes de secours restent
// dans l'app (Réglages → Double authentification).
export async function verifyMfaAction(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const code = String(formData.get('code') ?? '').replace(/\D/g, '');
  if (code.length !== 6) return { error: 'Le code fait 6 chiffres.' };
  const next = safeNext(formData.get('next'));

  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/pro/login');

  // 6 chiffres = 1 million de combinaisons : on borne les essais par compte
  // (l'IP seule se contourne). GoTrue a aussi sa propre limite.
  const ip = await clientIp();
  const [byIp, byUser] = await Promise.all([
    rateLimit(`pro:mfa:ip:${ip}`, 10, 60_000),
    rateLimit(`pro:mfa:user:${user.id}`, 5, 60_000),
  ]);
  if (!byIp.ok || !byUser.ok) return { error: RETRY_FR(Math.max(byIp.retryAfter, byUser.retryAfter)) };

  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError) return { error: mapAuthErrorFr(listError) };
  // Appareil le plus récemment utilisé d'abord (même ordre que l'app).
  const totp = [...(factors?.totp ?? [])].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  // Plus aucun appareil (retiré depuis l'app entre-temps) : rien à vérifier.
  // On rafraîchit d'abord la session en cookie : le proxy y lit encore
  // l'ancien appareil et renverrait ici jusqu'à expiration du jeton.
  if (!totp.length) {
    await supabase.auth.refreshSession();
    redirect(next);
  }

  for (const factor of totp) {
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    if (!error) {
      await logProEvent(supabase, 'pro_login');
      redirect(next);
    }
    // Mauvais code pour CET appareil : on essaie le suivant. Toute autre erreur
    // (limite atteinte, réseau…) arrête là.
    if (error.code !== 'mfa_verification_failed') {
      return {
        error:
          error.code === 'mfa_challenge_expired'
            ? 'Code expiré. Saisissez le code affiché maintenant.'
            : mapAuthErrorFr(error),
      };
    }
  }
  return {
    error: "Code incorrect. Saisissez le code affiché maintenant ; s'il est refusé, vérifiez l'heure du téléphone.",
  };
}

// ─── Déconnexion ──────────────────────────────────────────────────────────────
export async function signOutAction(): Promise<void> {
  const supabase = await getSupabaseServer();
  // scope local : ne révoque que cette session navigateur, pas celle de l'app.
  await supabase.auth.signOut({ scope: 'local' });
  redirect('/pro/login');
}
