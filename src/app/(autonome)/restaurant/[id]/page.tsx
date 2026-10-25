import { Metadata } from 'next';
import MenuBridge, { buildMenuMetadata } from '@/components/MenuBridge';

// Cible app-link (AASA + intent Android revendiquent `/restaurant*`) : c'est
// la landing des PARTAGES resto et des anciens QR de table. App installée →
// l'OS ouvre la fiche in-app avant cette page ; sinon web via MenuBridge, avec
// pont deep-link discret (allowAppRedirect). Voir components/MenuBridge.tsx.
interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ src?: string; lang?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return buildMenuMetadata(id);
}

export default async function Page({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { src, lang } = await searchParams;
  return <MenuBridge id={id} src={src} lang={lang} allowAppRedirect />;
}
