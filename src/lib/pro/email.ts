import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Emails transactionnels de l'espace pro (lot 4.4). Consolidation sur Brevo
 * (même clé que l'edge fn claim-verify), sender no-reply@dishrank.fr.
 *
 * Server-only : n'importe jamais de secret côté client.
 */

const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const BREVO_SENDER = process.env.BREVO_SENDER || 'no-reply@dishrank.fr';
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME || 'DishRank';
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://dishrank.fr';
// Secret HMAC des liens de désabonnement (fallback CRON_SECRET pour ne pas
// exiger une nouvelle variable en préprod).
const UNSUB_SECRET = process.env.PRO_EMAIL_SECRET || process.env.CRON_SECRET || '';

export interface SendResult {
  ok: boolean;
  skipped?: boolean;
  error?: string;
}

/** Envoi via l'API transactionnelle Brevo. Sans clé (préprod) → skipped:true. */
export async function sendOwnerEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendResult> {
  if (!BREVO_API_KEY) return { ok: false, skipped: true };
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: BREVO_SENDER_NAME, email: BREVO_SENDER },
        to: [{ email: opts.to }],
        subject: opts.subject,
        htmlContent: opts.html,
        textContent: opts.text,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ok: false, error: `brevo ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ── Désabonnement (lien one-click, sans login) ───────────────────────────────

export function unsubToken(uid: string): string {
  return createHmac('sha256', UNSUB_SECRET).update(`digest:${uid}`).digest('hex').slice(0, 32);
}

export function verifyUnsubToken(uid: string, token: string): boolean {
  if (!UNSUB_SECRET || !token) return false;
  const expected = unsubToken(uid);
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function unsubUrl(uid: string): string {
  return `${SITE}/api/pro/email/unsubscribe?u=${uid}&t=${unsubToken(uid)}`;
}

// ── Gabarit du digest « avis à répondre » ────────────────────────────────────

export interface DigestItem {
  restaurant: string;
  restaurant_id: string;
  count: number;
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

export function buildDigestEmail(uid: string, items: DigestItem[]): { subject: string; html: string; text: string } {
  const total = items.reduce((s, i) => s + i.count, 0);
  const plural = total > 1 ? 's' : '';
  const subject = `${total} nouvel${plural === 's' ? 'x' : ''} avis à répondre sur DishRank`;
  const unsub = unsubUrl(uid);

  const rows = items
    .map(
      (i) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #EBE4D8">${esc(i.restaurant)}</td>` +
        `<td style="padding:8px 0;border-bottom:1px solid #EBE4D8;text-align:right;font-weight:700">${i.count} avis</td></tr>`
    )
    .join('');

  const html =
    `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto;color:#2A241E">` +
    `<h2 style="color:#6C5CE7;margin-bottom:4px">DishRank <span style="font-weight:400">Pro</span></h2>` +
    `<p>Vos clients ont laissé <strong>${total} nouvel${plural === 's' ? 'x' : ''} avis</strong> sans réponse${items.length > 1 ? ' sur vos établissements' : ''} :</p>` +
    `<table style="width:100%;border-collapse:collapse;margin:12px 0">${rows}</table>` +
    `<p style="margin:20px 0">` +
    `<a href="${SITE}/pro" style="background:#6C5CE7;color:#fff;text-decoration:none;padding:12px 22px;border-radius:12px;font-weight:700;display:inline-block">Répondre aux avis</a>` +
    `</p>` +
    `<p style="color:#8C8478;font-size:12px;margin-top:24px">Répondre publiquement montre à vos clients que vous êtes à l'écoute — et améliore votre image sur DishRank.</p>` +
    `<p style="color:#B2AEA6;font-size:11px;margin-top:16px">Vous recevez cet email en tant que responsable d'établissement sur DishRank. ` +
    `<a href="${unsub}" style="color:#B2AEA6">Ne plus recevoir ces rappels</a>.</p>` +
    `</div>`;

  const text =
    `DishRank Pro\n\nVos clients ont laissé ${total} nouvel${plural === 's' ? 'x' : ''} avis sans réponse :\n` +
    items.map((i) => `- ${i.restaurant} : ${i.count} avis`).join('\n') +
    `\n\nRépondre : ${SITE}/pro\n\nSe désabonner : ${unsub}`;

  return { subject, html, text };
}
