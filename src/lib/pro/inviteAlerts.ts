import { getSupabaseServiceClient } from '@/lib/supabase';
import { sendOwnerEmail } from '@/lib/pro/email';

/**
 * Alertes « prospect chaud » (mig. 199). La base remplit `invite_alerts` par
 * trigger quand un restaurant invité franchit une étape (une seule fois par
 * étape) ; ce module vide la file et envoie UN mail à l'équipe. Appelé en
 * `after()` par les actions de la page des allergènes et de la revendication :
 * la réponse au restaurateur n'attend jamais le SMTP.
 *
 * Destinataire : PRO_ALERT_EMAIL, sinon la boîte qui reçoit déjà les tickets
 * support (SMTP_TO), sinon l'expéditeur.
 */

type Kind =
  | 'ouverture'
  | 'premier_plat'
  | 'impression'
  | 'clic_revendiquer'
  | 'publication'
  | 'fiche_revendiquee'
  | 'desinscription'
  | 'retrait_carte';

interface AlertRow {
  id: number;
  kind: Kind;
  created_at: string;
  campaign: string;
  email: string | null;
  restaurant_id: string;
  restaurant_name: string;
  city: string | null;
  open_count: number;
  confirmed_count: number;
  items: number;
  claimed: boolean;
}

// Ordre = chaleur du signal (le plus chaud en tête du mail).
const KINDS: Record<Kind, { rang: number; fait: string; quoi: string }> = {
  fiche_revendiquee: { rang: 0, fait: 'a revendiqué sa fiche', quoi: 'Client potentiel : écris-lui dans l’heure.' },
  publication: { rang: 1, fait: 'a publié ses allergènes sur sa carte', quoi: 'Client actif : prends contact pour la suite.' },
  clic_revendiquer: {
    rang: 2,
    fait: 'a cliqué « revendiquer ma fiche »',
    quoi: 'Très chaud : s’il ne va pas au bout, écris-lui pour l’aider.',
  },
  impression: {
    rang: 3,
    fait: 'a imprimé son tableau',
    quoi: 'Chaud : écris-lui aujourd’hui (merci + afficher les allergènes sur son menu QR).',
  },
  premier_plat: { rang: 4, fait: 'a vérifié son premier plat', quoi: 'Il s’en sert. Rien à faire pour l’instant.' },
  ouverture: { rang: 5, fait: 'a ouvert son tableau', quoi: 'Signal tiède. Rien à faire.' },
  desinscription: { rang: 6, fait: 'ne veut plus être contacté', quoi: 'Déjà coupé automatiquement. Rien à faire.' },
  retrait_carte: { rang: 7, fait: 'a retiré sa carte', quoi: 'Négatif. Déjà retirée et bloquée. Rien à faire.' },
};

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://dishrank.fr';

function destinataire(): string | null {
  return process.env.PRO_ALERT_EMAIL || process.env.SMTP_TO || process.env.SMTP_FROM || process.env.SMTP_USERNAME || null;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function heure(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
}

export function composeAlertEmail(rows: AlertRow[]): { subject: string; text: string; html: string } {
  const tri = [...rows].sort((a, b) => KINDS[a.kind].rang - KINDS[b.kind].rang || a.id - b.id);
  const test = (r: AlertRow) => (r.campaign.startsWith('allergenes-') ? '' : ` [${r.campaign}]`);
  const top = tri[0];
  const subject =
    rows.length === 1
      ? `DishRank · ${top.restaurant_name} ${KINDS[top.kind].fait}${test(top)}`
      : `DishRank · ${rows.length} signaux — ${top.restaurant_name} ${KINDS[top.kind].fait}`;

  const blocs = tri.map((r) => {
    const k = KINDS[r.kind];
    const lignes = [
      `${r.restaurant_name}${r.city ? ` (${r.city})` : ''} ${k.fait} — ${heure(r.created_at)}${test(r)}`,
      `→ ${k.quoi}`,
      `Contact : ${r.email ?? 'inconnu'} · page ouverte ${r.open_count} fois · ${r.confirmed_count}/${r.items} plats vérifiés${
        r.claimed ? ' · fiche revendiquée' : ''
      }`,
      `Fiche : ${SITE}/restaurant/${r.restaurant_id}`,
    ];
    return lignes;
  });

  const text = blocs.map((l) => l.join('\n')).join('\n\n') + '\n\n— Alerte automatique (campagne tableau des allergènes)\n';
  const html =
    blocs
      .map(
        (l) =>
          `<p style="margin:0 0 16px;font:14px/1.5 -apple-system,Segoe UI,sans-serif;color:#1c1b1f"><strong>${esc(l[0])}</strong><br>${esc(
            l[1]
          )}<br><span style="color:#555">${esc(l[2])}</span></p>`
      )
      .join('') +
    '<p style="font:12px sans-serif;color:#888">Alerte automatique (campagne tableau des allergènes)</p>';
  return { subject, text, html };
}

/** Vide la file d'alertes. Ne lève jamais : une alerte ratée repart au prochain appel. */
export async function flushInviteAlerts(): Promise<void> {
  const to = destinataire();
  if (!to) return;
  let supabase;
  try {
    supabase = getSupabaseServiceClient();
  } catch {
    return;
  }
  const { data, error } = await supabase.rpc('invite_alerts_take', { p_limit: 20 });
  if (error || !Array.isArray(data) || data.length === 0) return;
  const rows = data as AlertRow[];
  const mail = composeAlertEmail(rows);
  const res = await sendOwnerEmail({ to, ...mail });
  if (!res.ok) {
    await supabase.rpc('invite_alerts_release', { p_ids: rows.map((r) => r.id) });
  }
}
