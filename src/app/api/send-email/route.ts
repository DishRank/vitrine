import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST || 'ssl0.ovh.net';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '465');
const SMTP_USER = process.env.SMTP_USER || 'noreply@dishrank.fr';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SENDER_NAME = process.env.SMTP_SENDER_NAME || 'DishRank';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yztbhdvrvgozhyaujtjz.supabase.co';
const SITE_URL = process.env.SITE_URL || 'dishrank://';
const LOGO_URL = `${SUPABASE_URL}/storage/v1/object/public/assets/logo.png`;

/* ================================================================
   SMTP transport
   ================================================================ */

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: true,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

/* ================================================================
   Email templates (from Supabase dashboard)
   ================================================================ */

function getEmail(type: string, confirmUrl: string): { subject: string; html: string } {
  const templates: Record<string, { subject: string; heading: string; text: string; button: string; footer: string }> = {
    signup: {
      subject: 'Confirmez votre email - DishRank',
      heading: 'Bienvenue sur DishRank !',
      text: 'Confirmez votre adresse email pour commencer \u00e0 noter vos plats pr\u00e9f\u00e9r\u00e9s.',
      button: 'Confirmer mon email',
      footer: 'Si vous n\u2019avez pas cr\u00e9\u00e9 de compte DishRank, ignorez cet email.',
    },
    magiclink: {
      subject: 'Connexion rapide - DishRank',
      heading: 'Connexion rapide',
      text: 'Cliquez ci-dessous pour vous connecter \u00e0 DishRank.',
      button: 'Se connecter',
      footer: 'Ce lien expire dans 1 heure. Si vous n\u2019avez pas demand\u00e9 cette connexion, ignorez cet email.',
    },
    recovery: {
      subject: 'Mot de passe oubli\u00e9 ? - DishRank',
      heading: 'Mot de passe oubli\u00e9 ?',
      text: 'Cliquez ci-dessous pour choisir un nouveau mot de passe.',
      button: 'R\u00e9initialiser le mot de passe',
      footer: 'Si vous n\u2019avez pas demand\u00e9 cette r\u00e9initialisation, ignorez cet email. Votre mot de passe ne sera pas modifi\u00e9.',
    },
    email_change: {
      subject: 'Changement d\u2019email - DishRank',
      heading: 'Changement d\u2019email',
      text: 'Confirmez votre nouvelle adresse email pour finaliser le changement.',
      button: 'Confirmer le changement',
      footer: 'Si vous n\u2019avez pas demand\u00e9 ce changement, contactez-nous imm\u00e9diatement.',
    },
  };

  const t = templates[type] || templates.signup;

  const html = `<div style="max-width:480px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#1A1A2E;border-radius:16px;overflow:hidden;color:#EEEEF0">
  <div style="text-align:center;padding:32px 24px 16px">
    <img src="${LOGO_URL}" alt="DishRank" width="120" style="display:inline-block"/>
  </div>
  <div style="padding:0 32px 32px">
    <h1 style="font-size:22px;margin:0 0 8px;color:#FFFFFF;text-align:center">${t.heading}</h1>
    <p style="font-size:15px;line-height:1.6;color:#B0B0C0;text-align:center;margin:0 0 24px">${t.text}</p>
    <div style="text-align:center">
      <a href="${confirmUrl}" style="display:inline-block;background:#6C5CE7;color:#FFFFFF;font-size:16px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:12px">${t.button}</a>
    </div>
    <p style="font-size:12px;color:#707080;text-align:center;margin:24px 0 0">${t.footer}</p>
  </div>
</div>`;

  return { subject: t.subject, html };
}

/* ================================================================
   POST handler — called by Supabase Auth Hook
   ================================================================ */

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    const email = payload.user?.email || payload.email;
    const emailData = payload.email_data || {};
    const token = emailData.token_hash || emailData.token || '';
    const actionType = emailData.email_action_type || 'signup';
    const redirectTo = emailData.redirect_to || SITE_URL;

    if (!email) {
      return NextResponse.json({ error: 'No email provided' }, { status: 400 });
    }

    // Build the confirmation URL like Supabase does
    const confirmUrl = `${SUPABASE_URL}/auth/v1/verify?token=${token}&type=${actionType}&redirect_to=${encodeURIComponent(redirectTo)}`;

    const { subject, html } = getEmail(actionType, confirmUrl);

    await transporter.sendMail({
      from: `${SENDER_NAME} <${SMTP_USER}>`,
      to: email,
      subject,
      html,
    });

    console.log(`[send-email] Sent ${actionType} to ${email}`);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[send-email] Error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
