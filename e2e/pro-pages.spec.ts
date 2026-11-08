import { expect, test, type Page } from '@playwright/test';
import { SEED, hasServiceRoleKey, jwtSub, serviceRpc, serviceSelect, serviceWrite, signIn } from './helpers/data';
import { watchPageErrors } from './helpers/pageErrors';
import { NO_PRO_SECRET, loginPro, proSecret } from './helpers/pro';

/**
 * Espace pro, page par page : pages publiques (présentation, comptes), garde
 * d'accès, lien « tableau des allergènes », puis, connecté (mot de passe + code),
 * chaque rubrique de l'établissement « Resto Pro Maestro » (seed). Les
 * modifications sont remises comme avant à la fin de chaque test.
 */
const RID = SEED.proRestaurantId;
const base = `/pro/r/${RID}`;

test.describe('sans compte', () => {
  // Les formulaires (mot de passe oublié, lien magique) sont plafonnés par IP et
  // par adresse : chaque passage se présente avec une IP et une adresse neuves
  // (x-real-ip, que Vercel pose en production, est lu par le serveur).
  test.use({ extraHTTPHeaders: { 'x-real-ip': `10.${Date.now() % 250}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` } });
  const unknownEmail = () => `personne-${Date.now()}@dishrank-integration.test`;

  test('présentation /pro : publique et indexable', async ({ page }) => {
    const res = await page.goto('/pro');
    expect(res?.status()).toBe(200);
    expect(res?.headers()['x-robots-tag']).toBe('index, follow');
    await expect(page.locator('h1')).toHaveText('Votre établissement, piloté au plat près.');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://dishrank.fr/pro');
  });

  for (const path of ['/pro/login', '/pro/signup', '/pro/reset']) {
    test(`${path} : hors index`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      expect(res?.headers()['x-robots-tag']).toBe('noindex, nofollow');
    });
  }

  for (const path of ['/pro/espace', '/pro/compte', '/pro/claim', '/pro/reset/update', `${base}/stats`, `${base}/avis?avis=negatifs`]) {
    test(`${path} : connexion demandée, retour prévu`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/pro\/login\?next=/);
      expect(new URL(page.url()).searchParams.get('next')).toBe(path);
    });
  }

  test('inscription : mot de passe trop faible refusé', async ({ page }) => {
    await page.goto('/pro/signup');
    await page.locator('#email').fill('personne-playwright@dishrank-integration.test');
    await page.locator('#password').fill('faible');
    await page.getByRole('button', { name: 'Créer mon compte' }).click();
    await expect(page.getByText(/Mot de passe trop faible/)).toBeVisible();
    await expect(page).toHaveURL(/\/pro\/signup/);
  });

  test('mot de passe oublié : même réponse que le compte existe ou non', async ({ page }) => {
    await page.goto('/pro/reset');
    // Adresse sans compte : aucun email n'est envoyé.
    await page.locator('#email').fill(unknownEmail());
    await page.getByRole('button', { name: 'Envoyer le lien' }).click();
    await expect(page.getByText(/Si un compte existe avec cet email, vous recevrez un lien/)).toBeVisible();
  });

  test('connexion par lien magique : même réponse que le compte existe ou non', async ({ page }) => {
    await page.goto('/pro/login');
    await page.getByRole('button', { name: 'Lien magique' }).click();
    await expect(page.getByRole('button', { name: 'Lien magique' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#password')).toHaveCount(0);
    // Adresse sans compte : le lien n'est pas créé (pas d'inscription par ce biais).
    await page.locator('#magic-email').fill(unknownEmail());
    await page.getByRole('button', { name: 'Recevoir un lien de connexion' }).click();
    await expect(page.getByText(/Si un compte existe avec cet email, vous recevrez un lien de connexion/)).toBeVisible();
  });
});

test.describe('tableau des allergènes (lien envoyé aux restaurants)', () => {
  test('lien invalide', async ({ page }) => {
    await page.goto('/pro/allergenes/abcdefghijabcdefghijabcdefghij12');
    await expect(page.getByRole('heading', { name: 'Ce lien n’est pas valide' })).toBeVisible();
    // Jeton mal formé : ce n'est plus une page publique.
    await page.goto('/pro/allergenes/court');
    await expect(page).toHaveURL(/\/pro\/login/);
  });

  test('lien valide : la carte du restaurant, sans compte', async ({ page }) => {
    test.skip(!hasServiceRoleKey, 'Clé secrète DEV absente : le jeton est créé par invite_create (réservé au serveur).');
    const campaign = `playwright-${Date.now()}`;
    const token = await serviceRpc<string>('invite_create', { p_restaurant_id: RID, p_email: null, p_campaign: campaign });
    try {
      const errors = watchPageErrors(page);
      await page.goto(`/pro/allergenes/${token}`);
      await expect(page.getByText(SEED.proRestaurantName).first()).toBeVisible();
      await expect(page.getByText('Burger Maestro').first()).toBeVisible();
      expect(errors).toEqual([]);
    } finally {
      await serviceWrite('DELETE', `restaurant_invites?campaign=eq.${campaign}`);
    }
  });
});

test.describe.serial('connecté', () => {
  test.skip(!proSecret, NO_PRO_SECRET);
  let page: Page;
  let errors: string[];
  const startedAt = new Date().toISOString();

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    errors = watchPageErrors(page);
    await loginPro(page);
  });
  test.afterAll(async () => {
    await page?.close();
  });
  test.afterEach(() => {
    expect(errors, 'erreurs dans la page').toEqual([]);
  });

  test('connexion journalisée après le code', async () => {
    test.skip(!hasServiceRoleKey, 'Clé secrète DEV absente : lecture de analytics_events impossible.');
    const proId = jwtSub(await signIn(SEED.pro));
    await expect
      .poll(async () => {
        const rows = await serviceSelect<{ id: string }[]>(
          `analytics_events?user_id=eq.${proId}&event_type=eq.pro_login&created_at=gte.${encodeURIComponent(startedAt)}&select=id`
        );
        return rows?.length ?? 0;
      })
      .toBeGreaterThan(0);
  });

  test('accueil de l’établissement', async () => {
    await page.goto('/pro/espace');
    await expect(page).toHaveURL(new RegExp(`${base}$`));
    await expect(page.getByRole('heading', { name: SEED.proRestaurantName })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Bien démarrer' })).toBeVisible();
    // Adresse tronquée : retour au tableau de bord, pas une 404.
    await page.goto('/pro/r');
    await expect(page).toHaveURL(new RegExp(`${base}$`));
  });

  test('fiche : modification enregistrée toute seule, puis remise', async () => {
    // Page hydratée avant de taper (en développement, l'hydratation est lente
    // et une saisie trop tôt n'est pas vue par l'enregistrement automatique).
    await page.goto(`${base}/fiche`, { waitUntil: 'networkidle' });
    const description = page.locator('#description');
    await expect(description).toBeVisible();
    const before = await description.inputValue();
    const marker = `Fiche testée par Playwright ${Date.now()}`;

    const saveOf = async (value: string) => {
      const response = page.waitForResponse(
        (r) => r.url().endsWith('/api/pro/listing') && r.request().method() === 'POST'
      );
      await page.locator('#description').fill(value);
      const r = await response;
      expect(r.ok()).toBe(true);
      expect(r.request().postDataJSON().description).toBe(value);
    };
    await saveOf(marker);
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('#description')).toHaveValue(marker);
    await saveOf(before);
  });

  test('apparence du menu', async () => {
    await page.goto(`${base}/menu/apparence`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Apparence du menu' })).toBeVisible();
    for (const h of ['Ambiance', "Couleur d'accent", 'Police', 'Logo', 'Photos des plats', 'Mes apparences']) {
      // Par le texte : les titres des blocs Premium verrouillés sont inertes,
      // donc hors de l'arbre d'accessibilité.
      await expect(page.locator('h3', { hasText: h }).first()).toBeVisible();
    }
    // Compte gratuit : ambiance, couleur et police sont réservées au Premium
    // (blocs inertes, comme dans l'appli). On vérifie donc le verrou, puis on
    // change un réglage gratuit : l'affichage des photos des plats.
    await expect(page.getByText('Personnalisation Premium')).toBeVisible();
    await expect(page.locator('section', { has: page.locator('h3', { hasText: 'Ambiance' }) })).toHaveAttribute('inert', '');
    test.skip(!hasServiceRoleKey, 'Clé secrète DEV absente : réglage non testé (impossible de remettre l’apparence d’origine).');
    const [row] = (await serviceSelect<{ menu_theme: unknown }[]>(`restaurants?id=eq.${RID}&select=menu_theme`)) ?? [];
    try {
      const save = page.waitForResponse((r) => r.url().endsWith('/api/pro/theme') && r.request().method() === 'POST');
      await page.getByRole('checkbox', { name: 'Afficher les photos des plats sur le menu' }).click();
      expect((await save).ok()).toBe(true);
      await expect
        .poll(async () => JSON.stringify((await serviceSelect<{ menu_theme: unknown }[]>(`restaurants?id=eq.${RID}&select=menu_theme`))?.[0]?.menu_theme))
        .not.toBe(JSON.stringify(row?.menu_theme));
    } finally {
      await serviceWrite('PATCH', `restaurants?id=eq.${RID}`, { menu_theme: row?.menu_theme ?? {} });
    }
  });
  test('partage : lien du menu et QR code', async () => {
    await page.goto(`${base}/partage`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Lien de votre menu' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'QR code de table' })).toBeVisible();
    const link = page.getByRole('textbox', { name: 'Lien de votre menu' });
    await expect(link).toHaveValue(new RegExp(`/menu/${RID}`));
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Télécharger le QR (PNG)' }).click();
    expect((await download).suggestedFilename()).toMatch(/\.png$/);
  });

  test('statistiques (offre gratuite)', async () => {
    await page.goto(`${base}/stats`);
    await expect(page.getByRole('heading', { name: 'Débloquez vos analytics' })).toBeVisible();
  });

  test('abonnement : paiement pas encore ouvert', async () => {
    await page.goto(`${base}/abonnement`);
    await expect(page.getByRole('heading', { name: 'Passer Premium' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Bientôt disponible' })).toBeDisabled();
  });

  test('notifications : ouvertes, marquées lues', async () => {
    await page.goto(base, { waitUntil: 'networkidle' });
    const bell = page.getByRole('button', { name: /^Notifications/ });
    // « Marquer lu » part en action serveur à l'ouverture : on attend sa réponse
    // avant de recharger (sinon, sous charge, le rechargement l'interrompt).
    const hadUnread = /non lue/.test((await bell.getAttribute('aria-label')) ?? '');
    const marked = hadUnread
      ? page.waitForResponse((r) => r.request().method() === 'POST' && !!r.request().headers()['next-action'])
      : null;
    await bell.click();
    await expect(bell).toHaveAttribute('aria-expanded', 'true');
    if (marked) await marked;
    await page.keyboard.press('Escape');
    await page.reload();
    await expect(page.getByRole('button', { name: /^Notifications/ })).not.toHaveAttribute('aria-label', /non lue/);
  });

  test('mon compte : adresse et rappels par email', async () => {
    await page.goto('/pro/compte', { waitUntil: 'networkidle' });
    await expect(page.locator('strong', { hasText: SEED.pro })).toBeVisible();
    const toggle = page.getByRole('switch');
    const before = (await toggle.getAttribute('aria-checked'))!;
    const flip = async (expected: string) => {
      await page.getByRole('switch').click();
      await expect(page.getByRole('switch')).toHaveAttribute('aria-checked', expected);
      // Bascule optimiste : on attend la fin de l'enregistrement (bouton réactivé).
      await expect(page.getByRole('switch')).toBeEnabled();
      await page.reload({ waitUntil: 'networkidle' });
      await expect(page.getByRole('switch')).toHaveAttribute('aria-checked', expected);
    };
    await flip(before === 'true' ? 'false' : 'true');
    await flip(before);
  });

  test('revendiquer : déjà pris ou à choisir', async () => {
    await page.goto('/pro/claim', { waitUntil: 'networkidle' });
    await page.locator('#q').fill(SEED.proRestaurantName);
    await page.getByRole('button', { name: 'Chercher' }).click();
    await expect(page.getByText('Déjà pris').first()).toBeVisible();
    await page.locator('#q').fill('Resto Maestro E2E');
    await page.getByRole('button', { name: 'Chercher' }).click();
    await page.getByText('Choisir →').first().click();
    // Étape suivante affichée ; rien n'est demandé tant que l'email n'est pas envoyé.
    await expect(page.getByText(/Pour prouver que vous êtes responsable/)).toBeVisible();
  });

  test('déconnexion', async () => {
    await page.goto(base);
    await page.getByRole('button', { name: 'Se déconnecter' }).first().click();
    await expect(page).toHaveURL(/\/pro\/login/);
    await page.goto('/pro/compte');
    await expect(page).toHaveURL(/\/pro\/login\?next=/);
  });
});