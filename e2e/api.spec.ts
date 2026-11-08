import { expect, test } from '@playwright/test';
import { SEED, signIn } from './helpers/data';

/**
 * Routes d'API du site, côté sécurité : sans secret ou sans session, elles
 * refusent ; avec une session, elles valident leurs entrées. Aucun appel
 * n'atteint un service payant (Google, SMTP, Stripe) : les clés ne sont pas
 * fournies au serveur de test.
 *
 * Les routes /api/debug/* sont coupées en production (VERCEL_ENV /
 * NODE_ENV === 'production', vérifié à la lecture du code) : pas testées ici,
 * le serveur de test tourne en développement.
 */
const UUID = '00000000-0000-4000-8000-000000000000';

test.describe('tâches planifiées : secret exigé', () => {
  for (const path of ['/api/cron/check-closures', '/api/cron/owner-digest']) {
    test(`${path} sans secret → 401`, async ({ request }) => {
      expect((await request.get(path)).status()).toBe(401);
      expect((await request.post(path)).status()).toBe(401);
      const wrong = await request.get(path, { headers: { Authorization: 'Bearer pas-le-secret' } });
      expect(wrong.status()).toBe(401);
    });
  }

  test('/api/cron/indexnow sans secret : refusé', async ({ request }) => {
    // 401 quand un secret est configuré ; 500 « aucun secret configuré » sinon
    // (échec fermé) — jamais exécuté.
    const res = await request.get('/api/cron/indexnow', { headers: { Authorization: 'Bearer pas-le-secret' } });
    expect([401, 500]).toContain(res.status());
  });

  test('/api/indexnow/submit sans secret : refusé', async ({ request }) => {
    const res = await request.post('/api/indexnow/submit', { data: { urls: ['https://dishrank.fr/'] } });
    expect([401, 500]).toContain(res.status());
  });
});

test('/api/stripe/webhook : une requête non signée n’est jamais traitée', async ({ request }) => {
  const res = await request.post('/api/stripe/webhook', {
    data: { type: 'customer.subscription.updated', data: { object: {} } },
  });
  if (res.status() === 200) {
    // Stripe non configuré sur ce serveur : accusé de réception sans traitement.
    expect(await res.json()).toMatchObject({ stripe: 'not_configured' });
  } else {
    expect(res.status()).toBe(400);
  }
});

test('/api/revalidate-menu : identifiant validé (route publique par choix)', async ({ request }) => {
  expect((await request.post('/api/revalidate-menu', { data: { restaurantId: 'pas-un-uuid' } })).status()).toBe(400);
  expect((await request.post('/api/revalidate-menu', { data: 'pas du json' })).status()).toBe(400);
  const ok = await request.post('/api/revalidate-menu', { data: { restaurantId: SEED.proRestaurantId } });
  expect(ok.status()).toBe(200);
});

test('/api/csp-report : accepte un rapport, refuse le reste', async ({ request }) => {
  const report = {
    'csp-report': {
      'document-uri': 'https://dishrank.fr/',
      'violated-directive': 'script-src',
      'blocked-uri': 'https://evil.example/x.js',
    },
  };
  const ok = await request.post('/api/csp-report', {
    data: report,
    headers: { 'Content-Type': 'application/csp-report' },
  });
  expect(ok.status()).toBe(200);
  const bad = await request.post('/api/csp-report', {
    data: '{pas du json',
    headers: { 'Content-Type': 'application/csp-report' },
  });
  expect(bad.status()).toBe(400);
  const big = await request.post('/api/csp-report', {
    data: 'x'.repeat(20 * 1024),
    headers: { 'Content-Type': 'application/csp-report' },
  });
  expect(big.status()).toBe(413);
});

test.describe('appelées par l’appli : session exigée', () => {
  const routes = [
    '/api/google/find-place',
    '/api/google/place-details',
    '/api/google/rating',
    '/api/osm/restaurants',
    '/api/osm/photos',
    '/api/support-ticket',
  ];
  for (const path of routes) {
    test(`${path} sans jeton → 401`, async ({ request }) => {
      expect((await request.post(path, { data: {} })).status()).toBe(401);
      const forged = await request.post(path, {
        data: {},
        headers: { Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwczovL2V2aWwuZXhhbXBsZSJ9.x' },
      });
      expect(forged.status()).toBe(401);
    });
  }

  test('avec une session : entrées validées', async ({ request }) => {
    const token = await signIn(SEED.alice);
    const auth = { Authorization: `Bearer ${token}` };
    // Pas d'identifiant de ticket → 400 ; ticket inconnu → 404.
    expect((await request.post('/api/support-ticket', { data: {}, headers: auth })).status()).toBe(400);
    expect((await request.post('/api/support-ticket', { data: { ticket_id: UUID }, headers: auth })).status()).toBe(404);
    // Note Google : identifiant de restaurant obligatoire et valide.
    const rating = await request.post('/api/google/rating', { data: { restaurant_id: 'x' }, headers: auth });
    // 400 (entrée refusée) ; 500 si la clé Google n'est pas configurée sur ce
    // serveur (contrôlée avant l'entrée) — jamais d'appel à Google.
    expect([400, 500]).toContain(rating.status());
    // OSM : zone trop grande refusée.
    const osm = await request.post('/api/osm/restaurants', {
      data: { north: 50, south: 40, east: 10, west: 0 },
      headers: auth,
    });
    expect(osm.status()).toBe(400);
  });
});

test.describe('espace pro : session propriétaire exigée', () => {
  for (const path of ['/api/pro/listing', '/api/pro/thanks', '/api/pro/theme']) {
    test(`${path} sans session → refusé`, async ({ request }) => {
      expect((await request.post(path, { data: {} })).status()).toBe(400);
      const res = await request.post(path, {
        data: { id: SEED.proRestaurantId, restaurantId: SEED.proRestaurantId, theme: { accent: '#AE8324' } },
      });
      expect(res.status()).toBe(403);
    });
  }

  test('/api/pro/theme/library sans session → refusé', async ({ request }) => {
    const res = await request.get(`/api/pro/theme/library?restaurantId=${SEED.proRestaurantId}`);
    expect([400, 403]).toContain(res.status());
  });

  test('/api/pro/email/unsubscribe : jeton invalide refusé', async ({ request }) => {
    const res = await request.get(`/api/pro/email/unsubscribe?u=${UUID}&t=faux`);
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });
});

test('/api/menu/rate : entrées invalides refusées', async ({ request }) => {
  const bad = await request.post('/api/menu/rate', { data: { restaurantId: 'x', menuItemId: 'y', stars: 9 } });
  expect(bad.status()).toBeGreaterThanOrEqual(400);
  expect(bad.status()).toBeLessThan(500);
  const notJson = await request.post('/api/menu/rate', { data: 'pas du json' });
  expect(notJson.status()).toBeGreaterThanOrEqual(400);
  expect(notJson.status()).toBeLessThan(500);
});

test('/api/menu/rate : requête valide sans jeton anti-robot → 403', async ({ request }) => {
  // Turnstile du menu actif sur le serveur de test (clés de test Cloudflare,
  // playwright.config.ts) : la requête s'arrête avant toute lecture en base.
  const res = await request.post('/api/menu/rate', {
    data: { restaurantId: UUID, menuItemId: UUID, stars: 5 },
  });
  expect(res.status()).toBe(403);
  expect((await res.json()).reason).toBe('verify');
});

test('/api/auth/confirm-email : lien sans jeton refusé', async ({ request }) => {
  expect((await request.get('/api/auth/confirm-email')).status()).toBe(400);
});