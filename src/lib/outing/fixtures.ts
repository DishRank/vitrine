import type { Outing, OutingCandidate, OutingDish, OutingGuestSession, OutingStatus } from './types';

/**
 * Données de DÉMO pour développer la page /s/<jeton> sans la migration 202.
 * Actives uniquement hors production (cf. `isDemoToken`) : en build de prod,
 * `process.env.NODE_ENV` est inliné → les appels sont éliminés.
 *
 * Jetons : demo-active-xxxxxxxxxxxx, demo-decided-xxxxxxxxxxx,
 * demo-expired-xxxxxxxxxxx, demo-cancelled-xxxxxxxxx.
 */

export const isDemoToken = (token: string) =>
  process.env.NODE_ENV !== 'production' && token.startsWith('demo-');

const rid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const review = (name: string, rating: number, reviews: number, price: number | null): OutingDish => ({
  name, rating, reviews, price, photo_url: null, source: 'review',
});
const menu = (name: string, price: number | null): OutingDish => ({
  name, rating: null, reviews: 0, price, photo_url: null, source: 'menu',
});

type Seed = Omit<OutingCandidate,
  'rank' | 'section' | 'added_by' | 'approvals' | 'approvers' | 'mine' | 'photo_url' | 'photo_ref' |
  'google_place_id' | 'phone' | 'website' | 'reservation_url' | 'menu_url' | 'opening_hours_raw' | 'lat' | 'lng' | 'city'
> & Partial<OutingCandidate>;

const SEEDS: Seed[] = [
  { id: rid(1), name: 'Chez Mamie Lou', address: '12 rue d’Austerlitz', distance_km: 0.4, place_type: 'restaurant',
    cuisines: ['french', 'bistro'], open_at_planned: true, has_menu: true, price_median: 17,
    dishes: [review('Quenelle de brochet, sauce Nantua', 4.7, 14, 18), review('Tarte aux pralines', 4.5, 9, 7.5), menu('Œuf parfait aux champignons', 9)],
    phone: '04 78 00 00 01', website: 'chezmamielou.example', menu_url: 'https://dishrank.fr/menu/demo' },
  { id: rid(2), name: 'Trattoria Fiorella', address: '3 place Sathonay', distance_km: 0.9, place_type: 'restaurant',
    cuisines: ['italian', 'pizza'], open_at_planned: true, has_menu: true, price_median: 15,
    dishes: [review('Pizza burrata & mortadelle', 4.6, 22, 16), review('Tiramisu maison', 4.4, 11, 7)] },
  { id: rid(3), name: 'Sō Ramen', address: '41 rue de la Charité', distance_km: 1.3, place_type: 'restaurant',
    cuisines: ['japanese', 'ramen'], open_at_planned: null, has_menu: false, price_median: null,
    dishes: [review('Tonkotsu ramen', 4.3, 6, 14.5)] },
  { id: rid(4), name: 'La Cantine du Plateau', address: '8 rue d’Ivry', distance_km: 0.7, place_type: 'restaurant',
    cuisines: ['french'], open_at_planned: false, has_menu: true, price_median: 19,
    dishes: [menu('Saucisson brioché', 16), menu('Andouillette AAAAA', 18), menu('Cervelle de canut', 8)] },
  { id: rid(5), name: 'Banh Mi Côté Rue', address: '22 cours Gambetta', distance_km: 2.1, place_type: 'restaurant',
    cuisines: ['vietnamese'], open_at_planned: true, has_menu: true, price_median: 11,
    dishes: [review('Bánh mì porc caramel', 4.8, 31, 9), menu('Bò bún', 12.5)] },
  { id: rid(6), name: 'Le Comptoir des Canuts', address: '5 rue Dumenge', distance_km: 0.5, place_type: 'restaurant',
    cuisines: ['french'], open_at_planned: true, has_menu: false, price_median: null, dishes: [] },
  { id: rid(7), name: 'Mezze Beyrouth', address: '60 rue Mercière', distance_km: 2.6, place_type: 'restaurant',
    cuisines: ['lebanese'], open_at_planned: true, has_menu: true, price_median: 14,
    dishes: [review('Assiette mezze', 4.2, 5, 16)] },
  { id: rid(8), name: 'Burger Atelier', address: '14 quai Saint-Vincent', distance_km: 1.8, place_type: 'restaurant',
    cuisines: ['burger'], open_at_planned: true, has_menu: true, price_median: 15,
    dishes: [review('Smash burger double cheddar', 4.5, 18, 14)] },
  { id: rid(9), name: 'Taqueria Sol', address: '9 rue Paul Chenavard', distance_km: 1.6, place_type: 'restaurant',
    cuisines: ['mexican', 'tacos'], open_at_planned: null, has_menu: true, price_median: 12,
    dishes: [menu('Tacos al pastor (3)', 11)] },
  { id: rid(10), name: 'Curry House Tilak', address: '30 rue Saint-Jean', distance_km: 2.4, place_type: 'restaurant',
    cuisines: ['indian'], open_at_planned: true, has_menu: true, price_median: 13,
    dishes: [review('Butter chicken', 4.4, 12, 13.9)] },
];

const MEMBERS = ['Léa', 'Tom', 'Inès', 'Karim', 'Julie'];

function plannedIso(): { planned: string; deadline: string } {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 2);
  d.setUTCHours(18, 0, 0, 0); // 20:00 à Paris (heure d'été) / 19:00 (hiver)
  return { planned: d.toISOString(), deadline: new Date(d.getTime() - 2 * 3600_000).toISOString() };
}

