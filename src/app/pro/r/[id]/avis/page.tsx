import { requireOwnedRestaurant, isPremium, requireUser } from '@/lib/pro/data';
import ReviewCard, { type ProReview, type ProReply } from './ReviewCard';

export const metadata = { title: 'Avis' };

const PAGE_SIZE = 50;

export default async function ReviewsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resto = await requireOwnedRestaurant(id);
  const premium = isPremium(resto);
  const { supabase } = await requireUser();

  // Avis publiés (RLS SELECT publique) — les plus récents d'abord.
  const { data: reviewRows } = await supabase
    .from('reviews')
    .select('id, dish_name, comment, rating, verdict, photo_url, created_at, user_id')
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
  }>;

  // Auteurs (profiles publics) + réponses existantes, en 2 requêtes groupées.
  const userIds = [...new Set(reviews.map((r) => r.user_id))];
  const [{ data: profileRows }, { data: replyRows }] = await Promise.all([
    userIds.length
      ? supabase.from('profiles').select('id, display_name, avatar_url').in('id', userIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string | null; avatar_url: string | null }[] }),
    supabase
      .from('review_replies')
      .select('id, review_id, body, created_at, is_pinned')
      .eq('restaurant_id', id),
  ]);

  const profiles = new Map(
    ((profileRows ?? []) as { id: string; display_name: string | null; avatar_url: string | null }[]).map((p) => [p.id, p])
  );
  const replies = new Map<string, ProReply>(
    ((replyRows ?? []) as ProReply[]).map((r) => [r.review_id, r])
  );

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
  }));

  return (
    <div>
      <p className="mb-4 text-sm text-[var(--text2)]">
        Répondez publiquement aux avis de vos clients. Votre réponse apparaît sous l&apos;avis, signée
        du nom de votre établissement.
        {premium
          ? ' Vous pouvez épingler une réponse en haut de votre fiche.'
          : ' L’épinglage d’une réponse est réservé au forfait Premium.'}
      </p>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border2)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--text2)]">
          Aucun avis pour l&apos;instant. Ils apparaîtront ici dès que vos clients noteront un plat.
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((r) => (
            <li key={r.id}>
              <ReviewCard restaurantId={id} review={r} canPin={premium} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
