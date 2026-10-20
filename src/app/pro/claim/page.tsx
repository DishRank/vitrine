import Link from 'next/link';
import { requireUser } from '@/lib/pro/data';
import { getSupabaseServer } from '@/lib/pro/supabaseServer';
import { UUID_RE } from '@/lib/pro/invite';
import ProHeader from '../_components/ProHeader';
import ClaimClient from './ClaimClient';
import type { RestaurantHit } from './claimActions';

export const metadata = { title: 'Revendiquer un établissement' };

// Retour autorisé après revendication : uniquement le tableau des allergènes
// (lien personnel, mig. 196). Tout autre chemin est ignoré.
const RETURN_RE = /^\/pro\/allergenes\/[A-Za-z0-9_-]{32}$/;

export default async function ClaimPage({
  searchParams,
}: {
  searchParams: Promise<{ r?: string; retour?: string }>;
}) {
  const { user } = await requireUser();
  const sp = await searchParams;

  // `?r=<id>` : arrivée depuis le lien « tableau des allergènes » → on saute la
  // recherche, l'établissement est déjà connu. Lecture publique (RLS SELECT).
  let initial: RestaurantHit | null = null;
  if (sp.r && UUID_RE.test(sp.r)) {
    const supabase = await getSupabaseServer();
    const { data } = await supabase
      .from('restaurants')
      .select('id, name, city, address, owner_id')
      .eq('id', sp.r)
      .maybeSingle();
    if (data) {
      const r = data as { id: string; name: string; city: string | null; address: string | null; owner_id: string | null };
      initial = { id: r.id, name: r.name, city: r.city, address: r.address, claimed: !!r.owner_id };
    }
  }
  const returnTo = sp.retour && RETURN_RE.test(sp.retour) ? sp.retour : undefined;

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <ProHeader email={user.email} />

      <div className="mt-6">
        <Link href="/pro/espace" className="text-xs font-semibold text-[var(--text3)] hover:text-[var(--text2)]">
          ← Mes établissements
        </Link>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Revendiquer votre établissement</h1>
        <p className="mt-1 text-sm text-[var(--text2)]">
          Trouvez votre établissement, prouvez que vous en êtes responsable, et gérez sa fiche, son
          menu et ses avis.
        </p>
      </div>

      <div className="mt-6">
        <ClaimClient initial={initial} returnTo={returnTo} />
      </div>
    </main>
  );
}
