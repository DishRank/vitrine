import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSharedOuting } from '@/lib/outing/server';
import { whenShort } from '@/lib/outing/format';
import OutingGuestView from './OutingGuestView';
import OutingUnavailable from './OutingUnavailable';

/**
 * /s/<jeton> — vote d'une sortie de groupe SANS compte.
 *
 * Lien partagé depuis l'app (« Inviter sans l'app ») : les amis qui n'ont pas
 * DishRank cochent les lieux qui leur vont ; le plus coché l'emporte. Le
 * serveur fait le premier rendu (et l'aperçu WhatsApp) ; le navigateur gère
 * ensuite le prénom, les votes et le rafraîchissement.
 */

interface PageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  const res = await getSharedOuting(token);
  if (res.kind !== 'ok') return { title: 'Sortie DishRank', robots: { index: false, follow: false } };

  const o = res.outing;
  const group = `${o.group.emoji ? `${o.group.emoji} ` : ''}${o.group.name}`;
  const title = o.planned_at ? `Sortie ${group} · ${whenShort(o.planned_at)}` : `Sortie ${group}`;
  const who = o.initiator_name ? `${o.initiator_name} propose` : 'Au choix';
  const names = o.candidates.filter((c) => c.section === 'top').slice(0, 3).map((c) => c.name);
  const description =
    o.status === 'decided' && o.winner
      ? `C’est décidé : ${o.winner.name}.`
      : names.length
        ? `${who} : ${names.join(', ')}… Coche les lieux qui te vont, sans installer d’app.`
        : 'Coche les lieux qui te vont, sans installer d’app.';

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
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function SharedOutingPage({ params }: PageProps) {
  const { token } = await params;
  const res = await getSharedOuting(token);
  if (res.kind === 'missing') notFound();
  if (res.kind === 'error') return <OutingUnavailable token={token} />;
  return <OutingGuestView token={token} initial={res.outing} />;
}