/* Petite base locale pour simuler les invités et leurs votes (dev seulement). */
type DemoStore = { guests: { id: string; name: string; secret: string }[]; votes: { g: string; r: string }[] };
const memStore = new Map<string, DemoStore>();
function loadStore(token: string): DemoStore {
  const cached = memStore.get(token);
  if (cached) return cached;
  let s: DemoStore = { guests: [], votes: [] };
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(`dishrank:demo-store:${token}`) : null;
    if (raw) s = JSON.parse(raw) as DemoStore;
  } catch {}
  memStore.set(token, s);
  return s;
}
function saveStore(token: string, s: DemoStore) {
  memStore.set(token, s);
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(`dishrank:demo-store:${token}`, JSON.stringify(s));
  } catch {}
}

const MEMBER_VOTES: Record<string, string[]> = {
  Léa: [rid(1), rid(2)],
  Tom: [rid(2), rid(5)],
  Karim: [rid(1), rid(2), rid(3)],
};

export function demoOuting(token: string, guestId?: string | null, secret?: string | null): Outing | null {
  if (!isDemoToken(token)) return null;
  const status: OutingStatus = token.startsWith('demo-decided')
    ? 'decided'
    : token.startsWith('demo-expired')
      ? 'expired'
      : token.startsWith('demo-cancelled')
        ? 'abandoned'
        : 'active';
  const store = status === 'active' ? loadStore(token) : { guests: [], votes: [] };
  const me = store.guests.find((g) => g.id === guestId && g.secret === secret) ?? null;
  const { planned, deadline } = plannedIso();

  const voters = (r: string) => [
    ...MEMBERS.filter((m) => MEMBER_VOTES[m]?.includes(r)).map((name) => ({ name, avatar_url: null, kind: 'member' as const })),
    ...store.votes.filter((v) => v.r === r).map((v) => ({
      name: store.guests.find((g) => g.id === v.g)?.name ?? null, avatar_url: null, kind: 'guest' as const,
    })),
  ];

  const candidates: OutingCandidate[] = SEEDS.map((s, i) => {
    const approvers = voters(s.id);
    return {
      lat: 45.77 + i * 0.002, lng: 4.83 + i * 0.002, city: 'Lyon', photo_url: null, photo_ref: null, google_place_id: null,
      phone: null, website: null, reservation_url: null, menu_url: null, opening_hours_raw: null,
      ...s,
      rank: i + 1,
      section: i === 5 ? 'added' : i < 5 ? 'top' : 'more',
      added_by: i === 5 ? 'Inès' : null,
      approvals: approvers.length,
      approvers,
      mine: !!me && store.votes.some((v) => v.g === me.id && v.r === s.id),
    } as OutingCandidate;
  });

  const winnerSeed = candidates[1];
  return {
    id: '00000000-0000-4000-8000-0000000000aa',
    flow: 'v2',
    status,
    category: 'eat',
    planned_at: planned,
    vote_deadline: status === 'active' ? deadline : deadline,
    decided_at: status === 'decided' ? new Date().toISOString() : null,
    winner_id: status === 'decided' ? winnerSeed.id : null,
    center: { lat: 45.77, lng: 4.83, label: 'Croix-Rousse', from_group: token.includes('group') },
    group: { id: null, name: 'Les copains du jeudi', emoji: '🍷' },
    is_initiator: false,
    initiator_name: 'Léa',
    share_token: null,
    members: MEMBERS.map((name) => ({ id: null, name, avatar_url: null, voted: !!MEMBER_VOTES[name], is_me: false })),
    guests: store.guests.map((g) => ({
      name: g.name, voted: store.votes.some((v) => v.g === g.id), is_me: !!me && g.id === me.id,
    })),
    candidates,
    winner: status === 'decided'
      ? {
          id: winnerSeed.id, name: winnerSeed.name, address: winnerSeed.address, city: 'Lyon',
          lat: winnerSeed.lat, lng: winnerSeed.lng, phone: '04 78 00 00 02', website: 'https://example.com',
          reservation_url: 'https://example.com/reserver', menu_url: 'https://dishrank.fr/menu/demo', photo_url: null,
          photo_ref: null, google_place_id: null, approvals: 4, dishes: winnerSeed.dishes,
        }
      : null,
  };
}

export async function demoJoin(token: string, name: string): Promise<OutingGuestSession> {
  await new Promise((r) => setTimeout(r, 250));
  const clean = name.trim().replace(/\s+/g, ' ').slice(0, 40);
  if (!clean) throw new Error('Name required');
  const s = loadStore(token);
  const id = crypto.randomUUID();
  const secret = crypto.randomUUID().replace(/-/g, '');
  s.guests.push({ id, name: clean, secret });
  saveStore(token, s);
  return { guest_id: id, guest_secret: secret, outing: demoOuting(token, id, secret)! };
}

export async function demoToggle(token: string, guestId: string, secret: string, restaurantId: string): Promise<Outing> {
  await new Promise((r) => setTimeout(r, 300));
  if (restaurantId === rid(9) && token.includes('fail')) throw new Error('Failed to fetch');
  const s = loadStore(token);
  if (!s.guests.some((g) => g.id === guestId && g.secret === secret)) throw new Error('Invalid guest');
  const i = s.votes.findIndex((v) => v.g === guestId && v.r === restaurantId);
  if (i >= 0) s.votes.splice(i, 1);
  else s.votes.push({ g: guestId, r: restaurantId });
  saveStore(token, s);
  return demoOuting(token, guestId, secret)!;
}
