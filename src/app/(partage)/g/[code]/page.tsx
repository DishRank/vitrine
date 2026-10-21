import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';
import { APP_STORE_URL, PLAY_STORE_URL } from '@/lib/downloadLinks';
import styles from '../../partage.module.css';
import AppFooter from '../../AppFooter';
import OpenAppButton from './OpenAppButton';

/**
 * /g/<code> — invitation à rejoindre un groupe (lien partagé depuis l'app).
 *
 * Le code DR-XXXXXX vient de `group_invites` (`create_group_invite`). La page
 * montre le groupe et le code en grand, et ouvre l'app sur `dishrank://g/<code>`
 * qui appelle `join_group_via_code`. Lecture serveur en service_role (comme
 * /join) : `group_invites` n'est lisible que par les membres via RLS, et on
 * n'expose que le nom du groupe, son émoji, le nombre de membres et le prénom
 * de la personne qui invite. Jamais de 500 : base injoignable → page générique
 * qui garde le code utilisable.
 */

const CODE_RE = /^DR-[A-Z0-9]{6}$/;

type InviteState = 'ok' | 'expired' | 'exhausted' | 'missing' | 'unknown';
type Invite = {
  state: InviteState;
  group: { name: string; emoji: string | null } | null;
  members: number | null;
  inviter: string | null;
  expiresAt: string | null;
};

const normalize = (raw: string) => decodeURIComponent(raw).toUpperCase().replace(/\s+/g, '');
const firstName = (s: string | null | undefined) => (s ?? '').trim().split(/\s+/)[0] || null;

function demoInvite(code: string): Invite | null {
  if (process.env.NODE_ENV === 'production' || !code.startsWith('DR-DEMO')) return null;
  return {
    state: code === 'DR-DEMOEX' ? 'expired' : 'ok',
    group: { name: 'Les copains du jeudi', emoji: '🍷' },
    members: 5,
    inviter: 'Léa',
    expiresAt: new Date(Date.now() + 6 * 86400_000).toISOString(),
  };
}

const getInvite = cache(async (code: string): Promise<Invite> => {
  const empty: Invite = { state: 'unknown', group: null, members: null, inviter: null, expiresAt: null };
  if (!CODE_RE.test(code)) return { ...empty, state: 'missing' };
  const demo = demoInvite(code);
  if (demo) return demo;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return empty;

  try {
    const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: inv, error } = await sb
      .from('group_invites')
      .select('group_id, created_by, max_uses, use_count, expires_at, revoked_at')
      .eq('code', code)
      .is('revoked_at', null)
      .limit(1)
      .maybeSingle();
    if (error) return empty;
    if (!inv) return { ...empty, state: 'missing' };

    const [{ data: group }, { count }, { data: profile }] = await Promise.all([
      sb.from('groups').select('name, emoji').eq('id', inv.group_id).maybeSingle(),
      sb.from('group_members').select('user_id', { count: 'exact', head: true }).eq('group_id', inv.group_id),
      inv.created_by
        ? sb.from('profiles').select('display_name').eq('id', inv.created_by).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const expired = !!inv.expires_at && new Date(inv.expires_at).getTime() < Date.now();
    const exhausted = inv.max_uses != null && inv.use_count >= inv.max_uses;
    return {
      state: expired ? 'expired' : exhausted ? 'exhausted' : 'ok',
      group: group ? { name: group.name as string, emoji: (group.emoji as string | null) ?? null } : null,
      members: count ?? null,
      inviter: firstName((profile as { display_name?: string | null } | null)?.display_name),
      expiresAt: inv.expires_at ?? null,
    };
  } catch {
    return empty;
  }
});

interface PageProps {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const code = normalize((await params).code);
  const inv = await getInvite(code);
  const groupName = inv.group ? `${inv.group.emoji ? `${inv.group.emoji} ` : ''}${inv.group.name}` : null;
  const title = groupName ? `Rejoins ${groupName} sur DishRank` : 'Rejoins un groupe sur DishRank';
  const description = inv.inviter
    ? `${inv.inviter} t’invite dans le groupe pour choisir ensemble où sortir manger.`
    : 'Un groupe pour choisir ensemble où sortir manger, d’après les meilleurs plats.';
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: 'DishRank',
      locale: 'fr_FR',
      images: [{ url: 'https://dishrank.fr/img/play_store_feature_graphic-v2.webp' }],
    },
  };
}

