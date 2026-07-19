import { requireUser } from '@/lib/pro/data';
import { getEditorMenus } from '../menu/menuData';
import { type ProReview, type ProReply, type MenuItemRef, type ReviewAssoc } from './ReviewCard';
import { type OrphanDish } from './OrphanWorklist';
import DishReviewsBoard from './DishReviewsBoard';

/**
 * Board des avis — ISOLÉ dans un composant async (enveloppé par un <Suspense>
 * côté page) : la lecture des avis + profils + réponses + menus + alias + RPC
 * orphelins, PUIS le regroupement par plat, streament pendant que le squelette
 * s'affiche. Les réglages « remerciement » + l'intro restent instantanés (page).
 */

const PAGE_SIZE = 50;
const norm = (s: string) => s.trim().toLowerCase();

/** Squelette (chrome instantané) — quelques groupes de plats attendus. */
export function ReviewsSkeleton() {
  const block = 'rounded-2xl border border-[var(--border2)] bg-[var(--surface)]';
  return (
    <div className="space-y-3 pro-swap">
      <div className={`${block} h-16`} />
      {[0, 1, 2].map((i) => (
        <div key={i} className={`${block} h-28`} />
      ))}
    </div>
  );
}

export default async function ReviewsContent({
  id,
  premium,
  thankTemplate,
  initialView,
  initialFilter,
}: {
  id: string;
  premium: boolean;
  thankTemplate: string;
  initialView?: 'dish' | 'list';
  initialFilter?: 'all' | 'unanswered' | 'negative' | 'positive';
}) {
  const { supabase } = await requireUser();

  // Avis publiés (RLS SELECT publique) — les plus récents d'abord.
  const { data: reviewRows } = await supabase
    .from('reviews')
    .select('id, dish_name, comment, rating, verdict, photo_url, created_at, user_id, menu_item_id')
    .eq('restaurant_id', id)
    .eq('pending_moderation', false)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);

  const reviews = (reviewRows ?? []) as Array<{
    id: string;
    dish_name: string | null;
    comment: string | null;
    rating: number | null;
    verdict: string | null;
    photo_url: string | null;
    created_at: string;
    user_id: string;
    menu_item_id: string | null;
  }>;

  const userIds = [...new Set(reviews.map((r) => r.user_id))];
  const [{ data: profileRows }, { data: replyRows }, editorMenus, { data: aliasRows }, { data: unmatchedRows }] =
    await Promise.all([
      userIds.length
        ? supabase.from('profiles').select('id, display_name, avatar_url').in('id', userIds)
        : Promise.resolve({ data: [] as { id: string; display_name: string | null; avatar_url: string | null }[] }),
      supabase.from('review_replies').select('id, review_id, body, created_at, is_pinned').eq('restaurant_id', id),
      getEditorMenus(id),
      supabase.from('menu_item_aliases').select('alias_norm, menu_item_id').eq('restaurant_id', id),
      supabase.rpc('get_unmatched_review_dishes', { p_restaurant_id: id }),
    ]);

  const profiles = new Map(
    ((profileRows ?? []) as { id: string; display_name: string | null; avatar_url: string | null }[]).map((p) => [p.id, p])
  );
  const replies = new Map<string, ProReply>(((replyRows ?? []) as ProReply[]).map((r) => [r.review_id, r]));

  // Plats visibles (cibles d'association, kind='item') + maps de RÉSOLUTION avis→plat.
  const menuItems: MenuItemRef[] = [];
  const visibleNameByNorm = new Map<string, string>(); // nom normalisé → nom canonique (item + formule visibles)
  const itemNameById = new Map<string, string>(); // id → nom (tous plats, incl. masqués)
  // Nom canonique → {id, photo} : sert à attacher la photo « mise en avant » et
  // l'id du plat à chaque groupe d'avis (les noms résolus SONT des item.name).
  const metaByName = new Map<string, { id: string; photoUrl: string | null }>();
  for (const m of editorMenus) {
    for (const s of m.sections) {
      const rows: { section: string; items: typeof s.items }[] = [
        { section: s.name, items: s.is_visible ? s.items : [] },
        ...s.children.map((c) => ({ section: `${s.name} › ${c.name}`, items: c.is_visible ? c.items : [] })),
      ];
      for (const it of [...s.items, ...s.children.flatMap((c) => c.items)]) {
        itemNameById.set(it.id, it.name);
        if (!metaByName.has(it.name)) metaByName.set(it.name, { id: it.id, photoUrl: it.photo_url });
      }
      for (const { section, items } of rows) {
        for (const it of items) {
          if (!it.is_visible) continue;
          visibleNameByNorm.set(norm(it.name), it.name);
          if (it.kind === 'item') menuItems.push({ id: it.id, name: it.name, section });
        }
      }
    }
  }
  const aliasNormToItemId = new Map(
    ((aliasRows ?? []) as { alias_norm: string; menu_item_id: string }[]).map((a) => [a.alias_norm, a.menu_item_id])
  );

  // Résolution avis → nom de plat CANONIQUE : lien explicite → nom exact → alias.
  // `null` = plat non reconnu (orphelin). Même précédence que l'agrégation (mig 113).
  const resolvedName = (r: ProReview): string | null => {
    if (r.menuItemId) return itemNameById.get(r.menuItemId) ?? 'Plat retiré du menu';
    const nm = norm(r.dishName ?? '');
    if (!nm) return null;
    const vis = visibleNameByNorm.get(nm);
    if (vis) return vis;
    const aid = aliasNormToItemId.get(nm);
    if (aid) return itemNameById.get(aid) ?? null;
    return null;
  };

  const assocFor = (r: (typeof reviews)[number]): ReviewAssoc => {
    if (r.menu_item_id) return { state: 'linked', linkedName: itemNameById.get(r.menu_item_id) ?? 'un plat' };
    const nm = norm(r.dish_name ?? '');
    if (nm && (visibleNameByNorm.has(nm) || aliasNormToItemId.has(nm))) return { state: 'matched' };
    return { state: 'orphan' };
  };

  const items: ProReview[] = reviews.map((r) => ({
    id: r.id,
    dishName: r.dish_name,
    comment: r.comment,
    rating: r.rating != null ? Number(r.rating) : null,
    verdict: r.verdict,
    photoUrl: r.photo_url,
    createdAt: r.created_at,
    authorName: profiles.get(r.user_id)?.display_name ?? 'Client',
    reply: replies.get(r.id) ?? null,
    menuItemId: r.menu_item_id,
    assoc: assocFor(r),
  }));

  // ── Regroupement par plat + catégorie « non reconnus » ──────────────────────
  const groupMap = new Map<string, ProReview[]>();
  const orphanReviews: ProReview[] = [];
  for (const it of items) {
    const name = resolvedName(it);
    if (name == null) {
      orphanReviews.push(it);
      continue;
    }
    const arr = groupMap.get(name);
    if (arr) arr.push(it);
    else groupMap.set(name, [it]);
  }
  const dishGroups = [...groupMap.entries()]
    .map(([name, revs]) => {
      const rated = revs.filter((r) => r.rating != null);
      const avg = rated.length ? rated.reduce((sum, r) => sum + (r.rating as number), 0) / rated.length : null;
      const unanswered = revs.filter((r) => !r.reply).length;
      const meta = metaByName.get(name) ?? null;
      return {
        name,
        reviews: revs,
        avg,
        unanswered,
        photoUrl: meta?.photoUrl ?? null, // photo du plat (vignette de la carte)
        reviewPhoto: revs.find((r) => r.photoUrl)?.photoUrl ?? null, // repli vignette
      };
    })
    // À traiter d'abord (des avis sans réponse), puis les plus commentés.
    .sort((a, b) => b.unanswered - a.unanswered || b.reviews.length - a.reviews.length || a.name.localeCompare(b.name));

  // « Avis en attente » = avis publiés sans réponse (groupes + orphelins), sur
  // la page courante (mêmes données que le reste du board).
  const pendingCount =
    dishGroups.reduce((s, g) => s + g.unanswered, 0) + orphanReviews.filter((r) => !r.reply).length;

  const orphans = (unmatchedRows ?? []) as OrphanDish[];

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border2)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--text2)] pro-swap">
        Aucun avis pour l&apos;instant. Ils apparaîtront ici dès que vos clients noteront un plat.
      </div>
    );
  }

  return (
    <div className="pro-swap">
      <DishReviewsBoard
        restaurantId={id}
        premium={premium}
        thankTemplate={thankTemplate}
        menuItems={menuItems}
        reviews={items}
        dishGroups={dishGroups}
        orphanReviews={orphanReviews}
        orphans={orphans}
        pendingCount={pendingCount}
        initialView={initialView}
        initialFilter={initialFilter}
      />
    </div>
  );
}
