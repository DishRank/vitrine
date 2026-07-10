import { Metadata } from 'next';
import MenuBridge, { buildMenuMetadata } from '@/components/MenuBridge';

// Landing du QR de table (table-tents). Chemin volontairement HORS des
// app-links : l'app revendique `/restaurant*`, `/dish*`, `/review*`, `/join*`
// — mais PAS `/menu*`. L'OS n'intercepte donc jamais ce lien → le client voit
// toujours le menu numérique sur le web, même app installée, sans aucun
// redirect (allowAppRedirect=false). Voir components/MenuBridge.tsx.
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
  return <MenuBridge id={id} src={src} lang={lang} allowAppRedirect={false} />;
}