const dateFmt = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long' });

export default async function GroupInvitePage({ params }: PageProps) {
  const code = normalize((await params).code);
  const inv = await getInvite(code);
  const usable = inv.state === 'ok' || inv.state === 'unknown';
  const name = inv.group?.name ?? null;

  return (
    <main className={styles.page}>
      <div className={styles.wrap} style={{ paddingBottom: 48 }}>
        <Link href="/" className={styles.brand}>
          <Image src="/img/icon-v2.webp" alt="" width={28} height={28} />
          DishRank
        </Link>

        <section className={styles.invite}>
          {inv.group?.emoji && (
            <div className={styles.inviteEmoji} aria-hidden="true">
              {inv.group.emoji}
            </div>
          )}
          <h1 className={`${styles.display} ${styles.inviteTitle}`}>
            {name ?? (inv.state === 'missing' ? 'Invitation introuvable' : 'Rejoins le groupe')}
          </h1>

          {usable && (
            <p className={styles.inviteMeta}>
              {inv.inviter ? `${inv.inviter} t’invite dans ce groupe` : 'Tu as reçu une invitation pour un groupe DishRank'}
              {inv.members ? `, déjà ${inv.members} ${inv.members > 1 ? 'membres' : 'membre'}` : ''}. Ensemble, vous
              choisissez où sortir d’après les meilleurs plats du coin.
            </p>
          )}
          {inv.state === 'expired' && (
            <p className={styles.inviteMeta}>
              Cette invitation a expiré. Demande {inv.inviter ? `à ${inv.inviter}` : 'au groupe'} de t’en envoyer une
              nouvelle depuis l’app.
            </p>
          )}
          {inv.state === 'exhausted' && (
            <p className={styles.inviteMeta}>
              Cette invitation a déjà servi autant de fois que prévu. Demande{' '}
              {inv.inviter ? `à ${inv.inviter}` : 'au groupe'} un nouveau lien.
            </p>
          )}
          {inv.state === 'missing' && (
            <p className={styles.inviteMeta}>
              Ce lien d’invitation n’existe pas ou a été désactivé. Demande un nouveau lien à la personne qui te l’a
              envoyé.
            </p>
          )}

          {usable && (
            <>
              <div className={styles.codeBox}>
                <p className={styles.codeLabel}>Code d’invitation</p>
                <p className={`${styles.display} ${styles.code}`}>{code}</p>
                {inv.expiresAt && (
                  <p className={styles.codeLabel} style={{ marginTop: 8 }}>
                    Valable jusqu’au {dateFmt.format(new Date(inv.expiresAt))}
                  </p>
                )}
              </div>

              <div className={styles.btnRow}>
                <OpenAppButton path={`g/${code}`} />
              </div>

              <ol className={styles.steps}>
                <li>
                  Pas encore l’app ? Installe DishRank sur l’
                  <a className={styles.link} href={APP_STORE_URL}>
                    App Store
                  </a>{' '}
                  ou sur{' '}
                  <a className={styles.link} href={PLAY_STORE_URL}>
                    Google Play
                  </a>
                  .
                </li>
                <li>Reviens sur ce lien et touche « Rejoindre dans l’app ».</li>
                <li>
                  Si rien ne s’ouvre, saisis le code <strong className={styles.nowrap}>{code}</strong> dans l’app pour
                  rejoindre le groupe.
                </li>
              </ol>
            </>
          )}
        </section>
        {!usable && <AppFooter />}
      </div>
    </main>
  );
}
