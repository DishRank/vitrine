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
  fiche_revendiquee: { rang: 0, fait: 'a revendiqué sa fiche', quoi: 'Client potentiel : envoie la réponse prête dans l’heure.' },
  publication: { rang: 1, fait: 'a publié ses allergènes sur sa carte', quoi: 'Client actif : envoie la réponse prête, propose l’appel.' },
  clic_revendiquer: {
    rang: 2,
    fait: 'a cliqué « revendiquer ma fiche »',
    quoi: 'Très chaud : s’il n’a pas fini dans l’heure, envoie la réponse prête.',
  },
  impression: {
    rang: 3,
    fait: 'a imprimé son tableau',
    quoi: 'Chaud : envoie la réponse prête aujourd’hui.',
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

const SIGNATURE = '\n\nBonne journée,\nGrégoire Raturat\nDishRank — dishrank.fr';

/**
 * Réponse prête pour les signaux chauds : Greg n'a qu'à relire et envoyer.
 * Jamais de « j'ai vu que vous avez… » (le suivi n'a pas à se voir) ; une
 * question ouverte pour apprendre ce que le restaurateur paierait.
 */
export function brouillon(r: AlertRow): { subject: string; body: string } | null {
  const nom = r.restaurant_name;
  switch (r.kind) {
    case 'impression':
      return {
        subject: `Votre tableau des allergènes — ${nom}`,
        body:
          `Bonjour,\n\nJe reviens vers vous au sujet du tableau des allergènes de ${nom} : est-ce qu'il vous a été utile ?\n\n` +
          `Deux questions, si vous avez une minute :\n` +
          `– il manquait quelque chose (un plat, une recette, une version en anglais pour les touristes) ?\n` +
          `– quand votre carte change, vous préférez refaire le tableau vous-même, ou qu'on le tienne à jour pour vous ?\n\n` +
          `Vos réponses m'aident à l'améliorer.` +
          SIGNATURE,
      };
    case 'clic_revendiquer':
      if (r.claimed) return null;
      return {
        subject: `Votre fiche ${nom} sur DishRank`,
        body:
          `Bonjour,\n\nUn mot au cas où : pour revendiquer la fiche de ${nom} (gratuit), le code de vérification part sur l'adresse à laquelle je vous ai écrit. ` +
          `S'il n'arrive pas, ou si vous préférez utiliser une autre adresse, répondez simplement à ce message et je m'en occupe.` +
          SIGNATURE,
      };
    case 'fiche_revendiquee':
      return {
        subject: `Bienvenue sur DishRank — ${nom}`,
        body:
          `Bonjour,\n\nBienvenue ! La fiche de ${nom} est maintenant à vous.\n\n` +
          `Si vous voulez, je publie avec vous les allergènes vérifiés sur votre carte en ligne et je vous envoie le QR code à poser sur les tables : ` +
          `vos clients filtrent « sans gluten », « sans lait »… depuis leur téléphone.\n\n` +
          `Vous auriez 10 minutes cette semaine pour un appel ? Dites-moi le créneau qui vous arrange.` +
          SIGNATURE,
      };
    case 'publication':
      return {
        subject: `Vos allergènes sont en ligne — ${nom}`,
        body:
          `Bonjour,\n\nVos allergènes sont publiés sur la carte de ${nom}. Il ne reste qu'à poser le QR code sur les tables ` +
          `(dans votre espace, rubrique « Partage ») ; je peux aussi vous l'envoyer prêt à imprimer.\n\n` +
          `Une question : qu'est-ce qui vous serait le plus utile ensuite ?` +
          SIGNATURE,
      };
    default:
      return null;
  }
}

function mailto(to: string, d: { subject: string; body: string }): string {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(d.subject)}&body=${encodeURIComponent(d.body.replace(/\n/g, '\r\n'))}`;
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

  const drafts = tri.map((r) => (r.email ? brouillon(r) : null));
  const text =
    blocs
      .map((l, i) => {
        const d = drafts[i];
        return d ? `${l.join('\n')}\n\nRéponse prête — objet : ${d.subject}\n${d.body}` : l.join('\n');
      })
      .join('\n\n────────\n\n') + '\n\n— Alerte automatique (campagne tableau des allergènes)\n';
  const font = 'font:14px/1.5 -apple-system,Segoe UI,sans-serif;color:#1c1b1f';
  const html =
    blocs
      .map((l, i) => {
        const r = tri[i];
        const d = drafts[i];
        const reponse =
          d && r.email
            ? `<div style="margin:10px 0 0;padding:12px;border-radius:10px;background:#f4f1ec;${font}">` +
              `<a href="${esc(mailto(r.email, d))}" style="display:inline-block;margin-bottom:8px;padding:8px 14px;border-radius:8px;background:#c2410c;color:#fff;font-weight:700;text-decoration:none">✉️ Répondre avec ce message</a>` +
              `<div style="color:#555;font-size:13px"><strong>${esc(d.subject)}</strong><br>${esc(d.body).replace(/\n/g, '<br>')}</div></div>`
            : '';
        return `<div style="margin:0 0 22px;${font}"><strong>${esc(l[0])}</strong><br>${esc(l[1])}<br><span style="color:#555">${esc(
          l[2]
        )}</span>${reponse}</div>`;
      })
      .join('') + '<p style="font:12px sans-serif;color:#888">Alerte automatique (campagne tableau des allergènes)</p>';
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
