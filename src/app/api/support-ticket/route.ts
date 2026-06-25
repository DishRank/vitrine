// Forwards a support ticket (already inserted in `support_tickets` by the
// app) to contact@dishrank.fr via the OVH Zimbra SMTP relay.
//
// The mobile app calls this route right after the row is inserted, with
// the ticket id. We re-fetch the row server-side (using the service role)
// so the email always reflects canonical DB state, including the author's
// auth email. We also verify the caller is the ticket's author so an
// authenticated user can only mail their own tickets.
//
// Lives on Vercel (vitrine) instead of a Supabase Edge Function so we
// don't burn the Supabase Edge invocation quota on a low-traffic flow.
//
// Required env vars (Vercel project settings):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   SUPABASE_ANON_KEY               (for verifyAuth)
//   SMTP_HOST                       e.g. ssl0.ovh.net
//   SMTP_PORT                       587 (STARTTLS) or 465 (SSL)
//   SMTP_USERNAME                   contact@dishrank.fr
//   SMTP_PASSWORD                   mailbox password
//   SMTP_FROM                       defaults to SMTP_USERNAME
//   SMTP_TO                         defaults to SMTP_FROM

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { getAuthenticatedUserId } from '@/lib/verifyAuth';
import { getCorsHeaders } from '@/lib/cors';

const CATEGORY_LABEL: Record<string, string> = {
  question: '❓ Question',
  problem: '⚠️ Problème',
  bug: '🐛 Bug',
  feature: '💡 Suggestion',
  other: '💬 Autre',
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { headers: getCorsHeaders(request) });
}

export async function POST(request: Request) {
  const cors = getCorsHeaders(request);

  const userId = await getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: cors });
  }

  const body = await request.json().catch(() => null);
  const ticketId = body?.ticket_id;
  if (!ticketId || typeof ticketId !== 'string') {
    return NextResponse.json({ error: 'ticket_id required' }, { status: 400, headers: cors });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500, headers: cors });
  }
  const admin = createClient(supabaseUrl, serviceKey);

  const { data: ticket, error: tErr } = await admin
    .from('support_tickets')
    .select('id, user_id, category, message, screenshot_url, device_info, created_at')
    .eq('id', ticketId)
    .single();
  if (tErr || !ticket) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404, headers: cors });
  }
  // Author check — caller can only mail their own ticket
  if (ticket.user_id !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: cors });
  }

  // Author display_name + auth email for the message header
  const { data: profile } = await admin
    .from('profiles')
    .select('display_name')
    .eq('id', ticket.user_id)
    .maybeSingle();
  const { data: authResp } = await admin.auth.admin.getUserById(ticket.user_id);
  const authorEmail = authResp?.user?.email ?? null;
  const authorName = profile?.display_name || authorEmail || ticket.user_id;

  // SMTP config
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || '587');
  const username = process.env.SMTP_USERNAME;
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM || username;
  const to = process.env.SMTP_TO || from;
  if (!host || !username || !password || !from || !to) {
    return NextResponse.json({ error: 'SMTP not configured' }, { status: 500, headers: cors });
  }

  // Strip CR/LF from values interpolated into the Subject header as a
  // defense-in-depth measure against SMTP header injection (nodemailer also
  // encodes headers, but never trust a single layer).
  const oneLine = (s: string) => String(s ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, 200);
  const subject = `[Support] ${oneLine(CATEGORY_LABEL[ticket.category] || ticket.category)} — ${oneLine(authorName)}`;
  const device = (ticket.device_info as { platform?: string; version?: string | number } | null) || {};

  const text = [
    `Catégorie : ${CATEGORY_LABEL[ticket.category] || ticket.category}`,
    `De        : ${authorName}${authorEmail ? ` <${authorEmail}>` : ''}`,
    `User ID   : ${ticket.user_id}`,
    `Ticket ID : ${ticket.id}`,
    `Date      : ${ticket.created_at}`,
    `Plateforme: ${`${device.platform || '?'} ${device.version || ''}`.trim()}`,
    ticket.screenshot_url ? `Screenshot: ${ticket.screenshot_url}` : '',
    '',
    '— Message —',
    ticket.message || '(vide)',
  ].filter(Boolean).join('\n');

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:640px;line-height:1.5;color:#222;">
      <h2 style="margin:0 0 8px;color:#6C5CE7;">Nouveau ticket support</h2>
      <p style="margin:0 0 16px;color:#666;font-size:13px;">${escapeHtml(CATEGORY_LABEL[ticket.category] || ticket.category)}</p>
      <table style="border-collapse:collapse;font-size:13px;color:#333;">
        <tr><td style="padding:4px 12px 4px 0;color:#888;">De</td><td>${escapeHtml(authorName)}${authorEmail ? ` &lt;${escapeHtml(authorEmail)}&gt;` : ''}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#888;">User ID</td><td><code>${escapeHtml(ticket.user_id)}</code></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#888;">Ticket ID</td><td><code>${escapeHtml(ticket.id)}</code></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#888;">Date</td><td>${escapeHtml(ticket.created_at)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#888;">Plateforme</td><td>${escapeHtml(`${device.platform || '?'} ${device.version || ''}`.trim())}</td></tr>
        ${ticket.screenshot_url ? `<tr><td style="padding:4px 12px 4px 0;color:#888;">Screenshot</td><td><a href="${escapeHtml(ticket.screenshot_url)}">Ouvrir</a></td></tr>` : ''}
      </table>
      <h3 style="margin:24px 0 8px;font-size:14px;color:#444;">Message</h3>
      <div style="background:#f7f6fc;border-radius:8px;padding:14px;white-space:pre-wrap;font-size:14px;">${escapeHtml(ticket.message || '(vide)')}</div>
    </div>
  `;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 465 = TLS implicit, 587 = STARTTLS via secure:false
    auth: { user: username, pass: password },
  });

  try {
    await transporter.sendMail({
      from,
      to,
      // Hitting "Reply" in the inbox writes back to the actual user
      replyTo: authorEmail || from,
      subject,
      text,
      html,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `SMTP send failed: ${(err as Error).message}` },
      { status: 502, headers: cors },
    );
  }

  return NextResponse.json({ ok: true }, { headers: cors });
}
