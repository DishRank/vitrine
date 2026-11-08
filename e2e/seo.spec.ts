import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { watchPageErrors } from './helpers/pageErrors';

/**
 * Pages publiques indexées (référencement) : statut, titre, URL canonique,
 * versions linguistiques (hreflang), directive robots, contenu principal, et
 * aucune erreur dans la page. Les adresses de restaurant viennent du sitemap
 * (données DEV), pour ne pas dépendre d'un nom figé.
 */
const SITE = 'https://dishrank.fr';
const HREFLANGS = ['fr-FR', 'en-US', 'es-ES', 'de-DE', 'it-IT', 'x-default'];

async function sitemapPaths(request: APIRequestContext): Promise<string[]> {
  const res = await request.get('/sitemap.xml');
  expect(res.status()).toBe(200);
  const xml = await res.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(SITE, '') || '/');
}

async function expectSeo(page: Page, path: string, opts: { hreflang?: boolean } = {}) {
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${SITE}${path === '/' ? '' : path}`);
  const robots = await page.locator('meta[name="robots"]').evaluateAll((els) => els.map((e) => e.getAttribute('content')));
  expect(robots).toEqual([expect.stringMatching(/^index/)]);
  const langs = await page.locator('link[rel="alternate"][hreflang]').evaluateAll((els) =>
    els.map((e) => e.getAttribute('hreflang'))
  );
  if (opts.hreflang === false) expect(langs).toEqual([]);
  else expect(langs.sort()).toEqual([...HREFLANGS].sort());
  expect((await page.title()).length).toBeGreaterThan(10);
}

test.describe('pages indexées', () => {
  let errors: string[];
  test.beforeEach(({ page }) => {
    errors = watchPageErrors(page);
  });
  test.afterEach(() => {
    expect(errors, 'erreurs dans la page').toEqual([]);
  });

  test('accueil', async ({ page }) => {
    const res = await page.goto('/');
    expect(res?.status()).toBe(200);
    await expectSeo(page, '/');
    await expect(page.locator('h1')).toContainText('Le meilleur plat');
    expect(await page.locator('script[type="application/ld+json"]').count()).toBeGreaterThan(0);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  });

  test('ville', async ({ page }) => {
    const res = await page.goto('/lyon');
    expect(res?.status()).toBe(200);
    await expectSeo(page, '/lyon');
    await expect(page.locator('h1')).toHaveText('Les meilleurs plats à Lyon');
    await expect(page).toHaveTitle(/Lyon/);
  });

  test('ville + catégorie', async ({ page }) => {
    const res = await page.goto('/lyon/burger');
    expect(res?.status()).toBe(200);
    await expectSeo(page, '/lyon/burger');
    await expect(page.locator('h1')).toHaveText(/burger à Lyon/i);
    await expect(page.getByRole('heading', { name: /classement du meilleur burger/i })).toBeVisible();
  });

  test('catégorie', async ({ page }) => {
    const res = await page.goto('/c/burger');
    expect(res?.status()).toBe(200);
    await expectSeo(page, '/c/burger');
    await expect(page.locator('h1')).toHaveText(/burger/i);
  });

  test('restaurant (pris dans le sitemap)', async ({ page, request }) => {
    const path = (await sitemapPaths(request)).find((p) => /^\/[a-z-]+\/r\/[a-z0-9-]+$/.test(p));
    expect(path, 'au moins un restaurant dans le sitemap').toBeTruthy();
    const res = await page.goto(path!);
    expect(res?.status()).toBe(200);
    await expectSeo(page, path!);
    await expect(page).toHaveTitle(/Tous les plats notés/);
    await expect(page.locator('h1')).not.toBeEmpty();
  });

  test('prix à Lyon (français seulement)', async ({ page }) => {
    const res = await page.goto('/prix-lyon');
    expect(res?.status()).toBe(200);
    await expectSeo(page, '/prix-lyon', { hreflang: false });
    await expect(page.locator('h1')).toHaveText('Combien coûte un plat à Lyon ?');
  });

  test('version anglaise : textes traduits', async ({ page }) => {
    const res = await page.goto('/en/lyon');
    expect(res?.status()).toBe(200);
    await expectSeo(page, '/en/lyon');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('h1')).toHaveText('The best dishes in Lyon');
    // Textes longtemps restés en français sur les pages traduites.
    await expect(page.getByText('Les derniers plats notés')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Ouvrir le menu' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Open menu' })).toHaveCount(1);
  });
});

test.describe('adresses inconnues : page introuvable, non indexée', () => {
  for (const path of ['/villeinexistante', '/c/categorie-inexistante', '/lyon/r/resto-inexistant-zz', '/lyon/c/azidessi', '/en/prix-lyon']) {
    test(path, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBe(404);
      // Toutes les consignes robots de la page disent noindex (aucune contradictoire).
      const robots = await page.locator('meta[name="robots"]').evaluateAll((els) => els.map((e) => e.getAttribute('content')));
      expect(robots.length).toBeGreaterThan(0);
      for (const r of robots) expect(r).toMatch(/noindex/);
    });
  }
});

test('anciennes adresses : redirection permanente', async ({ request }) => {
  const res = await request.get('/?ville=Lyon&categorie=burger', { maxRedirects: 0 });
  expect(res.status()).toBe(301);
  expect(res.headers()['location']).toMatch(/\/lyon\/burger$/);
  const fr = await request.get('/fr/lyon', { maxRedirects: 0 });
  expect([307, 308]).toContain(fr.status());
  expect(fr.headers()['location']).toMatch(/\/lyon$/);
});

test('robots.txt et sitemap', async ({ request }) => {
  const robots = await request.get('/robots.txt');
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toMatch(/Sitemap: https:\/\/dishrank\.fr\/sitemap\.xml/i);
  const paths = await sitemapPaths(request);
  expect(paths).toEqual(expect.arrayContaining(['/', '/lyon', '/pro', '/prix-lyon']));
  // Rien de privé dans le sitemap.
  expect(paths.filter((p) => /^\/(pro\/|api\/|menu\/|s\/|g\/|join\/|auth\/)/.test(p))).toEqual([]);
});