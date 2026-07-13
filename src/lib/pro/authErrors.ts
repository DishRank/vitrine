/**
 * Erreurs auth → messages FR + politique de mot de passe.
 *
 * Port fidèle de `dishrank/lib/auth.ts:80-181` (mapAuthError + checkPassword).
 * L'espace pro est FR-only au lancement (D1 du plan espace-pro-web) : on mappe
 * directement vers des chaînes FR au lieu de clés i18n. Garder la politique
 * synchronisée avec le dashboard Supabase (Auth → Policies : min 8, minuscule,
 * majuscule, chiffre, symbole) ET avec l'app mobile.
 */

const FR: Record<string, string> = {
  signupFailed:
    "L'inscription a échoué (email de confirmation impossible à envoyer). Réessaie dans quelques minutes.",
  emailAlreadyRegistered: 'Un compte existe déjà avec cet email. Connecte-toi ou réinitialise ton mot de passe.',
  emailNotConfirmed: "Ton email n'est pas encore confirmé — vérifie ta boîte mail (et les spams).",
  invalidCredentials: 'Email ou mot de passe incorrect.',
  tooManyAttempts: 'Trop de tentatives. Patiente une minute puis réessaie.',
  weakPassword: 'Mot de passe trop faible (8 caractères min., minuscule, majuscule, chiffre et symbole).',
  emailInvalid: 'Adresse email invalide.',
  serverUnavailable: 'Serveur injoignable. Vérifie ta connexion et réessaie.',
  captchaFailed: 'La vérification anti-robot a échoué. Recharge la page et réessaie.',
  genericError: "Une erreur est survenue. Réessaie, ou contacte-nous si ça persiste.",
};

export function mapAuthErrorFr(error: unknown): string {
  const raw =
    (error as { message?: string } | null)?.message ??
    (typeof error === 'string' ? error : '') ??
    '';
  const msg = raw.toLowerCase();
  const status = (error as { status?: number } | null)?.status;

  if (
    msg.includes('hook') ||
    msg.includes('error sending confirmation') ||
    msg.includes('error sending') ||
    msg.includes('confirmation email') ||
    msg.includes('database error saving new user')
  ) {
    return FR.signupFailed;
  }
  if (msg.includes('already registered') || msg.includes('already been registered') || msg.includes('user already exists')) {
    return FR.emailAlreadyRegistered;
  }
  if (msg.includes('email not confirmed')) return FR.emailNotConfirmed;
  if (msg.includes('invalid login') || msg.includes('invalid_credentials') || msg.includes('invalid credentials')) {
    return FR.invalidCredentials;
  }
  if (msg.includes('captcha')) return FR.captchaFailed;
  if (msg.includes('too many') || msg.includes('rate limit') || status === 429) {
    return FR.tooManyAttempts;
  }
  if (msg.includes('weak password') || msg.includes('password should be') || msg.includes('password is too short')) {
    return FR.weakPassword;
  }
  if (msg.includes('email') && msg.includes('invalid')) return FR.emailInvalid;
  if (
    msg.includes('network request failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('timeout') ||
    msg.includes('fetch') ||
    msg === ''
  ) {
    return FR.serverUnavailable;
  }
  return FR.genericError;
}

// ─── Politique de mot de passe (miroir du dashboard Supabase) ────────────────
export const PASSWORD_MIN_LENGTH = 8;
const SYMBOL_RE = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?`~]/;

export interface PasswordCheck {
  minLength: boolean;
  lowercase: boolean;
  uppercase: boolean;
  digit: boolean;
  symbol: boolean;
}

export function checkPassword(pw: string): PasswordCheck {
  return {
    minLength: pw.length >= PASSWORD_MIN_LENGTH,
    lowercase: /[a-z]/.test(pw),
    uppercase: /[A-Z]/.test(pw),
    digit: /[0-9]/.test(pw),
    symbol: SYMBOL_RE.test(pw),
  };
}

export function isPasswordValid(pw: string): boolean {
  const c = checkPassword(pw);
  return c.minLength && c.lowercase && c.uppercase && c.digit && c.symbol;
}

export const PASSWORD_RULES_FR: Record<keyof PasswordCheck, string> = {
  minLength: '8 caractères minimum',
  lowercase: 'une minuscule',
  uppercase: 'une majuscule',
  digit: 'un chiffre',
  symbol: 'un symbole (!@#$…)',
};
