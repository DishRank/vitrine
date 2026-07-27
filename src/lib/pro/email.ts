import { createHmac, timingSafeEqual } from 'node:crypto';
import nodemailer, { type Transporter } from 'nodemailer';

/**
 * Emails transactionnels de l'espace pro (lot 4.4). Relais SMTP OVH — MÊMES
 * variables d'env que la route `support-ticket` (SMTP_HOST/PORT/USERNAME/
 * PASSWORD/FROM/SENDER_NAME), donc rien de nouveau à configurer sur Vercel et
 * ZÉRO dépendance payante (pas de Brevo/SendGrid).
 *
 * Server-only : n'importe jamais de secret côté client.
 */

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://dishrank.fr';
// Secret HMAC des liens de désabonnement. On réutilise un secret DÉJÀ présent
// sur Vercel (INDEXNOW_TRIGGER_SECRET) pour ne pas exiger de variable dédiée ;
// PRO_EMAIL_SECRET reste prioritaire si un jour on veut l'isoler.
const UNSUB_SECRET =
  process.env.PRO_EMAIL_SECRET ||
  process.env.INDEXNOW_TRIGGER_SECRET ||
  process.env.CRON_SECRET ||
  '';

// Transporter réutilisé entre les envois de la boucle du digest (pool SMTP).
let _transporter: Transporter | null = null;
function getTransporter(): Transporter | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USERNAME;
  const pass = process.env.SMTP_PASSWORD;
  if (!host || !user || !pass) return null;
  if (!_transporter) {
    const port = Number(process.env.SMTP_PORT || '587');
    _transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // 465 = TLS implicite, 587 = STARTTLS
      auth: { user, pass },
    });
  }
  return _transporter;
}

export interface SendResult {
  ok: boolean;
  skipped?: boolean;
  error?: string;
}

/** Envoi via le relais SMTP OVH. Sans config SMTP (préprod) → skipped:true. */
export async function sendOwnerEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendResult> {
  const transporter = getTransporter();
  if (!transporter) return { ok: false, skipped: true };
  const senderName = process.env.SMTP_SENDER_NAME || 'DishRank';
  const fromAddr = process.env.SMTP_FROM || process.env.SMTP_USERNAME || '';
  try {
    await transporter.sendMail({
      from: `"${senderName}" <${fromAddr}>`,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });
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
    `<a href="${SITE}/pro/espace" style="background:#6C5CE7;color:#fff;text-decoration:none;padding:12px 22px;border-radius:12px;font-weight:700;display:inline-block">Répondre aux avis</a>` +
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
